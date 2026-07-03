use std::path::Path;

use serde::Deserialize;

use super::{load_marker, save_marker, WorkspaceMarker};
use crate::error::CoreError;
use crate::slug::slugify;

const LEGACY_FILES: [&str; 2] = [".docs.yaml", "docs.yaml"];

#[derive(Debug, Default, Deserialize)]
struct LegacyProject {
    slug: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct LegacyManifest {
    project: Option<LegacyProject>,
}

/// Loads the workspace marker, migrating a legacy `.docs.yaml`/`docs.yaml`
/// manifest on first sight: only the project slug and name carry over, and
/// the legacy file stays in place for one release so older builds keep
/// working. Folders whose legacy manifest names no project are left alone -
/// a bare `docs.yaml` is not proof the folder was a DocsReader workspace.
pub fn marker_with_migration(root: &Path) -> Result<Option<WorkspaceMarker>, CoreError> {
    if let Some(marker) = load_marker(root)? {
        return Ok(Some(marker));
    }
    let Some(project) = legacy_project(root) else {
        return Ok(None);
    };
    let Some(slug) = [project.slug.as_deref(), project.name.as_deref()]
        .into_iter()
        .flatten()
        .map(slugify)
        .find(|s| !s.is_empty())
    else {
        return Ok(None);
    };
    let name = project
        .name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());
    let marker = WorkspaceMarker {
        slug,
        name,
        homepage: None,
    };
    save_marker(root, &marker)?;
    Ok(Some(marker))
}

fn legacy_project(root: &Path) -> Option<LegacyProject> {
    LEGACY_FILES
        .iter()
        .find_map(|name| std::fs::read_to_string(root.join(name)).ok())
        .and_then(|raw| serde_yaml::from_str::<LegacyManifest>(&raw).ok())
        .and_then(|manifest| manifest.project)
}

#[cfg(test)]
mod tests {
    use super::super::{test_dir, MARKER_FILE};
    use super::*;

    const RICH_LEGACY: &str = r##"
spec_version: "0.1"
project:
  slug: voice
  name: Vinfra Voice
  tagline: Carrier-grade VoIP
  icon: phone
  homepage: docs/spec/architecture.md
navigation:
  - title: Start here
    items:
      - title: Overview
        path: docs/overview.md
ignore:
  - docs/archived/**
visibility: internal
"##;

    #[test]
    fn migrates_legacy_manifest_keeping_slug_and_name_only() {
        let dir = test_dir("mig_rich");
        std::fs::write(dir.join(".docs.yaml"), RICH_LEGACY).unwrap();

        let marker = marker_with_migration(&dir).unwrap().unwrap();
        assert_eq!(marker.slug, "voice");
        assert_eq!(marker.name.as_deref(), Some("Vinfra Voice"));
        assert_eq!(marker.homepage, None);

        let written = std::fs::read_to_string(dir.join(MARKER_FILE)).unwrap();
        for dropped in ["tagline", "icon", "navigation", "ignore", "visibility"] {
            assert!(!written.contains(dropped), "{dropped} should be dropped");
        }
        assert!(
            dir.join(".docs.yaml").exists(),
            "legacy file stays for one release"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn existing_marker_wins_over_legacy_manifest() {
        let dir = test_dir("mig_marker_wins");
        std::fs::write(dir.join(MARKER_FILE), "slug: existing\n").unwrap();
        std::fs::write(dir.join(".docs.yaml"), RICH_LEGACY).unwrap();

        let marker = marker_with_migration(&dir).unwrap().unwrap();
        assert_eq!(marker.slug, "existing");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn foreign_docs_yaml_without_project_is_ignored() {
        let dir = test_dir("mig_foreign");
        std::fs::write(dir.join("docs.yaml"), "site_name: Some Other Tool\n").unwrap();

        assert_eq!(marker_with_migration(&dir).unwrap(), None);
        assert!(!dir.join(MARKER_FILE).exists(), "no marker written");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn non_slug_legacy_values_are_slugified() {
        let dir = test_dir("mig_badslug");
        std::fs::write(
            dir.join(".docs.yaml"),
            "project:\n  slug: \"Bad Slug!\"\n  name: Bad Slug\n",
        )
        .unwrap();

        let marker = marker_with_migration(&dir).unwrap().unwrap();
        assert_eq!(marker.slug, "bad-slug");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn plain_folder_yields_none() {
        let dir = test_dir("mig_plain");
        assert_eq!(marker_with_migration(&dir).unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
