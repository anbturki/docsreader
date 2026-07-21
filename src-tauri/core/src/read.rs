use std::path::Path;

use serde::Serialize;

use crate::error::{CoreError, ErrorCode};
use crate::frontmatter::{parse_doc_meta, split_frontmatter};
use crate::score::{combine_terms, FieldHits};
use crate::write::DocStatus;

/// ~25k tokens at ~4 chars/token; MCP responses stay under this.
pub const RESPONSE_BUDGET_CHARS: usize = 100_000;
pub const SNIPPET_CHARS: usize = 500;

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct DocSummary {
    pub slug: String,
    pub rel_path: String,
    pub status: DocStatus,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub phase: Option<String>,
    pub size: u64,
    pub modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    #[serde(flatten)]
    pub doc: DocSummary,
    pub score: u32,
    pub snippet: Option<String>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct DocContent {
    pub slug: String,
    pub rel_path: String,
    pub status: DocStatus,
    pub phase: Option<String>,
    pub frontmatter: Option<serde_json::Value>,
    pub title: Option<String>,
    /// Full markdown body (detailed mode only).
    pub body: Option<String>,
    /// Leading excerpt of the body (concise mode only).
    pub snippet: Option<String>,
    pub size: u64,
    pub truncated: bool,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct DocFilters<'a> {
    pub status: Option<DocStatus>,
    pub phase: Option<&'a str>,
    pub tag: Option<&'a str>,
}

fn truncate_at_char_boundary(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

fn doc_summary(
    root: &Path,
    status: DocStatus,
    phase: Option<&str>,
    path: &Path,
) -> Option<(DocSummary, String)> {
    let slug = path.file_stem()?.to_string_lossy().to_string();
    let metadata = std::fs::metadata(path).ok()?;
    let content = std::fs::read_to_string(path).ok()?;
    let (fm, _) = split_frontmatter(&content);
    let meta = fm.map(parse_doc_meta).unwrap_or_default();
    let rel_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Some((
        DocSummary {
            slug,
            rel_path,
            status,
            title: meta.title,
            tags: meta.tags,
            phase: phase.map(str::to_string),
            size: metadata.len(),
            modified,
        },
        content,
    ))
}

fn matches_filters(doc: &DocSummary, filters: &DocFilters<'_>) -> bool {
    if let Some(status) = filters.status {
        if doc.status != status {
            return false;
        }
    }
    if let Some(phase) = filters.phase {
        if doc.phase.as_deref() != Some(phase) {
            return false;
        }
    }
    if let Some(tag) = filters.tag {
        if !doc.tags.iter().any(|t| t == tag) {
            return false;
        }
    }
    true
}

fn collect_docs(
    root: &Path,
    filters: &DocFilters<'_>,
) -> Result<Vec<(DocSummary, String)>, CoreError> {
    if !root.is_dir() {
        return Err(CoreError::new(
            ErrorCode::WorkspaceNotFound,
            format!("workspace directory {} is missing", root.display()),
        )
        .with_recovery("call list_workspaces to see valid slugs"));
    }
    let mut docs = Vec::new();
    let mut push_doc = |status: DocStatus, phase: Option<&str>, path: &Path| {
        let is_md = path.extension().is_some_and(|e| e == "md");
        if !is_md || !path.is_file() {
            return;
        }
        if let Some((doc, content)) = doc_summary(root, status, phase, path) {
            if matches_filters(&doc, filters) {
                docs.push((doc, content));
            }
        }
    };
    for status in DocStatus::ALL {
        let entries = match std::fs::read_dir(root.join(status.folder())) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let phase = path.file_name().map(|n| n.to_string_lossy().to_string());
                for nested in std::fs::read_dir(&path).into_iter().flatten().flatten() {
                    push_doc(status, phase.as_deref(), &nested.path());
                }
            } else {
                push_doc(status, None, &path);
            }
        }
    }
    docs.sort_by(|a, b| {
        b.0.modified
            .cmp(&a.0.modified)
            .then_with(|| a.0.rel_path.cmp(&b.0.rel_path))
    });
    Ok(docs)
}

pub fn list_docs_core(root: &Path, filters: &DocFilters<'_>) -> Result<Vec<DocSummary>, CoreError> {
    Ok(collect_docs(root, filters)?
        .into_iter()
        .map(|(doc, _)| doc)
        .collect())
}

// Every whitespace-separated term must match somewhere (AND); each term's
// score sums the fields it hits. A single-word query scores exactly as it did
// before tokenization; a multi-word query like "coturn flags" now matches an
// entry containing both words even when they are not adjacent.
pub(crate) fn score_match(
    title: Option<&str>,
    tags: &[String],
    slug: &str,
    body_lower: &str,
    query_lower: &str,
) -> u32 {
    let title_lower = title.map(str::to_lowercase);
    let slug_lower = slug.to_lowercase();
    let tags_lower: Vec<String> = tags.iter().map(|t| t.to_lowercase()).collect();
    combine_terms(query_lower.split_whitespace().map(|term| FieldHits {
        title: title_lower.as_deref().is_some_and(|t| t.contains(term)),
        tag: tags_lower.iter().any(|t| t == term),
        slug: slug_lower.contains(term),
        content: body_lower.contains(term),
    }))
}

fn content_snippet(content: &str, query_lower: &str) -> Option<String> {
    let body = split_frontmatter(content).1;
    let lower = body.to_lowercase();
    let hit = query_lower
        .split_whitespace()
        .filter_map(|term| lower.find(term))
        .min()?;
    let start = body[..hit]
        .char_indices()
        .rev()
        .take(80)
        .last()
        .map(|(i, _)| i)
        .unwrap_or(hit);
    let excerpt = truncate_at_char_boundary(&body[start..], 160);
    Some(format!("...{}...", excerpt.trim()))
}

pub fn search_docs_core(
    root: &Path,
    query: &str,
    filters: &DocFilters<'_>,
) -> Result<Vec<SearchHit>, CoreError> {
    if query.trim().is_empty() {
        return Err(
            CoreError::new(ErrorCode::InvalidInput, "query must not be empty")
                .with_recovery("pass a search term, or use list_docs to browse"),
        );
    }
    let q = query.to_lowercase();
    let mut hits = Vec::new();
    for (doc, content) in collect_docs(root, filters)? {
        let snippet = content_snippet(&content, &q);
        let body_lower = split_frontmatter(&content).1.to_lowercase();
        let score = score_match(doc.title.as_deref(), &doc.tags, &doc.slug, &body_lower, &q);
        if score > 0 {
            hits.push(SearchHit {
                doc,
                score,
                snippet,
            });
        }
    }
    hits.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.doc.rel_path.cmp(&b.doc.rel_path))
    });
    Ok(hits)
}

pub fn read_doc_core(root: &Path, doc_ref: &str, detailed: bool) -> Result<DocContent, CoreError> {
    let doc = crate::write::locate_doc(root, doc_ref)?;
    let content = std::fs::read_to_string(&doc.path)?;
    let size = content.len() as u64;
    let (fm, body) = split_frontmatter(&content);
    let meta = fm.map(parse_doc_meta).unwrap_or_default();
    let frontmatter = fm
        .and_then(|raw| serde_yaml::from_str::<serde_yaml::Value>(raw).ok())
        .and_then(|v| serde_json::to_value(v).ok());

    let body = body.trim_start_matches('\n');
    let (body_out, snippet, truncated) = if detailed {
        let capped = truncate_at_char_boundary(body, RESPONSE_BUDGET_CHARS);
        (Some(capped.to_string()), None, capped.len() < body.len())
    } else {
        let snip = truncate_at_char_boundary(body, SNIPPET_CHARS);
        (None, Some(snip.to_string()), snip.len() < body.len())
    };

    Ok(DocContent {
        slug: doc.slug,
        rel_path: doc.rel_path,
        status: doc.status,
        phase: doc.phase,
        frontmatter,
        title: meta.title,
        body: body_out,
        snippet,
        size,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::write::{write_doc_core, NewDoc};

    fn test_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_read_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    async fn seed(root: &Path) {
        let mut alpha = NewDoc::new("Alpha Guide", "How to use alpha features.", DocStatus::Done);
        alpha.tags = vec!["guide".into()];
        alpha.phase = Some("v1");
        write_doc_core(root, &alpha).await.unwrap();

        let mut beta = NewDoc::new(
            "Beta Notes",
            "Rough notes mentioning alpha once.",
            DocStatus::Research,
        );
        beta.tags = vec!["notes".into()];
        write_doc_core(root, &beta).await.unwrap();
    }

    #[tokio::test]
    async fn list_filters_and_together() {
        let root = test_dir("list");
        seed(&root).await;

        let all = list_docs_core(&root, &DocFilters::default()).unwrap();
        assert_eq!(all.len(), 2);

        let filtered = list_docs_core(
            &root,
            &DocFilters {
                status: Some(DocStatus::Done),
                tag: Some("guide"),
                phase: Some("v1"),
            },
        )
        .unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].slug, "alpha-guide");

        let none = list_docs_core(
            &root,
            &DocFilters {
                status: Some(DocStatus::Done),
                tag: Some("notes"),
                phase: None,
            },
        )
        .unwrap();
        assert!(none.is_empty(), "filters AND together");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn search_ranks_title_match_above_content_match() {
        let root = test_dir("search");
        seed(&root).await;

        let hits = search_docs_core(&root, "alpha", &DocFilters::default()).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].doc.slug, "alpha-guide", "title match first");
        assert!(hits[0].score > hits[1].score);
        assert!(hits[1].snippet.as_deref().unwrap().contains("alpha"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn search_matches_multi_word_query_across_the_body() {
        let root = test_dir("search_multi");
        seed(&root).await;

        // "use" and "alpha" both occur in Alpha Guide but are not adjacent;
        // Beta Notes has "alpha" but not "use", so AND semantics drops it.
        let hits = search_docs_core(&root, "alpha use", &DocFilters::default()).unwrap();
        assert_eq!(hits.len(), 1, "only the doc with both terms matches");
        assert_eq!(hits[0].doc.slug, "alpha-guide");
        assert!(hits[0].snippet.is_some());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn read_concise_vs_detailed() {
        let root = test_dir("read");
        seed(&root).await;

        let concise = read_doc_core(&root, "alpha-guide", false).unwrap();
        assert!(concise.body.is_none());
        assert!(concise.snippet.as_deref().unwrap().contains("alpha"));
        assert_eq!(concise.status, DocStatus::Done);
        assert_eq!(concise.phase.as_deref(), Some("v1"), "phase from subfolder");
        assert!(concise.frontmatter.is_some());

        let detailed = read_doc_core(&root, "done/v1/alpha-guide.md", true).unwrap();
        assert!(detailed.body.as_deref().unwrap().contains("alpha features"));
        assert!(detailed.snippet.is_none());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn read_missing_doc_is_not_found_and_traversal_rejected() {
        let root = test_dir("read_missing");
        seed(&root).await;

        let err = read_doc_core(&root, "ghost", false).unwrap_err();
        assert_eq!(err.code, ErrorCode::DocNotFound);

        let err = read_doc_core(&root, "../outside.md", false).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidPath);
        let _ = std::fs::remove_dir_all(&root);
    }
}
