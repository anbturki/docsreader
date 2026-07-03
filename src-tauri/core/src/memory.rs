use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::Serialize;

use crate::error::{CoreError, ErrorCode};
use crate::frontmatter::{parse_doc_meta, split_frontmatter};
use crate::read::score_match;
use crate::slug::slugify;
use crate::write::{enforce_size_limit, stage_in_git};

pub const MEMORY_DIR: &str = "memory";

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub slug: String,
    pub rel_path: String,
    pub path: PathBuf,
    /// false when an existing entry for the topic was overwritten.
    pub created: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct MemoryHit {
    pub slug: String,
    pub rel_path: String,
    pub title: Option<String>,
    pub tags: Vec<String>,
    /// Full body of the entry; memory entries are short by design.
    pub content: String,
    pub score: u32,
    pub modified: Option<u64>,
}

pub fn memory_rel_path(slug: &str) -> String {
    format!("{MEMORY_DIR}/{slug}.md")
}

fn memory_slug(mem_ref: &str) -> Result<String, CoreError> {
    let slug = mem_ref
        .strip_prefix("memory/")
        .unwrap_or(mem_ref)
        .trim_end_matches(".md");
    if slug.is_empty() || slugify(slug) != slug {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("invalid memory reference {mem_ref:?}"),
        )
        .with_recovery("pass a topic slug or a path like \"memory/user-preferences.md\""));
    }
    Ok(slug.to_string())
}

#[derive(Serialize)]
struct MemoryFrontmatter<'a> {
    title: &'a str,
    #[serde(skip_serializing_if = "<[String]>::is_empty")]
    tags: &'a [String],
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_by: Option<&'a str>,
}

fn existing_creation_stamp(path: &Path) -> Option<(String, Option<String>)> {
    let content = std::fs::read_to_string(path).ok()?;
    let fm = split_frontmatter(&content).0?;
    let map: serde_yaml::Mapping = serde_yaml::from_str(fm).ok()?;
    let field = |key: &str| {
        map.get(serde_yaml::Value::String(key.into()))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    };
    Some((field("created_at")?, field("created_by")))
}

/// Upsert by topic: one entry per topic slug, overwritten wholesale on each
/// write (the Anthropic memory-tool "create or overwrite" contract).
/// created_at/created_by survive updates; updated_at/updated_by track them.
pub async fn write_memory_core(
    root: &Path,
    topic: &str,
    content: &str,
    tags: &[String],
    agent: Option<&str>,
) -> Result<MemoryEntry, CoreError> {
    if topic.trim().is_empty() {
        return Err(CoreError::new(ErrorCode::InvalidInput, "topic is required")
            .with_recovery("pass a short topic, e.g. \"user-preferences\""));
    }
    let slug = slugify(topic);
    let rel_path = memory_rel_path(&slug);
    let path = root.join(&rel_path);
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let existing = existing_creation_stamp(&path);
    let created = existing.is_none();
    let (created_at, created_by) =
        existing.unwrap_or_else(|| (now.clone(), agent.map(str::to_string)));
    let fm = serde_yaml::to_string(&MemoryFrontmatter {
        title: topic,
        tags,
        created_at,
        created_by,
        updated_at: (!created).then(|| now.clone()),
        updated_by: (!created).then_some(agent).flatten(),
    })
    .map_err(|e| CoreError::new(ErrorCode::Io, format!("serialize frontmatter: {e}")))?;
    let rendered = format!("---\n{fm}---\n\n{}\n", content.trim_end());
    enforce_size_limit(rendered.len())?;
    std::fs::create_dir_all(path.parent().unwrap_or(root))?;
    std::fs::write(&path, rendered)?;
    stage_in_git(root, &[&rel_path]).await;
    Ok(MemoryEntry {
        slug,
        rel_path,
        path,
        created,
    })
}

/// Empty/absent query lists everything, newest first; otherwise hits are
/// ranked like search_docs. Full content rides along so recall is one call.
pub fn search_memory_core(
    root: &Path,
    query: Option<&str>,
    tag: Option<&str>,
) -> Result<Vec<MemoryHit>, CoreError> {
    if !root.is_dir() {
        return Err(CoreError::new(
            ErrorCode::WorkspaceNotFound,
            format!("workspace directory {} is missing", root.display()),
        )
        .with_recovery("call list_workspaces to see valid slugs"));
    }
    let q = query
        .map(|q| q.trim().to_lowercase())
        .filter(|q| !q.is_empty());
    let mut hits = Vec::new();
    for entry in std::fs::read_dir(root.join(MEMORY_DIR))
        .into_iter()
        .flatten()
        .flatten()
    {
        let Some(hit) = memory_hit(&entry.path()) else {
            continue;
        };
        if tag.is_some_and(|t| !hit.tags.iter().any(|x| x == t)) {
            continue;
        }
        match &q {
            None => hits.push(hit),
            Some(q) => {
                let score = score_match(
                    hit.title.as_deref(),
                    &hit.tags,
                    &hit.slug,
                    hit.content.to_lowercase().contains(q),
                    q,
                );
                if score > 0 {
                    hits.push(MemoryHit { score, ..hit });
                }
            }
        }
    }
    match q {
        None => hits.sort_by(|a, b| {
            b.modified
                .cmp(&a.modified)
                .then_with(|| a.slug.cmp(&b.slug))
        }),
        Some(_) => hits.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.slug.cmp(&b.slug))),
    }
    Ok(hits)
}

fn memory_hit(path: &Path) -> Option<MemoryHit> {
    if path.extension().is_none_or(|e| e != "md") || !path.is_file() {
        return None;
    }
    let slug = path.file_stem()?.to_string_lossy().to_string();
    let content = std::fs::read_to_string(path).ok()?;
    let (fm, body) = split_frontmatter(&content);
    let meta = fm.map(parse_doc_meta).unwrap_or_default();
    let modified = std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Some(MemoryHit {
        rel_path: memory_rel_path(&slug),
        slug,
        title: meta.title,
        tags: meta.tags,
        content: body.trim().to_string(),
        score: 0,
        modified,
    })
}

pub async fn delete_memory_core(root: &Path, mem_ref: &str) -> Result<MemoryEntry, CoreError> {
    let slug = memory_slug(mem_ref)?;
    let rel_path = memory_rel_path(&slug);
    let path = root.join(&rel_path);
    if !path.is_file() {
        return Err(CoreError::new(
            ErrorCode::DocNotFound,
            format!("no memory entry for {slug:?}"),
        )
        .with_recovery("call search_memory to see existing entries"));
    }
    std::fs::remove_file(&path)?;
    stage_in_git(root, &[&rel_path]).await;
    Ok(MemoryEntry {
        slug,
        rel_path,
        path,
        created: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_mem_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn upsert_creates_then_overwrites_preserving_creation_stamp() {
        let root = test_dir("upsert");
        let first = write_memory_core(&root, "User Preferences", "Likes tabs.", &[], Some("codex"))
            .await
            .unwrap();
        assert!(first.created);
        assert_eq!(first.rel_path, "memory/user-preferences.md");
        let raw = std::fs::read_to_string(&first.path).unwrap();
        assert!(raw.contains("created_by: codex"));
        assert!(!raw.contains("updated_at:"));

        let second = write_memory_core(
            &root,
            "User Preferences",
            "Likes spaces now.",
            &[],
            Some("claude-code"),
        )
        .await
        .unwrap();
        assert!(!second.created, "same topic upserts");
        let raw = std::fs::read_to_string(&second.path).unwrap();
        assert!(raw.contains("created_by: codex"), "creation stamp survives");
        assert!(raw.contains("updated_by: claude-code"));
        assert!(raw.contains("updated_at:"));
        assert!(raw.ends_with("Likes spaces now.\n"));
        assert!(!raw.contains("tabs"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn search_ranks_and_empty_query_lists_all() {
        let root = test_dir("search");
        write_memory_core(
            &root,
            "Auth Stack",
            "Uses Better Auth.",
            &["stack".into()],
            None,
        )
        .await
        .unwrap();
        write_memory_core(&root, "Editor", "Neovim, auth for git via ssh.", &[], None)
            .await
            .unwrap();

        let all = search_memory_core(&root, None, None).unwrap();
        assert_eq!(all.len(), 2);
        assert!(all.iter().all(|h| !h.content.is_empty()));

        let hits = search_memory_core(&root, Some("auth"), None).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(
            hits[0].slug, "auth-stack",
            "title+slug match outranks content"
        );
        assert!(hits[0].score > hits[1].score);

        let tagged = search_memory_core(&root, None, Some("stack")).unwrap();
        assert_eq!(tagged.len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn delete_removes_entry_and_rejects_bad_refs() {
        let root = test_dir("del");
        write_memory_core(&root, "Stale Fact", "old", &[], None)
            .await
            .unwrap();

        let gone = delete_memory_core(&root, "memory/stale-fact.md")
            .await
            .unwrap();
        assert!(!gone.path.exists());

        let err = delete_memory_core(&root, "stale-fact").await.unwrap_err();
        assert_eq!(err.code, ErrorCode::DocNotFound);

        let err = delete_memory_core(&root, "memory/../escape")
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
        let _ = std::fs::remove_dir_all(&root);
    }
}
