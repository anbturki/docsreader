use std::path::{Path, PathBuf};

use super::registry::WorkspaceEntry;
use super::{load_marker, WorkspaceScope};
use crate::error::{CoreError, ErrorCode};

pub const DEFAULT_WORKSPACE_DIR: &str = "notes";
pub const DEFAULT_USER_SLUG: &str = "notes";

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
pub struct ResolvedWorkspace {
    pub root: PathBuf,
    pub slug: String,
    pub scope: WorkspaceScope,
}

/// Resolution order mirrors Claude Code's user+project hierarchy:
/// explicit slug > client roots hint > walk-up from cwd > default user
/// workspace. An explicit slug matches the registry or the ambient
/// (roots/walk-up/default) workspace, so every slug the server reports is
/// resolvable even before registration. Only an explicit slug matching
/// neither fails.
pub fn resolve_workspace(
    explicit_slug: Option<&str>,
    roots_hint: &[PathBuf],
    cwd: &Path,
    home: &Path,
    registry: &[WorkspaceEntry],
) -> Result<ResolvedWorkspace, CoreError> {
    let ambient = ambient_workspace(roots_hint, cwd, home)?;
    match explicit_slug {
        Some(slug) => resolve_explicit(slug, registry, ambient),
        None => Ok(ambient),
    }
}

fn ambient_workspace(
    roots_hint: &[PathBuf],
    cwd: &Path,
    home: &Path,
) -> Result<ResolvedWorkspace, CoreError> {
    for base in roots_hint.iter().map(PathBuf::as_path).chain(walk_up(cwd)) {
        if let Some(found) = project_workspace_at(base)? {
            return Ok(found);
        }
    }
    user_default(home)
}

fn resolve_explicit(
    slug: &str,
    registry: &[WorkspaceEntry],
    ambient: ResolvedWorkspace,
) -> Result<ResolvedWorkspace, CoreError> {
    if let Some(entry) = registry.iter().find(|w| w.slug == slug && w.path.is_dir()) {
        return Ok(ResolvedWorkspace {
            root: entry.path.clone(),
            slug: entry.slug.clone(),
            scope: entry.scope,
        });
    }
    if ambient.slug == slug && ambient.root.is_dir() {
        return Ok(ambient);
    }
    let available = available_slugs(registry, Some(&ambient));
    Err(CoreError::new(
        ErrorCode::WorkspaceNotFound,
        format!("no workspace with slug {slug:?}"),
    )
    .with_recovery(format!(
        "available workspaces: [{}]; call list_workspaces or init_workspace",
        available.join(", ")
    )))
}

/// Slugs that would resolve right now: registered workspaces whose directory
/// still exists, plus the ambient workspace when it exists unregistered.
pub fn available_slugs(
    registry: &[WorkspaceEntry],
    ambient: Option<&ResolvedWorkspace>,
) -> Vec<String> {
    let mut available: Vec<String> = registry
        .iter()
        .filter(|w| w.path.is_dir())
        .map(|w| w.slug.clone())
        .collect();
    if let Some(ambient) = ambient {
        if ambient.root.is_dir() && !available.iter().any(|s| s == &ambient.slug) {
            available.push(ambient.slug.clone());
        }
    }
    available
}

fn walk_up(cwd: &Path) -> impl Iterator<Item = &Path> {
    cwd.ancestors()
}

fn project_workspace_at(base: &Path) -> Result<Option<ResolvedWorkspace>, CoreError> {
    let candidate = base.join(DEFAULT_WORKSPACE_DIR);
    match load_marker(&candidate)? {
        Some(marker) => Ok(Some(ResolvedWorkspace {
            root: candidate,
            slug: marker.slug,
            scope: WorkspaceScope::Project,
        })),
        None => Ok(None),
    }
}

fn user_default(home: &Path) -> Result<ResolvedWorkspace, CoreError> {
    let root = home.join(DEFAULT_WORKSPACE_DIR);
    let slug = match load_marker(&root)? {
        Some(marker) => marker.slug,
        None => DEFAULT_USER_SLUG.to_string(),
    };
    Ok(ResolvedWorkspace {
        root,
        slug,
        scope: WorkspaceScope::User,
    })
}

#[cfg(test)]
mod tests {
    use super::super::{save_marker, test_dir, WorkspaceMarker};
    use super::*;

    fn marker(slug: &str) -> WorkspaceMarker {
        WorkspaceMarker {
            slug: slug.into(),
            name: None,
            homepage: None,
        }
    }

    #[test]
    fn walk_up_finds_project_workspace_from_nested_cwd() {
        let dir = test_dir("res_walkup");
        let project = dir.join("repo");
        save_marker(&project.join("notes"), &marker("repo-notes")).unwrap();
        let cwd = project.join("src/deeply/nested");
        std::fs::create_dir_all(&cwd).unwrap();

        let resolved = resolve_workspace(None, &[], &cwd, &dir.join("home"), &[]).unwrap();
        assert_eq!(resolved.slug, "repo-notes");
        assert_eq!(resolved.scope, WorkspaceScope::Project);
        assert_eq!(resolved.root, project.join("notes"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn roots_hint_wins_over_cwd_walk_up() {
        let dir = test_dir("res_roots");
        let hinted = dir.join("hinted");
        save_marker(&hinted.join("notes"), &marker("hinted-notes")).unwrap();
        let other = dir.join("other");
        save_marker(&other.join("notes"), &marker("other-notes")).unwrap();

        let resolved = resolve_workspace(
            None,
            std::slice::from_ref(&hinted),
            &other,
            &dir.join("home"),
            &[],
        )
        .unwrap();
        assert_eq!(resolved.slug, "hinted-notes");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_marker_defaults_to_user_workspace() {
        let dir = test_dir("res_default");
        let home = dir.join("home");
        let cwd = dir.join("elsewhere");
        std::fs::create_dir_all(&cwd).unwrap();

        let resolved = resolve_workspace(None, &[], &cwd, &home, &[]).unwrap();
        assert_eq!(resolved.root, home.join("notes"));
        assert_eq!(resolved.slug, DEFAULT_USER_SLUG);
        assert_eq!(resolved.scope, WorkspaceScope::User);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn user_workspace_marker_slug_wins_over_default() {
        let dir = test_dir("res_userslug");
        let home = dir.join("home");
        save_marker(&home.join("notes"), &marker("ali-notes")).unwrap();

        let resolved = resolve_workspace(None, &[], &dir, &home, &[]).unwrap();
        assert_eq!(resolved.slug, "ali-notes");
        assert_eq!(resolved.scope, WorkspaceScope::User);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn explicit_slug_resolves_from_registry() {
        let dir = test_dir("res_explicit");
        let ws = dir.join("proj/notes");
        save_marker(&ws, &marker("proj")).unwrap();
        let registry = vec![WorkspaceEntry {
            slug: "proj".into(),
            path: ws.clone(),
            scope: WorkspaceScope::Project,
        }];

        let resolved = resolve_workspace(Some("proj"), &[], &dir, &dir, &registry).unwrap();
        assert_eq!(resolved.root, ws);
        assert_eq!(resolved.scope, WorkspaceScope::Project);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn explicit_slug_matches_unregistered_walk_up_workspace() {
        let dir = test_dir("res_ambient");
        let project = dir.join("repo");
        save_marker(&project.join("notes"), &marker("repo-notes")).unwrap();

        let resolved =
            resolve_workspace(Some("repo-notes"), &[], &project, &dir.join("home"), &[]).unwrap();
        assert_eq!(resolved.root, project.join("notes"));
        assert_eq!(resolved.scope, WorkspaceScope::Project);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn unknown_slug_recovery_lists_ambient_workspace() {
        let dir = test_dir("res_ambient_list");
        let project = dir.join("repo");
        save_marker(&project.join("notes"), &marker("repo-notes")).unwrap();

        let err =
            resolve_workspace(Some("ghost"), &[], &project, &dir.join("home"), &[]).unwrap_err();
        assert!(err.recovery.as_deref().unwrap().contains("repo-notes"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn explicit_unknown_slug_fails_loud_with_available_list() {
        let dir = test_dir("res_unknown");
        let ws = dir.join("known/notes");
        save_marker(&ws, &marker("known")).unwrap();
        let registry = vec![WorkspaceEntry {
            slug: "known".into(),
            path: ws,
            scope: WorkspaceScope::Project,
        }];

        let err = resolve_workspace(Some("ghost"), &[], &dir, &dir, &registry).unwrap_err();
        assert_eq!(err.code, ErrorCode::WorkspaceNotFound);
        assert!(err.recovery.as_deref().unwrap().contains("known"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
