use crate::db::{self, DbPool, agents::CreateAgent, permissions::GrantPermission};
use crate::security::permission_validator::PermissionValidator;
use crate::AppResult;

pub struct AgentLifecycle;

impl AgentLifecycle {
    /// Create an agent on behalf of another agent (with permission validation).
    // TODO: wrap in transaction for atomicity (requires refactoring CRUD fns to accept Pool or Transaction)
    pub async fn create_agent_by_agent(
        pool: &DbPool,
        creator_agent_id: &str,
        input: &CreateAgent,
        child_permissions: &[String],
    ) -> AppResult<db::agents::Agent> {
        // 1. Verify creator has create_agent permission
        PermissionValidator::can_create_agent(pool, creator_agent_id).await?;

        // 2. Validate permission inheritance
        PermissionValidator::validate_permission_inheritance(pool, creator_agent_id, child_permissions).await?;

        // 3. Create the agent
        let agent = db::agents::create(pool, input).await?;

        // 4. Record the relationship — clean up agent on failure
        if let Err(e) = sqlx::query(
            "INSERT INTO agent_relationships (parent_agent_id, child_agent_id, relationship) VALUES (?, ?, 'created')"
        )
        .bind(creator_agent_id)
        .bind(&agent.id)
        .execute(pool)
        .await {
            db::agents::delete(pool, &agent.id).await.ok();
            return Err(e.into());
        }

        // 5. Grant permissions to the new agent — clean up on failure
        for perm in child_permissions {
            if let Err(e) = db::permissions::grant(pool, &GrantPermission {
                agent_id: agent.id.clone(),
                scope_type: "global".into(),
                scope_id: None,
                permission_type: perm.clone(),
                granted_by_type: "agent".into(),
                granted_by_id: creator_agent_id.into(),
            }).await {
                // Best-effort cleanup: delete relationship and agent
                sqlx::query("DELETE FROM agent_relationships WHERE child_agent_id = ?")
                    .bind(&agent.id)
                    .execute(pool)
                    .await
                    .ok();
                db::agents::delete(pool, &agent.id).await.ok();
                return Err(e);
            }
        }

        Ok(agent)
    }

    /// Create an agent directly by user (no permission check needed).
    pub async fn create_agent_by_user(
        pool: &DbPool,
        user_id: &str,
        input: &CreateAgent,
        permissions: &[String],
    ) -> AppResult<db::agents::Agent> {
        let agent = db::agents::create(pool, input).await?;

        for perm in permissions {
            db::permissions::grant(pool, &GrantPermission {
                agent_id: agent.id.clone(),
                scope_type: "global".into(),
                scope_id: None,
                permission_type: perm.clone(),
                granted_by_type: "user".into(),
                granted_by_id: user_id.into(),
            }).await?;
        }

        Ok(agent)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::db::permissions::GrantPermission;

    #[tokio::test]
    async fn test_create_agent_by_user() {
        let pool = db::create_test_pool().await;

        let agent = AgentLifecycle::create_agent_by_user(
            &pool,
            "user-1",
            &CreateAgent {
                name: "Manager".into(),
                runtime_type: "claude_cli".into(),
                provider: "anthropic".into(),
                model_name: None, persona: None, config: None,
                created_by_type: "user".into(),
                created_by_id: "user-1".into(),
            },
            &["create_agent".into(), "execute_cli".into(), "create_session".into()],
        ).await.unwrap();

        let perms = db::permissions::list_for_agent(&pool, &agent.id).await.unwrap();
        assert_eq!(perms.len(), 3);
    }

    #[tokio::test]
    async fn test_create_agent_by_agent_with_permission() {
        let pool = db::create_test_pool().await;

        // Create parent agent with permissions
        let parent = AgentLifecycle::create_agent_by_user(
            &pool, "user-1",
            &CreateAgent {
                name: "Parent".into(),
                runtime_type: "claude_cli".into(),
                provider: "anthropic".into(),
                model_name: None, persona: None, config: None,
                created_by_type: "user".into(),
                created_by_id: "user-1".into(),
            },
            &["create_agent".into(), "execute_cli".into()],
        ).await.unwrap();

        // Parent creates child with subset of permissions
        let child = AgentLifecycle::create_agent_by_agent(
            &pool,
            &parent.id,
            &CreateAgent {
                name: "Child".into(),
                runtime_type: "codex_cli".into(),
                provider: "openai".into(),
                model_name: None, persona: None, config: None,
                created_by_type: "agent".into(),
                created_by_id: parent.id.clone(),
            },
            &["execute_cli".into()],
        ).await.unwrap();

        assert_eq!(child.name, "Child");
        let perms = db::permissions::list_for_agent(&pool, &child.id).await.unwrap();
        assert_eq!(perms.len(), 1);
    }

    #[tokio::test]
    async fn test_create_agent_by_agent_without_permission() {
        let pool = db::create_test_pool().await;

        // Create agent WITHOUT create_agent permission
        let agent = db::agents::create(&pool, &CreateAgent {
            name: "NoPerms".into(),
            runtime_type: "claude_cli".into(),
            provider: "anthropic".into(),
            model_name: None, persona: None, config: None,
            created_by_type: "user".into(),
            created_by_id: "user-1".into(),
        }).await.unwrap();

        let result = AgentLifecycle::create_agent_by_agent(
            &pool,
            &agent.id,
            &CreateAgent {
                name: "Child".into(),
                runtime_type: "codex_cli".into(),
                provider: "openai".into(),
                model_name: None, persona: None, config: None,
                created_by_type: "agent".into(),
                created_by_id: agent.id.clone(),
            },
            &["execute_cli".into()],
        ).await;

        assert!(result.is_err());
    }
}
