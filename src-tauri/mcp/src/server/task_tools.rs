use docsreader_core::error::CoreError;
use docsreader_core::tasks::{
    NewTask, TaskSummary, list_tasks_core, set_task_status_core, update_task_core, write_task_core,
};
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
pub struct WriteTaskParams {
    /// Short task title.
    pub title: String,
    /// What the task is and why (markdown; becomes the Description section).
    pub description: String,
    /// Acceptance criteria; rendered as a checklist the assignee ticks off.
    pub acceptance_criteria: Option<Vec<String>>,
    /// "To Do" (default) | "In Progress" | "Done".
    pub status: Option<String>,
    /// "high" | "medium" | "low".
    pub priority: Option<String>,
    /// Who the task is assigned to.
    pub assignee: Option<Vec<String>>,
    /// Topic labels.
    pub labels: Option<Vec<String>>,
    /// Ids of tasks this one depends on, e.g. ["task-2"].
    pub dependencies: Option<Vec<String>>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct ListTasksParams {
    /// Filter by status: "To Do" | "In Progress" | "Done".
    pub status: Option<String>,
    /// Filter by label.
    pub label: Option<String>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SetTaskStatusParams {
    /// Task id (e.g. "task-3") or tasks/ relative path.
    pub id: String,
    /// Target status: "To Do" | "In Progress" | "Done".
    pub status: String,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct UpdateTaskParams {
    /// Task id (e.g. "task-3") or tasks/ relative path.
    pub id: String,
    /// Exact text to replace; must appear exactly once in the task file.
    /// To check an acceptance criterion, replace "- [ ] #1 ..." with
    /// "- [x] #1 ...".
    pub old_str: String,
    /// Replacement text. Omit to delete old_str.
    pub new_str: Option<String>,
    /// Workspace slug (see list_workspaces). Omit to use the resolved default.
    pub workspace: Option<String>,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangeResult {
    pub ok: bool,
    pub workspace: ResolvedWorkspace,
    #[serde(flatten)]
    pub task: TaskSummary,
    /// Resource URI for this task (docsreader://<workspace>/<relPath>).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TaskEntry {
    #[serde(flatten)]
    pub task: TaskSummary,
    /// Resource URI for this task (docsreader://<workspace>/<relPath>).
    pub uri: String,
}

#[derive(Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTasksResult {
    pub workspace: ResolvedWorkspace,
    pub tasks: Vec<TaskEntry>,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guidance: Option<String>,
}

fn task_change(ws: ResolvedWorkspace, task: TaskSummary) -> Json<TaskChangeResult> {
    Json(TaskChangeResult {
        ok: true,
        uri: doc_uri(&ws.slug, &task.rel_path),
        workspace: ws,
        task,
    })
}

#[tool_router(router = task_tool_router, vis = "pub(crate)")]
impl DocsServer {
    #[tool(
        description = "Create a task in the workspace's tasks/ folder using the Backlog.md file shape (task-N id, frontmatter status, Description + Acceptance Criteria checklist). Unlike docs, task status lives in frontmatter, not folders. Write a project's tasks to that project's own workspace; a label is not a substitute for one.",
        annotations(destructive_hint = false)
    )]
    async fn write_task(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<WriteTaskParams>,
    ) -> Result<Json<TaskChangeResult>, CallToolResult> {
        let reporter = client_name(&peer);
        let result = async {
            let mut ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            ensure_workspace_exists(&mut ws)?;
            let task = NewTask {
                title: &p.title,
                description: &p.description,
                acceptance_criteria: p.acceptance_criteria.clone().unwrap_or_default(),
                status: p.status.as_deref(),
                priority: p.priority.as_deref(),
                assignee: p.assignee.clone().unwrap_or_default(),
                labels: p.labels.clone().unwrap_or_default(),
                dependencies: p.dependencies.clone().unwrap_or_default(),
                reporter: reporter.as_deref(),
            };
            let written = write_task_core(&ws.root, &task).await?;
            Ok::<_, CoreError>((ws, written))
        }
        .await;
        result
            .map(|(ws, task)| task_change(ws, task))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "List tasks in the workspace, ordered by id. Filter by status (\"To Do\" | \"In Progress\" | \"Done\") or label. Labels group work inside one workspace; unfiltered results include every project sharing it.",
        annotations(read_only_hint = true)
    )]
    async fn list_tasks(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<ListTasksParams>,
    ) -> Result<Json<ListTasksResult>, CallToolResult> {
        let result = async {
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let tasks = if ws.root.is_dir() {
                list_tasks_core(&ws.root, p.status.as_deref(), p.label.as_deref())?
            } else {
                Vec::new()
            };
            let entries: Vec<TaskEntry> = tasks
                .into_iter()
                .map(|task| TaskEntry {
                    uri: doc_uri(&ws.slug, &task.rel_path),
                    task,
                })
                .collect();
            let (tasks, truncated) = take_within_budget(entries);
            Ok::<_, CoreError>(ListTasksResult {
                workspace: ws,
                tasks,
                truncated,
                guidance: truncated.then(|| TRUNCATION_GUIDANCE.to_string()),
            })
        }
        .await;
        result.map(Json).map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Move a task to a different status (\"To Do\" | \"In Progress\" | \"Done\") by rewriting its frontmatter; updated_date is stamped.",
        annotations(destructive_hint = false, idempotent_hint = true)
    )]
    async fn set_task_status(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<SetTaskStatusParams>,
    ) -> Result<Json<TaskChangeResult>, CallToolResult> {
        let result = async {
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let task = set_task_status_core(&ws.root, &p.id, &p.status).await?;
            Ok::<_, CoreError>((ws, task))
        }
        .await;
        result
            .map(|(ws, task)| task_change(ws, task))
            .map_err(|e| error_result(&e))
    }

    #[tool(
        description = "Edit a task file by exact string replacement (same contract as update_doc). Typical use: check an acceptance criterion by replacing \"- [ ] #1 ...\" with \"- [x] #1 ...\", or append implementation notes."
    )]
    async fn update_task(
        &self,
        peer: Peer<RoleServer>,
        Parameters(p): Parameters<UpdateTaskParams>,
    ) -> Result<Json<TaskChangeResult>, CallToolResult> {
        let result = async {
            let ws = resolve_or_pick(&peer, p.workspace.as_deref()).await?;
            let task = update_task_core(
                &ws.root,
                &p.id,
                &p.old_str,
                p.new_str.as_deref().unwrap_or(""),
            )
            .await?;
            Ok::<_, CoreError>((ws, task))
        }
        .await;
        result
            .map(|(ws, task)| task_change(ws, task))
            .map_err(|e| error_result(&e))
    }
}
