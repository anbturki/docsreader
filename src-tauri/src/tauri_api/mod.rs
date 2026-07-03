use std::path::{Path, PathBuf};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

use crate::agents::{self, AgentClient, ClientId};
use docsreader_core::git::{git_show_head_core, git_status_core, GitStatus};
use docsreader_core::scan::{run_scan, ScanProgress, ScanProgressSink, ScanResult};
use docsreader_core::workspace::init::{convert_workspace_core, InitializedWorkspace};
use docsreader_core::workspace::registry::{
    default_registry_path, existing_workspaces, load_registry, WorkspaceEntry,
};

const PROGRESS_EVENT: &str = "scan-progress";

struct TauriProgressSink {
    app: AppHandle,
}

impl ScanProgressSink for TauriProgressSink {
    fn emit(&self, progress: &ScanProgress) {
        let _ = self.app.emit(PROGRESS_EVENT, progress.clone());
    }
}

#[tauri::command]
pub async fn scan_markdown(app: AppHandle, path: String) -> Result<ScanResult, String> {
    let sink = TauriProgressSink { app };
    let path_for_task = path.clone();
    tauri::async_runtime::spawn_blocking(move || run_scan(&sink, path_for_task))
        .await
        .map_err(|e| format!("scan task panicked: {}", e))?
}

#[tauri::command]
pub async fn convert_workspace(
    app: AppHandle,
    path: String,
) -> Result<InitializedWorkspace, String> {
    let home = home_dir(&app)?;
    let registry = default_registry_path(&home);
    tauri::async_runtime::spawn_blocking(move || {
        convert_workspace_core(Path::new(&path), &registry).map_err(|e| e.message)
    })
    .await
    .map_err(|e| format!("convert task panicked: {e}"))?
}

#[tauri::command]
pub fn detect_agent_clients(app: AppHandle) -> Result<Vec<AgentClient>, String> {
    let home = home_dir(&app)?;
    let sidecar = agents::sidecar_path(&app_data_dir(&app)?)?;
    Ok(agents::detect_clients(&home, &sidecar))
}

#[tauri::command]
pub fn connect_agent_client(app: AppHandle, id: ClientId) -> Result<AgentClient, String> {
    let home = home_dir(&app)?;
    let sidecar = agents::sidecar_path(&app_data_dir(&app)?)?;
    agents::connect_client(&home, &sidecar, id)
}

#[tauri::command]
pub fn list_registry_workspaces(app: AppHandle) -> Result<Vec<WorkspaceEntry>, String> {
    let home = home_dir(&app)?;
    let entries = load_registry(&default_registry_path(&home)).map_err(|e| e.message)?;
    Ok(existing_workspaces(entries))
}

#[tauri::command]
pub fn registry_dir(app: AppHandle) -> Result<String, String> {
    let home = home_dir(&app)?;
    let dir = default_registry_path(&home)
        .parent()
        .ok_or("registry path has no parent")?
        .to_path_buf();
    Ok(dir.to_string_lossy().into_owned())
}

fn home_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().home_dir().map_err(|e| e.to_string())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_local_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_status(workspace: String) -> Result<Option<GitStatus>, String> {
    git_status_core(workspace).await
}

#[tauri::command]
pub async fn git_show_head(workspace: String, path: String) -> Result<Option<String>, String> {
    git_show_head_core(workspace, path).await
}

#[tauri::command]
pub async fn install_welcome_workspace(app: AppHandle) -> Result<String, String> {
    let src = app
        .path()
        .resolve("resources/welcome", BaseDirectory::Resource)
        .map_err(|e| format!("could not resolve welcome resource: {e}"))?;
    if !src.exists() {
        return Err(format!(
            "welcome resource not found at {} - in dev mode, ensure src-tauri/resources/welcome exists; in a packaged build, ensure tauri.conf.json bundle.resources includes resources/welcome/**/*",
            src.display()
        ));
    }
    let dst_root = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let dst = dst_root.join("welcome");

    if !dst.exists() {
        copy_dir_recursive(&src, &dst).map_err(|e| {
            format!(
                "copy welcome from {} to {}: {e}",
                src.display(),
                dst.display()
            )
        })?;
    }

    Ok(dst.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}
