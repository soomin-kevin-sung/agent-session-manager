use crate::db::{self, sessions::CreateSession, DbPool};
use crate::AppResult;

pub struct SessionLifecycle;

impl SessionLifecycle {
    /// Create a work session with a linked channel.
    pub async fn create_work_session(
        pool: &DbPool,
        workspace_id: &str,
        name: &str,
        work_directory: &str,
        created_by_type: &str,
        created_by_id: &str,
        initial_agent_ids: &[String],
    ) -> AppResult<db::sessions::Session> {
        // 1. Create a channel for this session
        let channel = db::channels::create(
            pool,
            &db::channels::CreateChannel {
                workspace_id: workspace_id.into(),
                name: format!("# {}", name),
                channel_type: "group".into(),
            },
        )
        .await?;

        // 2. Create the session linked to the channel
        let session = db::sessions::create(
            pool,
            &CreateSession {
                workspace_id: workspace_id.into(),
                channel_id: channel.id.clone(),
                name: name.into(),
                work_directory: work_directory.into(),
                git_branch: None,
                created_by_type: created_by_type.into(),
                created_by_id: created_by_id.into(),
            },
        )
        .await?;

        // 3. Add initial agents as members
        for agent_id in initial_agent_ids {
            db::sessions::add_member(pool, &session.id, agent_id, "worker").await?;
            db::channels::add_member(pool, &channel.id, agent_id).await?;
        }

        Ok(session)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn test_create_work_session() {
        let pool = db::create_test_pool().await;

        // Setup workspace + agent
        let ws = db::workspaces::create(
            &pool,
            &db::workspaces::CreateWorkspace {
                name: "WS".into(),
                description: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        let agent = db::agents::create(
            &pool,
            &db::agents::CreateAgent {
                name: "Dev".into(),
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

        let session = SessionLifecycle::create_work_session(
            &pool,
            &ws.id,
            "Frontend Dev",
            "/tmp/project",
            "user",
            "u1",
            &[agent.id.clone()],
        )
        .await
        .unwrap();

        assert_eq!(session.name, "Frontend Dev");
        assert_eq!(session.status, "planned");

        // Verify channel was created and agent is a member
        let members = db::sessions::list_members(&pool, &session.id)
            .await
            .unwrap();
        assert_eq!(members.len(), 1);

        let ch_members = db::channels::list_members(&pool, &session.channel_id)
            .await
            .unwrap();
        assert_eq!(ch_members.len(), 1);
    }
}
