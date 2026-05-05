use serde::Deserialize;

use crate::db;
use crate::{AppError, AppState};
use tauri::State;

#[derive(Debug, Deserialize)]
struct ProposalTask {
    title: String,
    description: String,
    agent_preset: String,
    acceptance_criteria: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct PlanProposal {
    tasks: Vec<ProposalTask>,
}

fn parse_proposal_tasks(tasks_json: &str) -> Result<Vec<ProposalTask>, AppError> {
    serde_json::from_str::<Vec<ProposalTask>>(tasks_json)
        .or_else(|_| {
            serde_json::from_str::<PlanProposal>(tasks_json).map(|proposal| proposal.tasks)
        })
        .map_err(AppError::from)
}

fn format_task_description(task: &ProposalTask) -> String {
    let mut parts = vec![
        task.description.clone(),
        format!("Agent preset: {}", task.agent_preset),
    ];

    if let Some(criteria) = &task.acceptance_criteria {
        if !criteria.is_empty() {
            parts.push(format!("Acceptance criteria:\n- {}", criteria.join("\n- ")));
        }
    }

    parts.join("\n\n")
}

pub async fn create_tasks_from_proposal(
    pool: &db::DbPool,
    session_id: &str,
    channel_id: &str,
    tasks_json: &str,
) -> Result<Vec<db::tasks::Task>, AppError> {
    let proposal_tasks = parse_proposal_tasks(tasks_json)?;
    let mut created_tasks = Vec::with_capacity(proposal_tasks.len());

    for proposal_task in proposal_tasks {
        if proposal_task.title.trim().is_empty() {
            return Err(AppError::Validation {
                message: "Proposal task title is required".into(),
            });
        }

        let description = format_task_description(&proposal_task);
        let task = db::tasks::create_task(
            pool,
            &db::tasks::CreateTask {
                session_id: session_id.to_string(),
                channel_id: channel_id.to_string(),
                title: proposal_task.title,
                description: Some(description),
                created_by_type: "user".into(),
                created_by_id: "proposal".into(),
                assigned_to_id: None,
                priority: Some(0),
            },
        )
        .await?;

        created_tasks.push(task);
    }

    Ok(created_tasks)
}

#[tauri::command]
pub async fn approve_proposal(
    state: State<'_, AppState>,
    session_id: String,
    channel_id: String,
    tasks_json: String,
) -> Result<Vec<db::tasks::Task>, AppError> {
    create_tasks_from_proposal(&state.db, &session_id, &channel_id, &tasks_json).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &db::DbPool) -> (String, String) {
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
                name: "session".into(),
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
                work_directory: "/tmp/project".into(),
                git_branch: None,
                created_by_type: "user".into(),
                created_by_id: "u1".into(),
            },
        )
        .await
        .unwrap();

        (session.id, ch.id)
    }

    #[tokio::test]
    async fn approve_proposal_tasks_creates_open_tasks() {
        let pool = db::create_test_pool().await;
        let (session_id, channel_id) = setup(&pool).await;
        let tasks_json = r#"[
            {
                "title": "Implement parser",
                "description": "Parse proposal JSON",
                "agent_preset": "developer",
                "acceptance_criteria": ["valid JSON returns proposal"]
            }
        ]"#;

        let tasks = create_tasks_from_proposal(&pool, &session_id, &channel_id, tasks_json)
            .await
            .unwrap();

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Implement parser");
        assert_eq!(tasks[0].status, "open");
        assert!(tasks[0]
            .description
            .as_deref()
            .unwrap()
            .contains("developer"));
        assert!(tasks[0]
            .description
            .as_deref()
            .unwrap()
            .contains("valid JSON returns proposal"));
    }
}
