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
