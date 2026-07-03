// Shells out to `git` via tokio with a per-call timeout, rather than linking
// libgit2: zero bundle weight and the user's own git always understands their repo.

use std::process::Stdio;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::AsyncReadExt;

const GIT_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_GIT_STDOUT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    #[serde(
        default,
        rename = "originalPath",
        skip_serializing_if = "Option::is_none"
    )]
    pub original_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub root: String,
    pub files: Vec<GitFileStatus>,
}

pub struct GitOutput {
    pub success: bool,
    pub stdout: Vec<u8>,
    pub stderr: String,
}

// PATH on a GUI-launched macOS app lacks Homebrew dirs, so probe common
// install locations as a fallback. Cached after the first lookup.
pub fn git_binary() -> Option<&'static str> {
    static CACHED: std::sync::OnceLock<Option<&'static str>> = std::sync::OnceLock::new();
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

// stdout is capped at MAX_GIT_STDOUT_BYTES: a huge committed blob (git show) or
// a repo with enormous status output must not be buffered unbounded into memory.
// Overflow is drained to a sink so the child can't block on a full pipe.
pub async fn run_git(args: &[&str]) -> Result<GitOutput, String> {
    let bin = match git_binary() {
        Some(b) => b,
        None => return Err("git not found".to_string()),
    };
    let label = args.first().copied().unwrap_or("");
    let collect = async {
        let mut child = tokio::process::Command::new(bin)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("git {label}: {e}"))?;
        let mut stdout_pipe = child.stdout.take().ok_or("git stdout unavailable")?;
        let mut stderr_pipe = child.stderr.take().ok_or("git stderr unavailable")?;

        let read_stdout = async {
            let mut buf = Vec::new();
            let cap = MAX_GIT_STDOUT_BYTES as u64 + 1;
            (&mut stdout_pipe).take(cap).read_to_end(&mut buf).await?;
            tokio::io::copy(&mut stdout_pipe, &mut tokio::io::sink()).await?;
            buf.truncate(MAX_GIT_STDOUT_BYTES);
            Ok::<Vec<u8>, std::io::Error>(buf)
        };
        let read_stderr = async {
            let mut s = String::new();
            let _ = stderr_pipe.read_to_string(&mut s).await;
            s
        };
        let (stdout_res, stderr) = tokio::join!(read_stdout, read_stderr);
        let stdout = stdout_res.map_err(|e| format!("git {label}: {e}"))?;
        let status = child
            .wait()
            .await
            .map_err(|e| format!("git {label}: {e}"))?;
        Ok::<GitOutput, String>(GitOutput {
            success: status.success(),
            stdout,
            stderr,
        })
    };
    match tokio::time::timeout(GIT_TIMEOUT, collect).await {
        Ok(r) => r,
        Err(_) => Err(format!("git {label} timed out")),
    }
}

pub async fn is_git_repo(dir: &str) -> bool {
    match run_git(&["-C", dir, "rev-parse", "--is-inside-work-tree"]).await {
        Ok(o) => o.success && String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

pub async fn git_add(dir: &str, paths: &[&str]) -> bool {
    let mut args = vec!["-C", dir, "add", "-A", "--"];
    args.extend_from_slice(paths);
    matches!(run_git(&args).await, Ok(o) if o.success)
}

pub async fn git_mv(dir: &str, from: &str, to: &str) -> bool {
    matches!(
        run_git(&["-C", dir, "mv", "--", from, to]).await,
        Ok(o) if o.success
    )
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

pub async fn git_status_core(workspace: String) -> Result<Option<GitStatus>, String> {
    if git_binary().is_none() {
        return Ok(None);
    }
    let toplevel_out = match run_git(&["-C", &workspace, "rev-parse", "--show-toplevel"]).await {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };
    if !toplevel_out.success {
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
    if !status_out.success {
        return Err(format!("git status: {}", status_out.stderr));
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

pub async fn git_show_head_core(workspace: String, path: String) -> Result<Option<String>, String> {
    if git_binary().is_none() {
        return Ok(None);
    }
    let out = run_git(&["-C", &workspace, "show", &format!("HEAD:./{}", path), "--"]).await?;
    if !out.success {
        // Untracked / new file has no HEAD revision: not an error - the caller
        // renders an "all added" diff.
        if out.stderr.contains("exists on disk, but not in")
            || out.stderr.contains("does not exist")
            || out.stderr.contains("path does not exist")
            || out.stderr.contains("bad revision")
        {
            return Ok(None);
        }
        return Err(format!("git show: {}", out.stderr));
    }
    Ok(Some(String::from_utf8_lossy(&out.stdout).to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::process::Command;

    fn git(dir: &Path, args: &[&str]) {
        let ok = Command::new("git")
            .args(args)
            .current_dir(dir)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        assert!(ok, "git {args:?} failed");
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_git_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn show_head_returns_content_and_none_for_untracked() {
        if git_binary().is_none() {
            return;
        }
        let dir = temp_dir("show");
        git(&dir, &["init", "-q"]);
        git(&dir, &["config", "user.email", "a@b.c"]);
        git(&dir, &["config", "user.name", "x"]);
        std::fs::write(dir.join("f.md"), "hello\n").unwrap();
        git(&dir, &["add", "f.md"]);
        git(&dir, &["commit", "-qm", "init"]);

        let ws = dir.to_string_lossy().to_string();
        let committed = git_show_head_core(ws.clone(), "f.md".into()).await.unwrap();
        assert_eq!(committed.as_deref(), Some("hello\n"));

        std::fs::write(dir.join("new.md"), "x\n").unwrap();
        let untracked = git_show_head_core(ws.clone(), "new.md".into())
            .await
            .unwrap();
        assert_eq!(untracked, None);

        let status = git_status_core(ws).await.unwrap();
        assert!(status.is_some(), "files() in a repo returns Some");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn status_on_non_repo_is_none() {
        if git_binary().is_none() {
            return;
        }
        let dir = temp_dir("nonrepo");
        let status = git_status_core(dir.to_string_lossy().to_string())
            .await
            .unwrap();
        assert!(status.is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
