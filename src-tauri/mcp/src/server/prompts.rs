use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{PromptMessage, Role};
use rmcp::{prompt, prompt_router};
use schemars::JsonSchema;
use serde::Deserialize;

use super::DocsServer;

#[derive(Deserialize, JsonSchema)]
pub struct StartTaskArgs {
    /// Short title for the task.
    pub title: String,
    /// Extra context: constraints, links, or hints for acceptance criteria.
    pub context: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct RecordDecisionArgs {
    /// The decision taken, in one sentence.
    pub decision: String,
    /// Why: the problem, alternatives weighed, constraints.
    pub rationale: Option<String>,
}

fn with_context(base: String, label: &str, extra: Option<&str>) -> String {
    match extra {
        Some(extra) if !extra.trim().is_empty() => {
            format!("{base}\n\n{label}: {}", extra.trim())
        }
        _ => base,
    }
}

#[prompt_router(vis = "pub(crate)")]
impl DocsServer {
    #[prompt(
        name = "start-task",
        description = "Scaffold a DocsReader task for a piece of work and start on it: creates the Backlog.md-shaped task with acceptance criteria, moves it to In Progress, and tracks progress by checking criteria off."
    )]
    async fn start_task(&self, Parameters(args): Parameters<StartTaskArgs>) -> Vec<PromptMessage> {
        let text = with_context(
            format!(
                "Start work on this task: {}\n\n\
                 1. If you have not read it this session, read the docsreader://onboarding resource.\n\
                 2. Create the task with write_task: a one-paragraph description of what and why, \
                 plus 2-5 verifiable acceptance criteria.\n\
                 3. Move it to \"In Progress\" with set_task_status before you begin.\n\
                 4. As you complete each criterion, check it off with update_task \
                 (replace \"- [ ] #N ...\" with \"- [x] #N ...\"); append implementation notes the same way.\n\
                 5. When every criterion is checked, set the status to \"Done\".",
                args.title
            ),
            "Context",
            args.context.as_deref(),
        );
        vec![PromptMessage::new_text(Role::User, text)]
    }

    #[prompt(
        name = "record-decision",
        description = "Record a decision as a doc in the workspace: searches for prior related decisions, writes a structured decision doc, and saves a memory pointer when it changes day-to-day behavior."
    )]
    async fn record_decision(
        &self,
        Parameters(args): Parameters<RecordDecisionArgs>,
    ) -> Vec<PromptMessage> {
        let text = with_context(
            format!(
                "Record this decision in the workspace: {}\n\n\
                 1. Search first: run search_docs and search_memory for prior related decisions; \
                 link or supersede them instead of duplicating.\n\
                 2. Create the doc with write_doc: status \"done\", tags [\"decision\"], a title naming \
                 the decision, and a body with sections for Context, Decision, Alternatives considered, \
                 and Consequences.\n\
                 3. If the decision changes how agents should work in this workspace day-to-day, also \
                 save a short write_memory entry that states the rule and links the doc.",
                args.decision
            ),
            "Rationale",
            args.rationale.as_deref(),
        );
        vec![PromptMessage::new_text(Role::User, text)]
    }
}
