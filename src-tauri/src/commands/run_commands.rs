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
    pub channel_id: Option<String>,
    pub prompt: String,
    pub work_dir: Option<String>,
    pub max_turns: Option<u32>,
    pub allowed_tools: Option<Vec<String>>,
    pub extra_args: Option<Vec<String>>,
}

const MANAGER_PLAN_PROMPT: &str = r#"If the user's request requires multiple tasks, respond with a plan in the following JSON format inside a ```json code block:
{
  "plan_title": "...",
  "summary": "...",
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "agent_preset": "developer|frontend-developer|backend-developer|code-reviewer|devops-engineer|qa-engineer",
      "acceptance_criteria": ["...", "..."]
    }
  ]
}
If the request is simple enough for a single response, just answer directly without JSON."#;

fn build_full_prompt(
    persona: Option<&str>,
    user_prompt: &str,
    include_manager_plan_prompt: bool,
) -> String {
    let plan_prompt = if include_manager_plan_prompt {
        format!("\n\n{}", MANAGER_PLAN_PROMPT)
    } else {
        String::new()
    };

    if let Some(persona_json) = persona {
        format!(
            "You are an AI agent with the following persona:\n{}{}\n\nUser request:\n{}",
            persona_json, plan_prompt, user_prompt
        )
    } else if include_manager_plan_prompt {
        format!("{}\n\nUser request:\n{}", MANAGER_PLAN_PROMPT, user_prompt)
    } else {
        user_prompt.to_string()
    }
}

async fn has_manager_permissions(pool: &db::DbPool, agent_id: &str) -> Result<bool, AppError> {
    let can_create_agent =
        db::permissions::check(pool, agent_id, "create_agent", "global", None).await?;
    let can_assign_task =
        db::permissions::check(pool, agent_id, "assign_task", "global", None).await?;

    Ok(can_create_agent && can_assign_task)
}

async fn resolve_run_channel_id(
    pool: &db::DbPool,
    channel_id: Option<&str>,
    session_id: Option<&str>,
) -> Option<String> {
    if let Some(channel_id) = channel_id {
        return Some(channel_id.to_string());
    }

    if let Some(session_id) = session_id {
        return db::sessions::get_by_id(pool, session_id)
            .await
            .ok()
            .map(|session| session.channel_id);
    }

    None
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

    // 3. Build prompt with persona context
    let full_prompt = build_full_prompt(
        agent.persona.as_deref(),
        &input.prompt,
        has_manager_permissions(&state.db, &agent.id).await?,
    );

    // 4. Resolve work directory: explicit > session > home directory (never inherit app cwd)
    let resolved_work_dir = if let Some(ref dir) = input.work_dir {
        dir.clone()
    } else if let Some(ref sid) = input.session_id {
        // Session must resolve — don't fallback to home for project work
        let session = db::sessions::get_by_id(&state.db, sid).await?;
        session.work_directory
    } else {
        // DM: use home directory
        dirs::home_dir()
            .ok_or_else(|| AppError::Config {
                message: "Cannot determine home directory".into(),
            })?
            .to_string_lossy()
            .to_string()
    };

    // 5. Build command spec
    let spec = runtime.build_command(
        &full_prompt,
        Some(resolved_work_dir.as_str()),
        input.max_turns,
        input.allowed_tools.as_deref(),
        agent.model_name.as_deref(),
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

    // 8. Resolve channel_id from explicit input first, then session if provided.
    let channel_id = resolve_run_channel_id(
        &state.db,
        input.channel_id.as_deref(),
        input.session_id.as_deref(),
    )
    .await;

    // 9. Emit run:started
    let _ = app.emit(
        EVENT_RUN_STARTED,
        RunLifecyclePayload {
            run_id: run_id.clone(),
            agent_id: agent.id.clone(),
            channel_id: channel_id.clone(),
            exit_code: None,
            message: None,
        },
    );

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
                        channel_id: channel_id.clone(),
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
            channel_id: None,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup_session(pool: &db::DbPool) -> (String, String) {
        let ws = db::workspaces::create(
            pool,
            &db::workspaces::CreateWorkspace {
                name: "WS".into(),
                description: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        let ch = db::channels::create(
            pool,
            &db::channels::CreateChannel {
                workspace_id: ws.id.clone(),
                name: "session".into(),
                channel_type: "group".into(),
            },
        )
        .await
        .unwrap();

        let session = db::sessions::create(
            pool,
            &db::sessions::CreateSession {
                workspace_id: ws.id,
                channel_id: ch.id.clone(),
                name: "Session".into(),
                work_directory: "/tmp/project".into(),
                git_branch: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        (session.id, ch.id)
    }

    #[tokio::test]
    async fn resolve_run_channel_prefers_explicit_channel_id() {
        let pool = db::create_test_pool().await;
        let (session_id, _) = setup_session(&pool).await;

        let channel_id = resolve_run_channel_id(&pool, Some("dm-channel"), Some(&session_id)).await;

        assert_eq!(channel_id.as_deref(), Some("dm-channel"));
    }

    #[tokio::test]
    async fn resolve_run_channel_uses_session_channel_when_channel_id_missing() {
        let pool = db::create_test_pool().await;
        let (session_id, session_channel_id) = setup_session(&pool).await;

        let channel_id = resolve_run_channel_id(&pool, None, Some(&session_id)).await;

        assert_eq!(channel_id, Some(session_channel_id));
    }

    #[test]
    fn manager_prompt_includes_json_plan_instruction_after_persona() {
        let prompt = build_full_prompt(Some("{\"role\":\"Manager\"}"), "Build this feature", true);

        assert!(prompt.contains("You are an AI agent with the following persona:"));
        assert!(prompt.contains("If the user's request requires multiple tasks"));
        assert!(prompt.contains("\"plan_title\""));
        assert!(prompt.contains("```json"));
        assert!(prompt.ends_with("User request:\nBuild this feature"));
    }
}
