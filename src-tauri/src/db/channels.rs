use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::DbPool;
use crate::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Channel {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub channel_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChannelMember {
    pub channel_id: String,
    pub agent_id: String,
    pub joined_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateChannel {
    pub workspace_id: String,
    pub name: String,
    pub channel_type: String, // "dm" | "group"
}

pub async fn create(pool: &DbPool, input: &CreateChannel) -> AppResult<Channel> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (id, workspace_id, name, channel_type) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.workspace_id)
    .bind(&input.name)
    .bind(&input.channel_type)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Channel> {
    sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "channel".into(),
            id: id.into(),
        })
}

pub async fn list_by_workspace(pool: &DbPool, workspace_id: &str) -> AppResult<Vec<Channel>> {
    sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE workspace_id = ? ORDER BY created_at",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn add_member(pool: &DbPool, channel_id: &str, agent_id: &str) -> AppResult<()> {
    sqlx::query("INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)")
        .bind(channel_id)
        .bind(agent_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn remove_member(pool: &DbPool, channel_id: &str, agent_id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = ? AND agent_id = ?")
        .bind(channel_id)
        .bind(agent_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_members(pool: &DbPool, channel_id: &str) -> AppResult<Vec<ChannelMember>> {
    sqlx::query_as::<_, ChannelMember>("SELECT * FROM channel_members WHERE channel_id = ?")
        .bind(channel_id)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    let result = sqlx::query("DELETE FROM channels WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(crate::AppError::NotFound {
            entity: "channel".into(),
            id: id.into(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup_workspace(pool: &DbPool) -> String {
        let ws = db::workspaces::create(
            pool,
            &db::workspaces::CreateWorkspace {
                name: "Test WS".into(),
                description: None,
                created_by_type: "user".into(),
                created_by_id: "user-1".into(),
            },
        )
        .await
        .unwrap();
        ws.id
    }

    async fn setup_agent(pool: &DbPool) -> String {
        let agent = db::agents::create(
            pool,
            &db::agents::CreateAgent {
                name: "Agent".into(),
                runtime_type: "claude_cli".into(),
                provider: "anthropic".into(),
                model_name: None,
                persona: None,
                config: None,
                created_by_type: "user".into(),
                created_by_id: "user-1".into(),
            },
        )
        .await
        .unwrap();
        agent.id
    }

    #[tokio::test]
    async fn test_channel_crud() {
        let pool = db::create_test_pool().await;
        let ws_id = setup_workspace(&pool).await;

        let ch = create(
            &pool,
            &CreateChannel {
                workspace_id: ws_id.clone(),
                name: "general".into(),
                channel_type: "group".into(),
            },
        )
        .await
        .unwrap();

        assert_eq!(ch.name, "general");
        assert_eq!(ch.channel_type, "group");

        let channels = list_by_workspace(&pool, &ws_id).await.unwrap();
        assert_eq!(channels.len(), 1);

        delete(&pool, &ch.id).await.unwrap();
        assert!(get_by_id(&pool, &ch.id).await.is_err());
    }

    #[tokio::test]
    async fn test_channel_members() {
        let pool = db::create_test_pool().await;
        let ws_id = setup_workspace(&pool).await;
        let agent_id = setup_agent(&pool).await;

        let ch = create(
            &pool,
            &CreateChannel {
                workspace_id: ws_id,
                name: "dm".into(),
                channel_type: "dm".into(),
            },
        )
        .await
        .unwrap();

        add_member(&pool, &ch.id, &agent_id).await.unwrap();
        let members = list_members(&pool, &ch.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].agent_id, agent_id);

        remove_member(&pool, &ch.id, &agent_id).await.unwrap();
        let members = list_members(&pool, &ch.id).await.unwrap();
        assert_eq!(members.len(), 0);
    }
}
