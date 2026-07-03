pub mod init;
pub mod migrate;
pub mod registry;
pub mod resolve;

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, ErrorCode};
use crate::slug::slugify;

pub const MARKER_FILE: &str = ".docsreader.yaml";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceScope {
    User,
    Project,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceMarker {
    pub slug: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
}

fn validate_slug(slug: &str) -> Result<(), CoreError> {
    if slug.is_empty() || slugify(slug) != slug {
        return Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("invalid workspace slug {slug:?}"),
        )
        .with_recovery(
            "slugs are lowercase alphanumerics separated by dashes, e.g. \"my-project\"",
        ));
    }
    Ok(())
}

pub fn load_marker(dir: &Path) -> Result<Option<WorkspaceMarker>, CoreError> {
    let path = dir.join(MARKER_FILE);
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let marker: WorkspaceMarker = serde_yaml::from_str(&raw).map_err(|e| {
        CoreError::new(
            ErrorCode::InvalidInput,
            format!("malformed {MARKER_FILE}: {e}"),
        )
        .with_recovery("the marker needs at least a `slug:` line")
    })?;
    validate_slug(&marker.slug)?;
    Ok(Some(marker))
}

pub fn save_marker(dir: &Path, marker: &WorkspaceMarker) -> Result<(), CoreError> {
    validate_slug(&marker.slug)?;
    let raw = serde_yaml::to_string(marker)
        .map_err(|e| CoreError::new(ErrorCode::Io, format!("serialize {MARKER_FILE}: {e}")))?;
    std::fs::create_dir_all(dir)?;
    std::fs::write(dir.join(MARKER_FILE), raw)?;
    Ok(())
}

#[cfg(test)]
pub(crate) fn test_dir(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("dr_ws_{tag}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marker_round_trips() {
        let dir = test_dir("marker_rt");
        let marker = WorkspaceMarker {
            slug: "my-project".into(),
            name: Some("My Project".into()),
            homepage: Some("index.md".into()),
        };
        save_marker(&dir, &marker).unwrap();
        assert_eq!(load_marker(&dir).unwrap(), Some(marker));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_marker_is_none() {
        let dir = test_dir("marker_none");
        assert_eq!(load_marker(&dir).unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_slug_is_typed_error() {
        let dir = test_dir("marker_noslug");
        std::fs::write(dir.join(MARKER_FILE), "name: No Slug Here\n").unwrap();
        let err = load_marker(&dir).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidInput);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn non_slug_value_rejected_on_save_and_load() {
        let dir = test_dir("marker_badslug");
        let bad = WorkspaceMarker {
            slug: "Bad Slug!".into(),
            name: None,
            homepage: None,
        };
        assert_eq!(
            save_marker(&dir, &bad).unwrap_err().code,
            ErrorCode::InvalidInput
        );
        std::fs::write(dir.join(MARKER_FILE), "slug: \"Bad Slug!\"\n").unwrap();
        assert_eq!(load_marker(&dir).unwrap_err().code, ErrorCode::InvalidInput);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
