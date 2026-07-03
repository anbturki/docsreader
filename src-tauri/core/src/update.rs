use std::path::Path;

use crate::error::{CoreError, ErrorCode};
use crate::git;
use crate::write::{enforce_size_limit, locate_doc, WrittenDoc};

fn match_line_numbers(content: &str, needle: &str) -> Vec<usize> {
    content
        .match_indices(needle)
        .map(|(offset, _)| content[..offset].matches('\n').count() + 1)
        .collect()
}

/// str_replace with the Anthropic memory-tool contract: old_str must appear
/// exactly once, and the error strings match that tool's reference wording
/// verbatim so agents trained on it recover the same way.
pub async fn str_replace_core(
    root: &Path,
    doc_ref: &str,
    old_str: &str,
    new_str: &str,
) -> Result<WrittenDoc, CoreError> {
    let doc = locate_doc(root, doc_ref)?;
    str_replace_at(root, &doc.path, &doc.rel_path, old_str, new_str).await?;
    Ok(doc.to_written())
}

/// The memory-tool str_replace contract applied to an already-located file.
pub(crate) async fn str_replace_at(
    root: &Path,
    path: &std::path::Path,
    rel_path: &str,
    old_str: &str,
    new_str: &str,
) -> Result<(), CoreError> {
    if old_str.is_empty() {
        return Err(
            CoreError::new(ErrorCode::InvalidInput, "old_str must not be empty")
                .with_recovery("pass the exact text to replace"),
        );
    }
    let content = std::fs::read_to_string(path)?;
    let lines = match_line_numbers(&content, old_str);
    match lines.len() {
        0 => Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!(
                "No replacement was performed, old_str `{old_str}` did not appear verbatim in {rel_path}."
            ),
        )),
        1 => {
            let updated = content.replacen(old_str, new_str, 1);
            enforce_size_limit(updated.len())?;
            std::fs::write(path, updated)?;
            let root_str = root.to_string_lossy();
            if git::is_git_repo(&root_str).await {
                git::git_add(&root_str, &[rel_path]).await;
            }
            Ok(())
        }
        _ => {
            let mut unique_lines = lines;
            unique_lines.dedup();
            let listed: Vec<String> = unique_lines.iter().map(usize::to_string).collect();
            Err(CoreError::new(
                ErrorCode::InvalidInput,
                format!(
                    "No replacement was performed. Multiple occurrences of old_str `{old_str}` in lines: {}. Please ensure it is unique",
                    listed.join(", ")
                ),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::write::{write_doc_core, DocStatus, NewDoc};

    fn test_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_upd_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn replaces_a_unique_match() {
        let root = test_dir("ok");
        let doc = write_doc_core(
            &root,
            &NewDoc::new("Prefs", "Favorite color: blue", DocStatus::Research),
        )
        .await
        .unwrap();

        str_replace_core(&root, &doc.slug, "blue", "green")
            .await
            .unwrap();
        let raw = std::fs::read_to_string(&doc.path).unwrap();
        assert!(raw.contains("Favorite color: green"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn no_match_uses_verbatim_memory_tool_error() {
        let root = test_dir("nomatch");
        let doc = write_doc_core(&root, &NewDoc::new("Prefs", "text", DocStatus::Research))
            .await
            .unwrap();

        let err = str_replace_core(&root, &doc.slug, "absent", "x")
            .await
            .unwrap_err();
        assert_eq!(
            err.message,
            "No replacement was performed, old_str `absent` did not appear verbatim in research/prefs.md."
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn duplicate_match_lists_lines_and_asks_for_unique() {
        let root = test_dir("dupe");
        let doc = write_doc_core(
            &root,
            &NewDoc::new("Dupes", "alpha\nother\nalpha", DocStatus::Research),
        )
        .await
        .unwrap();

        let err = str_replace_core(&root, &doc.slug, "alpha", "x")
            .await
            .unwrap_err();
        assert!(
            err.message.starts_with(
                "No replacement was performed. Multiple occurrences of old_str `alpha` in lines:"
            ),
            "got: {}",
            err.message
        );
        assert!(err.message.ends_with("Please ensure it is unique"));
        let _ = std::fs::remove_dir_all(&root);
    }
}
