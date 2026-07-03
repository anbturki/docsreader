use std::path::{Path, PathBuf};

use serde::Serialize;

use super::registry::{load_registry, upsert_workspace, WorkspaceEntry};
use super::{load_marker, save_marker, WorkspaceMarker, WorkspaceScope, MARKER_FILE};
use crate::error::{CoreError, ErrorCode};
use crate::slug::slugify;
use crate::write::DocStatus;

#[derive(Debug, Serialize)]
pub struct InitializedWorkspace {
    pub root: PathBuf,
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub scope: WorkspaceScope,
}

fn default_slug(root: &Path, scope: WorkspaceScope) -> String {
    if scope == WorkspaceScope::User {
        return super::resolve::DEFAULT_USER_SLUG.to_string();
    }
    let parent_name = root
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    slugify(&parent_name)
}

fn ensure_target_is_fresh(root: &Path) -> Result<(), CoreError> {
    if !root.exists() {
        return Ok(());
    }
    if load_marker(root)?.is_some() {
        return Err(CoreError::new(
            ErrorCode::Conflict,
            format!("{} is already a DocsReader workspace", root.display()),
        )
        .with_recovery("it is ready to use; call write_doc or list_workspaces"));
    }
    let has_content = std::fs::read_dir(root)?.next().is_some();
    if has_content {
        return Err(CoreError::new(
            ErrorCode::Conflict,
            format!(
                "{} already has content but no {MARKER_FILE}",
                root.display()
            ),
        )
        .with_recovery("pick an empty or new directory, or convert it in the DocsReader app"));
    }
    Ok(())
}

fn materialize_workspace(
    root: &Path,
    slug: String,
    name: Option<&str>,
    scope: WorkspaceScope,
    registry_file: &Path,
) -> Result<InitializedWorkspace, CoreError> {
    let marker = WorkspaceMarker {
        slug: slug.clone(),
        name: name.map(str::to_string),
        homepage: None,
    };
    save_marker(root, &marker)?;
    for status in DocStatus::ALL {
        std::fs::create_dir_all(root.join(status.folder()))?;
    }
    upsert_workspace(
        registry_file,
        WorkspaceEntry {
            slug: slug.clone(),
            path: root.to_path_buf(),
            scope,
        },
    )?;
    Ok(InitializedWorkspace {
        root: root.to_path_buf(),
        slug,
        name: name.map(str::to_string),
        scope,
    })
}

pub fn init_workspace_core(
    root: &Path,
    slug: Option<&str>,
    name: Option<&str>,
    scope: WorkspaceScope,
    registry_file: &Path,
) -> Result<InitializedWorkspace, CoreError> {
    ensure_target_is_fresh(root)?;
    let slug = match slug {
        Some(s) => s.to_string(),
        None => default_slug(root, scope),
    };
    materialize_workspace(root, slug, name, scope, registry_file)
}

/// Converts an existing folder of markdown into a managed workspace in place:
/// marker, status folders, registry entry. This is the GUI's answer to init's
/// "already has content" conflict; the slug derives from the folder name and
/// is suffixed if another registered workspace already uses it.
pub fn convert_workspace_core(
    root: &Path,
    registry_file: &Path,
) -> Result<InitializedWorkspace, CoreError> {
    if load_marker(root)?.is_some() {
        return Err(CoreError::new(
            ErrorCode::Conflict,
            format!("{} is already a DocsReader workspace", root.display()),
        )
        .with_recovery("it is ready to use as-is"));
    }
    let base = root
        .file_name()
        .and_then(|n| n.to_str())
        .map(slugify)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidInput,
                format!("cannot derive a workspace slug from {}", root.display()),
            )
        })?;
    let slug = free_slug(base, root, registry_file)?;
    materialize_workspace(root, slug, None, WorkspaceScope::Project, registry_file)
}

fn free_slug(base: String, root: &Path, registry_file: &Path) -> Result<String, CoreError> {
    let entries = load_registry(registry_file)?;
    let taken = |slug: &str| entries.iter().any(|e| e.slug == slug && e.path != root);
    if !taken(&base) {
        return Ok(base);
    }
    Ok((2..)
        .map(|n| format!("{base}-{n}"))
        .find(|candidate| !taken(candidate))
        .expect("unbounded suffix search always finds a free slug"))
}

#[cfg(test)]
mod tests {
    use super::super::test_dir;
    use super::*;

    #[test]
    fn init_creates_marker_status_folders_and_registers() {
        let dir = test_dir("init_ok");
        let root = dir.join("myrepo/notes");
        let registry = dir.join("registry.json");

        let ws =
            init_workspace_core(&root, None, None, WorkspaceScope::Project, &registry).unwrap();
        assert_eq!(ws.slug, "myrepo", "slug derives from parent folder");
        for folder in ["research", "in-progress", "done", "archived"] {
            assert!(root.join(folder).is_dir(), "missing {folder}");
        }
        assert!(load_marker(&root).unwrap().is_some());

        let entries = super::super::registry::load_registry(&registry).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].slug, "myrepo");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn init_on_existing_workspace_is_conflict() {
        let dir = test_dir("init_twice");
        let root = dir.join("notes");
        let registry = dir.join("registry.json");
        init_workspace_core(&root, None, None, WorkspaceScope::User, &registry).unwrap();

        let err =
            init_workspace_core(&root, None, None, WorkspaceScope::User, &registry).unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn convert_turns_populated_folder_into_workspace() {
        let dir = test_dir("convert_ok");
        let root = dir.join("my-notes");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("existing.md"), "# Hi\n").unwrap();
        let registry = dir.join("registry.json");

        let ws = convert_workspace_core(&root, &registry).unwrap();
        assert_eq!(ws.slug, "my-notes");
        assert_eq!(ws.scope, WorkspaceScope::Project);
        assert!(load_marker(&root).unwrap().is_some());
        for folder in ["research", "in-progress", "done", "archived"] {
            assert!(root.join(folder).is_dir(), "missing {folder}");
        }
        assert!(root.join("existing.md").is_file(), "content untouched");

        let err = convert_workspace_core(&root, &registry).unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict, "second convert conflicts");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn convert_suffixes_slug_taken_by_another_path() {
        let dir = test_dir("convert_dupe");
        let registry = dir.join("registry.json");
        let first = dir.join("a/notes");
        let second = dir.join("b/notes");
        std::fs::create_dir_all(&first).unwrap();
        std::fs::create_dir_all(&second).unwrap();

        assert_eq!(
            convert_workspace_core(&first, &registry).unwrap().slug,
            "notes"
        );
        assert_eq!(
            convert_workspace_core(&second, &registry).unwrap().slug,
            "notes-2"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn init_on_populated_non_workspace_dir_is_conflict() {
        let dir = test_dir("init_populated");
        let root = dir.join("stuff");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("existing.txt"), "x").unwrap();

        let err = init_workspace_core(
            &root,
            None,
            None,
            WorkspaceScope::Project,
            &dir.join("r.json"),
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
