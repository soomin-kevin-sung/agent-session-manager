mod errors;
mod db;
mod config;
mod app_state;
mod commands;
mod runtime;
mod process;
mod events;
mod security;
mod orchestrator;

pub use errors::{AppError, AppResult, IpcError};
pub use db::DbPool;
pub use app_state::AppState;
pub use config::AppSettings;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            if cfg!(debug_assertions) {
                app_handle.plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            tauri::async_runtime::block_on(async move {
                let app_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir");
                std::fs::create_dir_all(&app_dir).ok();

                let settings = AppSettings::default();
                let db_path = app_dir.join(&settings.database_path);
                let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

                let pool = db::create_pool(&db_url)
                    .await
                    .expect("failed to create db pool");
                db::schema::run_migrations(&pool)
                    .await
                    .expect("failed to run migrations");

                // Create default user if none exists
                let users = db::users::list(&pool).await.unwrap_or_default();
                let _default_user_id = if users.is_empty() {
                    match db::users::create(&pool, &db::users::CreateUser {
                        display_name: "User".into(),
                    }).await {
                        Ok(user) => user.id,
                        Err(e) => {
                            log::error!("Failed to create default user: {}", e);
                            String::new()
                        }
                    }
                } else {
                    users[0].id.clone()
                };

                let process_manager = process::ProcessManager::new();
                let runtime_registry = runtime::registry::RuntimeRegistry::new(
                    settings.claude_cli_path.clone(),
                    settings.codex_cli_path.clone(),
                );

                app_handle.manage(AppState {
                    db: pool,
                    settings,
                    process_manager,
                    runtime_registry,
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent_commands::create_agent,
            commands::agent_commands::get_agent,
            commands::agent_commands::list_agents,
            commands::agent_commands::update_agent,
            commands::agent_commands::delete_agent,
            commands::workspace_commands::create_workspace,
            commands::workspace_commands::list_workspaces,
            commands::workspace_commands::create_channel,
            commands::workspace_commands::list_channels,
            commands::message_commands::send_message,
            commands::message_commands::list_messages,
            commands::run_commands::start_agent_run,
            commands::run_commands::stop_agent_run,
            commands::run_commands::list_active_runs,
            commands::session_commands::create_session,
            commands::session_commands::get_session,
            commands::session_commands::update_session_status,
            commands::session_commands::add_session_member,
            commands::session_commands::list_session_members,
            commands::permission_commands::check_permission,
            commands::permission_commands::list_agent_permissions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
