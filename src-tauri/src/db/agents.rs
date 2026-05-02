use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub runtime_type: String,
    pub provider: String,
    pub model_name: Option<String>,
    pub persona: Option<String>,
    pub config: Option<String>,
    pub enabled: bool,
    pub created_by_type: String,
    pub created_by_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAgent {
    pub name: String,
    pub runtime_type: String,  // "claude_cli" | "codex_cli"
    pub provider: String,      // "anthropic" | "openai"
    pub model_name: Option<String>,
    pub persona: Option<String>,
    pub config: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAgent {
    pub name: Option<String>,
    pub model_name: Option<String>,
    pub persona: Option<String>,
    pub config: Option<String>,
    pub enabled: Option<bool>,
}

pub async fn create(pool: &DbPool, input: &CreateAgent) -> AppResult<Agent> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Agent>(
        "INSERT INTO agents (id, name, runtime_type, provider, model_name, persona, config, created_by_type, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.runtime_type)
    .bind(&input.provider)
    .bind(&input.model_name)
    .bind(&input.persona)
    .bind(&input.config)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Agent> {
    sqlx::query_as::<_, Agent>("SELECT * FROM agents WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "agent".into(),
            id: id.into(),
        })
}

pub async fn list(pool: &DbPool) -> AppResult<Vec<Agent>> {
    sqlx::query_as::<_, Agent>("SELECT * FROM agents ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn update(pool: &DbPool, id: &str, input: &UpdateAgent) -> AppResult<Agent> {
    // Build dynamic update
    let existing = get_by_id(pool, id).await?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let model_name = input.model_name.as_ref().or(existing.model_name.as_ref());
    let persona = input.persona.as_ref().or(existing.persona.as_ref());
    let config = input.config.as_ref().or(existing.config.as_ref());
    let enabled = input.enabled.unwrap_or(existing.enabled);

    sqlx::query_as::<_, Agent>(
        "UPDATE agents SET name = ?, model_name = ?, persona = ?, config = ?, enabled = ?, updated_at = datetime('now')
         WHERE id = ? RETURNING *"
    )
    .bind(name)
    .bind(model_name)
    .bind(persona)
    .bind(config)
    .bind(enabled)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM agents WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(crate::AppError::NotFound {
            entity: "agent".into(),
            id: id.into(),
        });
    }
    Ok(())
}

pub async fn list_by_creator(pool: &DbPool, creator_type: &str, creator_id: &str) -> AppResult<Vec<Agent>> {
    sqlx::query_as::<_, Agent>(
        "SELECT * FROM agents WHERE created_by_type = ? AND created_by_id = ? ORDER BY created_at DESC"
    )
    .bind(creator_type)
    .bind(creator_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn test_create_input() -> CreateAgent {
        CreateAgent {
            name: "Test Agent".into(),
            runtime_type: "claude_cli".into(),
            provider: "anthropic".into(),
            model_name: Some("claude-opus-4-6".into()),
            persona: Some(r#"{"role":"developer"}"#.into()),
            config: None,
            created_by_type: "user".into(),
            created_by_id: "user-1".into(),
        }
    }

    #[tokio::test]
    async fn test_create_and_get_agent() {
        let pool = db::create_test_pool().await;
        let agent = create(&pool, &test_create_input()).await.unwrap();

        assert_eq!(agent.name, "Test Agent");
        assert_eq!(agent.runtime_type, "claude_cli");
        assert_eq!(agent.provider, "anthropic");
        assert!(agent.enabled);

        let fetched = get_by_id(&pool, &agent.id).await.unwrap();
        assert_eq!(fetched.name, "Test Agent");
    }

    #[tokio::test]
    async fn test_update_agent() {
        let pool = db::create_test_pool().await;
        let agent = create(&pool, &test_create_input()).await.unwrap();

        let updated = update(&pool, &agent.id, &UpdateAgent {
            name: Some("Renamed".into()),
            model_name: None,
            persona: None,
            config: None,
            enabled: Some(false),
        }).await.unwrap();

        assert_eq!(updated.name, "Renamed");
        assert!(!updated.enabled);
    }

    #[tokio::test]
    async fn test_list_agents() {
        let pool = db::create_test_pool().await;

        create(&pool, &test_create_input()).await.unwrap();
        let mut input2 = test_create_input();
        input2.name = "Agent 2".into();
        input2.runtime_type = "codex_cli".into();
        input2.provider = "openai".into();
        create(&pool, &input2).await.unwrap();

        let agents = list(&pool).await.unwrap();
        assert_eq!(agents.len(), 2);
    }

    #[tokio::test]
    async fn test_list_by_creator() {
        let pool = db::create_test_pool().await;

        create(&pool, &test_create_input()).await.unwrap();
        let mut input2 = test_create_input();
        input2.created_by_id = "user-2".into();
        create(&pool, &input2).await.unwrap();

        let agents = list_by_creator(&pool, "user", "user-1").await.unwrap();
        assert_eq!(agents.len(), 1);
    }

    #[tokio::test]
    async fn test_delete_agent() {
        let pool = db::create_test_pool().await;
        let agent = create(&pool, &test_create_input()).await.unwrap();

        delete(&pool, &agent.id).await.unwrap();
        assert!(get_by_id(&pool, &agent.id).await.is_err());
    }
}
