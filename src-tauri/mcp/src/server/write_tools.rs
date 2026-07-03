use std::path::Path;

use docsreader_core::delete::delete_doc_core;
use docsreader_core::error::CoreError;
use docsreader_core::memory::delete_memory_core;
use docsreader_core::rename::rename_doc_core;
use docsreader_core::tasks::delete_task_core;
use docsreader_core::update::str_replace_core;
use docsreader_core::workspace::resolve::ResolvedWorkspace;
use docsreader_core::write::{
    DocStatus, NewDoc, WrittenDoc, archive_doc_core, set_phase_core, set_status_core,
    write_doc_core,
};
use rmcp::handler::server::wrapper::{Json, Parameters};
use rmcp::model::{CallToolResult, ContentBlock};
use rmcp::{Peer, RoleServer, tool, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::{
    DocsServer, client_name, doc_resource_link, doc_uri, ensure_workspace_exists, error_result,
    resolve_or_pick,
};

#[derive(Deserialize, JsonSchema)]
pub struct WriteDocParams {
    /// Short human-readable title; becomes the doc's slug and filename.
    pub title: String,
    /// Markdown body. Frontmatter is generated automatically; do not include it.
    pub body: String,
    /// Lifecycle status: one of "research", "in-progress", "done", "archived".
    pub status: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default
    /// workspace (project ./notes if present, else user ~/notes).
    pub workspace: Option<String>,
    /// Phase subfolder within the status folder, e.g. "discovery" or "v2-launch".
    pub phase: Option<String>,
    /// Owner of the doc (person or agent name).
    pub owner: Option<String>,
    /// Topic tags.
    pub tags: Option<Vec<String>>,
    /// Priority label, e.g. "high" | "medium" | "low".
    pub priority: Option<String>,
    /// Due date in ISO format (YYYY-MM-DD).
    pub due: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct UpdateDocParams {
    /// Doc slug or status-relative path (e.g. "research/api-notes.md").
    pub path: String,
    /// Exact text to replace; must appear exactly once in the doc.
    pub old_str: String,
    /// Replacement text. Omit to delete old_str.
    pub new_str: Option<String>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SetStatusParams {
    /// Doc slug or status-relative path.
    pub path: String,
    /// Target status: "research" | "in-progress" | "done" | "archived".
    pub status: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SetPhaseParams {
    /// Doc slug or status-relative path.
    pub path: String,
    /// Phase subfolder name (e.g. "v2-launch"). Omit to move the doc out of
    /// its phase subfolder.
    pub phase: Option<String>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct ArchiveParams {
    /// Doc slug or status-relative path.
    pub path: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct DeleteDocParams {
    /// Doc slug or status-relative path.
    pub path: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct RenameDocParams {
    /// Doc slug or status-relative path.
    pub path: String,
    /// New human-readable title; becomes the frontmatter title and the new
    /// slug/filename.
    pub new_title: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct DocDeleteResult {
    pub ok: bool,
    pub workspace: ResolvedWorkspace,
    pub slug: String,
    /// Status-relative path the doc was deleted from.
    pub rel_path: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct DocChangeResult {
    pub ok: bool,
    pub workspace: ResolvedWorkspace,
    #[serde(flatten)]
    pub doc: WrittenDoc,
    /// Resource URI for this doc (docsreader://<workspace>/<relPath>).
    pub uri: String,
}

fn change_result(ws: ResolvedWorkspace, doc: WrittenDoc) -> Json<DocChangeResult> {
    Json(DocChangeResult {
        ok: true,
        uri: doc_uri(&ws.slug, &doc.rel_path),
        workspace: ws,
        doc,
    })
}

async fn located(
    peer: &Peer<RoleServer>,
    workspace: Option<&str>,
) -> Result<ResolvedWorkspace, CoreError> {
    let ws = resolve_or_pick(peer, workspace).await?;
    ensure_workspace_exists(&ws)?;
    Ok(ws)
}

#[tool_router(router = write_tool_router, vis = "pub(crate)")]
impl DocsServer {
    #[tool(
        description = "Create a markdown doc in a DocsReader workspace. The doc lands in the folder matching its status (research | in-progress | done | archived), optionally inside a phase subfolder, with generated frontmatter. Prefer this over writing files directly: it handles slugs, collisions, metadata, and git staging.",
        annotations(destructive_hint = false)
    )]
    async fn write_doc(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<WriteDocParams>,
    ) -> CallToolResult {
        let created_by = client_name(&peer);
        match write_doc_impl(&peer, &p, created_by.as_deref()).await {
            Ok((ws, doc)) => {
                let link = doc_resource_link(&ws.slug, &doc.rel_path, &p.title);
                let body = serde_json::json!({
                    "ok": true,
                    "path": doc.path,
                    "relPath": doc.rel_path,
                    "slug": doc.slug,
                    "status": doc.status,
                    "phase": doc.phase,
                    "workspace": ws,
                });
                CallToolResult::success(vec![ContentBlock::text(body.to_string()), link])
            }
            Err(err) => error_result(&err),
        }
    }

    #[tool(
        description = "Edit a doc in place by exact string replacement (str_replace). old_str must appear exactly once; on failure the error explains whether it was missing or ambiguous."
    )]
    async fn update_doc(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<UpdateDocParams>,
    ) -> Result<Json<DocChangeResult>, CallToolResult> {
        let result = async {
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let doc = str_replace_core(
                &ws.root,
                &p.path,
                &p.old_str,
                p.new_str.as_deref().unwrap_or(""),
            )
            .await?;
            Ok::<_, CoreError>((ws, doc))
        }
        .await;
        result
            .map(|(ws, doc)| change_result(ws, doc))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Move a doc to a different lifecycle status (research | in-progress | done | archived). The move IS the status change; any phase subfolder is preserved.",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn set_status(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<SetStatusParams>,
    ) -> Result<Json<DocChangeResult>, CallToolResult> {
        let result = async {
            let status = DocStatus::parse(&p.status)?;
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let doc = set_status_core(&ws.root, &p.path, status).await?;
            Ok::<_, CoreError>((ws, doc))
        }
        .await;
        result
            .map(|(ws, doc)| change_result(ws, doc))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Move a doc into a phase subfolder within its status (or out of it when phase is omitted).",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn set_phase(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<SetPhaseParams>,
    ) -> Result<Json<DocChangeResult>, CallToolResult> {
        let result = async {
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let doc = set_phase_core(&ws.root, &p.path, p.phase.as_deref()).await?;
            Ok::<_, CoreError>((ws, doc))
        }
        .await;
        result
            .map(|(ws, doc)| change_result(ws, doc))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Archive a doc: shorthand for set_status(path, \"archived\").",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn archive(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<ArchiveParams>,
    ) -> Result<Json<DocChangeResult>, CallToolResult> {
        let result = async {
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let doc = archive_doc_core(&ws.root, &p.path).await?;
            Ok::<_, CoreError>((ws, doc))
        }
        .await;
        result
            .map(|(ws, doc)| change_result(ws, doc))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Rename a doc: the new title becomes the frontmatter title and a new slug/filename. The doc stays in its status and phase; renaming onto a slug another doc uses is a conflict.",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn rename_doc(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<RenameDocParams>,
    ) -> Result<Json<DocChangeResult>, CallToolResult> {
        let result = async {
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let doc = rename_doc_core(&ws.root, &p.path, &p.new_title).await?;
            Ok::<_, CoreError>((ws, doc))
        }
        .await;
        result
            .map(|(ws, doc)| change_result(ws, doc))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Permanently delete a doc (or a memory entry via \"memory/<slug>.md\", or a task via its \"tasks/...\" path) from the workspace. Outside git history this cannot be undone; prefer archive to keep a doc browsable.",
        annotations(destructive_hint = true, idempotent_hint = true)
    )]
    async fn delete_doc(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<DeleteDocParams>,
    ) -> Result<Json<DocDeleteResult>, CallToolResult> {
        let result = async {
            let ws = located(&peer, p.workspace.as_deref()).await?;
            let (slug, rel_path) = if p.path.starts_with("memory/") {
                let entry = delete_memory_core(&ws.root, &p.path).await?;
                (entry.slug, entry.rel_path)
            } else if p.path.starts_with("tasks/") {
                let task = delete_task_core(&ws.root, &p.path).await?;
                (task.id, task.rel_path)
            } else {
                let doc = delete_doc_core(&ws.root, &p.path).await?;
                (doc.slug, doc.rel_path)
            };
            Ok::<_, CoreError>((ws, slug, rel_path))
        }
        .await;
        result
            .map(|(ws, slug, rel_path)| {
                Json(DocDeleteResult {
                    ok: true,
                    workspace: ws,
                    slug,
                    rel_path,
                })
            })
            .map_err(|e| error_result(&e))
    }
}

async fn write_doc_impl(
    peer: &Peer<RoleServer>,
    p: &WriteDocParams,
    created_by: Option<&str>,
) -> Result<(ResolvedWorkspace, WrittenDoc), CoreError> {
    let status = DocStatus::parse(&p.status)?;
    let ws = located(peer, p.workspace.as_deref()).await?;
    let doc = NewDoc {
        created_by,
        phase: p.phase.as_deref(),
        owner: p.owner.as_deref(),
        tags: p.tags.clone().unwrap_or_default(),
        priority: p.priority.as_deref(),
        due: p.due.as_deref(),
        ..NewDoc::new(&p.title, &p.body, status)
    };
    let written = write_doc_core(Path::new(&ws.root), &doc).await?;
    Ok((ws, written))
}
