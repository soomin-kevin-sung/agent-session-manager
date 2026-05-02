use tauri::State;
use crate::{AppState, AppError};
use crate::db::{workspaces, workspaces::CreateWorkspace};
use crate::db::{channels, channels::CreateChannel};

#[tauri::command]
pub async fn create_workspace(state: State<'_, AppState>, input: CreateWorkspace) -> Result<workspaces::Workspace, AppError> {
    workspaces::create(&state.db, &input).await
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
