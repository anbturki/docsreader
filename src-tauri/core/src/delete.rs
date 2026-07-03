use std::path::Path;

use crate::error::CoreError;
use crate::write::{locate_doc, stage_in_git, WrittenDoc};

/// Permanent removal; archive_doc_core is the soft alternative.
pub async fn delete_doc_core(root: &Path, doc_ref: &str) -> Result<WrittenDoc, CoreError> {
    let doc = locate_doc(root, doc_ref)?;
    std::fs::remove_file(&doc.path)?;
    stage_in_git(root, &[&doc.rel_path]).await;
    Ok(doc.to_written())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use crate::write::{write_doc_core, DocStatus, NewDoc};

    fn test_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_del_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn deletes_doc_and_second_delete_is_not_found() {
        let root = test_dir("gone");
        let doc = write_doc_core(&root, &NewDoc::new("Doomed", "x", DocStatus::Research))
            .await
            .unwrap();
        assert!(doc.path.is_file());

        let deleted = delete_doc_core(&root, &doc.slug).await.unwrap();
        assert_eq!(deleted.rel_path, "research/doomed.md");
        assert!(!doc.path.exists());

        let err = delete_doc_core(&root, &doc.slug).await.unwrap_err();
        assert_eq!(err.code, ErrorCode::DocNotFound);
        let _ = std::fs::remove_dir_all(&root);
    }
}
