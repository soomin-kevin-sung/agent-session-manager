use std::sync::Arc;
use tauri::AppHandle;

use crate::db::{self, DbPool};
use crate::runtime::registry::RuntimeRegistry;
use crate::process::manager::ProcessManager;
use crate::{AppResult, AppError};

pub struct MessageRouter;

impl MessageRouter {
    /// Route a user message to an agent — starts a CLI run with the message as prompt.
    pub async fn route_to_agent(
        _app: &AppHandle,
        pool: &DbPool,
        process_manager: &ProcessManager,
        runtime_registry: &RuntimeRegistry,
        agent_id: &str,
        message: &str,
        work_directory: Option<&str>,
    ) -> AppResult<String> {
        let agent = db::agents::get_by_id(pool, agent_id).await?;

        let runtime_kind = RuntimeRegistry::runtime_for(&agent.runtime_type);
        let runtime = runtime_registry.get(runtime_kind)
            .ok_or_else(|| AppError::Internal {
                message: format!("No runtime for {}", agent.runtime_type),
            })?;

        let spec = runtime.build_command(
            message,
            work_directory,
            Some(10),
            None,
            None,
        )?;

        let run_id = uuid::Uuid::new_v4().to_string();
        let _event_rx = process_manager.spawn(
            run_id.clone(),
            agent.id.clone(),
            runtime,
            spec,
        ).await?;

        // The event forwarding is handled by the caller (run_commands)
        // Return the run_id so caller can set up forwarding
        Ok(run_id)
    }
}
