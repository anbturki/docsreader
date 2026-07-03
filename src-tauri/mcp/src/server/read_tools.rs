use docsreader_core::error::{CoreError, ErrorCode};
use docsreader_core::read::{
    DocContent, DocFilters, DocSummary, SearchHit, list_docs_core, read_doc_core, search_docs_core,
};
use docsreader_core::workspace::resolve::ResolvedWorkspace;
use rmcp::handler::server::wrapper::{Json, Parameters};
use rmcp::model::CallToolResult;
use rmcp::{Peer, RoleServer, tool, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::{
    DocsServer, TRUNCATION_GUIDANCE, doc_uri, error_result, parse_status, resolve_or_pick,
    take_within_budget,
};

#[derive(Deserialize, JsonSchema)]
pub struct ReadDocParams {
    /// Doc slug (e.g. "api-design-notes") or status-relative path
    /// (e.g. "research/api-design-notes.md").
    pub path: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
    /// "concise" (default: frontmatter + snippet) or "detailed" (full body).
    pub response_format: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct ListDocsParams {
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
    /// Filter by status: "research" | "in-progress" | "done" | "archived".
    pub status: Option<String>,
    /// Filter by phase subfolder.
    pub phase: Option<String>,
    /// Filter by tag. Filters AND together.
    pub tag: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SearchDocsParams {
    /// Search term, matched against title, tags, slug, and content.
    pub query: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
    /// Filter by status: "research" | "in-progress" | "done" | "archived".
    pub status: Option<String>,
    /// Filter by phase subfolder.
    pub phase: Option<String>,
    /// Filter by tag. Filters AND together.
    pub tag: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct DocEntry {
    #[serde(flatten)]
    pub doc: DocSummary,
    /// Resource URI for this doc (docsreader://<workspace>/<relPath>).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HitEntry {
    #[serde(flatten)]
    pub hit: SearchHit,
    /// Resource URI for this doc (docsreader://<workspace>/<relPath>).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDocsResult {
    pub workspace: ResolvedWorkspace,
    pub docs: Vec<DocEntry>,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guidance: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchDocsResult {
    pub workspace: ResolvedWorkspace,
    pub hits: Vec<HitEntry>,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guidance: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReadDocResult {
    pub workspace: ResolvedWorkspace,
    pub doc: DocContent,
}

fn parse_filters<'a>(
    status: Option<&'a str>,
    phase: Option<&'a str>,
    tag: Option<&'a str>,
) -> Result<DocFilters<'a>, CoreError> {
    Ok(DocFilters {
        status: parse_status(status)?,
        phase,
        tag,
    })
}

fn parse_response_format(value: Option<&str>) -> Result<bool, CoreError> {
    match value {
        None | Some("concise") => Ok(false),
        Some("detailed") => Ok(true),
        Some(other) => Err(CoreError::new(
            ErrorCode::InvalidInput,
            format!("unknown response_format {other:?}"),
        )
        .with_recovery("valid formats: [concise, detailed]")),
    }
}

#[tool_router(router = read_tool_router, vis = "pub(crate)")]
impl DocsServer {
    #[tool(
        description = "Read one doc from a DocsReader workspace by slug or status-relative path. Default concise mode returns frontmatter + a snippet; response_format=\"detailed\" returns the full body.",
        annotations(read_only_hint = true)
    )]
    async fn read_doc(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<ReadDocParams>,
    ) -> Result<Json<ReadDocResult>, CallToolResult> {
        let result = async {
            let detailed = parse_response_format(p.response_format.as_deref())?;
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let doc = read_doc_core(&ws.root, &p.path, detailed)?;
            Ok(ReadDocResult { workspace: ws, doc })
        }
        .await;
        result.map(Json).map_err(|e: CoreError| error_result(&e))
    }

    #[tool(
        description = "List docs in a DocsReader workspace, newest first. Filter by status, phase, or tag (filters AND together). Results carry docsreader:// resource URIs.",
        annotations(read_only_hint = true)
    )]
    async fn list_docs(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<ListDocsParams>,
    ) -> Result<Json<ListDocsResult>, CallToolResult> {
        let result = async {
            let filters = parse_filters(p.status.as_deref(), p.phase.as_deref(), p.tag.as_deref())?;
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let docs = list_docs_core(&ws.root, &filters)?;
            let entries: Vec<DocEntry> = docs
                .into_iter()
                .map(|doc| DocEntry {
                    uri: doc_uri(&ws.slug, &doc.rel_path),
                    doc,
                })
                .collect();
            let (docs, truncated) = take_within_budget(entries);
            Ok(ListDocsResult {
                workspace: ws,
                docs,
                truncated,
                guidance: truncated.then(|| TRUNCATION_GUIDANCE.to_string()),
            })
        }
        .await;
        result.map(Json).map_err(|e: CoreError| error_result(&e))
    }

    #[tool(
        description = "Search docs in a DocsReader workspace. Ranks matches across title, tags, slug, and content; returns snippets and docsreader:// resource URIs. Combine with status/phase/tag filters to narrow.",
        annotations(read_only_hint = true)
    )]
    async fn search_docs(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<SearchDocsParams>,
    ) -> Result<Json<SearchDocsResult>, CallToolResult> {
        let result = async {
            let filters = parse_filters(p.status.as_deref(), p.phase.as_deref(), p.tag.as_deref())?;
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let hits = search_docs_core(&ws.root, &p.query, &filters)?;
            let entries: Vec<HitEntry> = hits
                .into_iter()
                .map(|hit| HitEntry {
                    uri: doc_uri(&ws.slug, &hit.doc.rel_path),
                    hit,
                })
                .collect();
            let (hits, truncated) = take_within_budget(entries);
            Ok(SearchDocsResult {
                workspace: ws,
                hits,
                truncated,
                guidance: truncated.then(|| TRUNCATION_GUIDANCE.to_string()),
            })
        }
        .await;
        result.map(Json).map_err(|e: CoreError| error_result(&e))
    }
}
