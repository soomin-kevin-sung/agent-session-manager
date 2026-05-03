use crate::db::{permissions, DbPool};
use crate::AppError;
use crate::AppResult;

pub struct PermissionValidator;

impl PermissionValidator {
    /// Verify an agent can create another agent (has create_agent permission).
    pub async fn can_create_agent(pool: &DbPool, creator_id: &str) -> AppResult<()> {
        let allowed = permissions::check(pool, creator_id, "create_agent", "global", None).await?;
        if !allowed {
            return Err(AppError::Permission {
                message: format!("Agent {} does not have create_agent permission", creator_id),
            });
        }
        Ok(())
    }

    /// When an agent creates a child agent, the child's permissions
    /// must be a subset of the parent's permissions.
    pub async fn validate_permission_inheritance(
        pool: &DbPool,
        parent_id: &str,
        child_permissions: &[String],
    ) -> AppResult<()> {
        let parent_perms = permissions::list_for_agent(pool, parent_id).await?;
        let parent_perm_types: Vec<&str> = parent_perms
            .iter()
            .map(|p| p.permission_type.as_str())
            .collect();

        for perm in child_permissions {
            if !parent_perm_types.contains(&perm.as_str()) {
                return Err(AppError::Permission {
                    message: format!(
                        "Cannot grant '{}' to child agent — parent does not have this permission",
                        perm
                    ),
                });
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::db::permissions::GrantPermission;

    async fn setup(pool: &DbPool) -> String {
        let agent = db::agents::create(
            pool,
            &db::agents::CreateAgent {
                name: "TestAgent".into(),
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
        agent.id
    }

    #[tokio::test]
    async fn test_can_create_agent_with_permission() {
        let pool = db::create_test_pool().await;
        let agent_id = setup(&pool).await;

        // Without permission — should fail
        let result = PermissionValidator::can_create_agent(&pool, &agent_id).await;
        assert!(result.is_err());

        // Grant permission
        permissions::grant(
            &pool,
            &GrantPermission {
                agent_id: agent_id.clone(),
                scope_type: "global".into(),
                scope_id: None,
                permission_type: "create_agent".into(),
                granted_by_type: "user".into(),
                granted_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        // With permission — should succeed
        let result = PermissionValidator::can_create_agent(&pool, &agent_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_permission_inheritance_validation() {
        let pool = db::create_test_pool().await;
        let parent_id = setup(&pool).await;

        // Grant parent some permissions
        permissions::grant(
            &pool,
            &GrantPermission {
                agent_id: parent_id.clone(),
                scope_type: "global".into(),
                scope_id: None,
                permission_type: "create_agent".into(),
                granted_by_type: "user".into(),
                granted_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        permissions::grant(
            &pool,
            &GrantPermission {
                agent_id: parent_id.clone(),
                scope_type: "global".into(),
                scope_id: None,
                permission_type: "execute_cli".into(),
                granted_by_type: "user".into(),
                granted_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        // Valid subset — should pass
        let result = PermissionValidator::validate_permission_inheritance(
            &pool,
            &parent_id,
            &["create_agent".into(), "execute_cli".into()],
        )
        .await;
        assert!(result.is_ok());

        // Invalid — child wants permission parent doesn't have
        let result = PermissionValidator::validate_permission_inheritance(
            &pool,
            &parent_id,
            &["create_agent".into(), "review".into()],
        )
        .await;
        assert!(result.is_err());
    }
}
