# Agent Session Manager — 설계 문서

> AI 에이전트 간 대화를 관리하는 메신저 데스크톱 앱
> 작성일: 2026-05-02
> 리뷰: Claude (설계) + Codex CLI (데이터 모델, 백엔드 구조, CLI 프로토콜, 에러/i18n)

---

## 1. 개요

### 목적
사용자가 AI 에이전트(Claude, Codex)를 생성하고, 에이전트 간 대화/작업 지시/보고/코드 리뷰를 Discord 스타일 메신저 UI에서 실시간으로 관찰하고 제어할 수 있는 데스크톱 앱.

### 핵심 사용 시나리오
1. 사용자가 쿼리 입력 → "이 프로젝트의 로그인 기능 구현해줘"
2. 매니저 에이전트가 수신 → 작업 분석, 필요한 에이전트 파악
3. 매니저가 에이전트 생성/배정 → "프론트엔드 개발자" 생성, "백엔드 개발자"에게 작업 지시
4. 작업 세션 생성 → 해당 프로젝트 디렉토리에서 CLI 프로세스 시작
5. 에이전트들이 작업 수행 → 각자 CLI로 코딩, 결과를 매니저에게 보고
6. 매니저가 리뷰 지시 → "리뷰어" 에이전트에게 코드 리뷰 요청
7. 최종 보고 → 매니저가 사용자에게 결과 보고

### 주요 기능
- 에이전트 생성: Claude 또는 Codex 선택 → 이름/직업 등 페르소나 입력 → 권한 설정
- 에이전트 간 대화: 작업 지시, 보고, 리뷰를 대화 형태로 표시
- 작업 세션: CLI 프로세스 기반 코딩 작업 + 에이전트 간 협업 채널
- 권한 계층: 에이전트가 다른 에이전트 생성 시 권한은 생성자 범위 내로 제한
- 사용자 쿼리 → 에이전트 직접 선택 또는 관리자 에이전트에게 위임

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 데스크톱 프레임워크 | Tauri v2 |
| 백엔드 | Rust |
| 프론트엔드 | React + TypeScript |
| UI 라이브러리 | shadcn/ui (Tailwind 기반) |
| 상태관리 | Zustand |
| DB | SQLite |
| i18n | react-i18next (한국어/영어) |
| AI 런타임 | Claude Code CLI, Codex CLI (로컬 설치) |

---

## 3. 전체 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   React + TypeScript                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ 메신저UI  │ │에이전트   │ │작업세션   │ │ 설정   │ │
│  │(Discord) │ │관리 패널  │ │관리 패널  │ │ 패널   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│         ↕ Tauri Commands + Events (IPC)             │
├─────────────────────────────────────────────────────┤
│                  Tauri 백엔드 (Rust)                 │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────┐ │
│  │ Runtime    │ │ Process    │ │ Orchestrator    │ │
│  │ Adapters   │ │ Manager    │ │ (Router,        │ │
│  │(Claude,    │ │ (Spawn,    │ │  Permission,    │ │
│  │ Codex)     │ │  IO, PTY)  │ │  Lifecycle)     │ │
│  └────────────┘ └────────────┘ └─────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────┐ │
│  │ Services   │ │ Security   │ │ Config          │ │
│  └────────────┘ └────────────┘ └─────────────────┘ │
│                    ↕ SQLite                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ users │ agents │ agent_runs │ sessions │ ...    ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
         ↕ 자식 프로세스 (stdin/stdout)
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │Claude CLI│  │Codex CLI │  │Claude CLI│
   └──────────┘  └──────────┘  └──────────┘
```

**아키텍처 방식**: 하이브리드 (중앙 오케스트레이터 + Tauri 이벤트 시스템)
- Commands (UI → Rust): 요청-응답 (에이전트 생성, 메시지 전송 등)
- Events (Rust → UI): 실시간 푸시 (CLI 출력 스트리밍, 상태 변경, 새 메시지)

---

## 4. 데이터 모델

### 4.1 사용자/에이전트

```sql
CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    runtime_type    TEXT NOT NULL CHECK (runtime_type IN ('claude_cli', 'codex_cli')),
    provider        TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
    model_name      TEXT,
    persona         TEXT, -- JSON
    config          TEXT, -- JSON
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id   TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 에이전트 실행/관계

```sql
CREATE TABLE agent_runs (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    session_id      TEXT REFERENCES sessions(id),
    pid             INTEGER,
    cli_command     TEXT NOT NULL,
    cli_args        TEXT, -- JSON
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
    started_at      DATETIME,
    ended_at        DATETIME,
    last_heartbeat  DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_relationships (
    parent_agent_id TEXT NOT NULL REFERENCES agents(id),
    child_agent_id  TEXT NOT NULL REFERENCES agents(id),
    relationship    TEXT NOT NULL CHECK (relationship IN ('created', 'supervises', 'delegates', 'reviews')),
    session_id      TEXT REFERENCES sessions(id),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_agent_id, child_agent_id, relationship)
);
```

### 4.3 워크스페이스/채널

```sql
CREATE TABLE workspaces (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id   TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE channels (
    id              TEXT PRIMARY KEY,
    workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
    name            TEXT NOT NULL,
    channel_type    TEXT NOT NULL CHECK (channel_type IN ('dm', 'group')),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE channel_members (
    channel_id      TEXT NOT NULL REFERENCES channels(id),
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, agent_id)
);
```

### 4.4 작업 세션

```sql
CREATE TABLE sessions (
    id               TEXT PRIMARY KEY,
    workspace_id     TEXT NOT NULL REFERENCES workspaces(id),
    channel_id       TEXT NOT NULL REFERENCES channels(id),
    name             TEXT NOT NULL,
    work_directory   TEXT NOT NULL,
    git_branch       TEXT,
    status           TEXT NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    created_by_type  TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
    created_by_id    TEXT NOT NULL,
    started_at       DATETIME,
    ended_at         DATETIME,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_members (
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    role            TEXT NOT NULL CHECK (role IN ('owner', 'worker', 'reviewer', 'observer')),
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at         DATETIME,
    PRIMARY KEY (session_id, agent_id)
);
```

### 4.5 메시지/로그

```sql
CREATE TABLE messages (
    id              TEXT PRIMARY KEY,
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
    metadata        TEXT, -- JSON
    parent_id       TEXT REFERENCES messages(id),
    thread_root_id  TEXT REFERENCES messages(id),
    edited_at       DATETIME,
    deleted_at      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cli_logs (
    id              TEXT PRIMARY KEY,
    agent_run_id    TEXT NOT NULL REFERENCES agent_runs(id),
    message_id      TEXT REFERENCES messages(id),
    stream          TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
    content         TEXT NOT NULL,
    sequence        INTEGER NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.6 권한

```sql
CREATE TABLE agent_permissions (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    scope_type      TEXT NOT NULL CHECK (scope_type IN ('global', 'workspace', 'channel', 'session')),
    scope_id        TEXT,
    permission_type TEXT NOT NULL CHECK (permission_type IN (
                        'create_agent', 'create_session', 'assign_task', 'review', 'execute_cli'
                    )),
    granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('user', 'agent')),
    granted_by_id   TEXT NOT NULL,
    expires_at      DATETIME,
    revoked_at      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.7 작업/리뷰

```sql
CREATE TABLE tasks (
    id                 TEXT PRIMARY KEY,
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
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id                 TEXT PRIMARY KEY,
    task_id            TEXT NOT NULL REFERENCES tasks(id),
    reviewer_agent_id  TEXT NOT NULL REFERENCES agents(id),
    target_agent_id    TEXT NOT NULL REFERENCES agents(id),
    status             TEXT NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'commented', 'approved', 'changes_requested')),
    summary            TEXT,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.8 인덱스

```sql
CREATE INDEX idx_agents_created_by ON agents(created_by_type, created_by_id);
CREATE INDEX idx_channels_workspace ON channels(workspace_id);
CREATE INDEX idx_channels_workspace_type ON channels(workspace_id, channel_type);
CREATE INDEX idx_channel_members_agent ON channel_members(agent_id);
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_parent ON messages(parent_id);
CREATE INDEX idx_messages_sender_agent ON messages(sender_agent_id, created_at);
CREATE INDEX idx_messages_status ON messages(channel_id, status);
CREATE INDEX idx_permissions_agent_type ON agent_permissions(agent_id, permission_type);
CREATE INDEX idx_sessions_workspace_status ON sessions(workspace_id, status);
CREATE INDEX idx_sessions_channel ON sessions(channel_id);
CREATE INDEX idx_agent_runs_session ON agent_runs(session_id, started_at);
CREATE INDEX idx_agent_runs_agent_status ON agent_runs(agent_id, process_status);
CREATE INDEX idx_cli_logs_run_sequence ON cli_logs(agent_run_id, sequence);
CREATE INDEX idx_tasks_session_status ON tasks(session_id, status);
CREATE INDEX idx_tasks_assignee_status ON tasks(assigned_to_id, status);
```

---

## 5. Rust 백엔드 모듈 구조

```
src-tauri/
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── errors.rs               -- AppError (thiserror + IPC 직렬화)
│   ├── app_state.rs            -- Tauri State: DB pool, process registry, config
│   │
│   ├── config/
│   │   ├── mod.rs
│   │   └── settings.rs         -- CLI 경로, timeout, 환경변수, 로그 정책
│   │
│   ├── db/
│   │   ├── mod.rs
│   │   ├── schema.rs           -- 마이그레이션
│   │   ├── agents.rs
│   │   ├── messages.rs
│   │   ├── sessions.rs
│   │   ├── tasks.rs
│   │   └── permissions.rs
│   │
│   ├── runtime/                -- CLI 런타임 어댑터 (trait 기반)
│   │   ├── mod.rs
│   │   ├── adapter.rs          -- AgentRuntime trait
│   │   ├── claude.rs
│   │   ├── codex.rs
│   │   └── registry.rs
│   │
│   ├── process/                -- 프로세스 수명주기 관리
│   │   ├── mod.rs
│   │   ├── manager.rs
│   │   ├── registry.rs         -- run_id → child handle
│   │   ├── supervisor.rs       -- 종료 감시, 재시작, cleanup
│   │   ├── io.rs               -- stdin/stdout/stderr async streaming
│   │   └── pty.rs              -- 터미널 패널용 PTY
│   │
│   ├── orchestrator/
│   │   ├── mod.rs
│   │   ├── router.rs           -- 메시지 라우팅
│   │   ├── permission_engine.rs
│   │   ├── agent_lifecycle.rs
│   │   ├── session_lifecycle.rs
│   │   └── task_flow.rs
│   │
│   ├── services/               -- 비즈니스 서비스 계층
│   │   ├── mod.rs
│   │   ├── agent_service.rs
│   │   ├── session_service.rs
│   │   └── message_service.rs
│   │
│   ├── commands/               -- Tauri IPC (얇은 진입점)
│   │   ├── mod.rs
│   │   ├── agent_commands.rs
│   │   ├── message_commands.rs
│   │   ├── session_commands.rs
│   │   └── workspace_commands.rs
│   │
│   ├── events/
│   │   ├── mod.rs
│   │   ├── types.rs            -- 이벤트 payload 타입 정의
│   │   └── emitter.rs
│   │
│   └── security/
│       ├── mod.rs
│       ├── sandbox.rs          -- 작업 디렉토리/명령 제한
│       └── permission_validator.rs
```

### AgentRuntime trait

```rust
trait AgentRuntime: Send + Sync {
    fn kind(&self) -> RuntimeKind;
    fn build_command(&self, run: &AgentRunSpec) -> Result<CommandSpec>;
    fn parse_output(&self, chunk: &[u8]) -> Vec<RuntimeEvent>;
    fn format_input(&self, message: &OutboundMessage) -> Result<Vec<u8>>;
}
```

---

## 6. CLI 통신 프로토콜

### Claude Code CLI

```bash
# 비대화형 실행 (작업 디렉토리는 spawn.current_dir()로 설정)
claude -p "프롬프트" \
  --output-format stream-json \
  --max-turns 10 \
  --allowedTools "Bash,Read,Write,Edit" \
  --add-dir /path/to/additional

# 세션 유지
claude -p "후속 프롬프트" --resume <session_id>
```

### Codex CLI

```bash
# 비대화형 실행
codex exec \
  --sandbox workspace-write \
  -C /path/to/work/directory \
  --json \
  --ephemeral \
  --ignore-user-config \
  --skip-git-repo-check \
  "프롬프트"

# 세션 유지
codex exec resume <session_id>
```

### 실제 JSONL 이벤트 포맷

**Codex:**
```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.started","item":{"type":"command_execution","command":"bash -lc ls"}}
{"type":"item.completed","item":{"type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":24763,"output_tokens":122}}
```

**Claude:**
```jsonl
{"type":"assistant","message":{"content":[...]}}
{"type":"result","result":"...","session_id":"...","total_cost_usd":0.05,"num_turns":3}
```

### RuntimeEvent (공통 이벤트 타입)

```rust
enum RuntimeEvent {
    // 세션/턴 수명주기
    SessionStarted { session_id: String },
    TurnStarted,
    TurnCompleted { usage: Option<TokenUsage> },
    TurnFailed { message: String },

    // 대화
    Message { role: String, content: String },
    Reasoning { content: String },

    // 명령 실행
    CommandStarted { command: String },
    CommandOutput { command: String, output: String },
    CommandCompleted { command: String, exit_code: Option<i32> },

    // 도구/파일
    FileChange { path: String, kind: String },
    ToolCall { tool: String, args: Value },
    ToolResult { tool: String, output: Value, status: String },

    // 비용/사용량
    Usage { input_tokens: i64, cached_input_tokens: i64,
            output_tokens: i64, reasoning_output_tokens: i64 },
    Cost { usd: f64 },

    // 기타
    Error { message: String },
    RawLog { stream: String, line: String },
}
```

### 에이전트 간 통신 방식

- **턴 단위 실행**: A 완료 → Orchestrator가 필터링/요약 → B를 새 프로세스로 호출
- **세션 유지**: Claude `--resume` / Codex `codex exec resume`
- **보안**: allowlisted event만 전달 + secret redaction

---

## 7. 프론트엔드 구조

### UI 레이아웃 (Discord 스타일)

```
┌────┬──────────┬───────────────────────┬──────────┐
│ W  │ Channel  │      ChatArea         │ Member   │
│ o  │ Sidebar  │  ┌─────────────────┐  │ Panel    │
│ r  │          │  │  ChannelHeader   │  │          │
│ k  │ ▼ DM     │  ├─────────────────┤  │ Agent    │
│ s  │  매니저   │  │                 │  │ Info     │
│ p  │  개발자   │  │  MessageList    │  │ Card     │
│ a  │          │  │  + CliLog       │  │          │
│ c  │ ▼ 세션   │  │  + SystemMsg    │  │ Member   │
│ e  │  # 프론트 │  │                 │  │ List     │
│    │  # 백엔드 │  ├─────────────────┤  │          │
│ S  │          │  │  MessageInput   │  │          │
│ i  │          │  └─────────────────┘  │          │
│ d  │          │  ┌─────────────────┐  │          │
│ e  │          │  │ TerminalPanel   │  │          │
│ b  │          │  └─────────────────┘  │          │
│ a  │          │                       │          │
│ r  │          │                       │          │
└────┴──────────┴───────────────────────┴──────────┘
```

### 컴포넌트 트리

```
App
├── AppLayout
│   ├── WorkspaceSidebar
│   │   ├── WorkspaceIcon
│   │   └── CreateWorkspaceButton
│   ├── ChannelSidebar
│   │   ├── ChannelGroup (DM / 세션)
│   │   ├── ChannelItem
│   │   └── UserStatus
│   ├── ChatArea
│   │   ├── ChannelHeader
│   │   ├── MessageList
│   │   │   ├── MessageItem
│   │   │   ├── CliLogAccordion
│   │   │   └── SystemMessage
│   │   └── MessageInput
│   ├── MemberPanel
│   │   ├── AgentInfoCard
│   │   └── MemberList
│   └── TerminalPanel (토글)
│       ├── TerminalTabs
│       └── TerminalOutput
├── AgentCreationModal
├── SessionCreationModal
└── SettingsModal
```

### 디렉토리 구조

```
src/
├── components/
│   ├── layout/
│   ├── workspace/
│   ├── channel/
│   ├── chat/
│   ├── terminal/
│   ├── agent/
│   ├── session/
│   └── common/
├── hooks/          -- useTauriCommand, useTauriEvent, useAgent 등
├── stores/         -- Zustand 상태관리
├── lib/            -- Tauri IPC 래퍼, 유틸리티
├── i18n/           -- 한국어/영어 번역
│   └── locales/
│       ├── ko.json
│       └── en.json
└── types/          -- TypeScript 타입 정의
```

---

## 8. 에러 핸들링

### IPC 에러 구조

```rust
// Rust
struct AppError {
    code: String,            // "CLI_NOT_FOUND"
    message_key: String,     // "errors.cli.notFound"
    fallback_message: String,
    details: Option<Value>,  // 사용자 표시용만 (secret 제외)
    request_id: String,
    recoverable: bool,
}
```

```ts
// React
t(error.messageKey, error.details)
```

### 에러 카테고리

| 카테고리 | 예시 |
|---------|------|
| Process | spawn 실패, CLI 미설치, timeout, signal kill |
| Filesystem | workspace 접근 불가, 용량 부족, path traversal |
| Serialization | IPC decode 실패, JSONL 파싱 에러 |
| Config | CLI 경로 누락, 미지원 모델 설정 |
| Concurrency | 중복 run, DB lock, race condition |
| Network | CLI의 외부 API 호출 실패 |
| Permission | 권한 부족, 스코프 초과 |
| Validation | 잘못된 입력값 |

---

## 9. 로깅

- **Rust**: `tauri-plugin-log` + `tracing` structured logging
- **Frontend**: 주요 UI action, invoke 실패 기록
- 모든 요청에 `request_id`, 모든 run에 `run_id`
- CLI stderr는 tail만 저장 (secret redaction)
- 로그 로테이션 + 보존 기간/최대 크기 설정 UI
- 로컬 진단 번들 내보내기 기능

---

## 10. i18n

- **라이브러리**: react-i18next
- **범위**: UI 텍스트만 번역 — 에이전트 대화 내용은 번역하지 않음
- **기본 언어**: 시스템 로케일 감지 → 수동 전환 가능 (설정 패널)
- **날짜/시간/숫자**: `Intl` API 사용
- **에러 메시지**: 백엔드가 `messageKey`를 전달 → 프론트에서 번역

---

## 11. 보안

- Rust `Command`에 arg array 사용 (shell string 조립 금지)
- workdir canonicalize + 허용 root 검증
- 기본 `read-only`, 편집 시만 `workspace-write`
- `danger-full-access` / `--dangerously-skip-permissions`는 격리 환경 외 금지
- `--ignore-user-config` / 별도 `CODEX_HOME`으로 앱 환경 분리
- stdout → 다른 에이전트 전달 시 allowlisted event만 + secret redaction
- 타임아웃, max turns, budget, output size limit 필수
- `.env`, auth token, CLI auth 파일 접근 차단
- 에이전트 생성 시 권한은 생성자의 권한 범위 내로 제한
