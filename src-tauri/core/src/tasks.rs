use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Serialize;

use crate::error::{CoreError, ErrorCode};
use crate::frontmatter::{split_frontmatter, upsert_fm_line, yaml_line};
use crate::update::str_replace_at;
use crate::write::{enforce_size_limit, stage_in_git};

pub const TASKS_DIR: &str = "tasks";

/// Backlog.md's DEFAULT_STATUSES, verbatim; the file format is theirs.
pub const TASK_STATUSES: [&str; 3] = ["To Do", "In Progress", "Done"];
pub const TASK_PRIORITIES: [&str; 3] = ["high", "medium", "low"];

fn normalize_status(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

/// Accepts any casing/spacing variant ("to-do", "In Progress", "done").
pub fn parse_task_status(value: &str) -> Result<&'static str, CoreError> {
    let wanted = normalize_status(value);
    TASK_STATUSES
        .into_iter()
        .find(|s| normalize_status(s) == wanted)
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidInput,
                format!("unknown task status {value:?}"),
            )
            .with_recovery(format!("valid statuses: [{}]", TASK_STATUSES.join(", ")))
        })
}

fn parse_task_priority(value: &str) -> Result<&'static str, CoreError> {
    TASK_PRIORITIES
        .into_iter()
        .find(|p| p.eq_ignore_ascii_case(value))
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidInput,
                format!("unknown priority {value:?}"),
            )
            .with_recovery(format!(
                "valid priorities: [{}]",
                TASK_PRIORITIES.join(", ")
            ))
        })
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct TaskSummary {
    pub id: String,
    pub title: Option<String>,
    pub status: String,
    pub assignee: Vec<String>,
    pub labels: Vec<String>,
    pub dependencies: Vec<String>,
    pub priority: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
    pub rel_path: String,
    pub path: PathBuf,
}

#[derive(Debug, Default)]
pub struct NewTask<'a> {
    pub title: &'a str,
    pub description: &'a str,
    pub acceptance_criteria: Vec<String>,
    pub status: Option<&'a str>,
    pub priority: Option<&'a str>,
    pub assignee: Vec<String>,
    pub labels: Vec<String>,
    pub dependencies: Vec<String>,
    pub reporter: Option<&'a str>,
}

const MAX_TITLE_FILE_CHARS: usize = 60;

/// Backlog.md filename shape: "task-3 - Title-with-dashes.md".
fn task_file_name(id: &str, title: &str) -> String {
    let mut sanitized = String::new();
    for c in title.chars() {
        if c.is_alphanumeric() {
            sanitized.push(c);
        } else if !sanitized.ends_with('-') && !sanitized.is_empty() {
            sanitized.push('-');
        }
    }
    let sanitized: String = sanitized
        .trim_matches('-')
        .chars()
        .take(MAX_TITLE_FILE_CHARS)
        .collect();
    let sanitized = sanitized.trim_matches('-');
    if sanitized.is_empty() {
        format!("{id}.md")
    } else {
        format!("{id} - {sanitized}.md")
    }
}

fn yaml_list(key: &str, items: &[String]) -> Result<String, CoreError> {
    if items.is_empty() {
        return Ok(format!("{key}: []"));
    }
    let mut map = serde_yaml::Mapping::new();
    map.insert(key.into(), items.into());
    serde_yaml::to_string(&map)
        .map(|s| s.trim_end().to_string())
        .map_err(|e| CoreError::new(ErrorCode::Io, format!("serialize {key}: {e}")))
}

fn render_task(
    id: &str,
    task: &NewTask<'_>,
    status: &str,
    today: &str,
) -> Result<String, CoreError> {
    let mut fm = vec![
        format!("id: {id}"),
        yaml_line("title", task.title)?,
        yaml_line("status", status)?,
        yaml_list("assignee", &task.assignee)?,
    ];
    if let Some(reporter) = task.reporter {
        fm.push(yaml_line("reporter", reporter)?);
    }
    // Dates are quoted the way Backlog.md's own serializer emits them, so
    // YAML 1.1 parsers read strings, not timestamps.
    fm.push(format!("created_date: '{today}'"));
    fm.push(yaml_list("labels", &task.labels)?);
    fm.push(yaml_list("dependencies", &task.dependencies)?);
    if let Some(priority) = task.priority {
        fm.push(yaml_line("priority", priority)?);
    }

    let mut body = format!("## Description\n\n{}\n", task.description.trim_end());
    if !task.acceptance_criteria.is_empty() {
        body.push_str("\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n");
        for (i, criterion) in task.acceptance_criteria.iter().enumerate() {
            body.push_str(&format!("- [ ] #{} {}\n", i + 1, criterion.trim()));
        }
        body.push_str("<!-- AC:END -->\n");
    }
    Ok(format!("---\n{}\n---\n\n{body}", fm.join("\n")))
}

fn parse_task(path: &Path) -> Option<TaskSummary> {
    if path.extension().is_none_or(|e| e != "md") || !path.is_file() {
        return None;
    }
    let content = std::fs::read_to_string(path).ok()?;
    let fm = split_frontmatter(&content).0?;
    let map: serde_yaml::Mapping = serde_yaml::from_str(fm).ok()?;
    let text = |key: &str| {
        map.get(serde_yaml::Value::String(key.into()))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    };
    let list = |key: &str| -> Vec<String> {
        map.get(serde_yaml::Value::String(key.into()))
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    };
    Some(TaskSummary {
        id: text("id")?,
        title: text("title"),
        status: text("status").unwrap_or_else(|| TASK_STATUSES[0].to_string()),
        assignee: list("assignee"),
        labels: list("labels"),
        dependencies: list("dependencies"),
        priority: text("priority"),
        created_date: text("created_date"),
        updated_date: text("updated_date"),
        rel_path: format!("{TASKS_DIR}/{}", path.file_name()?.to_string_lossy()),
        path: path.to_path_buf(),
    })
}

fn all_tasks(root: &Path) -> Vec<TaskSummary> {
    let mut tasks: Vec<TaskSummary> = std::fs::read_dir(root.join(TASKS_DIR))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| parse_task(&entry.path()))
        .collect();
    tasks.sort_by_key(|a| task_ordinal(&a.id));
    tasks
}

fn task_ordinal(id: &str) -> u64 {
    id.rsplit('-')
        .next()
        .and_then(|n| n.parse().ok())
        .unwrap_or(0)
}

fn next_task_id(root: &Path) -> String {
    let max = all_tasks(root)
        .iter()
        .map(|t| task_ordinal(&t.id))
        .max()
        .unwrap_or(0);
    format!("task-{}", max + 1)
}

pub async fn write_task_core(root: &Path, task: &NewTask<'_>) -> Result<TaskSummary, CoreError> {
    if task.title.trim().is_empty() {
        return Err(CoreError::new(ErrorCode::InvalidInput, "title is required")
            .with_recovery("pass a short task title"));
    }
    let status = match task.status {
        Some(s) => parse_task_status(s)?,
        None => TASK_STATUSES[0],
    };
    if let Some(p) = task.priority {
        parse_task_priority(p)?;
    }
    let id = next_task_id(root);
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let rendered = render_task(&id, task, status, &today)?;
    enforce_size_limit(rendered.len())?;
    let rel_path = format!("{TASKS_DIR}/{}", task_file_name(&id, task.title));
    let path = root.join(&rel_path);
    std::fs::create_dir_all(path.parent().unwrap_or(root))?;
    std::fs::write(&path, rendered)?;
    stage_in_git(root, &[&rel_path]).await;
    parse_task(&path)
        .ok_or_else(|| CoreError::new(ErrorCode::Io, format!("task {id} written but unreadable")))
}

pub fn list_tasks_core(
    root: &Path,
    status: Option<&str>,
    label: Option<&str>,
) -> Result<Vec<TaskSummary>, CoreError> {
    let status = status.map(parse_task_status).transpose()?;
    Ok(all_tasks(root)
        .into_iter()
        .filter(|t| status.is_none_or(|s| t.status == s))
        .filter(|t| label.is_none_or(|l| t.labels.iter().any(|x| x == l)))
        .collect())
}

/// Accepts a task id ("task-3") or a tasks/ relative path.
fn locate_task(root: &Path, task_ref: &str) -> Result<TaskSummary, CoreError> {
    let by_id = |id: &str| all_tasks(root).into_iter().find(|t| t.id == id);
    let found = if let Some(name) = task_ref.strip_prefix("tasks/") {
        all_tasks(root)
            .into_iter()
            .find(|t| t.rel_path == task_ref || t.path.file_name().is_some_and(|f| f == name))
    } else {
        by_id(task_ref)
    };
    found.ok_or_else(|| {
        CoreError::new(
            ErrorCode::DocNotFound,
            format!("no task found for {task_ref:?}"),
        )
        .with_recovery("pass a task id like \"task-3\"; see list_tasks")
    })
}

fn touch_updated_date(content: &str) -> String {
    let stamp = Utc::now().format("%Y-%m-%d %H:%M").to_string();
    upsert_fm_line(content, "updated_date", &format!("updated_date: '{stamp}'"))
}

async fn rewrite_task(root: &Path, task: &TaskSummary, content: String) -> Result<(), CoreError> {
    enforce_size_limit(content.len())?;
    std::fs::write(&task.path, content)?;
    stage_in_git(root, &[&task.rel_path]).await;
    Ok(())
}

pub async fn set_task_status_core(
    root: &Path,
    task_ref: &str,
    status: &str,
) -> Result<TaskSummary, CoreError> {
    let status = parse_task_status(status)?;
    let task = locate_task(root, task_ref)?;
    let content = std::fs::read_to_string(&task.path)?;
    let line = yaml_line("status", status)?;
    let updated = touch_updated_date(&upsert_fm_line(&content, "status", &line));
    rewrite_task(root, &task, updated).await?;
    parse_task(&task.path)
        .ok_or_else(|| CoreError::new(ErrorCode::Io, "task updated but unreadable"))
}

/// str_replace on a task file (check acceptance criteria, extend sections).
pub async fn update_task_core(
    root: &Path,
    task_ref: &str,
    old_str: &str,
    new_str: &str,
) -> Result<TaskSummary, CoreError> {
    let task = locate_task(root, task_ref)?;
    str_replace_at(root, &task.path, &task.rel_path, old_str, new_str).await?;
    let content = std::fs::read_to_string(&task.path)?;
    rewrite_task(root, &task, touch_updated_date(&content)).await?;
    parse_task(&task.path)
        .ok_or_else(|| CoreError::new(ErrorCode::Io, "task updated but unreadable"))
}

pub async fn delete_task_core(root: &Path, task_ref: &str) -> Result<TaskSummary, CoreError> {
    let task = locate_task(root, task_ref)?;
    std::fs::remove_file(&task.path)?;
    stage_in_git(root, &[&task.rel_path]).await;
    Ok(task)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dr_task_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn write_renders_backlog_md_shape_with_incrementing_ids() {
        let root = test_dir("shape");
        let task = write_task_core(
            &root,
            &NewTask {
                title: "Add core search functionality",
                description: "Search across docs.",
                acceptance_criteria: vec!["Results ranked".into(), "Budget enforced".into()],
                labels: vec!["enhancement".into()],
                priority: Some("medium"),
                reporter: Some("claude-code"),
                ..NewTask::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(task.id, "task-1");
        assert_eq!(
            task.rel_path,
            "tasks/task-1 - Add-core-search-functionality.md"
        );
        assert_eq!(task.status, "To Do");

        let raw = std::fs::read_to_string(&task.path).unwrap();
        assert!(raw.starts_with("---\nid: task-1\ntitle: Add core search functionality\nstatus: To Do\nassignee: []\nreporter: claude-code\ncreated_date: '"), "exact backlog frontmatter order: {raw}");
        assert!(raw.contains("labels:\n- enhancement"));
        assert!(raw.contains("dependencies: []"));
        assert!(raw.contains("priority: medium"));
        assert!(raw.contains("## Description\n\nSearch across docs."));
        assert!(raw.contains("## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [ ] #1 Results ranked\n- [ ] #2 Budget enforced\n<!-- AC:END -->"));

        let next = write_task_core(
            &root,
            &NewTask {
                title: "Second",
                description: "x",
                ..NewTask::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(next.id, "task-2");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn status_updates_in_frontmatter_and_lenient_parse() {
        let root = test_dir("status");
        write_task_core(
            &root,
            &NewTask {
                title: "Move me",
                description: "x",
                ..NewTask::default()
            },
        )
        .await
        .unwrap();

        let moved = set_task_status_core(&root, "task-1", "in-progress")
            .await
            .unwrap();
        assert_eq!(moved.status, "In Progress");
        assert!(moved.updated_date.is_some());
        let raw = std::fs::read_to_string(&moved.path).unwrap();
        assert!(raw.contains("status: In Progress"));
        assert!(raw.contains("updated_date: '"));

        let err = set_task_status_core(&root, "task-1", "blocked")
            .await
            .unwrap_err();
        assert!(err.recovery.unwrap().contains("To Do, In Progress, Done"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn update_checks_acceptance_criterion_and_list_filters() {
        let root = test_dir("update");
        write_task_core(
            &root,
            &NewTask {
                title: "With AC",
                description: "x",
                acceptance_criteria: vec!["Ship it".into()],
                labels: vec!["mcp".into()],
                ..NewTask::default()
            },
        )
        .await
        .unwrap();

        update_task_core(&root, "task-1", "- [ ] #1 Ship it", "- [x] #1 Ship it")
            .await
            .unwrap();
        let raw = std::fs::read_to_string(root.join("tasks/task-1 - With-AC.md")).unwrap();
        assert!(raw.contains("- [x] #1 Ship it"));

        let done = list_tasks_core(&root, Some("done"), None).unwrap();
        assert!(done.is_empty());
        let tagged = list_tasks_core(&root, None, Some("mcp")).unwrap();
        assert_eq!(tagged.len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn delete_removes_task_file() {
        let root = test_dir("del");
        let task = write_task_core(
            &root,
            &NewTask {
                title: "Doomed",
                description: "x",
                ..NewTask::default()
            },
        )
        .await
        .unwrap();
        delete_task_core(&root, "tasks/task-1 - Doomed.md")
            .await
            .unwrap();
        assert!(!task.path.exists());

        let err = delete_task_core(&root, "task-1").await.unwrap_err();
        assert_eq!(err.code, ErrorCode::DocNotFound);
        let _ = std::fs::remove_dir_all(&root);
    }
}
