use docsreader_core::error::{CoreError, ErrorCode};
use docsreader_core::workspace::resolve::{ResolvedWorkspace, WorkspaceOrigin, no_write_target};
use rmcp::model::{ElicitRequestParams, ElicitationAction, ElicitationSchema, EnumSchema};
use rmcp::service::ElicitationMode;
use rmcp::{Peer, RoleServer};

use super::{known_slugs, resolve};

/// Unknown-slug recovery for interactive clients: offer a form-elicitation
/// enum picker over the workspaces that would resolve (2025-11-25 enum +
/// default support). Headless clients and declines keep the recovery-bearing
/// error, so the non-interactive `workspace` argument path always works.
/// Only workspace slugs cross the wire - never sensitive data.
pub(crate) async fn resolve_or_pick(
    peer: &Peer<RoleServer>,
    explicit: Option<&str>,
) -> Result<ResolvedWorkspace, CoreError> {
    let err = match resolve(explicit) {
        Ok(ws) => return Ok(ws),
        Err(err) => err,
    };
    if err.code != ErrorCode::WorkspaceNotFound {
        return Err(err);
    }
    let requested = explicit.unwrap_or_default();
    match pick_workspace(
        peer,
        format!("Workspace {requested:?} was not found. Pick the workspace to use."),
    )
    .await
    {
        Some(slug) => resolve(Some(&slug)),
        None => Err(err),
    }
}

/// A write whose resolution only fell back to the user default has no chosen
/// home, so it takes the same shape as an unknown slug: pick when the client
/// can elicit, refuse with recovery when it cannot. An explicit slug is a
/// deliberate choice even when it names the user workspace; only an un-slugged
/// write drifts there unnoticed.
pub(crate) async fn resolve_for_write(
    peer: &Peer<RoleServer>,
    explicit: Option<&str>,
) -> Result<ResolvedWorkspace, CoreError> {
    let ws = resolve_or_pick(peer, explicit).await?;
    if explicit.is_some() || ws.origin == WorkspaceOrigin::Found {
        return Ok(ws);
    }
    match pick_workspace(
        peer,
        "No workspace was found for this location. Pick the workspace to write to.".to_string(),
    )
    .await
    {
        Some(slug) => resolve(Some(&slug)),
        None => Err(no_write_target(&known_slugs()?, &ws.root)),
    }
}

async fn pick_workspace(peer: &Peer<RoleServer>, message: String) -> Option<String> {
    if !peer
        .supported_elicitation_modes()
        .contains(&ElicitationMode::Form)
    {
        return None;
    }
    let choices = known_slugs().ok()?;
    if choices.is_empty() {
        return None;
    }
    let params = ElicitRequestParams::FormElicitationParams {
        meta: None,
        message,
        requested_schema: workspace_schema(choices)?,
    };
    let result = peer.create_elicitation(params).await.ok()?;
    if result.action != ElicitationAction::Accept {
        return None;
    }
    result
        .content?
        .get("workspace")?
        .as_str()
        .map(str::to_owned)
}

fn workspace_schema(choices: Vec<String>) -> Option<ElicitationSchema> {
    // A fallback resolution is what put the picker on screen, so preselecting
    // it would offer back the answer the caller is being asked to replace.
    let default = resolve(None)
        .ok()
        .filter(|ws| ws.origin == WorkspaceOrigin::Found)
        .map(|ws| ws.slug)
        .filter(|slug| choices.contains(slug));
    let mut choices = EnumSchema::builder(choices);
    if let Some(default) = default {
        choices = choices.with_default(default).ok()?;
    }
    ElicitationSchema::builder()
        .required_enum_schema("workspace", choices.build())
        .build()
        .ok()
}
