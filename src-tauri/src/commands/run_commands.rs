use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::{AppError, AppState};
use crate::db;
use crate::events::*;
use crate::process::RunStatus;
use crate::runtime::RuntimeEvent;
use crate::runtime::registry::RuntimeRegistry;

#[derive(Debug, Deserialize)]
pub struct StartRunInput {
    pub agent_id: String,
    pub prompt: String,
    pub work_dir: Option<String>,
    pub max_turns: Option<u32>,
    pub allowed_tools: Option<Vec<String>>,
    pub extra_args: Option<Vec<String>>,
}

#[tauri::command]
pub async fn start_agent_run(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartRunInput,
) -> Result<String, AppError> {
    // 1. Look up agent from DB
    let agent = db::agents::get_by_id(&state.db, &input.agent_id).await?;

    // 2. Determine runtime
    let runtime_kind = RuntimeRegistry::runtime_for(&agent.runtime_type);
    let runtime = state.runtime_registry.get(runtime_kind)
        .ok_or_else(|| AppError::Internal {
            message: format!("No runtime registered for {:?}", runtime_kind),
        })?;

    // 3. Build command spec
    let spec = runtime.build_command(
        &input.prompt,
        input.work_dir.as_deref(),
        input.max_turns,
        input.allowed_tools.as_deref(),
        input.extra_args.as_deref(),
    )?;

    // 4. Generate run_id
    let run_id = uuid::Uuid::new_v4().to_string();

    // 5. Spawn process
    let mut event_rx = state.process_manager.spawn(
        run_id.clone(),
        agent.id.clone(),
        runtime,
        spec,
    ).await?;

    // 6. Emit run:started
    let _ = app.emit(EVENT_RUN_STARTED, RunLifecyclePayload {
        run_id: run_id.clone(),
        agent_id: agent.id.clone(),
        exit_code: None,
        message: None,
    });

    // 7. Spawn event forwarding task
    let app_fwd = app.clone();
    let run_id_fwd = run_id.clone();
    let agent_id_fwd = agent.id.clone();
    let registry = state.process_manager.registry.clone();
    let db_pool = state.db.clone();

    tokio::spawn(async move {
        let mut cli_logs = Vec::<String>::new();

        while let Some(event) = event_rx.recv().await {
            // Collect raw log lines for DB storage
            match &event {
                RuntimeEvent::RawLog { line, .. } => {
                    cli_logs.push(line.clone());
                }
                RuntimeEvent::Message { content, .. } => {
                    cli_logs.push(content.clone());
                }
                _ => {}
            }

            // Check for ProcessExited — this drives DB status update
            if let RuntimeEvent::ProcessExited { exit_code } = &event {
                let status_at_exit = registry.get_status(&run_id_fwd).await;

                // Determine final status based on cancellation state + exit code
                let (final_status, event_name) = match status_at_exit {
                    Some(RunStatus::Cancelling) => ("cancelled", EVENT_RUN_CANCELLED),
                    _ => {
                        if *exit_code == Some(0) {
                            ("completed", EVENT_RUN_COMPLETED)
                        } else {
                            ("failed", EVENT_RUN_FAILED)
                        }
                    }
                };

                // Emit lifecycle event
                let _ = app_fwd.emit(event_name, RunLifecyclePayload {
                    run_id: run_id_fwd.clone(),
                    agent_id: agent_id_fwd.clone(),
                    exit_code: *exit_code,
                    message: Some(format!("Run {} with exit code {:?}", final_status, exit_code)),
                });

                // Store CLI logs in DB as a message (best-effort)
                if !cli_logs.is_empty() {
                    let log_content = cli_logs.join("\n");
                    let _ = db::messages::create(&db_pool, &db::messages::CreateMessage {
                        channel_id: "system".into(), // system channel placeholder
                        sender_type: "agent".into(),
                        sender_user_id: None,
                        sender_agent_id: Some(agent_id_fwd.clone()),
                        content: log_content,
                        message_type: "cli_log".into(),
                        metadata: Some(serde_json::json!({
                            "run_id": run_id_fwd,
                            "status": final_status,
                            "exit_code": exit_code,
                        }).to_string()),
                        parent_id: None,
                        thread_root_id: None,
                    }).await;
                }

                break;
            }

            // Forward all other events to frontend
            let _ = app_fwd.emit(EVENT_AGENT_OUTPUT, AgentOutputPayload {
                run_id: run_id_fwd.clone(),
                agent_id: agent_id_fwd.clone(),
                event,
            });
        }
    });

    Ok(run_id)
}

#[tauri::command]
pub async fn stop_agent_run(
    app: AppHandle,
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), AppError> {
    let agent_id = state.process_manager.kill(&run_id).await?;

    let _ = app.emit(EVENT_RUN_CANCELLED, RunLifecyclePayload {
        run_id: run_id.clone(),
        agent_id,
        exit_code: None,
        message: Some("Run cancelled by user".into()),
    });

    Ok(())
}

#[tauri::command]
pub async fn list_active_runs(
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    Ok(state.process_manager.registry.active_run_ids().await)
}
