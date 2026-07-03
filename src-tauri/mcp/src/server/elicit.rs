use docsreader_core::error::{CoreError, ErrorCode};
use docsreader_core::workspace::resolve::ResolvedWorkspace;
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
    match pick_workspace(peer, explicit.unwrap_or_default()).await {
        Some(slug) => resolve(Some(&slug)),
        None => Err(err),
    }
}

async fn pick_workspace(peer: &Peer<RoleServer>, requested: &str) -> Option<String> {
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
        message: format!("Workspace {requested:?} was not found. Pick the workspace to use."),
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
    let default = resolve(None)
        .ok()
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
