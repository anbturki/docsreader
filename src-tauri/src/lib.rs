mod agents;
mod tauri_api;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            tauri_api::scan_markdown,
            tauri_api::convert_workspace,
            tauri_api::detect_agent_clients,
            tauri_api::connect_agent_client,
            tauri_api::list_registry_workspaces,
            tauri_api::registry_dir,
            tauri_api::install_welcome_workspace,
            tauri_api::git_status,
            tauri_api::git_show_head,
            tauri_api::list_tasks,
            tauri_api::set_task_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
