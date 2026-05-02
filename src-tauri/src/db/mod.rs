pub mod schema;
pub mod users;
pub mod agents;
pub mod workspaces;
pub mod channels;
pub mod sessions;
pub mod messages;
pub mod permissions;
pub mod tasks;

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use crate::AppResult;

pub type DbPool = SqlitePool;

pub async fn create_pool(database_url: &str) -> AppResult<DbPool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
    sqlx::query("PRAGMA foreign_keys=ON;").execute(&pool).await?;

    Ok(pool)
}

#[cfg(test)]
pub async fn create_test_pool() -> DbPool {
    let pool = create_pool("sqlite::memory:").await.unwrap();
    schema::run_migrations(&pool).await.unwrap();
    pool
}
