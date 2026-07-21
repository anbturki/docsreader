mod agents;
mod open_with;
mod tauri_api;

use open_with::OpenedPaths;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // A file/folder opened via the OS while an instance is already running
    // arrives as argv on Windows/Linux; single-instance folds that launch
    // into the running window and forwards the paths. macOS delivers opens
    // through RunEvent::Opened instead (handled below), so this branch is a
    // no-op there beyond preventing a duplicate instance.
    #[cfg(desktop)]
    {
        use tauri::Manager;
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            open_with::dispatch(app, argv.into_iter().skip(1));
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(OpenedPaths::default())
        .manage(tauri_api::SearchGeneration::default())
        .invoke_handler(tauri::generate_handler![
            tauri_api::scan_markdown,
            tauri_api::search_content,
            tauri_api::convert_workspace,
            tauri_api::detect_agent_clients,
            tauri_api::connect_agent_client,
            tauri_api::list_registry_workspaces,
            tauri_api::registry_dir,
            tauri_api::install_welcome_workspace,
            tauri_api::git_status,
            tauri_api::git_show_head,
            tauri_api::list_tasks,
            tauri_api::set_task_status,
            open_with::take_opened_paths
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let tauri::RunEvent::Opened { urls } = _event {
                    open_with::dispatch(_app, urls.iter().map(|url| url.to_string()));
                    if let Some(window) = _app.get_webview_window("main") {
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
