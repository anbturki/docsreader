use docsreader_core::error::CoreError;
use docsreader_core::memory::{MemoryHit, search_memory_core};
use docsreader_core::path_guard::safe_join;
use docsreader_core::read::{DocFilters, DocSummary, list_docs_core};
use docsreader_core::tasks::{TaskSummary, list_tasks_core};
use docsreader_core::write::{DocStatus, locate_doc};
use rmcp::ErrorData;
use rmcp::model::{
    Annotations, ListResourceTemplatesResult, ListResourcesResult, ReadResourceResult, Resource,
    ResourceContents, ResourceTemplate,
};

use super::{doc_uri, resolve};

pub(crate) const ONBOARDING_URI: &str = "docsreader://onboarding";
const ONBOARDING_TEXT: &str = include_str!("onboarding.md");
const MARKDOWN_MIME: &str = "text/markdown";
const PAGE_SIZE: usize = 100;

/// Attention hint for clients: active work outranks finished work.
fn status_priority(status: DocStatus) -> f32 {
    match status {
        DocStatus::InProgress => 0.9,
        DocStatus::Research => 0.7,
        DocStatus::Done => 0.5,
        DocStatus::Archived => 0.2,
    }
}

fn doc_annotations(doc: &DocSummary) -> Annotations {
    let annotations = Annotations::default().with_priority(status_priority(doc.status));
    match doc
        .modified
        .and_then(|s| chrono::DateTime::from_timestamp(i64::try_from(s).ok()?, 0))
    {
        Some(ts) => annotations.with_timestamp(ts),
        None => annotations,
    }
}

fn onboarding_resource() -> Resource {
    Resource::new(ONBOARDING_URI, "onboarding")
        .with_title("DocsReader agent onboarding")
        .with_description(
            "Read this first: how DocsReader workspaces, the status/phase lifecycle, \
             and the doc tools fit together.",
        )
        .with_mime_type(MARKDOWN_MIME)
        .with_annotations(Annotations::default().with_priority(1.0))
}

fn doc_resource(ws_slug: &str, doc: &DocSummary) -> Resource {
    let mut resource = Resource::new(doc_uri(ws_slug, &doc.rel_path), doc.rel_path.clone())
        .with_mime_type(MARKDOWN_MIME)
        .with_size(doc.size)
        .with_annotations(doc_annotations(doc));
    if let Some(title) = &doc.title {
        resource = resource.with_title(title.clone());
    }
    resource
}

const MEMORY_PRIORITY: f32 = 0.8;
const TASK_PRIORITY: f32 = 0.6;

fn memory_resource(ws_slug: &str, hit: &MemoryHit) -> Resource {
    let mut resource = Resource::new(doc_uri(ws_slug, &hit.rel_path), hit.rel_path.clone())
        .with_mime_type(MARKDOWN_MIME)
        .with_annotations(Annotations::default().with_priority(MEMORY_PRIORITY));
    if let Some(title) = &hit.title {
        resource = resource.with_title(title.clone());
    }
    resource
}

fn task_resource(ws_slug: &str, task: &TaskSummary) -> Resource {
    let mut resource = Resource::new(doc_uri(ws_slug, &task.rel_path), task.id.clone())
        .with_mime_type(MARKDOWN_MIME)
        .with_annotations(Annotations::default().with_priority(TASK_PRIORITY));
    if let Some(title) = &task.title {
        resource = resource.with_title(title.clone());
    }
    resource
}

fn protocol_error(err: &CoreError) -> ErrorData {
    ErrorData::internal_error(
        err.message.clone(),
        Some(serde_json::json!({ "error": err })),
    )
}

fn parse_cursor(cursor: Option<String>) -> Result<usize, ErrorData> {
    match cursor {
        None => Ok(0),
        Some(c) => c
            .parse()
            .map_err(|_| ErrorData::invalid_params(format!("invalid cursor `{c}`"), None)),
    }
}

pub(crate) fn list_resources_page(
    cursor: Option<String>,
) -> Result<ListResourcesResult, ErrorData> {
    let offset = parse_cursor(cursor)?;
    let ws = resolve(None).map_err(|e| protocol_error(&e))?;
    let mut all = Vec::new();
    if ws.root.is_dir() {
        let memories = search_memory_core(&ws.root, None, None).map_err(|e| protocol_error(&e))?;
        all.extend(memories.iter().map(|hit| memory_resource(&ws.slug, hit)));
        let tasks = list_tasks_core(&ws.root, None, None).map_err(|e| protocol_error(&e))?;
        all.extend(tasks.iter().map(|task| task_resource(&ws.slug, task)));
        let docs =
            list_docs_core(&ws.root, &DocFilters::default()).map_err(|e| protocol_error(&e))?;
        all.extend(docs.iter().map(|doc| doc_resource(&ws.slug, doc)));
    }

    let mut resources = Vec::new();
    if offset == 0 {
        resources.push(onboarding_resource());
    }
    resources.extend(all.iter().skip(offset).take(PAGE_SIZE).cloned());

    let next = offset + PAGE_SIZE;
    let mut result = ListResourcesResult::with_all_items(resources);
    if next < all.len() {
        result.next_cursor = Some(next.to_string());
    }
    Ok(result)
}

pub(crate) fn list_templates() -> ListResourceTemplatesResult {
    let template = ResourceTemplate::new("docsreader://{workspace}/{+path}", "doc")
        .with_title("DocsReader doc")
        .with_description(
            "A markdown doc in a DocsReader workspace. `workspace` is a workspace slug \
             (see list_workspaces); `path` is the doc's status-relative path, e.g. \
             `research/api-notes.md`.",
        )
        .with_mime_type(MARKDOWN_MIME);
    ListResourceTemplatesResult::with_all_items(vec![template])
}

pub(crate) fn read_resource_at(uri: &str) -> Result<ReadResourceResult, ErrorData> {
    if uri == ONBOARDING_URI {
        return Ok(ReadResourceResult::new(vec![
            ResourceContents::text(ONBOARDING_TEXT, uri).with_mime_type(MARKDOWN_MIME),
        ]));
    }
    let (ws_slug, rel_path) = split_doc_uri(uri)?;
    let path = resolve(Some(ws_slug))
        .and_then(|ws| {
            if rel_path.starts_with("memory/") || rel_path.starts_with("tasks/") {
                let path = safe_join(&ws.root, rel_path)?;
                if !path.is_file() {
                    return Err(CoreError::new(
                        docsreader_core::error::ErrorCode::DocNotFound,
                        format!("nothing at {rel_path:?}"),
                    )
                    .with_recovery("call search_memory or list_tasks to see existing entries"));
                }
                Ok(path)
            } else {
                locate_doc(&ws.root, rel_path).map(|doc| doc.path)
            }
        })
        .map_err(|err| {
            ErrorData::resource_not_found(
                err.message.clone(),
                Some(serde_json::json!({ "uri": uri, "error": err })),
            )
        })?;
    let text = std::fs::read_to_string(&path)
        .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
    Ok(ReadResourceResult::new(vec![
        ResourceContents::text(text, uri).with_mime_type(MARKDOWN_MIME),
    ]))
}

fn split_doc_uri(uri: &str) -> Result<(&str, &str), ErrorData> {
    uri.strip_prefix("docsreader://")
        .and_then(|rest| rest.split_once('/'))
        .filter(|(ws, path)| !ws.is_empty() && !path.is_empty())
        .ok_or_else(|| {
            ErrorData::resource_not_found(
                format!("unknown resource URI `{uri}`"),
                Some(serde_json::json!({
                    "expected": "docsreader://{workspace}/{path} or docsreader://onboarding",
                })),
            )
        })
}
