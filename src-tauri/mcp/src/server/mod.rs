mod elicit;
mod memory_tools;
mod prompts;
mod read_tools;
mod resources;
mod task_tools;
mod workspace_tools;
mod write_tools;

use std::path::PathBuf;

use docsreader_core::error::{CoreError, ErrorCode};
use docsreader_core::workspace::WorkspaceScope;
use docsreader_core::workspace::init::init_workspace_core;
use docsreader_core::workspace::registry::{default_registry_path, load_registry};
use docsreader_core::workspace::resolve::{ResolvedWorkspace, available_slugs, resolve_workspace};
use docsreader_core::write::DocStatus;
use rmcp::model::{
    CallToolResult, ContentBlock, Implementation, ListResourceTemplatesResult, ListResourcesResult,
    PaginatedRequestParams, ReadResourceRequestParams, ReadResourceResult, Resource,
    ServerCapabilities, ServerInfo,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData, Peer, RoleServer, ServerHandler, prompt_handler, tool_handler};

pub(crate) use elicit::resolve_or_pick;

pub struct DocsServer;

impl DocsServer {
    fn combined_router() -> rmcp::handler::server::router::tool::ToolRouter<Self> {
        Self::workspace_tool_router()
            + Self::write_tool_router()
            + Self::read_tool_router()
            + Self::memory_tool_router()
            + Self::task_tool_router()
    }
}

const INSTRUCTIONS: &str = "DocsReader serves markdown docs, memory, and tasks from local workspaces. Docs live in status folders (research/in-progress/done/archived), optionally grouped by phase subfolders. Read the docsreader://onboarding resource first for the full model. Start with list_workspaces; create docs with write_doc; find them with list_docs/search_docs; read with read_doc; edit with update_doc; move through the lifecycle with set_status/set_phase/archive. Save short topic-addressed facts with write_memory; recall them with search_memory. Track work with write_task/list_tasks/set_task_status/update_task (Backlog.md-shaped files in tasks/).";

#[tool_handler(router = Self::combined_router())]
#[prompt_handler(router = Self::prompt_router())]
impl ServerHandler for DocsServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .enable_prompts()
                .build(),
        )
        .with_server_info(Implementation::new("docsreader", env!("CARGO_PKG_VERSION")))
        .with_instructions(INSTRUCTIONS)
    }

    async fn list_resources(
        &self,
        request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, ErrorData> {
        resources::list_resources_page(request.and_then(|r| r.cursor))
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, ErrorData> {
        Ok(resources::list_templates())
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResult, ErrorData> {
        resources::read_resource_at(&request.uri)
    }
}

pub(crate) fn success_json(value: serde_json::Value) -> CallToolResult {
    CallToolResult::success(vec![ContentBlock::text(value.to_string())])
}

pub(crate) fn error_result(err: &CoreError) -> CallToolResult {
    tracing::debug!(code = ?err.code, message = %err.message, "tool error");
    let payload = serde_json::json!({ "error": err });
    CallToolResult::error(vec![ContentBlock::text(payload.to_string())])
}

pub(crate) fn home_dir() -> Result<PathBuf, CoreError> {
    std::env::home_dir().ok_or_else(|| {
        CoreError::new(ErrorCode::Io, "cannot determine home directory")
            .with_recovery("set the HOME environment variable for the MCP server process")
    })
}

pub(crate) fn client_name(peer: &Peer<RoleServer>) -> Option<String> {
    peer.peer_info().map(|info| info.client_info.name.clone())
}

pub(crate) fn resolve(explicit_slug: Option<&str>) -> Result<ResolvedWorkspace, CoreError> {
    let home = home_dir()?;
    let registry = load_registry(&default_registry_path(&home))?;
    let cwd = std::env::current_dir()?;
    resolve_workspace(explicit_slug, &project_dir_hint(), &cwd, &home, &registry)
}

/// Claude Code sets CLAUDE_PROJECT_DIR to the project root in the spawned
/// server's environment (code.claude.com/docs/en/mcp). MCP Roots would carry
/// the same signal but is deprecated by SEP-2577, so the env var plus cwd
/// walk-up is the whole auto-detect story.
fn project_dir_hint() -> Vec<PathBuf> {
    std::env::var_os("CLAUDE_PROJECT_DIR")
        .map(PathBuf::from)
        .into_iter()
        .collect()
}

pub(crate) fn known_slugs() -> Result<Vec<String>, CoreError> {
    let home = home_dir()?;
    let registry = load_registry(&default_registry_path(&home))?;
    let ambient = resolve(None).ok();
    Ok(available_slugs(&registry, ambient.as_ref()))
}

/// The default user workspace is create-on-first-use: writing to it before
/// init_workspace must succeed, so agents never hit a setup wall.
pub(crate) fn ensure_workspace_exists(ws: &ResolvedWorkspace) -> Result<(), CoreError> {
    if ws.root.is_dir() {
        return Ok(());
    }
    if ws.scope != WorkspaceScope::User {
        return Err(CoreError::new(
            ErrorCode::WorkspaceNotFound,
            format!("workspace directory {} is missing", ws.root.display()),
        )
        .with_recovery(
            "call list_workspaces to see valid slugs, or init_workspace to create one",
        ));
    }
    let home = home_dir()?;
    init_workspace_core(
        &ws.root,
        Some(&ws.slug),
        None,
        WorkspaceScope::User,
        &default_registry_path(&home),
    )?;
    Ok(())
}

pub(crate) fn doc_uri(ws_slug: &str, rel_path: &str) -> String {
    format!("docsreader://{ws_slug}/{rel_path}")
}

pub(crate) fn doc_resource_link(ws_slug: &str, rel_path: &str, title: &str) -> ContentBlock {
    let resource = Resource::new(doc_uri(ws_slug, rel_path), rel_path)
        .with_title(title)
        .with_mime_type("text/markdown");
    ContentBlock::resource_link(resource)
}

pub(crate) fn parse_status(value: Option<&str>) -> Result<Option<DocStatus>, CoreError> {
    value.map(DocStatus::parse).transpose()
}

pub(crate) const TRUNCATION_GUIDANCE: &str =
    "response hit the size budget; narrow with status/phase/tag filters or a more specific query";

/// Keeps the serialized entry list under the response budget; the guidance
/// string tells the agent how to narrow instead of silently dropping items.
pub(crate) fn take_within_budget<T: serde::Serialize>(items: Vec<T>) -> (Vec<T>, bool) {
    let mut used = 0usize;
    let mut kept = Vec::new();
    let mut truncated = false;
    for item in items {
        let cost = serde_json::to_string(&item).map(|s| s.len()).unwrap_or(0);
        if used + cost > docsreader_core::read::RESPONSE_BUDGET_CHARS {
            truncated = true;
            break;
        }
        used += cost;
        kept.push(item);
    }
    (kept, truncated)
}
