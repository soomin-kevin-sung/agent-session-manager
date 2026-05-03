use tauri::State;
use crate::{AppState, AppError};
use crate::db::{workspaces};
use crate::db::{channels, channels::CreateChannel};

#[tauri::command]
pub async fn create_workspace(state: State<'_, AppState>, name: String, description: Option<String>) -> Result<workspaces::Workspace, AppError> {
    let users = crate::db::users::list(&state.db).await?;
    let user_id = users.first()
        .map(|u| u.id.clone())
        .ok_or_else(|| AppError::Internal { message: "No user found".into() })?;

    workspaces::create(&state.db, &workspaces::CreateWorkspace {
        name,
        description,
        created_by_type: "user".into(),
        created_by_id: user_id,
    }).await
}

#[tauri::command]
pub async fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<workspaces::Workspace>, AppError> {
    workspaces::list(&state.db).await
}

#[tauri::command]
pub async fn create_channel(state: State<'_, AppState>, input: CreateChannel) -> Result<channels::Channel, AppError> {
    channels::create(&state.db, &input).await
}

#[tauri::command]
pub async fn list_channels(state: State<'_, AppState>, workspace_id: String) -> Result<Vec<channels::Channel>, AppError> {
    channels::list_by_workspace(&state.db, &workspace_id).await
}
