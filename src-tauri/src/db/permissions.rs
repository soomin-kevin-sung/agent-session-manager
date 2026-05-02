use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AgentPermission {
    pub id: String,
    pub agent_id: String,
    pub scope_type: String,
    pub scope_id: Option<String>,
    pub permission_type: String,
    pub granted_by_type: String,
    pub granted_by_id: String,
    pub expires_at: Option<String>,
    pub revoked_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct GrantPermission {
    pub agent_id: String,
    pub scope_type: String,
    pub scope_id: Option<String>,
    pub permission_type: String,
    pub granted_by_type: String,
    pub granted_by_id: String,
}

pub async fn grant(pool: &DbPool, input: &GrantPermission) -> AppResult<AgentPermission> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, AgentPermission>(
        "INSERT INTO agent_permissions (id, agent_id, scope_type, scope_id, permission_type, granted_by_type, granted_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.agent_id)
    .bind(&input.scope_type)
    .bind(&input.scope_id)
    .bind(&input.permission_type)
    .bind(&input.granted_by_type)
    .bind(&input.granted_by_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn check(pool: &DbPool, agent_id: &str, permission_type: &str, scope_type: &str, scope_id: Option<&str>) -> AppResult<bool> {
    let result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM agent_permissions
         WHERE agent_id = ? AND permission_type = ? AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         AND (scope_type = 'global' OR (scope_type = ? AND (scope_id IS NULL OR scope_id = ?)))"
    )
    .bind(agent_id)
    .bind(permission_type)
    .bind(scope_type)
    .bind(scope_id)
    .fetch_one(pool)
    .await?;

    Ok(result > 0)
}

pub async fn revoke(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("UPDATE agent_permissions SET revoked_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_for_agent(pool: &DbPool, agent_id: &str) -> AppResult<Vec<AgentPermission>> {
    sqlx::query_as::<_, AgentPermission>(
        "SELECT * FROM agent_permissions WHERE agent_id = ? AND revoked_at IS NULL ORDER BY created_at"
    )
    .bind(agent_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup_agent(pool: &DbPool) -> String {
        db::agents::create(pool, &db::agents::CreateAgent {
            name: "Agent".into(), runtime_type: "claude_cli".into(), provider: "anthropic".into(),
            model_name: None, persona: None, config: None,
            created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap().id
    }

    #[tokio::test]
    async fn test_grant_and_check_permission() {
        let pool = db::create_test_pool().await;
        let agent_id = setup_agent(&pool).await;

        grant(&pool, &GrantPermission {
            agent_id: agent_id.clone(),
            scope_type: "global".into(),
            scope_id: None,
            permission_type: "create_agent".into(),
            granted_by_type: "user".into(),
            granted_by_id: "u1".into(),
        }).await.unwrap();

        assert!(check(&pool, &agent_id, "create_agent", "global", None).await.unwrap());
        assert!(!check(&pool, &agent_id, "execute_cli", "global", None).await.unwrap());
    }

    #[tokio::test]
    async fn test_revoke_permission() {
        let pool = db::create_test_pool().await;
        let agent_id = setup_agent(&pool).await;

        let perm = grant(&pool, &GrantPermission {
            agent_id: agent_id.clone(),
            scope_type: "global".into(), scope_id: None,
            permission_type: "create_agent".into(),
            granted_by_type: "user".into(), granted_by_id: "u1".into(),
        }).await.unwrap();

        revoke(&pool, &perm.id).await.unwrap();
        assert!(!check(&pool, &agent_id, "create_agent", "global", None).await.unwrap());
    }
}
