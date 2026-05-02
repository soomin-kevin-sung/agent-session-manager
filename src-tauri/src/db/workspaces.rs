use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspace {
    pub name: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
}

pub async fn create(pool: &DbPool, input: &CreateWorkspace) -> AppResult<Workspace> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Workspace>(
        "INSERT INTO workspaces (id, name, description, created_by_type, created_by_id) VALUES (?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Workspace> {
    sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "workspace".into(),
            id: id.into(),
        })
}

pub async fn list(pool: &DbPool) -> AppResult<Vec<Workspace>> {
    sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM workspaces WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(crate::AppError::NotFound {
            entity: "workspace".into(),
            id: id.into(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn test_workspace_crud() {
        let pool = db::create_test_pool().await;

        let ws = create(&pool, &CreateWorkspace {
            name: "Project Alpha".into(),
            description: Some("Main project".into()),
            created_by_type: "user".into(),
            created_by_id: "user-1".into(),
        }).await.unwrap();

        assert_eq!(ws.name, "Project Alpha");

        let fetched = get_by_id(&pool, &ws.id).await.unwrap();
        assert_eq!(fetched.description, Some("Main project".into()));

        let all = list(&pool).await.unwrap();
        assert_eq!(all.len(), 1);

        delete(&pool, &ws.id).await.unwrap();
        assert!(get_by_id(&pool, &ws.id).await.is_err());
    }
}
