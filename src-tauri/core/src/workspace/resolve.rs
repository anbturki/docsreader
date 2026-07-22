use std::path::{Path, PathBuf};

use super::registry::{live_workspaces, same_folder, WorkspaceEntry};
use super::{load_marker, WorkspaceScope, MARKER_FILE};
use crate::error::{CoreError, ErrorCode};

pub const DEFAULT_WORKSPACE_DIR: &str = "notes";
pub const DEFAULT_USER_SLUG: &str = "notes";

/// Whether the answer names a workspace that exists, or the user default
/// handed back because the search found nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceOrigin {
    Found,
    Fallback,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
pub struct ResolvedWorkspace {
    pub root: PathBuf,
    pub slug: String,
    pub scope: WorkspaceScope,
    // Kept out of the wire format: no tool reports it yet, and adding it would
    // change every tool result that carries a workspace.
    #[serde(skip)]
    pub origin: WorkspaceOrigin,
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
        Some(slug) => resolve_explicit(slug, &live_workspaces(registry.to_vec()), ambient),
        None => Ok(ambient),
    }
}

fn ambient_workspace(
    roots_hint: &[PathBuf],
    cwd: &Path,
    home: &Path,
) -> Result<ResolvedWorkspace, CoreError> {
    for base in roots_hint.iter().map(PathBuf::as_path).chain(walk_up(cwd)) {
        // ~/notes is the user default, not a project workspace; skip the home
        // directory so the walk-up never tags it Project. user_default below
        // classifies it as User, keeping scope consistent with the registry.
        if base == home {
            continue;
        }
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
    let mut matches = workspaces_with_slug(slug, registry, &ambient);
    match matches.len() {
        0 => Err(unknown_slug(slug, registry, &ambient)),
        1 => Ok(matches.remove(0)),
        _ => Err(ambiguous_slug(slug, &matches)),
    }
}

/// Every workspace the slug could mean: registered entries plus the ambient
/// one, which may still be unregistered. Two folders sharing a slug is a
/// real state on disk, so more than one answer is possible.
fn workspaces_with_slug(
    slug: &str,
    registry: &[WorkspaceEntry],
    ambient: &ResolvedWorkspace,
) -> Vec<ResolvedWorkspace> {
    let mut found: Vec<ResolvedWorkspace> = Vec::new();
    let mut add = |candidate: ResolvedWorkspace| {
        if candidate.slug == slug
            && candidate.root.is_dir()
            && !found.iter().any(|w| same_folder(&w.root, &candidate.root))
        {
            found.push(candidate);
        }
    };
    for entry in registry {
        add(ResolvedWorkspace {
            root: entry.path.clone(),
            slug: entry.slug.clone(),
            scope: entry.scope,
            origin: WorkspaceOrigin::Found,
        });
    }
    add(ambient.clone());
    found
}

fn unknown_slug(slug: &str, registry: &[WorkspaceEntry], ambient: &ResolvedWorkspace) -> CoreError {
    let available = available_slugs(registry, Some(ambient));
    CoreError::new(
        ErrorCode::WorkspaceNotFound,
        format!("no workspace with slug {slug:?}"),
    )
    .with_recovery(format!(
        "available workspaces: [{}]; call list_workspaces or init_workspace",
        available.join(", ")
    ))
}

fn ambiguous_slug(slug: &str, matches: &[ResolvedWorkspace]) -> CoreError {
    let paths: Vec<String> = matches
        .iter()
        .map(|w| w.root.display().to_string())
        .collect();
    CoreError::new(
        ErrorCode::Conflict,
        format!(
            "the slug {slug:?} belongs to more than one workspace: {}",
            paths.join(", ")
        ),
    )
    .with_recovery(format!(
        "these folders share a slug, so there is no safe way to pick one and writing to the wrong one would be silent. A workspace takes its slug from the {MARKER_FILE} in its own folder, so give one of them a different slug there and retry. Meanwhile use a slug only one workspace has",
    ))
}

/// Slugs that would resolve right now: registered workspaces whose directory
/// still exists, plus the ambient workspace when it exists unregistered.
pub fn available_slugs(
    registry: &[WorkspaceEntry],
    ambient: Option<&ResolvedWorkspace>,
) -> Vec<String> {
    let mut available: Vec<String> = Vec::new();
    let live = live_workspaces(registry.to_vec());
    let candidates = live
        .iter()
        .map(|w| w.slug.clone())
        .chain(ambient.filter(|a| a.root.is_dir()).map(|a| a.slug.clone()));
    for slug in candidates {
        if !available.contains(&slug) {
            available.push(slug);
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
            origin: WorkspaceOrigin::Found,
        })),
        None => Ok(None),
    }
}

fn user_default(home: &Path) -> Result<ResolvedWorkspace, CoreError> {
    let root = home.join(DEFAULT_WORKSPACE_DIR);
    let (slug, origin) = match load_marker(&root)? {
        Some(marker) => (marker.slug, WorkspaceOrigin::Found),
        None => (DEFAULT_USER_SLUG.to_string(), WorkspaceOrigin::Fallback),
    };
    Ok(ResolvedWorkspace {
        root,
        slug,
        scope: WorkspaceScope::User,
        origin,
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
    fn home_notes_stays_user_scope_when_reached_by_walk_up() {
        let dir = test_dir("res_home_scope");
        let home = dir.join("home");
        save_marker(&home.join("notes"), &marker("ali-notes")).unwrap();
        // cwd is inside home but not inside any project workspace, so the
        // walk-up reaches ~/notes. It must stay User, matching the registry.
        let cwd = home.join("projects/some-repo");
        std::fs::create_dir_all(&cwd).unwrap();

        let resolved = resolve_workspace(None, &[], &cwd, &home, &[]).unwrap();
        assert_eq!(resolved.root, home.join("notes"));
        assert_eq!(resolved.slug, "ali-notes");
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
    fn project_workspace_is_a_real_resolution() {
        let dir = test_dir("res_origin_project");
        let project = dir.join("repo");
        save_marker(&project.join("notes"), &marker("repo-notes")).unwrap();

        let resolved = resolve_workspace(None, &[], &project, &dir.join("home"), &[]).unwrap();
        assert_eq!(resolved.origin, WorkspaceOrigin::Found);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn existing_user_workspace_is_a_real_resolution() {
        let dir = test_dir("res_origin_user");
        let home = dir.join("home");
        save_marker(&home.join("notes"), &marker("ali-notes")).unwrap();
        let cwd = home.join("projects/some-repo");
        std::fs::create_dir_all(&cwd).unwrap();

        let resolved = resolve_workspace(None, &[], &cwd, &home, &[]).unwrap();
        assert_eq!(resolved.slug, "ali-notes");
        assert_eq!(resolved.origin, WorkspaceOrigin::Found);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn nothing_found_anywhere_is_a_fallback() {
        let dir = test_dir("res_origin_fallback");
        let home = dir.join("home");
        let cwd = dir.join("elsewhere");
        std::fs::create_dir_all(&cwd).unwrap();

        let resolved = resolve_workspace(None, &[], &cwd, &home, &[]).unwrap();
        assert_eq!(resolved.root, home.join("notes"));
        assert_eq!(resolved.origin, WorkspaceOrigin::Fallback);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn origin_stays_out_of_the_serialized_shape() {
        let dir = test_dir("res_origin_serde");
        let home = dir.join("home");
        let resolved = resolve_workspace(None, &[], &dir, &home, &[]).unwrap();

        let json = serde_json::to_value(&resolved).unwrap();
        let mut keys: Vec<&String> = json.as_object().unwrap().keys().collect();
        keys.sort();
        assert_eq!(keys, ["root", "scope", "slug"]);
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
    fn pre_existing_duplicate_slug_fails_instead_of_picking_one() {
        let dir = test_dir("res_dupe");
        let first = dir.join("a/notes");
        let second = dir.join("b/notes");
        save_marker(&first, &marker("acme")).unwrap();
        save_marker(&second, &marker("acme")).unwrap();
        let registry = vec![
            WorkspaceEntry {
                slug: "acme".into(),
                path: first.clone(),
                scope: WorkspaceScope::Project,
            },
            WorkspaceEntry {
                slug: "acme".into(),
                path: second.clone(),
                scope: WorkspaceScope::Project,
            },
        ];

        let err = resolve_workspace(Some("acme"), &[], &dir, &dir, &registry).unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        for path in [&first, &second] {
            assert!(
                err.message.contains(&path.display().to_string()),
                "message names every colliding workspace: {}",
                err.message
            );
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn duplicate_slug_resolves_when_only_one_workspace_still_exists() {
        let dir = test_dir("res_dupe_stale");
        let live = dir.join("a/notes");
        save_marker(&live, &marker("acme")).unwrap();
        let registry = vec![
            WorkspaceEntry {
                slug: "acme".into(),
                path: dir.join("deleted/notes"),
                scope: WorkspaceScope::Project,
            },
            WorkspaceEntry {
                slug: "acme".into(),
                path: live.clone(),
                scope: WorkspaceScope::Project,
            },
        ];

        let resolved = resolve_workspace(Some("acme"), &[], &dir, &dir, &registry).unwrap();
        assert_eq!(resolved.root, live);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn registered_slug_shared_with_a_different_ambient_workspace_is_ambiguous() {
        let dir = test_dir("res_dupe_ambient");
        let registered = dir.join("a/notes");
        let project = dir.join("b");
        save_marker(&registered, &marker("acme")).unwrap();
        save_marker(&project.join("notes"), &marker("acme")).unwrap();
        let registry = vec![WorkspaceEntry {
            slug: "acme".into(),
            path: registered,
            scope: WorkspaceScope::Project,
        }];

        let err = resolve_workspace(Some("acme"), &[], &project, &dir.join("home"), &registry)
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::Conflict);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn hand_edited_marker_beats_the_slug_the_registry_recorded() {
        let dir = test_dir("res_marker_drift");
        let ws = dir.join("proj/notes");
        save_marker(&ws, &marker("renamed-by-hand")).unwrap();
        let registry = vec![WorkspaceEntry {
            slug: "stale".into(),
            path: ws.clone(),
            scope: WorkspaceScope::Project,
        }];

        let resolved =
            resolve_workspace(Some("renamed-by-hand"), &[], &dir, &dir, &registry).unwrap();
        assert_eq!(resolved.root, ws);
        assert_eq!(
            resolve_workspace(Some("stale"), &[], &dir, &dir, &registry)
                .unwrap_err()
                .code,
            ErrorCode::WorkspaceNotFound,
            "the folder no longer answers to the slug the registry recorded"
        );
        assert_eq!(
            available_slugs(&registry, None),
            ["renamed-by-hand"],
            "the advertised slug is the one the folder carries"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn one_folder_registered_under_two_spellings_is_not_ambiguous() {
        let dir = test_dir("res_symlinked");
        let real = dir.join("real/notes");
        save_marker(&real, &marker("acme")).unwrap();
        let link = dir.join("link");
        std::os::unix::fs::symlink(dir.join("real"), &link).unwrap();
        let registry = vec![
            WorkspaceEntry {
                slug: "acme".into(),
                path: real.clone(),
                scope: WorkspaceScope::Project,
            },
            WorkspaceEntry {
                slug: "acme".into(),
                path: link.join("notes"),
                scope: WorkspaceScope::Project,
            },
        ];

        let resolved = resolve_workspace(Some("acme"), &[], &dir, &dir, &registry).unwrap();
        assert_eq!(resolved.root, real);
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
