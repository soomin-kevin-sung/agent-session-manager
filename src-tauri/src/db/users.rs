use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::DbPool;
use crate::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub display_name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub display_name: String,
}

pub async fn create(pool: &DbPool, input: &CreateUser) -> AppResult<User> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, User>("INSERT INTO users (id, display_name) VALUES (?, ?) RETURNING *")
        .bind(&id)
        .bind(&input.display_name)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<User> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "user".into(),
            id: id.into(),
        })
}

pub async fn list(pool: &DbPool) -> AppResult<Vec<User>> {
    sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(crate::AppError::NotFound {
            entity: "user".into(),
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
    async fn test_create_and_get_user() {
        let pool = db::create_test_pool().await;

        let user = create(
            &pool,
            &CreateUser {
                display_name: "Test User".into(),
            },
        )
        .await
        .unwrap();

        assert_eq!(user.display_name, "Test User");
        assert!(!user.id.is_empty());

        let fetched = get_by_id(&pool, &user.id).await.unwrap();
        assert_eq!(fetched.id, user.id);
        assert_eq!(fetched.display_name, "Test User");
    }

    #[tokio::test]
    async fn test_list_users() {
        let pool = db::create_test_pool().await;

        create(
            &pool,
            &CreateUser {
                display_name: "Alice".into(),
            },
        )
        .await
        .unwrap();
        create(
            &pool,
            &CreateUser {
                display_name: "Bob".into(),
            },
        )
        .await
        .unwrap();

        let users = list(&pool).await.unwrap();
        assert_eq!(users.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_user() {
        let pool = db::create_test_pool().await;

        let user = create(
            &pool,
            &CreateUser {
                display_name: "ToDelete".into(),
            },
        )
        .await
        .unwrap();
        delete(&pool, &user.id).await.unwrap();

        let result = get_by_id(&pool, &user.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_nonexistent_user() {
        let pool = db::create_test_pool().await;

        let result = get_by_id(&pool, "nonexistent").await;
        assert!(result.is_err());
    }
}
