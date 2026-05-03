use tauri::State;
use crate::{AppState, AppError};
use crate::db::sessions::{self, Session, SessionMember};
use crate::orchestrator::session_lifecycle::SessionLifecycle;

#[derive(serde::Deserialize)]
pub struct CreateWorkSessionInput {
    pub workspace_id: String,
    pub name: String,
    pub work_directory: String,
    pub agent_ids: Vec<String>,
}

#[tauri::command]
pub async fn create_session(state: State<'_, AppState>, input: CreateWorkSessionInput) -> Result<Session, AppError> {
    let users = crate::db::users::list(&state.db).await?;
    let user_id = users.first()
        .map(|u| u.id.clone())
        .ok_or_else(|| AppError::Internal { message: "No user found".into() })?;

    SessionLifecycle::create_work_session(
        &state.db,
        &input.workspace_id,
        &input.name,
        &input.work_directory,
        "user",
        &user_id,
        &input.agent_ids,
    ).await
}

#[tauri::command]
pub async fn get_session(state: State<'_, AppState>, id: String) -> Result<Session, AppError> {
    sessions::get_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn update_session_status(state: State<'_, AppState>, id: String, status: String) -> Result<Session, AppError> {
    sessions::update_status(&state.db, &id, &status).await
}

#[tauri::command]
pub async fn add_session_member(state: State<'_, AppState>, session_id: String, agent_id: String, role: String) -> Result<(), AppError> {
    sessions::add_member(&state.db, &session_id, &agent_id, &role).await
}

#[tauri::command]
pub async fn list_session_members(state: State<'_, AppState>, session_id: String) -> Result<Vec<SessionMember>, AppError> {
    sessions::list_members(&state.db, &session_id).await
}
