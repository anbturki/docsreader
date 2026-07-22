use std::path::PathBuf;

use docsreader_core::error::{CoreError, ErrorCode};
use docsreader_core::workspace::WorkspaceScope;
use docsreader_core::workspace::init::{InitializedWorkspace, init_workspace_core};
use docsreader_core::workspace::registry::{default_registry_path, load_registry};
use docsreader_core::workspace::resolve::DEFAULT_WORKSPACE_DIR;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{tool, tool_router};
use schemars::JsonSchema;
use serde::Deserialize;

use super::{DocsServer, error_result, home_dir, success_json};

#[derive(Deserialize, JsonSchema)]
pub struct InitWorkspaceParams {
    /// Project directory; the workspace is created at <path>/notes. Omit to
    /// create the user workspace at ~/notes.
    pub path: Option<String>,
    /// Workspace scope: "user" (~/notes) or "project" (<path>/notes).
    /// Defaults to project when path is given, user otherwise.
    pub scope: Option<String>,
    /// Workspace slug; defaults to the project folder name, or "notes" for user
    /// scope. Do not reuse a slug list_workspaces already shows: calls would
    /// resolve to whichever workspace was registered first.
    pub slug: Option<String>,
    /// Display name humans pick from in the app: the project or product this
    /// workspace holds, e.g. "Acme Billing API" - never "Notes" or "Docs".
    pub name: Option<String>,
}

#[tool_router(router = workspace_tool_router, vis = "pub(crate)")]
impl DocsServer {
    #[tool(
        description = "Health check. Returns \"pong\" if the server is alive.",
        annotations(read_only_hint = true)
    )]
    async fn ping(&self) -> String {
        "pong".to_string()
    }

    #[tool(
        description = "List all known DocsReader workspaces: registered project workspaces plus the default user workspace (~/notes). Call this when a workspace slug is unknown, before choosing where to write, and before init_workspace. If none of them belongs to the project at hand, create one with init_workspace instead of writing into an unrelated workspace.",
        annotations(read_only_hint = true)
    )]
    async fn list_workspaces(&self) -> CallToolResult {
        match list_workspaces_impl() {
            Ok(value) => success_json(value),
            Err(err) => error_result(&err),
        }
    }

    #[tool(
        description = "Create a new DocsReader workspace and register it. Call list_workspaces first and reuse the one that belongs to this project; create only when none does. No args: creates the user workspace at ~/notes. With path: creates a project workspace at <path>/notes. Give every project its own workspace rather than sharing ~/notes. Set name to the project or product the workspace holds, e.g. \"Acme Billing API\" - never \"Notes\" or \"Docs\", which tell a human nothing once a second workspace exists. A git repository is a valid location: only the notes folder is written. If <path>/notes is already a workspace, it is ready to use: pass its slug and keep writing there. It fails only when <path>/notes already holds non-workspace files; then either point path at a sibling folder such as <parent>/<project>-notes, or convert the folder in the DocsReader app.",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn init_workspace(
        &self,
        Parameters(p): Parameters<InitWorkspaceParams>,
    ) -> CallToolResult {
        match init_workspace_impl(&p) {
            Ok(ws) => success_json(serde_json::json!({
                "ok": true,
                "workspacePath": ws.root,
                "slug": ws.slug,
                "name": ws.name,
                "scope": ws.scope,
            })),
            Err(err) => error_result(&err),
        }
    }
}

fn list_workspaces_impl() -> Result<serde_json::Value, CoreError> {
    let home = home_dir()?;
    let entries = load_registry(&default_registry_path(&home))?;
    let default_root = home.join(DEFAULT_WORKSPACE_DIR);
    Ok(serde_json::json!({
        "workspaces": entries,
        "defaultUserWorkspace": {
            "path": default_root,
            "exists": default_root.is_dir(),
            "scope": "user",
        },
    }))
}

fn parse_scope(value: &str) -> Result<WorkspaceScope, CoreError> {
    match value {
        "user" => Ok(WorkspaceScope::User),
        "project" => Ok(WorkspaceScope::Project),
        other => Err(
            CoreError::new(ErrorCode::InvalidInput, format!("unknown scope {other:?}"))
                .with_recovery("valid scopes: [user, project]"),
        ),
    }
}

fn init_workspace_impl(p: &InitWorkspaceParams) -> Result<InitializedWorkspace, CoreError> {
    let scope = match (p.scope.as_deref(), p.path.as_deref()) {
        (Some(s), _) => parse_scope(s)?,
        (None, Some(_)) => WorkspaceScope::Project,
        (None, None) => WorkspaceScope::User,
    };
    let home = home_dir()?;
    let root = match scope {
        WorkspaceScope::User => home.join(DEFAULT_WORKSPACE_DIR),
        WorkspaceScope::Project => {
            let base = match p.path.as_deref() {
                Some(path) => PathBuf::from(path),
                None => std::env::current_dir()?,
            };
            base.join(DEFAULT_WORKSPACE_DIR)
        }
    };
    init_workspace_core(
        &root,
        p.slug.as_deref(),
        p.name.as_deref(),
        scope,
        &default_registry_path(&home),
    )
}
