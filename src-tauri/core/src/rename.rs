use std::path::Path;

use crate::error::{CoreError, ErrorCode};
use crate::frontmatter::{upsert_fm_line, yaml_line};
use crate::slug::slugify;
use crate::write::{
    find_doc_location, locate_doc, location_at, relocate, stage_in_git, WrittenDoc,
};

/// The new title becomes both the frontmatter title and the slug/filename;
/// status and phase stay put. A slug already taken by another doc is a
/// Conflict, never a silent counter suffix.
pub async fn rename_doc_core(
    root: &Path,
    doc_ref: &str,
    new_title: &str,
) -> Result<WrittenDoc, CoreError> {
    if new_title.trim().is_empty() {
        return Err(
            CoreError::new(ErrorCode::InvalidInput, "new_title is required")
                .with_recovery("pass a short human-readable title; it becomes the doc's new slug"),
        );
    }
    let from = locate_doc(root, doc_ref)?;
    let new_slug = slugify(new_title);
    let target = if new_slug == from.slug {
        from
    } else {
        if let Some(existing) = find_doc_location(root, &new_slug) {
            return Err(CoreError::new(
                ErrorCode::Conflict,
                format!(
                    "a doc with slug {new_slug:?} already exists at {:?}",
                    existing.rel_path
                ),
            )
            .with_recovery("choose a different title, or archive/delete the existing doc first"));
        }
        let to = location_at(root, from.status, from.phase.as_deref(), &new_slug);
        relocate(root, &from, &to).await?;
        to
    };
    let content = std::fs::read_to_string(&target.path)?;
    std::fs::write(&target.path, with_title(&content, new_title)?)?;
    stage_in_git(root, &[&target.rel_path]).await;
    Ok(target.to_written())
}

fn with_title(content: &str, title: &str) -> Result<String, CoreError> {
    let line = yaml_line("title", title)?;
    Ok(upsert_fm_line(content, "title", &line))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::write::{set_status_core, write_doc_core, DocStatus, NewDoc};

    fn test_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_ren_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn rename_moves_file_and_updates_title_within_status_and_phase() {
        let root = test_dir("move");
        let doc = write_doc_core(
            &root,
            &NewDoc {
                phase: Some("v1"),
                tags: vec!["keep".into()],
                ..NewDoc::new("Old Name", "Body.", DocStatus::Research)
            },
        )
        .await
        .unwrap();

        let renamed = rename_doc_core(&root, &doc.slug, "New Name").await.unwrap();
        assert_eq!(renamed.rel_path, "research/v1/new-name.md");
        assert!(!doc.path.exists());

        let raw = std::fs::read_to_string(&renamed.path).unwrap();
        assert!(raw.contains("title: New Name"), "got: {raw}");
        assert!(!raw.contains("Old Name"));
        assert!(raw.contains("- keep"), "other frontmatter preserved: {raw}");
        assert!(raw.ends_with("Body.\n"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn same_slug_rename_only_updates_title() {
        let root = test_dir("retitle");
        let doc = write_doc_core(&root, &NewDoc::new("my doc", "x", DocStatus::Done))
            .await
            .unwrap();

        let renamed = rename_doc_core(&root, &doc.slug, "My Doc").await.unwrap();
        assert_eq!(renamed.rel_path, doc.rel_path);
        let raw = std::fs::read_to_string(&renamed.path).unwrap();
        assert!(raw.contains("title: My Doc"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn rename_onto_existing_slug_is_conflict() {
        let root = test_dir("clash");
        write_doc_core(&root, &NewDoc::new("Taken", "a", DocStatus::Research))
            .await
            .unwrap();
        let doc = write_doc_core(&root, &NewDoc::new("Mine", "b", DocStatus::Done))
            .await
            .unwrap();
        set_status_core(&root, "taken", DocStatus::Archived)
            .await
            .unwrap();

        let err = rename_doc_core(&root, &doc.slug, "Taken")
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        assert!(err.message.contains("archived/taken.md"), "{}", err.message);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn with_title_escapes_yaml_and_handles_missing_frontmatter() {
        let updated = with_title("just a body\n", "Plain").unwrap();
        assert!(updated.starts_with("---\ntitle: Plain\n---\n\n"));
        assert!(updated.ends_with("just a body\n"));

        let updated = with_title("---\ntags: [x]\n---\n\nbody\n", "Has: colon").unwrap();
        assert!(updated.contains("title: 'Has: colon'"), "got: {updated}");
        assert!(updated.contains("tags: [x]"));
    }
}
