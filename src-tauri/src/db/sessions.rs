use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::DbPool;
use crate::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub channel_id: String,
    pub name: String,
    pub work_directory: String,
    pub git_branch: Option<String>,
    pub status: String,
    pub created_by_type: String,
    pub created_by_id: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SessionMember {
    pub session_id: String,
    pub agent_id: String,
    pub role: String,
    pub joined_at: String,
    pub left_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSession {
    pub workspace_id: String,
    pub channel_id: String,
    pub name: String,
    pub work_directory: String,
    pub git_branch: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
}

pub async fn create(pool: &DbPool, input: &CreateSession) -> AppResult<Session> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Session>(
        "INSERT INTO sessions (id, workspace_id, channel_id, name, work_directory, git_branch, created_by_type, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.workspace_id)
    .bind(&input.channel_id)
    .bind(&input.name)
    .bind(&input.work_directory)
    .bind(&input.git_branch)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Session> {
    sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "session".into(),
            id: id.into(),
        })
}

pub async fn update_status(pool: &DbPool, id: &str, status: &str) -> AppResult<Session> {
    sqlx::query_as::<_, Session>(
        "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
    .bind(status)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn add_member(
    pool: &DbPool,
    session_id: &str,
    agent_id: &str,
    role: &str,
) -> AppResult<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO session_members (session_id, agent_id, role) VALUES (?, ?, ?)",
    )
    .bind(session_id)
    .bind(agent_id)
    .bind(role)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_members(pool: &DbPool, session_id: &str) -> AppResult<Vec<SessionMember>> {
    sqlx::query_as::<_, SessionMember>(
        "SELECT * FROM session_members WHERE session_id = ? AND left_at IS NULL",
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
                name: "session-ch".into(),
                channel_type: "group".into(),
            },
        )
        .await
        .unwrap();

        let agent = db::agents::create(
            pool,
            &db::agents::CreateAgent {
                name: "Worker".into(),
                runtime_type: "claude_cli".into(),
                provider: "anthropic".into(),
                model_name: None,
                persona: None,
                config: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        (ws.id, ch.id, agent.id)
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let pool = db::create_test_pool().await;
        let (ws_id, ch_id, agent_id) = setup(&pool).await;

        let session = create(
            &pool,
            &CreateSession {
                workspace_id: ws_id,
                channel_id: ch_id,
                name: "Frontend Dev".into(),
                work_directory: "/tmp/project".into(),
                git_branch: Some("feature/login".into()),
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        assert_eq!(session.status, "planned");

        let running = update_status(&pool, &session.id, "running").await.unwrap();
        assert_eq!(running.status, "running");

        add_member(&pool, &session.id, &agent_id, "worker")
            .await
            .unwrap();
        let members = list_members(&pool, &session.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].role, "worker");
    }
}
