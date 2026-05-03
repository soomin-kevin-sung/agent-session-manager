use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::DbPool;
use crate::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub session_id: String,
    pub channel_id: String,
    pub title: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
    pub assigned_to_id: Option<String>,
    pub status: String,
    pub priority: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub session_id: String,
    pub channel_id: String,
    pub title: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
    pub assigned_to_id: Option<String>,
    pub priority: Option<i64>,
}

pub async fn create_task(pool: &DbPool, input: &CreateTask) -> AppResult<Task> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Task>(
        "INSERT INTO tasks (id, session_id, channel_id, title, description, created_by_type, created_by_id, assigned_to_id, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.session_id)
    .bind(&input.channel_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .bind(&input.assigned_to_id)
    .bind(input.priority.unwrap_or(0))
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn update_task_status(pool: &DbPool, id: &str, status: &str) -> AppResult<Task> {
    sqlx::query_as::<_, Task>(
        "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
    .bind(status)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn list_by_session(pool: &DbPool, session_id: &str) -> AppResult<Vec<Task>> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE session_id = ? ORDER BY priority DESC, created_at",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &DbPool) -> (String, String, String) {
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
                name: "ch".into(),
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
                work_directory: "/tmp".into(),
                git_branch: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        (session.id, ch.id, "u1".into())
    }

    #[tokio::test]
    async fn test_task_lifecycle() {
        let pool = db::create_test_pool().await;
        let (session_id, ch_id, _) = setup(&pool).await;

        let task = create_task(
            &pool,
            &CreateTask {
                session_id: session_id.clone(),
                channel_id: ch_id,
                title: "Implement login".into(),
                description: Some("OAuth2".into()),
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
                assigned_to_id: None,
                priority: Some(1),
            },
        )
        .await
        .unwrap();

        assert_eq!(task.status, "open");

        let updated = update_task_status(&pool, &task.id, "in_progress")
            .await
            .unwrap();
        assert_eq!(updated.status, "in_progress");

        let tasks = list_by_session(&pool, &session_id).await.unwrap();
        assert_eq!(tasks.len(), 1);
    }
}
