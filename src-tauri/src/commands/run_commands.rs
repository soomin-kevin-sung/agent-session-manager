use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::db;
use crate::events::*;
use crate::runtime::registry::RuntimeRegistry;
use crate::runtime::RuntimeEvent;
use crate::{AppError, AppState};

#[derive(Debug, Deserialize)]
pub struct StartRunInput {
    pub agent_id: String,
    pub session_id: Option<String>,
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

    // 1b. Check if agent has execute_cli permission
    let has_permission =
        db::permissions::check(&state.db, &agent.id, "execute_cli", "global", None).await?;
    if !has_permission {
        return Err(AppError::Permission {
            message: format!("Agent {} does not have execute_cli permission", agent.id),
        });
    }

    // 2. Determine runtime
    let runtime_kind = RuntimeRegistry::runtime_for(&agent.runtime_type);
    let runtime = state
        .runtime_registry
        .get(runtime_kind)
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

    // 5. Insert agent_runs record BEFORE spawning (fixes FK violation for cli_logs)
    let cli_args_json = serde_json::to_string(&spec.args).unwrap_or_default();
    sqlx::query(
        "INSERT INTO agent_runs (id, agent_id, session_id, cli_command, cli_args, process_status)
         VALUES (?, ?, ?, ?, ?, 'starting')",
    )
    .bind(&run_id)
    .bind(&agent.id)
    .bind(&input.session_id)
    .bind(&spec.program)
    .bind(&cli_args_json)
    .execute(&state.db)
    .await?;

    // 6. Spawn process
    let mut event_rx = state
        .process_manager
        .spawn(run_id.clone(), agent.id.clone(), runtime, spec)
        .await?;

    // 7. Update status to running after successful spawn
    sqlx::query("UPDATE agent_runs SET process_status = 'running', started_at = datetime('now') WHERE id = ?")
        .bind(&run_id)
        .execute(&state.db)
        .await?;

    // 8. Emit run:started
    let _ = app.emit(
        EVENT_RUN_STARTED,
        RunLifecyclePayload {
            run_id: run_id.clone(),
            agent_id: agent.id.clone(),
            exit_code: None,
            message: None,
        },
    );

    // 9. Resolve channel_id from session if provided
    let channel_id: Option<String> = if let Some(ref sid) = input.session_id {
        match db::sessions::get_by_id(&state.db, sid).await {
            Ok(session) => Some(session.channel_id),
            Err(_) => None,
        }
    } else {
        None
    };

    // 10. Spawn event forwarding task
    let app_fwd = app.clone();
    let run_id_fwd = run_id.clone();
    let agent_id_fwd = agent.id.clone();
    let db_pool = state.db.clone();

    tokio::spawn(async move {
        let run_id_clone = run_id_fwd.clone();
        let agent_id_clone = agent_id_fwd.clone();

        while let Some(event) = event_rx.recv().await {
            // Check for ProcessExited — this drives DB status update
            if let RuntimeEvent::ProcessExited {
                exit_code,
                was_cancelling,
            } = &event
            {
                // Determine final status based on was_cancelling + exit code
                let (final_status, event_name) = if *was_cancelling {
                    ("cancelled", EVENT_RUN_CANCELLED)
                } else if *exit_code == Some(0) {
                    ("completed", EVENT_RUN_COMPLETED)
                } else {
                    ("failed", EVENT_RUN_FAILED)
                };

                // Update agent_runs record with final status
                sqlx::query("UPDATE agent_runs SET process_status = ?, exit_code = ?, ended_at = datetime('now') WHERE id = ?")
                    .bind(final_status)
                    .bind(exit_code)
                    .bind(&run_id_clone)
                    .execute(&db_pool)
                    .await
                    .ok();

                // Emit lifecycle event
                let _ = app_fwd.emit(
                    event_name,
                    RunLifecyclePayload {
                        run_id: run_id_clone.clone(),
                        agent_id: agent_id_clone.clone(),
                        exit_code: *exit_code,
                        message: Some(format!(
                            "Run {} with exit code {:?}",
                            final_status, exit_code
                        )),
                    },
                );

                break;
            }

            // Store events in appropriate tables
            match &event {
                RuntimeEvent::Message { role: _, content } => {
                    // Store agent messages as actual messages in the channel
                    if let Some(ref ch_id) = channel_id {
                        db::messages::create(
                            &db_pool,
                            &db::messages::CreateMessage {
                                channel_id: ch_id.clone(),
                                sender_type: "agent".into(),
                                sender_agent_id: Some(agent_id_clone.clone()),
                                sender_user_id: None,
                                content: content.clone(),
                                message_type: "chat".into(),
                                metadata: None,
                                parent_id: None,
                                thread_root_id: None,
                            },
                        )
                        .await
                        .ok();
                    }
                }
                RuntimeEvent::RawLog { stream, line } => {
                    // Store raw logs in cli_logs table
                    let log_id = uuid::Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO cli_logs (id, agent_run_id, stream, content, sequence)
                         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sequence), 0) + 1 FROM cli_logs WHERE agent_run_id = ?))"
                    )
                    .bind(&log_id)
                    .bind(&run_id_clone)
                    .bind(stream)
                    .bind(line)
                    .bind(&run_id_clone)
                    .execute(&db_pool)
                    .await
                    .ok();
                }
                _ => {}
            }

            // Forward all other events to frontend
            let _ = app_fwd.emit(
                EVENT_AGENT_OUTPUT,
                AgentOutputPayload {
                    run_id: run_id_clone.clone(),
                    agent_id: agent_id_clone.clone(),
                    event,
                },
            );
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

    // Update DB status to cancelling
    sqlx::query("UPDATE agent_runs SET process_status = 'cancelling' WHERE id = ?")
        .bind(&run_id)
        .execute(&state.db)
        .await
        .ok();

    // Emit cancelling (not cancelled — cancelled is emitted when ProcessExited arrives)
    let _ = app.emit(
        EVENT_RUN_CANCELLING,
        RunLifecyclePayload {
            run_id: run_id.clone(),
            agent_id,
            exit_code: None,
            message: Some("Run cancellation requested by user".into()),
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn list_active_runs(state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    Ok(state.process_manager.registry.active_run_ids().await)
}
