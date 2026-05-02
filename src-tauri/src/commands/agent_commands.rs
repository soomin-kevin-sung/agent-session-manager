use tauri::State;
use crate::{AppState, AppError};
use crate::db::{agents, agents::CreateAgent, agents::UpdateAgent};

#[tauri::command]
pub async fn create_agent(state: State<'_, AppState>, input: CreateAgent) -> Result<agents::Agent, AppError> {
    agents::create(&state.db, &input).await
}

#[tauri::command]
pub async fn get_agent(state: State<'_, AppState>, id: String) -> Result<agents::Agent, AppError> {
    agents::get_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<agents::Agent>, AppError> {
    agents::list(&state.db).await
}

#[tauri::command]
pub async fn update_agent(state: State<'_, AppState>, id: String, input: UpdateAgent) -> Result<agents::Agent, AppError> {
    agents::update(&state.db, &id, &input).await
}

#[tauri::command]
pub async fn delete_agent(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    agents::delete(&state.db, &id).await
}
