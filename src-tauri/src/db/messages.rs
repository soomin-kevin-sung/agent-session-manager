use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub sender_type: String,
    pub sender_user_id: Option<String>,
    pub sender_agent_id: Option<String>,
    pub content: String,
    pub message_type: String,
    pub status: String,
    pub metadata: Option<String>,
    pub parent_id: Option<String>,
    pub thread_root_id: Option<String>,
    pub edited_at: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessage {
    pub channel_id: String,
    pub sender_type: String,
    pub sender_user_id: Option<String>,
    pub sender_agent_id: Option<String>,
    pub content: String,
    pub message_type: String,
    pub metadata: Option<String>,
    pub parent_id: Option<String>,
    pub thread_root_id: Option<String>,
}

pub async fn create(pool: &DbPool, input: &CreateMessage) -> AppResult<Message> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Message>(
        "INSERT INTO messages (id, channel_id, sender_type, sender_user_id, sender_agent_id, content, message_type, metadata, parent_id, thread_root_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.channel_id)
    .bind(&input.sender_type)
    .bind(&input.sender_user_id)
    .bind(&input.sender_agent_id)
    .bind(&input.content)
    .bind(&input.message_type)
    .bind(&input.metadata)
    .bind(&input.parent_id)
    .bind(&input.thread_root_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Message> {
    sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "message".into(),
            id: id.into(),
        })
}

pub async fn list_by_channel(pool: &DbPool, channel_id: &str, limit: i64, before: Option<&str>) -> AppResult<Vec<Message>> {
    if let Some(before_time) = before {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = ? AND deleted_at IS NULL AND created_at < ?
             ORDER BY created_at DESC LIMIT ?"
        )
        .bind(channel_id)
        .bind(before_time)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT ?"
        )
        .bind(channel_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
    }
}

pub async fn update_status(pool: &DbPool, id: &str, status: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn soft_delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET deleted_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &DbPool) -> (String, String) {
        let ws = db::workspaces::create(pool, &db::workspaces::CreateWorkspace {
            name: "WS".into(),
            description: None,
            created_by_type: "user".into(),
            created_by_id: "u1".into(),
        }).await.unwrap();

        let ch = db::channels::create(pool, &db::channels::CreateChannel {
            workspace_id: ws.id,
            name: "general".into(),
            channel_type: "group".into(),
        }).await.unwrap();

        let user = db::users::create(pool, &db::users::CreateUser {
            display_name: "User".into(),
        }).await.unwrap();

        (ch.id, user.id)
    }

    #[tokio::test]
    async fn test_create_and_list_messages() {
        let pool = db::create_test_pool().await;
        let (ch_id, user_id) = setup(&pool).await;

        let msg = create(&pool, &CreateMessage {
            channel_id: ch_id.clone(),
            sender_type: "user".into(),
            sender_user_id: Some(user_id.clone()),
            sender_agent_id: None,
            content: "Hello".into(),
            message_type: "chat".into(),
            metadata: None,
            parent_id: None,
            thread_root_id: None,
        }).await.unwrap();

        assert_eq!(msg.content, "Hello");
        assert_eq!(msg.status, "created");

        let msgs = list_by_channel(&pool, &ch_id, 50, None).await.unwrap();
        assert_eq!(msgs.len(), 1);
    }

    #[tokio::test]
    async fn test_message_status_and_soft_delete() {
        let pool = db::create_test_pool().await;
        let (ch_id, user_id) = setup(&pool).await;

        let msg = create(&pool, &CreateMessage {
            channel_id: ch_id,
            sender_type: "user".into(),
            sender_user_id: Some(user_id),
            sender_agent_id: None,
            content: "Test".into(),
            message_type: "chat".into(),
            metadata: None,
            parent_id: None,
            thread_root_id: None,
        }).await.unwrap();

        update_status(&pool, &msg.id, "delivered").await.unwrap();
        let fetched = get_by_id(&pool, &msg.id).await.unwrap();
        assert_eq!(fetched.status, "delivered");

        soft_delete(&pool, &msg.id).await.unwrap();
        assert!(get_by_id(&pool, &msg.id).await.is_err());
    }
}
