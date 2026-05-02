# Plan 1: Foundation — 프로젝트 초기화 + DB 레이어

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri v2 프로젝트를 생성하고, SQLite 데이터베이스 스키마 + CRUD 레이어 + 에러 타입 + 기본 Tauri commands를 구현하여 테스트 가능한 백엔드를 만든다.

**Architecture:** Tauri v2 Rust 백엔드에서 SQLite(sqlx)를 직접 사용. DB 모듈이 CRUD를 제공하고, services 레이어가 비즈니스 로직을 담당하며, commands가 Tauri IPC 진입점 역할을 한다. 프론트엔드는 이 단계에서 최소한의 React 셸만 구성한다.

**Tech Stack:** Tauri v2, Rust, sqlx (SQLite), React + TypeScript, Vite, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-02-agent-session-manager-design.md`

---

## File Structure

```
agent-session-manager/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── errors.rs
│   │   ├── app_state.rs
│   │   ├── config/
│   │   │   ├── mod.rs
│   │   │   └── settings.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs
│   │   │   ├── users.rs
│   │   │   ├── agents.rs
│   │   │   ├── workspaces.rs
│   │   │   ├── channels.rs
│   │   │   ├── sessions.rs
│   │   │   ├── messages.rs
│   │   │   ├── permissions.rs
│   │   │   └── tasks.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── agent_service.rs
│   │   │   ├── workspace_service.rs
│   │   │   └── message_service.rs
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── agent_commands.rs
│   │       ├── workspace_commands.rs
│   │       └── message_commands.rs
│   └── migrations/
│       └── 001_init.sql
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   └── lib/
│       └── tauri.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── components.json
└── .gitignore
```

---

### Task 1: Tauri v2 프로젝트 초기화

**Files:**
- Create: 전체 프로젝트 디렉토리 (Tauri CLI가 생성)
- Modify: `package.json`, `Cargo.toml`, `vite.config.ts`, `tsconfig.json`

- [ ] **Step 1: Tauri 프로젝트 생성**

```bash
cd "D:/0. workspace/0. Github/0.soomin-kevin-sung"
npm create tauri-app@latest agent-session-manager -- --template react-ts
cd agent-session-manager
```

Expected: `agent-session-manager/` 디렉토리에 Tauri v2 + React + TypeScript 프로젝트 생성

- [ ] **Step 2: 의존성 설치 및 빌드 확인**

```bash
npm install
npm run tauri dev
```

Expected: Tauri 윈도우가 열리고 기본 React 앱이 표시됨. 확인 후 종료.

- [ ] **Step 3: Rust 의존성 추가**

`src-tauri/Cargo.toml`의 `[dependencies]` 섹션에 추가:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = "0.3"
tauri-plugin-log = "2"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 4: 프론트엔드 의존성 추가**

```bash
npm install zustand react-i18next i18next
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 5: Tailwind 설정**

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

`src/main.css` (기존 내용 교체):

```css
@import "tailwindcss";
```

`tsconfig.json`에 path alias 추가:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: shadcn/ui 초기화**

```bash
npx shadcn@latest init
```

프롬프트 응답: style=default, base-color=neutral, css-variables=yes

- [ ] **Step 7: 빌드 확인**

```bash
npm run tauri dev
```

Expected: Tailwind CSS가 적용된 기본 앱이 표시됨. 확인 후 종료.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "chore: initialize Tauri v2 project with React, TypeScript, Tailwind, shadcn/ui"
```

---

### Task 2: 에러 타입 정의

**Files:**
- Create: `src-tauri/src/errors.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: AppError 타입 작성**

`src-tauri/src/errors.rs`:

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },

    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Permission denied: {message}")]
    Permission { message: String },

    #[error("Config error: {message}")]
    Config { message: String },

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Internal error: {message}")]
    Internal { message: String },
}

#[derive(Serialize, Debug, Clone)]
pub struct IpcError {
    pub code: String,
    pub message_key: String,
    pub fallback_message: String,
    pub details: Option<serde_json::Value>,
    pub recoverable: bool,
}

impl From<AppError> for IpcError {
    fn from(err: AppError) -> Self {
        match &err {
            AppError::Database(_) => IpcError {
                code: "DATABASE_ERROR".into(),
                message_key: "errors.database.general".into(),
                fallback_message: err.to_string(),
                details: None,
                recoverable: true,
            },
            AppError::NotFound { entity, id } => IpcError {
                code: "NOT_FOUND".into(),
                message_key: format!("errors.notFound.{}", entity),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "entity": entity, "id": id })),
                recoverable: false,
            },
            AppError::Validation { message } => IpcError {
                code: "VALIDATION_ERROR".into(),
                message_key: "errors.validation".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Permission { message } => IpcError {
                code: "PERMISSION_DENIED".into(),
                message_key: "errors.permission.denied".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Config { message } => IpcError {
                code: "CONFIG_ERROR".into(),
                message_key: "errors.config".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Serialization(_) => IpcError {
                code: "SERIALIZATION_ERROR".into(),
                message_key: "errors.serialization".into(),
                fallback_message: err.to_string(),
                details: None,
                recoverable: false,
            },
            AppError::Internal { .. } => IpcError {
                code: "INTERNAL_ERROR".into(),
                message_key: "errors.internal".into(),
                fallback_message: "An internal error occurred".into(),
                details: None,
                recoverable: false,
            },
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let ipc_error: IpcError = self.clone_to_ipc();
        ipc_error.serialize(serializer)
    }
}

impl AppError {
    fn clone_to_ipc(&self) -> IpcError {
        // Re-create error info without consuming self
        match self {
            AppError::Database(e) => IpcError {
                code: "DATABASE_ERROR".into(),
                message_key: "errors.database.general".into(),
                fallback_message: e.to_string(),
                details: None,
                recoverable: true,
            },
            _ => IpcError::from(AppError::Internal {
                message: self.to_string(),
            }),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **Step 2: lib.rs에 모듈 등록**

`src-tauri/src/lib.rs`:

```rust
mod errors;

pub use errors::{AppError, AppResult, IpcError};
```

- [ ] **Step 3: 빌드 확인**

```bash
cd src-tauri && cargo check
```

Expected: 컴파일 성공

- [ ] **Step 4: 커밋**

```bash
git add src-tauri/src/errors.rs src-tauri/src/lib.rs
git commit -m "feat: add AppError and IpcError types with thiserror + serde"
```

---

### Task 3: SQLite 스키마 및 DB 연결

**Files:**
- Create: `src-tauri/migrations/001_init.sql`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/schema.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`src-tauri/migrations/001_init.sql`:

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY NOT NULL,
    display_name    TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY NOT NULL,
    name            TEXT NOT NULL,
    runtime_type    TEXT NOT NULL CHECK (runtime_type IN ('claude_cli', 'codex_cli')),
    provider        TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
    model_name      TEXT,
    persona         TEXT,
    config          TEXT,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent Runs
CREATE TABLE IF NOT EXISTS agent_runs (
    id              TEXT PRIMARY KEY NOT NULL,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    session_id      TEXT REFERENCES sessions(id),
    pid             INTEGER,
    cli_command     TEXT NOT NULL,
    cli_args        TEXT,
    process_status  TEXT NOT NULL DEFAULT 'queued'
                    CHECK (process_status IN (
                        'queued', 'starting', 'running', 'waiting_for_permission',
                        'cancelling', 'cancelled', 'completed', 'failed', 'timed_out'
                    )),
    exit_code       INTEGER,
    failure_code    TEXT,
    stderr_tail     TEXT,
    attempt_no      INTEGER NOT NULL DEFAULT 1,
    parent_run_id   TEXT REFERENCES agent_runs(id),
    started_at      TEXT,
    ended_at        TEXT,
    last_heartbeat  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent Relationships
CREATE TABLE IF NOT EXISTS agent_relationships (
    parent_agent_id TEXT NOT NULL REFERENCES agents(id),
    child_agent_id  TEXT NOT NULL REFERENCES agents(id),
    relationship    TEXT NOT NULL CHECK (relationship IN ('created', 'supervises', 'delegates', 'reviews')),
    session_id      TEXT REFERENCES sessions(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (parent_agent_id, child_agent_id, relationship)
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id              TEXT PRIMARY KEY NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id              TEXT PRIMARY KEY NOT NULL,
    workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
    name            TEXT NOT NULL,
    channel_type    TEXT NOT NULL CHECK (channel_type IN ('dm', 'group')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Channel Members
CREATE TABLE IF NOT EXISTS channel_members (
    channel_id      TEXT NOT NULL REFERENCES channels(id),
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (channel_id, agent_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT PRIMARY KEY NOT NULL,
    workspace_id     TEXT NOT NULL REFERENCES workspaces(id),
    channel_id       TEXT NOT NULL REFERENCES channels(id),
    name             TEXT NOT NULL,
    work_directory   TEXT NOT NULL,
    git_branch       TEXT,
    status           TEXT NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    created_by_type  TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id    TEXT NOT NULL,
    started_at       TEXT,
    ended_at         TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session Members
CREATE TABLE IF NOT EXISTS session_members (
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    role            TEXT NOT NULL CHECK (role IN ('owner', 'worker', 'reviewer', 'observer')),
    joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
    left_at         TEXT,
    PRIMARY KEY (session_id, agent_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY NOT NULL,
    channel_id      TEXT NOT NULL REFERENCES channels(id),
    sender_type     TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
    sender_user_id  TEXT REFERENCES users(id),
    sender_agent_id TEXT REFERENCES agents(id),
    content         TEXT NOT NULL,
    message_type    TEXT NOT NULL CHECK (message_type IN (
                        'chat', 'command', 'command_result', 'report', 'review', 'system'
                    )),
    status          TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'dispatching', 'delivered', 'delivery_failed')),
    metadata        TEXT,
    parent_id       TEXT REFERENCES messages(id),
    thread_root_id  TEXT REFERENCES messages(id),
    edited_at       TEXT,
    deleted_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CLI Logs
CREATE TABLE IF NOT EXISTS cli_logs (
    id              TEXT PRIMARY KEY NOT NULL,
    agent_run_id    TEXT NOT NULL REFERENCES agent_runs(id),
    message_id      TEXT REFERENCES messages(id),
    stream          TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
    content         TEXT NOT NULL,
    sequence        INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent Permissions
CREATE TABLE IF NOT EXISTS agent_permissions (
    id              TEXT PRIMARY KEY NOT NULL,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    scope_type      TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'channel', 'session')),
    scope_id        TEXT,
    permission_type TEXT NOT NULL CHECK (permission_type IN (
                        'create_agent', 'create_session', 'assign_task', 'review', 'execute_cli'
                    )),
    granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('user', 'agent')),
    granted_by_id   TEXT NOT NULL,
    expires_at      TEXT,
    revoked_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id                 TEXT PRIMARY KEY NOT NULL,
    session_id         TEXT NOT NULL REFERENCES sessions(id),
    channel_id         TEXT NOT NULL REFERENCES channels(id),
    title              TEXT NOT NULL,
    description        TEXT,
    created_by_type    TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id      TEXT NOT NULL,
    assigned_to_id     TEXT REFERENCES agents(id),
    status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'blocked', 'review', 'done', 'cancelled')),
    priority           INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id                 TEXT PRIMARY KEY NOT NULL,
    task_id            TEXT NOT NULL REFERENCES tasks(id),
    reviewer_agent_id  TEXT NOT NULL REFERENCES agents(id),
    target_agent_id    TEXT NOT NULL REFERENCES agents(id),
    status             TEXT NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'commented', 'approved', 'changes_requested')),
    summary            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_created_by ON agents(created_by_type, created_by_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace_type ON channels(workspace_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_channel_members_agent ON channel_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_agent ON messages(sender_agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(channel_id, status);
CREATE INDEX IF NOT EXISTS idx_permissions_agent_type ON agent_permissions(agent_id, permission_type);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_status ON sessions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_status ON agent_runs(agent_id, process_status);
CREATE INDEX IF NOT EXISTS idx_cli_logs_run_sequence ON cli_logs(agent_run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_tasks_session_status ON tasks(session_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assigned_to_id, status);
```

- [ ] **Step 2: DB 연결 모듈 작성**

`src-tauri/src/db/mod.rs`:

```rust
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

    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    Ok(pool)
}

/// Create an in-memory pool for testing.
#[cfg(test)]
pub async fn create_test_pool() -> DbPool {
    let pool = create_pool("sqlite::memory:").await.unwrap();
    schema::run_migrations(&pool).await.unwrap();
    pool
}
```

`src-tauri/src/db/schema.rs`:

```rust
use crate::AppResult;
use super::DbPool;

pub async fn run_migrations(pool: &DbPool) -> AppResult<()> {
    let sql = include_str!("../../migrations/001_init.sql");

    // Split on semicolons and execute each statement
    for statement in sql.split(';') {
        let trimmed = statement.trim();
        if !trimmed.is_empty() {
            sqlx::query(trimmed).execute(pool).await?;
        }
    }

    Ok(())
}
```

- [ ] **Step 3: lib.rs 업데이트**

`src-tauri/src/lib.rs`:

```rust
mod errors;
mod db;

pub use errors::{AppError, AppResult, IpcError};
pub use db::DbPool;
```

- [ ] **Step 4: 스키마 마이그레이션 테스트**

`src-tauri/src/db/schema.rs` 하단에 추가:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn test_migration_runs_successfully() {
        let pool = db::create_test_pool().await;

        // Verify tables exist by querying sqlite_master
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
        // Running again should not fail
        run_migrations(&pool).await.unwrap();
    }
}
```

- [ ] **Step 5: 테스트 실행**

```bash
cd src-tauri && cargo test db::schema
```

Expected: 2 tests passed

- [ ] **Step 6: 커밋**

```bash
git add src-tauri/migrations/ src-tauri/src/db/ src-tauri/src/lib.rs
git commit -m "feat: add SQLite schema migration with all 13 tables and indexes"
```

---

### Task 4: Users CRUD

**Files:**
- Create: `src-tauri/src/db/users.rs`

- [ ] **Step 1: 테스트 먼저 작성**

`src-tauri/src/db/users.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

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
    sqlx::query_as::<_, User>(
        "INSERT INTO users (id, display_name) VALUES (?, ?) RETURNING *"
    )
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

        let user = create(&pool, &CreateUser {
            display_name: "Test User".into(),
        }).await.unwrap();

        assert_eq!(user.display_name, "Test User");
        assert!(!user.id.is_empty());

        let fetched = get_by_id(&pool, &user.id).await.unwrap();
        assert_eq!(fetched.id, user.id);
        assert_eq!(fetched.display_name, "Test User");
    }

    #[tokio::test]
    async fn test_list_users() {
        let pool = db::create_test_pool().await;

        create(&pool, &CreateUser { display_name: "Alice".into() }).await.unwrap();
        create(&pool, &CreateUser { display_name: "Bob".into() }).await.unwrap();

        let users = list(&pool).await.unwrap();
        assert_eq!(users.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_user() {
        let pool = db::create_test_pool().await;

        let user = create(&pool, &CreateUser { display_name: "ToDelete".into() }).await.unwrap();
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
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test db::users
```

Expected: 4 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/db/users.rs
git commit -m "feat: add users CRUD with tests"
```

---

### Task 5: Agents CRUD

**Files:**
- Create: `src-tauri/src/db/agents.rs`

- [ ] **Step 1: 에이전트 모델 및 CRUD 작성 (테스트 포함)**

`src-tauri/src/db/agents.rs`:

```rust
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
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test db::agents
```

Expected: 5 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/db/agents.rs
git commit -m "feat: add agents CRUD with tests"
```

---

### Task 6: Workspaces + Channels CRUD

**Files:**
- Create: `src-tauri/src/db/workspaces.rs`
- Create: `src-tauri/src/db/channels.rs`

- [ ] **Step 1: Workspaces CRUD 작성**

`src-tauri/src/db/workspaces.rs`:

```rust
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
```

- [ ] **Step 2: Channels CRUD 작성**

`src-tauri/src/db/channels.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Channel {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub channel_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChannelMember {
    pub channel_id: String,
    pub agent_id: String,
    pub joined_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateChannel {
    pub workspace_id: String,
    pub name: String,
    pub channel_type: String,  // "dm" | "group"
}

pub async fn create(pool: &DbPool, input: &CreateChannel) -> AppResult<Channel> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (id, workspace_id, name, channel_type) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.workspace_id)
    .bind(&input.name)
    .bind(&input.channel_type)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Channel> {
    sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "channel".into(),
            id: id.into(),
        })
}

pub async fn list_by_workspace(pool: &DbPool, workspace_id: &str) -> AppResult<Vec<Channel>> {
    sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE workspace_id = ? ORDER BY created_at"
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn add_member(pool: &DbPool, channel_id: &str, agent_id: &str) -> AppResult<()> {
    sqlx::query("INSERT OR IGNORE INTO channel_members (channel_id, agent_id) VALUES (?, ?)")
        .bind(channel_id)
        .bind(agent_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn remove_member(pool: &DbPool, channel_id: &str, agent_id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = ? AND agent_id = ?")
        .bind(channel_id)
        .bind(agent_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_members(pool: &DbPool, channel_id: &str) -> AppResult<Vec<ChannelMember>> {
    sqlx::query_as::<_, ChannelMember>(
        "SELECT * FROM channel_members WHERE channel_id = ?"
    )
    .bind(channel_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    let result = sqlx::query("DELETE FROM channels WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(crate::AppError::NotFound {
            entity: "channel".into(),
            id: id.into(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup_workspace(pool: &DbPool) -> String {
        let ws = db::workspaces::create(pool, &db::workspaces::CreateWorkspace {
            name: "Test WS".into(),
            description: None,
            created_by_type: "user".into(),
            created_by_id: "user-1".into(),
        }).await.unwrap();
        ws.id
    }

    async fn setup_agent(pool: &DbPool) -> String {
        let agent = db::agents::create(pool, &db::agents::CreateAgent {
            name: "Agent".into(),
            runtime_type: "claude_cli".into(),
            provider: "anthropic".into(),
            model_name: None,
            persona: None,
            config: None,
            created_by_type: "user".into(),
            created_by_id: "user-1".into(),
        }).await.unwrap();
        agent.id
    }

    #[tokio::test]
    async fn test_channel_crud() {
        let pool = db::create_test_pool().await;
        let ws_id = setup_workspace(&pool).await;

        let ch = create(&pool, &CreateChannel {
            workspace_id: ws_id.clone(),
            name: "general".into(),
            channel_type: "group".into(),
        }).await.unwrap();

        assert_eq!(ch.name, "general");
        assert_eq!(ch.channel_type, "group");

        let channels = list_by_workspace(&pool, &ws_id).await.unwrap();
        assert_eq!(channels.len(), 1);

        delete(&pool, &ch.id).await.unwrap();
        assert!(get_by_id(&pool, &ch.id).await.is_err());
    }

    #[tokio::test]
    async fn test_channel_members() {
        let pool = db::create_test_pool().await;
        let ws_id = setup_workspace(&pool).await;
        let agent_id = setup_agent(&pool).await;

        let ch = create(&pool, &CreateChannel {
            workspace_id: ws_id,
            name: "dm".into(),
            channel_type: "dm".into(),
        }).await.unwrap();

        add_member(&pool, &ch.id, &agent_id).await.unwrap();
        let members = list_members(&pool, &ch.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].agent_id, agent_id);

        remove_member(&pool, &ch.id, &agent_id).await.unwrap();
        let members = list_members(&pool, &ch.id).await.unwrap();
        assert_eq!(members.len(), 0);
    }
}
```

- [ ] **Step 3: 테스트 실행**

```bash
cd src-tauri && cargo test db::workspaces && cargo test db::channels
```

Expected: 3 tests passed (1 workspace + 2 channels)

- [ ] **Step 4: 커밋**

```bash
git add src-tauri/src/db/workspaces.rs src-tauri/src/db/channels.rs
git commit -m "feat: add workspaces and channels CRUD with tests"
```

---

### Task 7: Messages CRUD

**Files:**
- Create: `src-tauri/src/db/messages.rs`

- [ ] **Step 1: Messages 모듈 작성**

`src-tauri/src/db/messages.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub sender_type: String,
    pub sender_user_id: Option<String>,
    pub sender_agent_id: Option<String>,
    pub content: String,
    pub message_type: String,
    pub status: String,
    pub metadata: Option<String>,
    pub parent_id: Option<String>,
    pub thread_root_id: Option<String>,
    pub edited_at: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessage {
    pub channel_id: String,
    pub sender_type: String,
    pub sender_user_id: Option<String>,
    pub sender_agent_id: Option<String>,
    pub content: String,
    pub message_type: String,
    pub metadata: Option<String>,
    pub parent_id: Option<String>,
    pub thread_root_id: Option<String>,
}

pub async fn create(pool: &DbPool, input: &CreateMessage) -> AppResult<Message> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Message>(
        "INSERT INTO messages (id, channel_id, sender_type, sender_user_id, sender_agent_id, content, message_type, metadata, parent_id, thread_root_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.channel_id)
    .bind(&input.sender_type)
    .bind(&input.sender_user_id)
    .bind(&input.sender_agent_id)
    .bind(&input.content)
    .bind(&input.message_type)
    .bind(&input.metadata)
    .bind(&input.parent_id)
    .bind(&input.thread_root_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Message> {
    sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "message".into(),
            id: id.into(),
        })
}

pub async fn list_by_channel(pool: &DbPool, channel_id: &str, limit: i64, before: Option<&str>) -> AppResult<Vec<Message>> {
    if let Some(before_time) = before {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = ? AND deleted_at IS NULL AND created_at < ?
             ORDER BY created_at DESC LIMIT ?"
        )
        .bind(channel_id)
        .bind(before_time)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE channel_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT ?"
        )
        .bind(channel_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
    }
}

pub async fn update_status(pool: &DbPool, id: &str, status: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn soft_delete(pool: &DbPool, id: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET deleted_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &DbPool) -> (String, String) {
        let ws = db::workspaces::create(pool, &db::workspaces::CreateWorkspace {
            name: "WS".into(),
            description: None,
            created_by_type: "user".into(),
            created_by_id: "u1".into(),
        }).await.unwrap();

        let ch = db::channels::create(pool, &db::channels::CreateChannel {
            workspace_id: ws.id,
            name: "general".into(),
            channel_type: "group".into(),
        }).await.unwrap();

        let user = db::users::create(pool, &db::users::CreateUser {
            display_name: "User".into(),
        }).await.unwrap();

        (ch.id, user.id)
    }

    #[tokio::test]
    async fn test_create_and_list_messages() {
        let pool = db::create_test_pool().await;
        let (ch_id, user_id) = setup(&pool).await;

        let msg = create(&pool, &CreateMessage {
            channel_id: ch_id.clone(),
            sender_type: "user".into(),
            sender_user_id: Some(user_id.clone()),
            sender_agent_id: None,
            content: "Hello".into(),
            message_type: "chat".into(),
            metadata: None,
            parent_id: None,
            thread_root_id: None,
        }).await.unwrap();

        assert_eq!(msg.content, "Hello");
        assert_eq!(msg.status, "created");

        let msgs = list_by_channel(&pool, &ch_id, 50, None).await.unwrap();
        assert_eq!(msgs.len(), 1);
    }

    #[tokio::test]
    async fn test_message_status_and_soft_delete() {
        let pool = db::create_test_pool().await;
        let (ch_id, user_id) = setup(&pool).await;

        let msg = create(&pool, &CreateMessage {
            channel_id: ch_id,
            sender_type: "user".into(),
            sender_user_id: Some(user_id),
            sender_agent_id: None,
            content: "Test".into(),
            message_type: "chat".into(),
            metadata: None,
            parent_id: None,
            thread_root_id: None,
        }).await.unwrap();

        update_status(&pool, &msg.id, "delivered").await.unwrap();
        let fetched = get_by_id(&pool, &msg.id).await.unwrap();
        assert_eq!(fetched.status, "delivered");

        soft_delete(&pool, &msg.id).await.unwrap();
        assert!(get_by_id(&pool, &msg.id).await.is_err());
    }
}
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test db::messages
```

Expected: 2 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/db/messages.rs
git commit -m "feat: add messages CRUD with pagination, status update, soft delete"
```

---

### Task 8: Sessions, Permissions, Tasks CRUD (stub)

**Files:**
- Create: `src-tauri/src/db/sessions.rs`
- Create: `src-tauri/src/db/permissions.rs`
- Create: `src-tauri/src/db/tasks.rs`

- [ ] **Step 1: Sessions CRUD**

`src-tauri/src/db/sessions.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub channel_id: String,
    pub name: String,
    pub work_directory: String,
    pub git_branch: Option<String>,
    pub status: String,
    pub created_by_type: String,
    pub created_by_id: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SessionMember {
    pub session_id: String,
    pub agent_id: String,
    pub role: String,
    pub joined_at: String,
    pub left_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSession {
    pub workspace_id: String,
    pub channel_id: String,
    pub name: String,
    pub work_directory: String,
    pub git_branch: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
}

pub async fn create(pool: &DbPool, input: &CreateSession) -> AppResult<Session> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Session>(
        "INSERT INTO sessions (id, workspace_id, channel_id, name, work_directory, git_branch, created_by_type, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.workspace_id)
    .bind(&input.channel_id)
    .bind(&input.name)
    .bind(&input.work_directory)
    .bind(&input.git_branch)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Session> {
    sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| crate::AppError::NotFound {
            entity: "session".into(),
            id: id.into(),
        })
}

pub async fn update_status(pool: &DbPool, id: &str, status: &str) -> AppResult<Session> {
    sqlx::query_as::<_, Session>(
        "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *"
    )
    .bind(status)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn add_member(pool: &DbPool, session_id: &str, agent_id: &str, role: &str) -> AppResult<()> {
    sqlx::query("INSERT OR IGNORE INTO session_members (session_id, agent_id, role) VALUES (?, ?, ?)")
        .bind(session_id)
        .bind(agent_id)
        .bind(role)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_members(pool: &DbPool, session_id: &str) -> AppResult<Vec<SessionMember>> {
    sqlx::query_as::<_, SessionMember>("SELECT * FROM session_members WHERE session_id = ? AND left_at IS NULL")
        .bind(session_id)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &DbPool) -> (String, String, String) {
        let ws = db::workspaces::create(pool, &db::workspaces::CreateWorkspace {
            name: "WS".into(), description: None,
            created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap();

        let ch = db::channels::create(pool, &db::channels::CreateChannel {
            workspace_id: ws.id.clone(), name: "session-ch".into(), channel_type: "group".into(),
        }).await.unwrap();

        let agent = db::agents::create(pool, &db::agents::CreateAgent {
            name: "Worker".into(), runtime_type: "claude_cli".into(), provider: "anthropic".into(),
            model_name: None, persona: None, config: None,
            created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap();

        (ws.id, ch.id, agent.id)
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let pool = db::create_test_pool().await;
        let (ws_id, ch_id, agent_id) = setup(&pool).await;

        let session = create(&pool, &CreateSession {
            workspace_id: ws_id, channel_id: ch_id,
            name: "Frontend Dev".into(), work_directory: "/tmp/project".into(),
            git_branch: Some("feature/login".into()),
            created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap();

        assert_eq!(session.status, "planned");

        let running = update_status(&pool, &session.id, "running").await.unwrap();
        assert_eq!(running.status, "running");

        add_member(&pool, &session.id, &agent_id, "worker").await.unwrap();
        let members = list_members(&pool, &session.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].role, "worker");
    }
}
```

- [ ] **Step 2: Permissions CRUD**

`src-tauri/src/db/permissions.rs`:

```rust
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
```

- [ ] **Step 3: Tasks CRUD**

`src-tauri/src/db/tasks.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppResult;
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub session_id: String,
    pub channel_id: String,
    pub title: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
    pub assigned_to_id: Option<String>,
    pub status: String,
    pub priority: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Review {
    pub id: String,
    pub task_id: String,
    pub reviewer_agent_id: String,
    pub target_agent_id: String,
    pub status: String,
    pub summary: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub session_id: String,
    pub channel_id: String,
    pub title: String,
    pub description: Option<String>,
    pub created_by_type: String,
    pub created_by_id: String,
    pub assigned_to_id: Option<String>,
    pub priority: Option<i64>,
}

pub async fn create_task(pool: &DbPool, input: &CreateTask) -> AppResult<Task> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Task>(
        "INSERT INTO tasks (id, session_id, channel_id, title, description, created_by_type, created_by_id, assigned_to_id, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.session_id)
    .bind(&input.channel_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.created_by_type)
    .bind(&input.created_by_id)
    .bind(&input.assigned_to_id)
    .bind(input.priority.unwrap_or(0))
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn update_task_status(pool: &DbPool, id: &str, status: &str) -> AppResult<Task> {
    sqlx::query_as::<_, Task>(
        "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *"
    )
    .bind(status)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn list_by_session(pool: &DbPool, session_id: &str) -> AppResult<Vec<Task>> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE session_id = ? ORDER BY priority DESC, created_at")
        .bind(session_id)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

#[derive(Debug, Deserialize)]
pub struct CreateReview {
    pub task_id: String,
    pub reviewer_agent_id: String,
    pub target_agent_id: String,
}

pub async fn create_review(pool: &DbPool, input: &CreateReview) -> AppResult<Review> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query_as::<_, Review>(
        "INSERT INTO reviews (id, task_id, reviewer_agent_id, target_agent_id) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .bind(&id)
    .bind(&input.task_id)
    .bind(&input.reviewer_agent_id)
    .bind(&input.target_agent_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn update_review_status(pool: &DbPool, id: &str, status: &str, summary: Option<&str>) -> AppResult<Review> {
    sqlx::query_as::<_, Review>(
        "UPDATE reviews SET status = ?, summary = COALESCE(?, summary), updated_at = datetime('now') WHERE id = ? RETURNING *"
    )
    .bind(status)
    .bind(summary)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn setup(pool: &DbPool) -> (String, String, String) {
        let ws = db::workspaces::create(pool, &db::workspaces::CreateWorkspace {
            name: "WS".into(), description: None,
            created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap();

        let ch = db::channels::create(pool, &db::channels::CreateChannel {
            workspace_id: ws.id.clone(), name: "ch".into(), channel_type: "group".into(),
        }).await.unwrap();

        let session = db::sessions::create(pool, &db::sessions::CreateSession {
            workspace_id: ws.id, channel_id: ch.id.clone(),
            name: "Session".into(), work_directory: "/tmp".into(),
            git_branch: None, created_by_type: "user".into(), created_by_id: "u1".into(),
        }).await.unwrap();

        (session.id, ch.id, "u1".into())
    }

    #[tokio::test]
    async fn test_task_lifecycle() {
        let pool = db::create_test_pool().await;
        let (session_id, ch_id, _) = setup(&pool).await;

        let task = create_task(&pool, &CreateTask {
            session_id: session_id.clone(), channel_id: ch_id,
            title: "Implement login".into(), description: Some("OAuth2".into()),
            created_by_type: "user".into(), created_by_id: "u1".into(),
            assigned_to_id: None, priority: Some(1),
        }).await.unwrap();

        assert_eq!(task.status, "open");

        let updated = update_task_status(&pool, &task.id, "in_progress").await.unwrap();
        assert_eq!(updated.status, "in_progress");

        let tasks = list_by_session(&pool, &session_id).await.unwrap();
        assert_eq!(tasks.len(), 1);
    }
}
```

- [ ] **Step 4: 전체 테스트 실행**

```bash
cd src-tauri && cargo test
```

Expected: 모든 테스트 통과 (약 15+ tests)

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/db/sessions.rs src-tauri/src/db/permissions.rs src-tauri/src/db/tasks.rs
git commit -m "feat: add sessions, permissions, tasks CRUD with tests"
```

---

### Task 9: AppState + Config

**Files:**
- Create: `src-tauri/src/app_state.rs`
- Create: `src-tauri/src/config/mod.rs`
- Create: `src-tauri/src/config/settings.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Config 모듈**

`src-tauri/src/config/mod.rs`:

```rust
pub mod settings;
pub use settings::AppSettings;
```

`src-tauri/src/config/settings.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub database_path: String,
    pub claude_cli_path: Option<String>,
    pub codex_cli_path: Option<String>,
    pub default_sandbox_mode: String,
    pub process_timeout_secs: u64,
    pub max_log_size_mb: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            database_path: "agent-session-manager.db".into(),
            claude_cli_path: None,
            codex_cli_path: None,
            default_sandbox_mode: "workspace-write".into(),
            process_timeout_secs: 300,
            max_log_size_mb: 100,
        }
    }
}
```

- [ ] **Step 2: AppState**

`src-tauri/src/app_state.rs`:

```rust
use crate::config::AppSettings;
use crate::db::DbPool;

pub struct AppState {
    pub db: DbPool,
    pub settings: AppSettings,
}
```

- [ ] **Step 3: lib.rs 업데이트 — 전체 모듈 등록 + Tauri 앱 빌더**

`src-tauri/src/lib.rs`:

```rust
mod errors;
mod db;
mod config;
mod app_state;

pub use errors::{AppError, AppResult, IpcError};
pub use db::DbPool;
pub use app_state::AppState;
pub use config::AppSettings;

use std::path::PathBuf;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let app_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir");
                std::fs::create_dir_all(&app_dir).ok();

                let settings = AppSettings::default();
                let db_path = app_dir.join(&settings.database_path);
                let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

                let pool = db::create_pool(&db_url)
                    .await
                    .expect("failed to create db pool");
                db::schema::run_migrations(&pool)
                    .await
                    .expect("failed to run migrations");

                // Create default user if none exists
                let users = db::users::list(&pool).await.unwrap_or_default();
                if users.is_empty() {
                    db::users::create(&pool, &db::users::CreateUser {
                        display_name: "User".into(),
                    }).await.ok();
                }

                app_handle.manage(AppState {
                    db: pool,
                    settings,
                });
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agent_session_manager_lib::run();
}
```

Note: `Cargo.toml`의 `[lib]` 섹션에 이름을 설정해야 합니다:

```toml
[lib]
name = "agent_session_manager_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 4: use 경로에 path 추가**

`src-tauri/src/lib.rs` 상단에 추가:

```rust
use tauri::Manager;
```

- [ ] **Step 5: 빌드 확인**

```bash
cd src-tauri && cargo check
```

Expected: 컴파일 성공

- [ ] **Step 6: 앱 실행 확인**

```bash
npm run tauri dev
```

Expected: 앱이 실행되고, app data 디렉토리에 SQLite DB 파일이 생성됨

- [ ] **Step 7: 커밋**

```bash
git add src-tauri/src/app_state.rs src-tauri/src/config/ src-tauri/src/lib.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: add AppState, config, and Tauri app setup with SQLite initialization"
```

---

### Task 10: 기본 Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/agent_commands.rs`
- Create: `src-tauri/src/commands/workspace_commands.rs`
- Create: `src-tauri/src/commands/message_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Commands 모듈 구조**

`src-tauri/src/commands/mod.rs`:

```rust
pub mod agent_commands;
pub mod workspace_commands;
pub mod message_commands;
```

- [ ] **Step 2: Agent commands**

`src-tauri/src/commands/agent_commands.rs`:

```rust
use tauri::State;
use crate::{AppState, AppError};
use crate::db::{agents, agents::CreateAgent, agents::UpdateAgent};

#[tauri::command]
pub async fn create_agent(state: State<'_, AppState>, input: CreateAgent) -> Result<agents::Agent, AppError> {
    agents::create(&state.db, &input).await
}

#[tauri::command]
pub async fn get_agent(state: State<'_, AppState>, id: String) -> Result<agents::Agent, AppError> {
    agents::get_by_id(&state.db, &id).await
}

#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<agents::Agent>, AppError> {
    agents::list(&state.db).await
}

#[tauri::command]
pub async fn update_agent(state: State<'_, AppState>, id: String, input: UpdateAgent) -> Result<agents::Agent, AppError> {
    agents::update(&state.db, &id, &input).await
}

#[tauri::command]
pub async fn delete_agent(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    agents::delete(&state.db, &id).await
}
```

- [ ] **Step 3: Workspace commands**

`src-tauri/src/commands/workspace_commands.rs`:

```rust
use tauri::State;
use crate::{AppState, AppError};
use crate::db::{workspaces, workspaces::CreateWorkspace};
use crate::db::{channels, channels::CreateChannel};

#[tauri::command]
pub async fn create_workspace(state: State<'_, AppState>, input: CreateWorkspace) -> Result<workspaces::Workspace, AppError> {
    workspaces::create(&state.db, &input).await
}

#[tauri::command]
pub async fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<workspaces::Workspace>, AppError> {
    workspaces::list(&state.db).await
}

#[tauri::command]
pub async fn create_channel(state: State<'_, AppState>, input: CreateChannel) -> Result<channels::Channel, AppError> {
    channels::create(&state.db, &input).await
}

#[tauri::command]
pub async fn list_channels(state: State<'_, AppState>, workspace_id: String) -> Result<Vec<channels::Channel>, AppError> {
    channels::list_by_workspace(&state.db, &workspace_id).await
}
```

- [ ] **Step 4: Message commands**

`src-tauri/src/commands/message_commands.rs`:

```rust
use tauri::State;
use crate::{AppState, AppError};
use crate::db::{messages, messages::CreateMessage};

#[tauri::command]
pub async fn send_message(state: State<'_, AppState>, input: CreateMessage) -> Result<messages::Message, AppError> {
    messages::create(&state.db, &input).await
}

#[tauri::command]
pub async fn list_messages(state: State<'_, AppState>, channel_id: String, limit: Option<i64>, before: Option<String>) -> Result<Vec<messages::Message>, AppError> {
    messages::list_by_channel(&state.db, &channel_id, limit.unwrap_or(50), before.as_deref()).await
}
```

- [ ] **Step 5: lib.rs에 commands 등록**

`src-tauri/src/lib.rs`의 모듈 선언에 추가:

```rust
mod commands;
```

`run()` 함수의 `tauri::Builder` 체인에 invoke_handler 추가:

```rust
.invoke_handler(tauri::generate_handler![
    commands::agent_commands::create_agent,
    commands::agent_commands::get_agent,
    commands::agent_commands::list_agents,
    commands::agent_commands::update_agent,
    commands::agent_commands::delete_agent,
    commands::workspace_commands::create_workspace,
    commands::workspace_commands::list_workspaces,
    commands::workspace_commands::create_channel,
    commands::workspace_commands::list_channels,
    commands::message_commands::send_message,
    commands::message_commands::list_messages,
])
```

- [ ] **Step 6: 프론트엔드 IPC 래퍼**

`src/lib/tauri.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

// Agent types
export interface Agent {
  id: string;
  name: string;
  runtime_type: string;
  provider: string;
  model_name: string | null;
  persona: string | null;
  config: string | null;
  enabled: boolean;
  created_by_type: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  runtime_type: "claude_cli" | "codex_cli";
  provider: "anthropic" | "openai";
  model_name?: string;
  persona?: string;
  config?: string;
  created_by_type: "user" | "agent";
  created_by_id: string;
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_by_type: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

// Channel types
export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  channel_type: "dm" | "group";
  created_at: string;
  updated_at: string;
}

// Message types
export interface Message {
  id: string;
  channel_id: string;
  sender_type: "user" | "agent" | "system";
  sender_user_id: string | null;
  sender_agent_id: string | null;
  content: string;
  message_type: string;
  status: string;
  metadata: string | null;
  parent_id: string | null;
  thread_root_id: string | null;
  created_at: string;
}

// API functions
export const api = {
  agents: {
    create: (input: CreateAgentInput) => invoke<Agent>("create_agent", { input }),
    get: (id: string) => invoke<Agent>("get_agent", { id }),
    list: () => invoke<Agent[]>("list_agents"),
    delete: (id: string) => invoke<void>("delete_agent", { id }),
  },
  workspaces: {
    create: (input: { name: string; description?: string; created_by_type: string; created_by_id: string }) =>
      invoke<Workspace>("create_workspace", { input }),
    list: () => invoke<Workspace[]>("list_workspaces"),
  },
  channels: {
    create: (input: { workspace_id: string; name: string; channel_type: string }) =>
      invoke<Channel>("create_channel", { input }),
    list: (workspaceId: string) => invoke<Channel[]>("list_channels", { workspaceId }),
  },
  messages: {
    send: (input: {
      channel_id: string; sender_type: string;
      sender_user_id?: string; sender_agent_id?: string;
      content: string; message_type: string;
    }) => invoke<Message>("send_message", { input }),
    list: (channelId: string, limit?: number) =>
      invoke<Message[]>("list_messages", { channelId, limit }),
  },
};
```

- [ ] **Step 7: 빌드 확인**

```bash
cd src-tauri && cargo check
```

Expected: 컴파일 성공

- [ ] **Step 8: 앱 실행 확인**

```bash
npm run tauri dev
```

Expected: 앱이 정상 실행됨

- [ ] **Step 9: 커밋**

```bash
git add src-tauri/src/commands/ src/lib/tauri.ts src-tauri/src/lib.rs
git commit -m "feat: add Tauri IPC commands for agents, workspaces, channels, messages"
```

---

### Task 11: 최종 확인 + .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore 업데이트**

`.gitignore`에 추가:

```
# Tauri
src-tauri/target/

# App data
*.db
*.db-wal
*.db-shm

# Superpowers brainstorm sessions
.superpowers/

# Node
node_modules/
dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd src-tauri && cargo test
```

Expected: 모든 테스트 통과 (약 15-20 tests)

- [ ] **Step 3: 앱 실행 최종 확인**

```bash
npm run tauri dev
```

Expected: 앱이 정상 실행되고 SQLite DB가 생성됨

- [ ] **Step 4: 커밋**

```bash
git add .gitignore
git commit -m "chore: add .gitignore for Tauri project"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage**: 데이터 모델 전체 구현, 에러 타입, AppState, Config, 기본 IPC commands
- [x] **No placeholders**: 모든 코드 블록 완성, TBD 없음
- [x] **Type consistency**: `DbPool`, `AppState`, `AppError`, `AppResult` 일관 사용
- [x] **Scope**: Plan 1은 "테스트 가능한 백엔드 CRUD"를 산출 — 독립적으로 동작

## Not in this plan (후속 계획)

- Plan 2: Runtime (CLI 어댑터 + 프로세스 관리)
- Plan 3: Frontend (React UI 컴포넌트)
- Plan 4: Integration (오케스트레이션 + 권한 + 연결)
