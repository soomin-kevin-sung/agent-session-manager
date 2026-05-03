use super::DbPool;
use crate::AppResult;

pub async fn run_migrations(pool: &DbPool) -> AppResult<()> {
    let sql = include_str!("../../migrations/001_init.sql");
    for statement in sql.split(';') {
        let trimmed = statement.trim();
        if !trimmed.is_empty() {
            sqlx::query(trimmed).execute(pool).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn test_migration_runs_successfully() {
        let pool = db::create_test_pool().await;
        let tables: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        let table_names: Vec<&str> = tables.iter().map(|t| t.0.as_str()).collect();
        assert!(table_names.contains(&"users"));
        assert!(table_names.contains(&"agents"));
        assert!(table_names.contains(&"agent_runs"));
        assert!(table_names.contains(&"workspaces"));
        assert!(table_names.contains(&"channels"));
        assert!(table_names.contains(&"sessions"));
        assert!(table_names.contains(&"messages"));
        assert!(table_names.contains(&"cli_logs"));
        assert!(table_names.contains(&"agent_permissions"));
        assert!(table_names.contains(&"tasks"));
        assert!(table_names.contains(&"reviews"));
    }

    #[tokio::test]
    async fn test_migration_is_idempotent() {
        let pool = db::create_pool("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        run_migrations(&pool).await.unwrap();
    }
}
