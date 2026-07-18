use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, ErrorCode};
use crate::git;
use crate::scan::MAX_FILE_BYTES;
use crate::slug::{slugify, unique_slug};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "kebab-case")]
pub enum DocStatus {
    Research,
    InProgress,
    Done,
    Archived,
}

impl DocStatus {
    pub const ALL: [Self; 4] = [Self::Research, Self::InProgress, Self::Done, Self::Archived];

    pub fn folder(self) -> &'static str {
        match self {
            Self::Research => "research",
            Self::InProgress => "in-progress",
            Self::Done => "done",
            Self::Archived => "archived",
        }
    }

    pub fn parse(value: &str) -> Result<Self, CoreError> {
        Self::ALL
            .into_iter()
            .find(|s| s.folder() == value)
            .ok_or_else(|| {
                let known: Vec<&str> = Self::ALL.into_iter().map(Self::folder).collect();
                CoreError::new(ErrorCode::InvalidInput, format!("unknown status {value:?}"))
                    .with_recovery(format!("valid statuses: [{}]", known.join(", ")))
            })
    }
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct WrittenDoc {
    pub slug: String,
    pub rel_path: String,
    pub path: PathBuf,
    pub status: DocStatus,
    pub phase: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DocLocation {
    pub slug: String,
    pub status: DocStatus,
    pub phase: Option<String>,
    pub rel_path: String,
    pub path: PathBuf,
}

impl DocLocation {
    pub(crate) fn to_written(&self) -> WrittenDoc {
        WrittenDoc {
            slug: self.slug.clone(),
            rel_path: self.rel_path.clone(),
            path: self.path.clone(),
            status: self.status,
            phase: self.phase.clone(),
        }
    }
}

#[derive(Debug)]
pub struct NewDoc<'a> {
    pub title: &'a str,
    pub body: &'a str,
    pub status: DocStatus,
    pub created_by: Option<&'a str>,
    pub phase: Option<&'a str>,
    pub owner: Option<&'a str>,
    pub tags: Vec<String>,
    pub priority: Option<&'a str>,
    pub due: Option<&'a str>,
}

impl<'a> NewDoc<'a> {
    pub fn new(title: &'a str, body: &'a str, status: DocStatus) -> Self {
        Self {
            title,
            body,
            status,
            created_by: None,
            phase: None,
            owner: None,
            tags: Vec::new(),
            priority: None,
            due: None,
        }
    }
}

#[derive(Serialize)]
struct Frontmatter<'a> {
    title: &'a str,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_by: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner: Option<&'a str>,
    #[serde(skip_serializing_if = "<[String]>::is_empty")]
    tags: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    priority: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    due: Option<&'a str>,
}

fn doc_rel_path(status: DocStatus, phase: Option<&str>, slug: &str) -> String {
    match phase {
        Some(p) => format!("{}/{p}/{slug}.md", status.folder()),
        None => format!("{}/{slug}.md", status.folder()),
    }
}

pub(crate) fn location_at(
    root: &Path,
    status: DocStatus,
    phase: Option<&str>,
    slug: &str,
) -> DocLocation {
    let rel_path = doc_rel_path(status, phase, slug);
    DocLocation {
        slug: slug.to_string(),
        status,
        phase: phase.map(str::to_string),
        rel_path: rel_path.clone(),
        path: root.join(rel_path),
    }
}

fn phases_in(root: &Path, status: DocStatus) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(root.join(status.folder())) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

fn validate_phase(phase: &str) -> Result<(), CoreError> {
    if phase.is_empty() || slugify(phase) != phase {
        return Err(
            CoreError::new(ErrorCode::InvalidInput, format!("invalid phase {phase:?}"))
                .with_recovery(
                    "phases are lowercase alphanumerics separated by dashes, e.g. \"v2-launch\"",
                ),
        );
    }
    // A phase folder named like a pruned directory (build, dist, ...) would
    // make its docs invisible to the GUI while writes still report success.
    if crate::scan::is_reserved_dir_name(phase) {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("phase {phase:?} is a reserved name"),
        )
        .with_recovery(format!(
            "choose a different phase name, e.g. \"{phase}-phase\""
        )));
    }
    Ok(())
}

pub(crate) fn find_doc_location(root: &Path, slug: &str) -> Option<DocLocation> {
    for status in DocStatus::ALL {
        let direct = location_at(root, status, None, slug);
        if direct.path.is_file() {
            return Some(direct);
        }
        for phase in phases_in(root, status) {
            let nested = location_at(root, status, Some(&phase), slug);
            if nested.path.is_file() {
                return Some(nested);
            }
        }
    }
    None
}

fn doc_not_found(doc_ref: &str) -> CoreError {
    CoreError::new(
        ErrorCode::DocNotFound,
        format!("no doc found for {doc_ref:?}"),
    )
    .with_recovery(
        "pass a slug or a status-relative path like \"research/my-doc.md\"; see list_docs",
    )
}

/// Resolves a slug or status-relative path to an existing doc. A stale path
/// whose doc now lives elsewhere is a Conflict ("changed under you"), not a
/// plain not-found, so agents learn the new location.
pub fn locate_doc(root: &Path, doc_ref: &str) -> Result<DocLocation, CoreError> {
    if doc_ref.starts_with("memory/") {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("{doc_ref:?} is a memory entry, not a doc; memory has no lifecycle"),
        )
        .with_recovery(
            "read it with search_memory, overwrite it with write_memory, or remove it with delete_doc",
        ));
    }
    if doc_ref.starts_with("tasks/") {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("{doc_ref:?} is a task, not a doc; tasks keep status in frontmatter"),
        )
        .with_recovery(
            "use set_task_status to move it, update_task to edit it, or delete_doc to remove it",
        ));
    }
    if !doc_ref.contains('/') {
        return find_doc_location(root, doc_ref).ok_or_else(|| doc_not_found(doc_ref));
    }
    let path = crate::path_guard::safe_join(root, doc_ref)?;
    let segments: Vec<&str> = doc_ref.split('/').collect();
    let status = DocStatus::parse(segments[0])?;
    let (phase, file_name) = match segments.as_slice() {
        [_, file] => (None, *file),
        [_, phase, file] => (Some(*phase), *file),
        _ => return Err(doc_not_found(doc_ref)),
    };
    let Some(slug) = file_name.strip_suffix(".md") else {
        return Err(doc_not_found(doc_ref));
    };
    if path.is_file() {
        return Ok(location_at(root, status, phase, slug));
    }
    match find_doc_location(root, slug) {
        Some(current) => Err(CoreError::new(
            ErrorCode::Conflict,
            format!(
                "doc {slug:?} is no longer at {doc_ref:?}; it moved to {:?}",
                current.rel_path
            ),
        )
        .with_recovery(format!("retry with path {:?}", current.rel_path))),
        None => Err(doc_not_found(doc_ref)),
    }
}

fn render_doc(doc: &NewDoc<'_>) -> Result<String, CoreError> {
    // Agent-supplied frontmatter wins; otherwise stamp the typed metadata.
    if doc.body.trim_start().starts_with("---") {
        return Ok(format!("{}\n", doc.body.trim_end()));
    }
    let fm = serde_yaml::to_string(&Frontmatter {
        title: doc.title,
        created_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        created_by: doc.created_by,
        owner: doc.owner,
        tags: &doc.tags,
        priority: doc.priority,
        due: doc.due,
    })
    .map_err(|e| CoreError::new(ErrorCode::Io, format!("serialize frontmatter: {e}")))?;
    Ok(format!("---\n{fm}---\n\n{}\n", doc.body.trim_end()))
}

pub(crate) fn enforce_size_limit(rendered_len: usize) -> Result<(), CoreError> {
    if rendered_len as u64 > MAX_FILE_BYTES {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!(
                "content exceeds the {} MiB limit",
                MAX_FILE_BYTES / (1024 * 1024)
            ),
        )
        .with_recovery("split the document into smaller docs"));
    }
    Ok(())
}

pub(crate) async fn stage_in_git(root: &Path, rel_paths: &[&str]) {
    let root_str = root.to_string_lossy();
    if git::is_git_repo(&root_str).await {
        git::git_add(&root_str, rel_paths).await;
    }
}

pub async fn write_doc_core(root: &Path, doc: &NewDoc<'_>) -> Result<WrittenDoc, CoreError> {
    if doc.title.trim().is_empty() {
        return Err(CoreError::new(ErrorCode::InvalidInput, "title is required")
            .with_recovery("pass a short human-readable title; it becomes the doc's slug"));
    }
    if let Some(phase) = doc.phase {
        validate_phase(phase)?;
    }
    let rendered = render_doc(doc)?;
    enforce_size_limit(rendered.len())?;
    let slug = unique_slug(&slugify(doc.title), |s| {
        find_doc_location(root, s).is_some()
    });
    let target = location_at(root, doc.status, doc.phase, &slug);
    std::fs::create_dir_all(target.path.parent().unwrap_or(root))?;
    std::fs::write(&target.path, rendered)?;
    stage_in_git(root, &[&target.rel_path]).await;
    Ok(target.to_written())
}

pub(crate) async fn relocate(
    root: &Path,
    from: &DocLocation,
    to: &DocLocation,
) -> Result<(), CoreError> {
    if to.path.is_file() {
        return Err(CoreError::new(
            ErrorCode::Conflict,
            format!("a doc already exists at {:?}", to.rel_path),
        )
        .with_recovery("archive or rename the existing doc first"));
    }
    std::fs::create_dir_all(to.path.parent().unwrap_or(root))?;
    let root_str = root.to_string_lossy();
    let moved_by_git = git::is_git_repo(&root_str).await
        && git::git_mv(&root_str, &from.rel_path, &to.rel_path).await;
    if !moved_by_git {
        // Untracked file or non-repo: plain rename, then best-effort stage.
        std::fs::rename(&from.path, &to.path)?;
        stage_in_git(root, &[&from.rel_path, &to.rel_path]).await;
    }
    Ok(())
}

/// The move IS the status change; the phase subfolder is preserved.
pub async fn set_status_core(
    root: &Path,
    doc_ref: &str,
    new_status: DocStatus,
) -> Result<WrittenDoc, CoreError> {
    let from = locate_doc(root, doc_ref)?;
    let to = location_at(root, new_status, from.phase.as_deref(), &from.slug);
    if from.status == new_status {
        return Ok(from.to_written());
    }
    relocate(root, &from, &to).await?;
    Ok(to.to_written())
}

/// Moves a doc into (or out of, with None) a phase subfolder within its status.
pub async fn set_phase_core(
    root: &Path,
    doc_ref: &str,
    phase: Option<&str>,
) -> Result<WrittenDoc, CoreError> {
    if let Some(p) = phase {
        validate_phase(p)?;
    }
    let from = locate_doc(root, doc_ref)?;
    let to = location_at(root, from.status, phase, &from.slug);
    if from.phase.as_deref() == phase {
        return Ok(from.to_written());
    }
    relocate(root, &from, &to).await?;
    Ok(to.to_written())
}

pub async fn archive_doc_core(root: &Path, doc_ref: &str) -> Result<WrittenDoc, CoreError> {
    set_status_core(root, doc_ref, DocStatus::Archived).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn test_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_write_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn git(dir: &Path, args: &[&str]) {
        let ok = Command::new("git")
            .args(args)
            .current_dir(dir)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        assert!(ok, "git {args:?} failed");
    }

    #[tokio::test]
    async fn write_places_doc_in_status_folder_with_frontmatter() {
        let root = test_dir("place");
        let new_doc = NewDoc {
            created_by: Some("claude-code"),
            phase: Some("discovery"),
            tags: vec!["mcp".into()],
            ..NewDoc::new("My First Doc", "Body text.", DocStatus::Research)
        };
        let doc = write_doc_core(&root, &new_doc).await.unwrap();
        assert_eq!(
            doc.rel_path, "research/discovery/my-first-doc.md",
            "phase is a subfolder"
        );

        let raw = std::fs::read_to_string(&doc.path).unwrap();
        assert!(raw.starts_with("---\n"), "has frontmatter: {raw}");
        assert!(raw.contains("title: My First Doc"));
        assert!(raw.contains("created_at:"));
        assert!(raw.contains("created_by: claude-code"));
        assert!(raw.contains("- mcp"));
        assert!(!raw.contains("status:"), "status must stay folder-only");
        assert!(!raw.contains("phase:"), "phase must stay folder-only");
        assert!(raw.ends_with("Body text.\n"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn set_status_preserves_phase_and_set_phase_moves_within_status() {
        let root = test_dir("phase_moves");
        let doc = write_doc_core(
            &root,
            &NewDoc {
                phase: Some("v1"),
                ..NewDoc::new("Phased", "x", DocStatus::Research)
            },
        )
        .await
        .unwrap();
        assert_eq!(doc.rel_path, "research/v1/phased.md");

        let moved = set_status_core(&root, "phased", DocStatus::Done)
            .await
            .unwrap();
        assert_eq!(moved.rel_path, "done/v1/phased.md", "phase preserved");

        let rephased = set_phase_core(&root, "phased", Some("v2")).await.unwrap();
        assert_eq!(rephased.rel_path, "done/v2/phased.md");

        let cleared = set_phase_core(&root, "phased", None).await.unwrap();
        assert_eq!(cleared.rel_path, "done/phased.md");
        assert!(cleared.path.is_file());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn stale_path_reports_moved_doc_conflict() {
        let root = test_dir("stale");
        let doc = write_doc_core(&root, &NewDoc::new("Wander", "x", DocStatus::Research))
            .await
            .unwrap();
        set_status_core(&root, &doc.slug, DocStatus::Done)
            .await
            .unwrap();

        let err = set_status_core(&root, "research/wander.md", DocStatus::Archived)
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        assert!(
            err.message.contains("done/wander.md"),
            "got: {}",
            err.message
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn slug_collisions_get_counter_across_statuses() {
        let root = test_dir("collide");
        let a = write_doc_core(&root, &NewDoc::new("Same Title", "a", DocStatus::Research))
            .await
            .unwrap();
        let b = write_doc_core(&root, &NewDoc::new("Same Title", "b", DocStatus::Done))
            .await
            .unwrap();
        assert_eq!(a.slug, "same-title");
        assert_eq!(b.slug, "same-title-2");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn move_relocates_between_status_folders() {
        let root = test_dir("move");
        let doc = write_doc_core(&root, &NewDoc::new("Movable", "x", DocStatus::Research))
            .await
            .unwrap();
        let moved = set_status_core(&root, &doc.slug, DocStatus::Done)
            .await
            .unwrap();
        assert_eq!(moved.rel_path, "done/movable.md");
        assert!(!doc.path.exists());
        assert!(moved.path.is_file());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn git_repo_write_stages_and_move_shows_rename() {
        if crate::git::git_binary().is_none() {
            return;
        }
        let root = test_dir("gitmv");
        git(&root, &["init", "-q"]);
        git(&root, &["config", "user.email", "a@b.c"]);
        git(&root, &["config", "user.name", "x"]);

        let doc = write_doc_core(&root, &NewDoc::new("Tracked Doc", "x", DocStatus::Research))
            .await
            .unwrap();
        let staged = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&root)
            .output()
            .unwrap();
        let staged = String::from_utf8_lossy(&staged.stdout).to_string();
        assert!(
            staged.contains("A  research/tracked-doc.md"),
            "write staged the file: {staged}"
        );

        git(&root, &["commit", "-qm", "add doc"]);
        set_status_core(&root, &doc.slug, DocStatus::InProgress)
            .await
            .unwrap();
        let after = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&root)
            .output()
            .unwrap();
        let after = String::from_utf8_lossy(&after.stdout).to_string();
        assert!(
            after.contains("R  research/tracked-doc.md -> in-progress/tracked-doc.md"),
            "history reflects git mv: {after}"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn agent_frontmatter_passes_through_unchanged() {
        let root = test_dir("ownfm");
        let content = "---\ntitle: Custom\ntags: [x]\n---\n\nBody.";
        let doc = write_doc_core(
            &root,
            &NewDoc::new("Ignored Title", content, DocStatus::Research),
        )
        .await
        .unwrap();
        let raw = std::fs::read_to_string(&doc.path).unwrap();
        assert_eq!(raw, format!("{content}\n"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn rejects_empty_title_and_oversize_content() {
        let root = test_dir("reject");
        let err = write_doc_core(&root, &NewDoc::new("  ", "x", DocStatus::Research))
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);

        let huge = "x".repeat(MAX_FILE_BYTES as usize + 1);
        let err = write_doc_core(&root, &NewDoc::new("Huge", &huge, DocStatus::Research))
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn rejects_reserved_phase_names() {
        let root = test_dir("reserved_phase");
        for phase in ["build", "dist", "target", "venv"] {
            let err = write_doc_core(
                &root,
                &NewDoc {
                    phase: Some(phase),
                    ..NewDoc::new("Doc", "x", DocStatus::Research)
                },
            )
            .await
            .unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidInput, "phase {phase:?}");
            assert!(
                err.message.contains("reserved"),
                "message says why: {}",
                err.message
            );
            assert!(err.recovery.is_some(), "suggests picking another name");
        }

        let ok = write_doc_core(
            &root,
            &NewDoc {
                phase: Some("discovery"),
                ..NewDoc::new("Doc", "x", DocStatus::Research)
            },
        )
        .await
        .unwrap();
        assert_eq!(ok.rel_path, "research/discovery/doc.md");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn move_unknown_slug_is_doc_not_found() {
        let root = test_dir("nomove");
        let err = set_status_core(&root, "ghost", DocStatus::Done)
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::DocNotFound);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn status_parses_folder_names_only() {
        assert_eq!(
            DocStatus::parse("in-progress").unwrap(),
            DocStatus::InProgress
        );
        let err = DocStatus::parse("wip").unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
        assert!(err.recovery.unwrap().contains("research"));
    }
}
