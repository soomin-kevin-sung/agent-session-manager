use tauri::State;
use crate::{AppState, AppError};
use crate::db::{messages, messages::CreateMessage};

#[tauri::command]
pub async fn send_message(state: State<'_, AppState>, input: CreateMessage) -> Result<messages::Message, AppError> {
    messages::create(&state.db, &input).await
}

#[tauri::command]
pub async fn list_messages(state: State<'_, AppState>, channel_id: String, limit: Option<i64>, before: Option<String>) -> Result<Vec<messages::Message>, AppError> {
    messages::list_by_channel(&state.db, &channel_id, limit.unwrap_or(50), before.as_deref()).await
}
