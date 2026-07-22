use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

use super::WorkspaceScope;
use crate::error::{CoreError, ErrorCode};

pub const REGISTRY_DIR: &str = ".docsreader";
pub const REGISTRY_FILE: &str = "workspaces.json";

const LOCK_SUFFIX: &str = ".lock";
const TEMP_SUFFIX: &str = ".tmp";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceEntry {
    pub slug: String,
    pub path: PathBuf,
    pub scope: WorkspaceScope,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RegistryFile {
    workspaces: Vec<WorkspaceEntry>,
}

pub fn default_registry_path(home: &Path) -> PathBuf {
    home.join(REGISTRY_DIR).join(REGISTRY_FILE)
}

pub fn load_registry(file: &Path) -> Result<Vec<WorkspaceEntry>, CoreError> {
    let raw = match std::fs::read_to_string(file) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };
    let parsed: RegistryFile = serde_json::from_str(&raw).map_err(|e| {
        CoreError::new(
            ErrorCode::InvalidInput,
            format!("malformed workspace registry: {e}"),
        )
        .with_recovery(format!("delete or fix {}", file.display()))
    })?;
    Ok(parsed.workspaces)
}

fn sibling_path(file: &Path, suffix: &str) -> PathBuf {
    let mut name = file.file_name().unwrap_or_default().to_os_string();
    name.push(suffix);
    file.with_file_name(name)
}

/// Unique per writer so two concurrent saves cannot collide on the scratch file.
fn temp_path(file: &Path) -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    sibling_path(file, &format!(".{}.{seq}{TEMP_SUFFIX}", std::process::id()))
}

/// Rename instead of writing in place: a concurrent reader sees either the whole
/// old file or the whole new one, never a truncated one.
fn write_atomically(file: &Path, raw: &str) -> Result<(), CoreError> {
    let temp = temp_path(file);
    if let Err(e) = std::fs::write(&temp, raw) {
        let _ = std::fs::remove_file(&temp);
        return Err(e.into());
    }
    if let Err(e) = std::fs::rename(&temp, file) {
        let _ = std::fs::remove_file(&temp);
        return Err(e.into());
    }
    Ok(())
}

/// Advisory exclusive lock on a sidecar file, released when the handle drops.
/// The sidecar is never renamed, so every writer contends on the same inode.
struct RegistryLock(std::fs::File);

impl RegistryLock {
    fn acquire(file: &Path) -> Result<Self, CoreError> {
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let handle = std::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(sibling_path(file, LOCK_SUFFIX))?;
        handle.lock()?;
        Ok(Self(handle))
    }
}

impl Drop for RegistryLock {
    fn drop(&mut self) {
        let _ = self.0.unlock();
    }
}

pub fn save_registry(file: &Path, workspaces: &[WorkspaceEntry]) -> Result<(), CoreError> {
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(&RegistryFile {
        workspaces: workspaces.to_vec(),
    })
    .map_err(|e| CoreError::new(ErrorCode::Io, format!("serialize registry: {e}")))?;
    write_atomically(file, &raw)
}

/// Replaces any entry naming the same folder, so re-registering updates
/// slug/scope instead of adding a second entry for one workspace.
pub fn upsert_workspace(file: &Path, entry: WorkspaceEntry) -> Result<(), CoreError> {
    // Held across the whole load-modify-save: concurrent sidecars would otherwise
    // each read the same registry and the last save would drop the other entries.
    let _lock = RegistryLock::acquire(file)?;
    let mut workspaces = load_registry(file)?;
    workspaces.retain(|w| !same_folder(&w.path, &entry.path));
    workspaces.push(entry);
    save_registry(file, &workspaces)
}

/// The workspaces the registry can actually serve right now: entries whose
/// folder is still there, each carrying the slug that folder answers to.
///
/// The stored registry is left as the user has it: reconciliation happens on
/// the way out, never on disk.
pub fn live_workspaces(entries: Vec<WorkspaceEntry>) -> Vec<WorkspaceEntry> {
    let mut live: Vec<WorkspaceEntry> = Vec::new();
    for entry in entries.into_iter().filter(|w| w.path.is_dir()) {
        if live.iter().any(|kept| same_folder(&kept.path, &entry.path)) {
            continue;
        }
        live.push(with_marker_slug(entry));
    }
    live
}

/// A marker that is missing or unreadable leaves the recorded slug standing:
/// listing workspaces must not fail over one folder's damaged marker.
fn with_marker_slug(entry: WorkspaceEntry) -> WorkspaceEntry {
    match super::load_marker(&entry.path).ok().flatten() {
        Some(marker) => WorkspaceEntry {
            slug: marker.slug,
            ..entry
        },
        None => entry,
    }
}

/// Whether two paths name one folder: a symlink and its target, or a relative
/// and an absolute spelling, are the same workspace. Resolving a path needs it
/// to exist, so an entry whose folder is gone falls back to the literal
/// comparison rather than becoming an error.
pub fn same_folder(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_dir;
    use super::*;

    fn entry(slug: &str, path: &str, scope: WorkspaceScope) -> WorkspaceEntry {
        WorkspaceEntry {
            slug: slug.into(),
            path: PathBuf::from(path),
            scope,
        }
    }

    #[test]
    fn missing_registry_is_empty() {
        let dir = test_dir("reg_missing");
        assert_eq!(load_registry(&dir.join("nope.json")).unwrap(), Vec::new());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn upsert_round_trips_and_dedupes_by_path() {
        let dir = test_dir("reg_upsert");
        let file = dir.join(REGISTRY_FILE);
        upsert_workspace(&file, entry("notes", "/home/u/notes", WorkspaceScope::User)).unwrap();
        upsert_workspace(&file, entry("proj", "/repo/notes", WorkspaceScope::Project)).unwrap();
        upsert_workspace(
            &file,
            entry("renamed", "/repo/notes", WorkspaceScope::Project),
        )
        .unwrap();

        let entries = load_registry(&file).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].slug, "notes");
        assert_eq!(entries[1].slug, "renamed");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn live_workspaces_drops_missing_dirs() {
        let dir = test_dir("reg_existing");
        let present = dir.join("present");
        std::fs::create_dir_all(&present).unwrap();
        let entries = vec![
            WorkspaceEntry {
                slug: "here".into(),
                path: present.clone(),
                scope: WorkspaceScope::User,
            },
            entry("gone", "/no/such/workspace/dir", WorkspaceScope::Project),
        ];
        let kept = live_workspaces(entries);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].path, present);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn live_workspaces_list_a_folder_registered_twice_once() {
        let dir = test_dir("reg_double_listed");
        let real = dir.join("real/notes");
        std::fs::create_dir_all(&real).unwrap();
        let link = dir.join("link");
        std::os::unix::fs::symlink(dir.join("real"), &link).unwrap();

        let live = live_workspaces(vec![
            entry("acme", real.to_str().unwrap(), WorkspaceScope::Project),
            entry(
                "acme",
                link.join("notes").to_str().unwrap(),
                WorkspaceScope::Project,
            ),
        ]);
        assert_eq!(live.len(), 1, "one folder, one listing: {live:?}");
        assert_eq!(live[0].path, real);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn one_folder_spelled_two_ways_stays_one_entry() {
        let dir = test_dir("reg_same_folder");
        let file = dir.join(REGISTRY_FILE);
        let real = dir.join("real/notes");
        std::fs::create_dir_all(&real).unwrap();
        let link = dir.join("link");
        std::os::unix::fs::symlink(dir.join("real"), &link).unwrap();

        upsert_workspace(
            &file,
            WorkspaceEntry {
                slug: "first".into(),
                path: PathBuf::from(format!("{}/", real.display())),
                scope: WorkspaceScope::Project,
            },
        )
        .unwrap();
        upsert_workspace(
            &file,
            WorkspaceEntry {
                slug: "second".into(),
                path: real.clone(),
                scope: WorkspaceScope::Project,
            },
        )
        .unwrap();
        upsert_workspace(
            &file,
            WorkspaceEntry {
                slug: "third".into(),
                path: link.join("notes"),
                scope: WorkspaceScope::Project,
            },
        )
        .unwrap();

        let entries = load_registry(&file).unwrap();
        assert_eq!(entries.len(), 1, "one folder, one entry: {entries:?}");
        assert_eq!(entries[0].slug, "third");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn live_workspaces_take_their_slug_from_the_folder_marker() {
        let dir = test_dir("reg_marker_drift");
        let ws = dir.join("proj/notes");
        super::super::save_marker(
            &ws,
            &super::super::WorkspaceMarker {
                slug: "renamed-by-hand".into(),
                name: None,
                homepage: None,
            },
        )
        .unwrap();

        let live = live_workspaces(vec![WorkspaceEntry {
            slug: "stale".into(),
            path: ws.clone(),
            scope: WorkspaceScope::Project,
        }]);
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].slug, "renamed-by-hand");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn live_workspaces_keep_the_registry_slug_when_the_folder_has_no_usable_marker() {
        let dir = test_dir("reg_marker_absent");
        let bare = dir.join("bare");
        let broken = dir.join("broken");
        std::fs::create_dir_all(&bare).unwrap();
        std::fs::create_dir_all(&broken).unwrap();
        std::fs::write(
            broken.join(super::super::MARKER_FILE),
            "slug: \"Not A Slug\"",
        )
        .unwrap();

        let live = live_workspaces(vec![
            entry("bare", bare.to_str().unwrap(), WorkspaceScope::Project),
            entry("broken", broken.to_str().unwrap(), WorkspaceScope::Project),
        ]);
        assert_eq!(
            live.iter().map(|w| w.slug.as_str()).collect::<Vec<_>>(),
            ["bare", "broken"]
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_registry_naming_a_missing_folder_still_loads() {
        let dir = test_dir("reg_missing_folder");
        let file = dir.join(REGISTRY_FILE);
        let present = dir.join("present");
        std::fs::create_dir_all(&present).unwrap();
        save_registry(
            &file,
            &[
                entry("gone", "/no/such/workspace/dir", WorkspaceScope::Project),
                entry("here", present.to_str().unwrap(), WorkspaceScope::User),
            ],
        )
        .unwrap();

        let loaded = load_registry(&file).unwrap();
        assert_eq!(loaded.len(), 2, "the stored registry is left intact");
        let live = live_workspaces(loaded);
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].slug, "here");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn concurrent_upserts_keep_every_entry() {
        const WRITERS: usize = 8;
        let dir = test_dir("reg_concurrent");
        let file = dir.join(REGISTRY_FILE);
        std::thread::scope(|scope| {
            for i in 0..WRITERS {
                let file = file.clone();
                scope.spawn(move || {
                    upsert_workspace(
                        &file,
                        entry(
                            &format!("ws{i}"),
                            &format!("/repo/ws{i}"),
                            WorkspaceScope::Project,
                        ),
                    )
                    .unwrap();
                });
            }
        });

        let mut slugs: Vec<String> = load_registry(&file)
            .unwrap()
            .into_iter()
            .map(|w| w.slug)
            .collect();
        slugs.sort();
        let expected: Vec<String> = (0..WRITERS).map(|i| format!("ws{i}")).collect();
        assert_eq!(slugs, expected);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn save_leaves_no_temp_files() {
        let dir = test_dir("reg_notemp");
        let file = dir.join(REGISTRY_FILE);
        save_registry(
            &file,
            &[entry("notes", "/home/u/notes", WorkspaceScope::User)],
        )
        .unwrap();

        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .filter(|name| name.to_string_lossy().ends_with(TEMP_SUFFIX))
            .collect();
        assert!(leftovers.is_empty(), "leftover temp files: {leftovers:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn malformed_registry_is_typed_error() {
        let dir = test_dir("reg_bad");
        let file = dir.join(REGISTRY_FILE);
        std::fs::write(&file, "not json").unwrap();
        assert_eq!(
            load_registry(&file).unwrap_err().code,
            ErrorCode::InvalidInput
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
