use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use walkdir::{DirEntry, WalkDir};

const PROGRESS_EVENT: &str = "scan-progress";
const PROGRESS_INTERVAL_MS: u64 = 100;
const MAX_FILES: usize = 50_000;
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const PARTIAL_READ_BYTES: usize = 16 * 1024;

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
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DocsYamlProject {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tagline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DocsYamlNavItem {
    Markdown {
        title: String,
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        slug: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        badge: Option<String>,
    },
    OpenApi {
        title: String,
        openapi: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        slug: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        badge: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DocsYamlNavSection {
    Items {
        title: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        collapsed: Option<bool>,
        items: Vec<DocsYamlNavItem>,
    },
    Folder {
        title: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        collapsed: Option<bool>,
        folder: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sort: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        direction: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        title_from: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pattern: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        nested: Option<bool>,
    },
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DocsYaml {
    #[serde(default, rename = "spec_version", skip_serializing_if = "Option::is_none")]
    pub spec_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<DocsYamlProject>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub navigation: Vec<DocsYamlNavSection>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ignore: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visibility: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub root: String,
    pub files: Vec<MarkdownFile>,
    pub truncated: bool,
    #[serde(default, rename = "docsYaml", skip_serializing_if = "Option::is_none")]
    pub docs_yaml: Option<DocsYaml>,
    #[serde(default, rename = "docsYamlError", skip_serializing_if = "Option::is_none")]
    pub docs_yaml_error: Option<String>,
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

fn extract_frontmatter(content: &str) -> Option<&str> {
    let trimmed = content.trim_start_matches('\u{feff}').trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let after = &trimmed[3..];
    let nl_idx = after.find('\n')?;
    let body = &after[nl_idx + 1..];
    let end = body.find("\n---")?;
    Some(&body[..end])
}

fn extract_first_heading(content: &str) -> Option<String> {
    for line in content.lines().take(120) {
        let line = line.trim_start();
        if let Some(rest) = line.strip_prefix("# ") {
            return Some(rest.trim().to_string());
        }
    }
    None
}

fn parse_meta(content: &str) -> (Option<String>, Vec<String>) {
    let mut title: Option<String> = None;
    let mut tags: Vec<String> = Vec::new();

    if let Some(fm) = extract_frontmatter(content) {
        if let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(fm) {
            if let Some(map) = value.as_mapping() {
                if let Some(t) = map.get(serde_yaml::Value::String("title".into())) {
                    if let Some(s) = t.as_str() {
                        title = Some(s.to_string());
                    }
                }
                if let Some(tg) = map.get(serde_yaml::Value::String("tags".into())) {
                    if let Some(seq) = tg.as_sequence() {
                        for v in seq {
                            if let Some(s) = v.as_str() {
                                tags.push(s.to_string());
                            }
                        }
                    } else if let Some(s) = tg.as_str() {
                        tags.extend(
                            s.split(',')
                                .map(|t| t.trim().to_string())
                                .filter(|t| !t.is_empty()),
                        );
                    }
                }
            }
        }
    }

    if title.is_none() {
        title = extract_first_heading(content);
    }

    (title, tags)
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
    "build",
    ".gradle",
    "DerivedData",
];

fn is_skipped_dir(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    SKIP_DIRS.contains(&name)
}

fn is_markdown(name: &str) -> bool {
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

fn load_docs_yaml(root: &Path) -> (Option<DocsYaml>, Option<String>) {
    for name in [".docs.yaml", "docs.yaml"] {
        let p = root.join(name);
        if !p.exists() {
            continue;
        }
        return match std::fs::read_to_string(&p) {
            Ok(s) => match serde_yaml::from_str::<DocsYaml>(&s) {
                Ok(parsed) => (Some(parsed), None),
                Err(e) => (None, Some(format!("{}: {}", name, e))),
            },
            Err(e) => (None, Some(format!("{}: {}", name, e))),
        };
    }
    (None, None)
}

#[tauri::command]
async fn scan_markdown(app: AppHandle, path: String) -> Result<ScanResult, String> {
    let app_clone = app.clone();
    let path_for_task = path.clone();
    tauri::async_runtime::spawn_blocking(move || run_scan(app_clone, path_for_task))
        .await
        .map_err(|e| format!("scan task panicked: {}", e))?
}

fn run_scan(app: AppHandle, path: String) -> Result<ScanResult, String> {
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
                &app,
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

            let count = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
            maybe_emit_read_progress(
                &app,
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
            })
        })
        .collect();

    files.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));

    let _ = app.emit(
        PROGRESS_EVENT,
        ScanProgress {
            root: path.clone(),
            current_dir: ".".to_string(),
            files_found: files.len() as u64,
            dirs_visited: dirs_visited.load(Ordering::Relaxed),
            last_file: None,
        },
    );

    let (docs_yaml, docs_yaml_error) = load_docs_yaml(root_path);

    Ok(ScanResult {
        root: root_path.to_string_lossy().to_string(),
        files,
        truncated,
        docs_yaml,
        docs_yaml_error,
    })
}

fn maybe_emit_walk_progress(
    app: &AppHandle,
    root: &str,
    current: &Path,
    root_path: &Path,
    dirs_visited: &AtomicU64,
    files_found: u64,
    last_file: Option<String>,
    last_emit: &Mutex<Instant>,
) {
    {
        let mut guard = match last_emit.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if guard.elapsed() < Duration::from_millis(PROGRESS_INTERVAL_MS) {
            return;
        }
        *guard = Instant::now();
    }
    let rel = current
        .strip_prefix(root_path)
        .unwrap_or(current)
        .to_string_lossy()
        .to_string();
    let _ = app.emit(
        PROGRESS_EVENT,
        ScanProgress {
            root: root.to_string(),
            current_dir: if rel.is_empty() { ".".into() } else { rel },
            files_found,
            dirs_visited: dirs_visited.load(Ordering::Relaxed),
            last_file,
        },
    );
}

fn maybe_emit_read_progress(
    app: &AppHandle,
    root: &str,
    files_found: u64,
    total: u64,
    last_file: Option<String>,
    last_emit: &Mutex<Instant>,
) {
    {
        let mut guard = match last_emit.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if guard.elapsed() < Duration::from_millis(PROGRESS_INTERVAL_MS) {
            return;
        }
        *guard = Instant::now();
    }
    let _ = app.emit(
        PROGRESS_EVENT,
        ScanProgress {
            root: root.to_string(),
            current_dir: format!("reading {} of {}", files_found, total),
            files_found,
            dirs_visited: 0,
            last_file,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_v01_manifest_with_mixed_sections() {
        let yaml = r##"
spec_version: "0.1"
project:
  slug: voice
  name: Vinfra Voice
  tagline: Carrier-grade VoIP for MENA
  scope: L1
  icon: phone
  homepage: docs/spec/architecture.md
navigation:
  - title: Start here
    items:
      - title: Architecture overview
        path: docs/spec/architecture.md
      - title: Operating contract
        path: docs/CONTRACT.md
        badge: live
  - title: Architecture decisions
    folder: docs/adr/
    sort: filename
    title_from: heading
  - title: Build curriculum
    folder: docs/phases/
    nested: true
ignore:
  - docs/archived/**
  - "**/*.draft.md"
visibility: internal
"##;
        let parsed: DocsYaml = serde_yaml::from_str(yaml).expect("should parse");
        let project = parsed.project.expect("project required");
        assert_eq!(project.slug.as_deref(), Some("voice"));
        assert_eq!(project.name.as_deref(), Some("Vinfra Voice"));
        assert_eq!(parsed.navigation.len(), 3);
        assert_eq!(parsed.ignore.len(), 2);

        let (mut items, mut folder) = (false, false);
        for s in &parsed.navigation {
            match s {
                DocsYamlNavSection::Items { .. } => items = true,
                DocsYamlNavSection::Folder { .. } => folder = true,
            }
        }
        assert!(items && folder, "both section kinds match");
    }

    #[test]
    fn ignores_unknown_top_level_fields() {
        let yaml = r##"
spec_version: "0.1"
project:
  slug: x
  name: X
navigation:
  - title: T
    folder: docs/
api_reference:
  openapi: api.yaml
versions:
  current: a
  supported: [a]
theme:
  primary_color: "#000"
metadata:
  team: t
"##;
        let parsed: DocsYaml = serde_yaml::from_str(yaml).expect("should parse with extras");
        assert_eq!(parsed.navigation.len(), 1);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![scan_markdown])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
