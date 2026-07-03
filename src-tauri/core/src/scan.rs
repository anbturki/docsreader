use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use walkdir::{DirEntry, WalkDir};

use crate::frontmatter::{parse_doc_meta, split_frontmatter};
use crate::workspace::migrate::marker_with_migration;
use crate::workspace::WorkspaceMarker;

const PROGRESS_INTERVAL_MS: u64 = 100;
const MAX_FILES: usize = 50_000;
pub const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const PARTIAL_READ_BYTES: usize = 16 * 1024;
const MAX_HEADING_SCAN_LINES: usize = 120;

pub trait ScanProgressSink: Send + Sync {
    fn emit(&self, progress: &ScanProgress);
}

pub struct NoopProgressSink;

impl ScanProgressSink for NoopProgressSink {
    fn emit(&self, _progress: &ScanProgress) {}
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MarkdownFile {
    pub path: String,
    pub name: String,
    #[serde(rename = "relPath")]
    pub rel_path: String,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub modified: Option<u64>,
    pub size: u64,
    // Workspace-relative markdown files this doc links to. Extracted from
    // the same partial read as title/tags, so links beyond the first 16 KiB
    // are not seen. Backs the backlinks pane in the GUI.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub root: String,
    pub files: Vec<MarkdownFile>,
    pub truncated: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marker: Option<WorkspaceMarker>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub root: String,
    #[serde(rename = "currentDir")]
    pub current_dir: String,
    #[serde(rename = "filesFound")]
    pub files_found: u64,
    #[serde(rename = "dirsVisited")]
    pub dirs_visited: u64,
    #[serde(rename = "lastFile")]
    pub last_file: Option<String>,
}

fn extract_first_heading(content: &str) -> Option<String> {
    for line in content.lines().take(MAX_HEADING_SCAN_LINES) {
        let line = line.trim_start();
        if let Some(rest) = line.strip_prefix("# ") {
            return Some(rest.trim().to_string());
        }
    }
    None
}

fn parse_meta(content: &str) -> (Option<String>, Vec<String>) {
    let (fm, _) = split_frontmatter(content);
    let meta = fm.map(parse_doc_meta).unwrap_or_default();
    let title = meta.title.or_else(|| extract_first_heading(content));
    (title, meta.tags)
}

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "target",
    ".git",
    ".next",
    "dist",
    "build",
    ".venv",
    "venv",
    ".cache",
    ".turbo",
    ".vercel",
    ".idea",
    ".vscode",
    "Library",
    "Applications",
    "System",
    "Pictures",
    "Movies",
    "Music",
    ".Trash",
    ".npm",
    ".yarn",
    ".pnpm-store",
    ".cargo",
    ".rustup",
    ".bun",
    ".local",
    "Pods",
    ".gradle",
    "DerivedData",
];

fn is_skipped_dir(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    SKIP_DIRS.contains(&name)
}

pub(crate) fn is_markdown(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx")
}

fn read_partial(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut buf = vec![0u8; PARTIAL_READ_BYTES];
    let n = file.read(&mut buf)?;
    buf.truncate(n);
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

pub fn run_scan(progress: &dyn ScanProgressSink, path: String) -> Result<ScanResult, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let dirs_visited = Arc::new(AtomicU64::new(0));
    let last_emit = Arc::new(Mutex::new(Instant::now()));

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut truncated = false;

    let walker = WalkDir::new(root_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !is_skipped_dir(&name)
            } else {
                !name.starts_with('.')
            }
        });

    for entry in walker.filter_map(|e| e.ok()) {
        if entry.file_type().is_dir() {
            dirs_visited.fetch_add(1, Ordering::Relaxed);
            maybe_emit_walk_progress(
                progress,
                &path,
                entry.path(),
                root_path,
                &dirs_visited,
                0,
                None,
                &last_emit,
            );
            continue;
        }

        if !entry.file_type().is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        if !is_markdown(&name) {
            continue;
        }

        if let Ok(meta) = entry.metadata() {
            if meta.len() > MAX_FILE_BYTES {
                continue;
            }
        }

        if entries.len() >= MAX_FILES {
            truncated = true;
            break;
        }
        entries.push(entry);
    }

    let total_to_read = entries.len() as u64;
    let files_processed = Arc::new(AtomicU64::new(0));

    let mut files: Vec<MarkdownFile> = entries
        .par_iter()
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let size = metadata.len();
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            let content = read_partial(entry.path()).ok()?;
            let (title, tags) = parse_meta(&content);

            let rel_path = entry
                .path()
                .strip_prefix(root_path)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string();

            let links = crate::links::links_from(&content, &rel_path);

            let count = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
            maybe_emit_read_progress(
                progress,
                &path,
                count,
                total_to_read,
                Some(rel_path.clone()),
                &last_emit,
            );

            Some(MarkdownFile {
                path: entry.path().to_string_lossy().to_string(),
                name: entry
                    .path()
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                rel_path,
                title,
                tags,
                modified,
                size,
                links,
            })
        })
        .collect();

    files.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));

    progress.emit(&ScanProgress {
        root: path.clone(),
        current_dir: ".".to_string(),
        files_found: files.len() as u64,
        dirs_visited: dirs_visited.load(Ordering::Relaxed),
        last_file: None,
    });

    // Best-effort: a broken marker must not stop the GUI from browsing the
    // folder; the MCP path fails loud through resolve_workspace instead.
    let marker = marker_with_migration(root_path).ok().flatten();

    Ok(ScanResult {
        root: root_path.to_string_lossy().to_string(),
        files,
        truncated,
        marker,
    })
}

fn should_emit(last_emit: &Mutex<Instant>) -> bool {
    let mut guard = match last_emit.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    if guard.elapsed() < Duration::from_millis(PROGRESS_INTERVAL_MS) {
        return false;
    }
    *guard = Instant::now();
    true
}

#[allow(clippy::too_many_arguments)]
fn maybe_emit_walk_progress(
    progress: &dyn ScanProgressSink,
    root: &str,
    current: &Path,
    root_path: &Path,
    dirs_visited: &AtomicU64,
    files_found: u64,
    last_file: Option<String>,
    last_emit: &Mutex<Instant>,
) {
    if !should_emit(last_emit) {
        return;
    }
    let rel = current
        .strip_prefix(root_path)
        .unwrap_or(current)
        .to_string_lossy()
        .to_string();
    progress.emit(&ScanProgress {
        root: root.to_string(),
        current_dir: if rel.is_empty() { ".".into() } else { rel },
        files_found,
        dirs_visited: dirs_visited.load(Ordering::Relaxed),
        last_file,
    });
}

fn maybe_emit_read_progress(
    progress: &dyn ScanProgressSink,
    root: &str,
    files_found: u64,
    total: u64,
    last_file: Option<String>,
    last_emit: &Mutex<Instant>,
) {
    if !should_emit(last_emit) {
        return;
    }
    progress.emit(&ScanProgress {
        root: root.to_string(),
        current_dir: format!("reading {} of {}", files_found, total),
        files_found,
        dirs_visited: 0,
        last_file,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::test_dir;

    #[test]
    fn scan_migrates_legacy_manifest_and_reports_marker() {
        let dir = test_dir("scan_migrates");
        std::fs::write(
            dir.join(".docs.yaml"),
            "project:\n  slug: voice\n  name: Vinfra Voice\n  tagline: dropped\n",
        )
        .unwrap();
        std::fs::write(dir.join("readme.md"), "# Hi\n").unwrap();

        let result = run_scan(&NoopProgressSink, dir.to_string_lossy().to_string()).unwrap();
        let marker = result.marker.expect("marker migrated during scan");
        assert_eq!(marker.slug, "voice");
        assert_eq!(marker.name.as_deref(), Some("Vinfra Voice"));
        assert!(dir.join(".docsreader.yaml").is_file());
        assert!(dir.join(".docs.yaml").is_file());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_collects_resolved_relative_links() {
        let dir = test_dir("scan_links");
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(
            dir.join("sub/source.md"),
            "# Src\nSee [target](../target.md) and [web](https://x.com/a.md).\n",
        )
        .unwrap();
        std::fs::write(dir.join("target.md"), "# Target\n").unwrap();

        let result = run_scan(&NoopProgressSink, dir.to_string_lossy().to_string()).unwrap();
        let source = result
            .files
            .iter()
            .find(|f| f.rel_path.ends_with("source.md"))
            .unwrap();
        assert_eq!(source.links, ["target.md"]);
        let target = result
            .files
            .iter()
            .find(|f| f.rel_path == "target.md")
            .unwrap();
        assert!(target.links.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
