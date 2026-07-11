use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Url};

pub const OPEN_PATH_EVENT: &str = "open-path";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTarget {
    pub path: String,
    pub is_dir: bool,
}

#[derive(Default)]
pub struct OpenedPaths(pub Mutex<Vec<OpenTarget>>);

// Turn whatever the OS handed us - file:// URLs from macOS RunEvent::Opened,
// or bare paths from Windows/Linux argv - into concrete filesystem targets,
// stash them for a cold-started frontend to drain, and emit for a warm one.
pub fn dispatch<I, S>(app: &AppHandle, items: I)
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let targets: Vec<OpenTarget> = items
        .into_iter()
        .filter_map(|item| resolve(item.as_ref()))
        .map(|path| OpenTarget {
            is_dir: path.is_dir(),
            path: path.to_string_lossy().into_owned(),
        })
        .collect();
    if targets.is_empty() {
        return;
    }
    if let Some(state) = app.try_state::<OpenedPaths>() {
        if let Ok(mut queued) = state.0.lock() {
            queued.extend(targets.clone());
        }
    }
    let _ = app.emit(OPEN_PATH_EVENT, targets);
}

fn resolve(item: &str) -> Option<PathBuf> {
    if let Ok(url) = Url::parse(item) {
        if url.scheme() == "file" {
            return url.to_file_path().ok();
        }
    }
    let path = PathBuf::from(item);
    path.exists().then_some(path)
}

#[tauri::command]
pub fn take_opened_paths(app: AppHandle) -> Vec<OpenTarget> {
    app.state::<OpenedPaths>()
        .0
        .lock()
        .map(|mut queued| std::mem::take(&mut *queued))
        .unwrap_or_default()
}
