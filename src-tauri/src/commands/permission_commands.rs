use tauri::State;
use crate::{AppState, AppError};
use crate::db::permissions::{self, AgentPermission, GrantPermission};

#[tauri::command]
pub async fn grant_permission(state: State<'_, AppState>, input: GrantPermission) -> Result<AgentPermission, AppError> {
    permissions::grant(&state.db, &input).await
}

#[tauri::command]
pub async fn check_permission(state: State<'_, AppState>, agent_id: String, permission_type: String, scope_type: String, scope_id: Option<String>) -> Result<bool, AppError> {
    permissions::check(&state.db, &agent_id, &permission_type, &scope_type, scope_id.as_deref()).await
}

#[tauri::command]
pub async fn revoke_permission(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    permissions::revoke(&state.db, &id).await
}

#[tauri::command]
pub async fn list_agent_permissions(state: State<'_, AppState>, agent_id: String) -> Result<Vec<AgentPermission>, AppError> {
    permissions::list_for_agent(&state.db, &agent_id).await
}
