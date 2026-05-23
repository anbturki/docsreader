use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};
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

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsYamlCrossLink {
    pub project: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub contexts: Vec<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DocsYaml {
    #[serde(default, rename = "spec_version", skip_serializing_if = "Option::is_none")]
    pub spec_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<DocsYamlProject>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub navigation: Vec<DocsYamlNavSection>,
    #[serde(default, rename = "cross_links", skip_serializing_if = "Vec::is_empty")]
    pub cross_links: Vec<DocsYamlCrossLink>,
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

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn install_welcome_workspace(app: AppHandle) -> Result<String, String> {
    let src = app
        .path()
        .resolve("resources/welcome", BaseDirectory::Resource)
        .map_err(|e| format!("could not resolve welcome resource: {e}"))?;
    if !src.exists() {
        return Err(format!(
            "welcome resource not found at {} - in dev mode, ensure src-tauri/resources/welcome exists; in a packaged build, ensure tauri.conf.json bundle.resources includes resources/welcome/**/*",
            src.display()
        ));
    }
    let dst_root = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let dst = dst_root.join("welcome");

    if !dst.exists() {
        copy_dir_recursive(&src, &dst).map_err(|e| {
            format!("copy welcome from {} to {}: {e}", src.display(), dst.display())
        })?;
    }

    Ok(dst.to_string_lossy().to_string())
}

// ─── Git integration ────────────────────────────────────────────────────────
//
// We shell out to git for status and HEAD-content lookups. Three reasons
// over a Rust git library: zero binary weight, no runtime dependency on
// libgit2 in the bundle, and the user's installed git always understands
// the user's repo. Workspaces without a `.git` (or without git installed)
// silently skip git decorations. Commands run via tokio::process so the
// async runtime isn't blocked, with a per-call timeout so a hung git
// can't stall other Tauri commands indefinitely.

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    #[serde(default, rename = "originalPath", skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub root: String,
    pub files: Vec<GitFileStatus>,
}

const GIT_TIMEOUT: Duration = Duration::from_secs(30);

// Find the git executable. PATH on a GUI-launched macOS app is typically
// minimal (no Homebrew dirs), so we probe a small set of common
// install locations as a fallback. Cached after the first lookup.
fn git_binary() -> Option<&'static str> {
    static CACHED: OnceLock<Option<&'static str>> = OnceLock::new();
    *CACHED.get_or_init(|| {
        const CANDIDATES: &[&str] = &[
            "git",
            "/usr/bin/git",
            "/opt/homebrew/bin/git",
            "/usr/local/bin/git",
        ];
        for c in CANDIDATES {
            let ok = std::process::Command::new(c)
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
            if ok {
                return Some(*c);
            }
        }
        None
    })
}

async fn run_git(args: &[&str]) -> Result<std::process::Output, String> {
    let bin = match git_binary() {
        Some(b) => b,
        None => return Err("git not found".to_string()),
    };
    let fut = tokio::process::Command::new(bin).args(args).output();
    match tokio::time::timeout(GIT_TIMEOUT, fut).await {
        Ok(Ok(out)) => Ok(out),
        Ok(Err(e)) => Err(format!("git {}: {e}", args.first().copied().unwrap_or(""))),
        Err(_) => Err(format!("git {} timed out", args.first().copied().unwrap_or(""))),
    }
}

fn classify_xy(xy: &str) -> &'static str {
    let bytes = xy.as_bytes();
    if bytes.len() < 2 {
        return "modified";
    }
    let x = bytes[0] as char;
    let y = bytes[1] as char;
    if x == '?' || y == '?' {
        return "untracked";
    }
    if x == 'U' || y == 'U' || (x == 'D' && y == 'D') || (x == 'A' && y == 'A') {
        return "unmerged";
    }
    if x == 'A' || y == 'A' {
        return "added";
    }
    if x == 'D' || y == 'D' {
        return "deleted";
    }
    if x == 'R' || y == 'R' || x == 'C' || y == 'C' {
        return "renamed";
    }
    "modified"
}

#[tauri::command]
async fn git_status(workspace: String) -> Result<Option<GitStatus>, String> {
    if git_binary().is_none() {
        return Ok(None);
    }
    let toplevel_out = match run_git(&["-C", &workspace, "rev-parse", "--show-toplevel"]).await {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };
    if !toplevel_out.status.success() {
        return Ok(None);
    }
    let toplevel = String::from_utf8_lossy(&toplevel_out.stdout)
        .trim()
        .to_string();

    // Workspace must live inside the repo. Compute the prefix so we can
    // translate repo-relative paths (what git emits) into
    // workspace-relative paths (what the scan uses).
    let ws_canonical = std::path::Path::new(&workspace)
        .canonicalize()
        .unwrap_or_else(|_| std::path::Path::new(&workspace).to_path_buf());
    let tl_canonical = std::path::Path::new(&toplevel)
        .canonicalize()
        .unwrap_or_else(|_| std::path::Path::new(&toplevel).to_path_buf());
    let prefix = ws_canonical
        .strip_prefix(&tl_canonical)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default();

    let status_out = run_git(&["-C", &workspace, "status", "--porcelain=v1", "-z"]).await?;
    if !status_out.status.success() {
        return Err(format!(
            "git status: {}",
            String::from_utf8_lossy(&status_out.stderr)
        ));
    }

    let mut files = Vec::new();
    let mut iter = status_out
        .stdout
        .split(|b| *b == 0)
        .filter(|t| !t.is_empty())
        .peekable();
    while let Some(tok) = iter.next() {
        let s = match std::str::from_utf8(tok) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if s.len() < 4 {
            continue;
        }
        let xy = &s[..2];
        let path = s[3..].to_string();
        let status = classify_xy(xy);
        let is_rename = xy.contains('R') || xy.contains('C');

        let original_path = if is_rename {
            iter.next()
                .and_then(|t| std::str::from_utf8(t).ok().map(|s| s.to_string()))
        } else {
            None
        };

        let final_path = if prefix.is_empty() {
            path.clone()
        } else if path == prefix {
            String::new()
        } else if let Some(rest) = path.strip_prefix(&format!("{}/", prefix)) {
            rest.to_string()
        } else {
            continue;
        };

        files.push(GitFileStatus {
            path: final_path,
            status: status.to_string(),
            original_path,
        });
    }

    Ok(Some(GitStatus {
        root: toplevel,
        files,
    }))
}

#[tauri::command]
async fn git_show_head(workspace: String, path: String) -> Result<Option<String>, String> {
    if git_binary().is_none() {
        return Ok(None);
    }
    let out = run_git(&["-C", &workspace, "show", &format!("HEAD:./{}", path)]).await?;
    if !out.status.success() {
        // Common case: file is untracked / new (no HEAD revision). Don't
        // treat as an error - the caller renders an "all added" diff.
        let stderr = String::from_utf8_lossy(&out.stderr);
        if stderr.contains("exists on disk, but not in")
            || stderr.contains("does not exist")
            || stderr.contains("path does not exist")
            || stderr.contains("bad revision")
        {
            return Ok(None);
        }
        return Err(format!("git show: {}", stderr));
    }
    Ok(Some(String::from_utf8_lossy(&out.stdout).to_string()))
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
cross_links:
  - project: agent
    label: "Need voice AI?"
    description: Vinfra Agent runs alongside.
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
        assert_eq!(parsed.cross_links.len(), 1);
        assert_eq!(parsed.cross_links[0].project, "agent");
        assert_eq!(parsed.cross_links[0].label, "Need voice AI?");

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
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            scan_markdown,
            install_welcome_workspace,
            git_status,
            git_show_head
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
