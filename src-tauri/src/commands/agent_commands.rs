use crate::db::agents::{self, Agent, UpdateAgent};
use crate::orchestrator::agent_lifecycle::AgentLifecycle;
use crate::{AppError, AppState};
use tauri::State;

#[derive(serde::Deserialize)]
pub struct CreateAgentWithPermissions {
    pub name: String,
    pub runtime_type: String,
    pub provider: String,
    pub model_name: Option<String>,
    pub persona: Option<String>,
    pub config: Option<String>,
    pub permissions: Vec<String>,
}

#[tauri::command]
pub async fn create_agent(
    state: State<'_, AppState>,
    input: CreateAgentWithPermissions,
) -> Result<Agent, AppError> {
    // Get default user id
    let users = crate::db::users::list(&state.db).await?;
    let user_id = users
        .first()
        .map(|u| u.id.clone())
        .ok_or_else(|| AppError::Internal {
            message: "No user found".into(),
        })?;

    AgentLifecycle::create_agent_by_user(
        &state.db,
        &user_id,
        &crate::db::agents::CreateAgent {
            name: input.name,
            runtime_type: input.runtime_type,
            provider: input.provider,
            model_name: input.model_name,
            persona: input.persona,
            config: input.config,
            created_by_type: "user".into(),
            created_by_id: user_id.clone(),
        },
        &input.permissions,
    )
    .await
}

// Read operations can stay as direct DB calls
#[tauri::command]
pub async fn get_agent(state: State<'_, AppState>, id: String) -> Result<Agent, AppError> {
    agents::get_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<Agent>, AppError> {
    agents::list(&state.db).await
}

#[tauri::command]
pub async fn update_agent(
    state: State<'_, AppState>,
    id: String,
    input: UpdateAgent,
) -> Result<Agent, AppError> {
    agents::update(&state.db, &id, &input).await
}

#[tauri::command]
pub async fn delete_agent(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    agents::delete(&state.db, &id).await
}
