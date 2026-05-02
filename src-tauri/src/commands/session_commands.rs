use tauri::State;
use crate::{AppState, AppError};
use crate::db::sessions::{self, Session, SessionMember, CreateSession};

#[tauri::command]
pub async fn create_session(state: State<'_, AppState>, input: CreateSession) -> Result<Session, AppError> {
    sessions::create(&state.db, &input).await
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
