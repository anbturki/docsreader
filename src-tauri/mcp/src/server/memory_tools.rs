use docsreader_core::error::CoreError;
use docsreader_core::memory::{MemoryEntry, MemoryHit, search_memory_core, write_memory_core};
use docsreader_core::workspace::resolve::ResolvedWorkspace;
use rmcp::handler::server::wrapper::{Json, Parameters};
use rmcp::model::CallToolResult;
use rmcp::{Peer, RoleServer, tool, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::{
    DocsServer, TRUNCATION_GUIDANCE, client_name, doc_uri, ensure_workspace_exists, error_result,
    resolve_or_pick, take_within_budget,
};

#[derive(Deserialize, JsonSchema)]
pub struct WriteMemoryParams {
    /// Short topic the memory is about, e.g. "user-preferences" or
    /// "auth stack". One entry per topic; writing the same topic overwrites.
    pub topic: String,
    /// The fact(s) to remember, as markdown. Replaces any previous content
    /// for this topic wholesale.
    pub content: String,
    /// Topic tags.
    pub tags: Option<Vec<String>>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SearchMemoryParams {
    /// Search term matched against topic, tags, and content. Omit to list
    /// every entry, newest first.
    pub query: Option<String>,
    /// Filter by tag.
    pub tag: Option<String>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWriteResult {
    pub ok: bool,
    pub workspace: ResolvedWorkspace,
    #[serde(flatten)]
    pub entry: MemoryEntry,
    /// Resource URI for this entry (docsreader://<workspace>/memory/<slug>.md).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHitEntry {
    #[serde(flatten)]
    pub hit: MemoryHit,
    /// Resource URI for this entry (docsreader://<workspace>/memory/<slug>.md).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchMemoryResult {
    pub workspace: ResolvedWorkspace,
    pub memories: Vec<MemoryHitEntry>,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guidance: Option<String>,
}

#[tool_router(router = memory_tool_router, vis = "pub(crate)")]
impl DocsServer {
    #[tool(
        description = "Save a short topic-addressed memory (a fact, preference, or decision) for future sessions. One entry per topic: writing an existing topic overwrites its content wholesale, so include everything still worth remembering. Memories have no lifecycle status.",
        annotations(idempotent_hint = true)
    )]
    async fn write_memory(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<WriteMemoryParams>,
    ) -> Result<Json<MemoryWriteResult>, CallToolResult> {
        let agent = client_name(&peer);
        let result = async {
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            ensure_workspace_exists(&ws)?;
            let entry = write_memory_core(
                &ws.root,
                &p.topic,
                &p.content,
                &p.tags.clone().unwrap_or_default(),
                agent.as_deref(),
            )
            .await?;
            Ok::<_, CoreError>((ws, entry))
        }
        .await;
        result
            .map(|(ws, entry)| {
                Json(MemoryWriteResult {
                    ok: true,
                    uri: doc_uri(&ws.slug, &entry.rel_path),
                    workspace: ws,
                    entry,
                })
            })
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Recall memories: ranked matches against topic, tags, and content, each with its full content. Omit the query to list every entry, newest first. Check here for prior context before re-deriving facts.",
        annotations(read_only_hint = true)
    )]
    async fn search_memory(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<SearchMemoryParams>,
    ) -> Result<Json<SearchMemoryResult>, CallToolResult> {
        let result = async {
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let hits = if ws.root.is_dir() {
                search_memory_core(&ws.root, p.query.as_deref(), p.tag.as_deref())?
            } else {
                Vec::new()
            };
            let entries: Vec<MemoryHitEntry> = hits
                .into_iter()
                .map(|hit| MemoryHitEntry {
                    uri: doc_uri(&ws.slug, &hit.rel_path),
                    hit,
                })
                .collect();
            let (memories, truncated) = take_within_budget(entries);
            Ok::<_, CoreError>(SearchMemoryResult {
                workspace: ws,
                memories,
                truncated,
                guidance: truncated.then(|| TRUNCATION_GUIDANCE.to_string()),
            })
        }
        .await;
        result.map(Json).map_err(|e| error_result(&e))
    }
}
