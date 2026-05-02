# Plan 2: Runtime — CLI 어댑터 + 프로세스 관리

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code CLI와 Codex CLI를 Rust에서 spawn/관리하고, JSONL 출력을 파싱하여 공통 RuntimeEvent로 변환하고, Tauri 이벤트로 프론트엔드에 실시간 스트리밍하는 런타임 레이어를 구현한다.

**Architecture:** `runtime/` 모듈이 CLI별 어댑터(trait 기반)를 제공하고, `process/` 모듈이 프로세스 수명주기(spawn, I/O, supervisor)를 관리한다. `events/` 모듈이 Tauri 이벤트로 프론트엔드에 전달한다.

**Tech Stack:** Rust, tokio (async), serde_json (JSONL 파싱), Tauri v2 events

**Spec:** `docs/superpowers/specs/2026-05-02-agent-session-manager-design.md` (Section 5, 6)

**Depends on:** Plan 1 완료 (DB, AppState, errors, commands)

---

## File Structure (신규 파일만)

```
src-tauri/src/
├── runtime/
│   ├── mod.rs              -- 모듈 선언 + RuntimeKind enum
│   ├── adapter.rs          -- AgentRuntime trait + RuntimeEvent enum + CommandSpec
│   ├── claude.rs           -- Claude CLI 어댑터
│   ├── codex.rs            -- Codex CLI 어댑터
│   └── registry.rs         -- 런타임 등록/조회
├── process/
│   ├── mod.rs              -- 모듈 선언
│   ├── manager.rs          -- 프로세스 생성 요청 처리
│   ├── registry.rs         -- RunId → child handle 매핑
│   ├── supervisor.rs       -- 종료 감시, cleanup
│   └── io.rs               -- stdout/stderr async line reader
├── events/
│   ├── mod.rs              -- 모듈 선언
│   └── types.rs            -- Tauri 이벤트 payload 타입
├── commands/
│   └── run_commands.rs     -- 에이전트 실행 관련 IPC 커맨드 (신규)
```

---

### Task 1: RuntimeEvent + AgentRuntime trait

**Files:**
- Create: `src-tauri/src/runtime/mod.rs`
- Create: `src-tauri/src/runtime/adapter.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod runtime;`)

- [ ] **Step 1: RuntimeKind enum + 모듈 선언**

`src-tauri/src/runtime/mod.rs`:

```rust
pub mod adapter;
pub mod claude;
pub mod codex;
pub mod registry;

pub use adapter::{AgentRuntime, RuntimeEvent, CommandSpec, TokenUsage, RuntimeKind};
```

- [ ] **Step 2: AgentRuntime trait + RuntimeEvent**

`src-tauri/src/runtime/adapter.rs`:

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RuntimeKind {
    Claude,
    Codex,
}

impl std::fmt::Display for RuntimeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RuntimeKind::Claude => write!(f, "claude"),
            RuntimeKind::Codex => write!(f, "codex"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: i64,
    pub cached_input_tokens: i64,
    pub output_tokens: i64,
    pub reasoning_output_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type")]
pub enum RuntimeEvent {
    SessionStarted { session_id: String },
    TurnStarted,
    TurnCompleted { usage: Option<TokenUsage> },
    TurnFailed { message: String },

    Message { role: String, content: String },
    Reasoning { content: String },

    CommandStarted { command: String },
    CommandOutput { command: String, output: String },
    CommandCompleted { command: String, exit_code: Option<i32> },

    FileChange { path: String, kind: String },
    ToolCall { tool: String, args: Value },
    ToolResult { tool: String, output: Value, status: String },

    Usage { usage: TokenUsage },
    Cost { usd: f64 },

    Error { message: String },
    RawLog { stream: String, line: String },
}

/// Specification for spawning a CLI process.
#[derive(Debug, Clone)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub work_dir: Option<String>,
    pub env: Vec<(String, String)>,
}

/// Input message to send to a running agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboundMessage {
    pub content: String,
    pub role: String,
}

/// Trait that each CLI runtime must implement.
pub trait AgentRuntime: Send + Sync {
    /// Which runtime this is.
    fn kind(&self) -> RuntimeKind;

    /// Build the command to spawn the CLI process.
    fn build_command(
        &self,
        prompt: &str,
        work_dir: Option<&str>,
        max_turns: Option<u32>,
        allowed_tools: Option<&[String]>,
        extra_args: Option<&[String]>,
    ) -> AppResult<CommandSpec>;

    /// Parse a single JSONL line from stdout into runtime events.
    fn parse_output_line(&self, line: &str) -> Vec<RuntimeEvent>;

    /// Format a message to send to the agent's stdin.
    fn format_input(&self, message: &OutboundMessage) -> AppResult<Vec<u8>>;
}
```

- [ ] **Step 3: lib.rs에 모듈 등록**

`src-tauri/src/lib.rs` 상단에 추가:

```rust
mod runtime;
```

- [ ] **Step 4: 빌드 확인**

```bash
cd src-tauri && cargo check
```

Expected: 컴파일 성공 (빈 claude.rs, codex.rs, registry.rs는 아직 없으므로 빈 파일 생성)

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/runtime/ src-tauri/src/lib.rs
git commit -m "feat: add RuntimeEvent enum and AgentRuntime trait"
```

---

### Task 2: Claude CLI 어댑터

**Files:**
- Create: `src-tauri/src/runtime/claude.rs`

- [ ] **Step 1: Claude 어댑터 구현**

`src-tauri/src/runtime/claude.rs`:

```rust
use crate::AppResult;
use super::adapter::*;

pub struct ClaudeRuntime {
    pub cli_path: String,
}

impl ClaudeRuntime {
    pub fn new(cli_path: Option<String>) -> Self {
        Self {
            cli_path: cli_path.unwrap_or_else(|| "claude".into()),
        }
    }
}

impl AgentRuntime for ClaudeRuntime {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Claude
    }

    fn build_command(
        &self,
        prompt: &str,
        work_dir: Option<&str>,
        max_turns: Option<u32>,
        allowed_tools: Option<&[String]>,
        extra_args: Option<&[String]>,
    ) -> AppResult<CommandSpec> {
        let mut args = vec![
            "-p".into(),
            prompt.into(),
            "--output-format".into(),
            "stream-json".into(),
            "--no-session-persistence".into(),
        ];

        if let Some(turns) = max_turns {
            args.push("--max-turns".into());
            args.push(turns.to_string());
        }

        if let Some(tools) = allowed_tools {
            args.push("--allowedTools".into());
            args.push(tools.join(","));
        }

        if let Some(extra) = extra_args {
            args.extend(extra.iter().cloned());
        }

        Ok(CommandSpec {
            program: self.cli_path.clone(),
            args,
            work_dir: work_dir.map(String::from),
            env: vec![],
        })
    }

    fn parse_output_line(&self, line: &str) -> Vec<RuntimeEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return vec![];
        }

        let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                return vec![RuntimeEvent::RawLog {
                    stream: "stdout".into(),
                    line: trimmed.into(),
                }];
            }
        };

        let event_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match event_type {
            "system" => {
                // System init event — extract session_id if present
                if let Some(sid) = parsed.pointer("/session_id").and_then(|v| v.as_str()) {
                    vec![RuntimeEvent::SessionStarted {
                        session_id: sid.into(),
                    }]
                } else {
                    vec![]
                }
            }
            "assistant" => {
                // Assistant message with content blocks
                let content = parsed
                    .pointer("/message/content")
                    .and_then(|c| {
                        if let Some(arr) = c.as_array() {
                            let texts: Vec<String> = arr
                                .iter()
                                .filter_map(|block| {
                                    if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                        block.get("text").and_then(|t| t.as_str()).map(String::from)
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            if texts.is_empty() { None } else { Some(texts.join("\n")) }
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();

                let mut events = vec![];

                if !content.is_empty() {
                    events.push(RuntimeEvent::Message {
                        role: "assistant".into(),
                        content,
                    });
                }

                // Check for tool_use blocks
                if let Some(arr) = parsed.pointer("/message/content").and_then(|c| c.as_array()) {
                    for block in arr {
                        if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                            let tool = block.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");
                            let args = block.get("input").cloned().unwrap_or(serde_json::Value::Null);
                            events.push(RuntimeEvent::ToolCall {
                                tool: tool.into(),
                                args,
                            });
                        }
                    }
                }

                events
            }
            "result" => {
                let mut events = vec![];

                if let Some(cost) = parsed.get("total_cost_usd").and_then(|v| v.as_f64()) {
                    events.push(RuntimeEvent::Cost { usd: cost });
                }

                if let Some(result_text) = parsed.get("result").and_then(|v| v.as_str()) {
                    events.push(RuntimeEvent::Message {
                        role: "result".into(),
                        content: result_text.into(),
                    });
                }

                events.push(RuntimeEvent::TurnCompleted { usage: None });
                events
            }
            _ => {
                vec![RuntimeEvent::RawLog {
                    stream: "stdout".into(),
                    line: trimmed.into(),
                }]
            }
        }
    }

    fn format_input(&self, message: &OutboundMessage) -> AppResult<Vec<u8>> {
        // Claude stream-json input format
        let input = serde_json::json!({
            "type": "user",
            "content": message.content,
        });
        let mut bytes = serde_json::to_vec(&input)?;
        bytes.push(b'\n');
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command_basic() {
        let runtime = ClaudeRuntime::new(None);
        let spec = runtime.build_command("hello", Some("/tmp"), None, None, None).unwrap();

        assert_eq!(spec.program, "claude");
        assert!(spec.args.contains(&"-p".into()));
        assert!(spec.args.contains(&"hello".into()));
        assert!(spec.args.contains(&"--output-format".into()));
        assert!(spec.args.contains(&"stream-json".into()));
        assert_eq!(spec.work_dir, Some("/tmp".into()));
    }

    #[test]
    fn test_build_command_with_options() {
        let runtime = ClaudeRuntime::new(Some("/usr/bin/claude".into()));
        let tools = vec!["Bash".into(), "Read".into()];
        let spec = runtime.build_command("test", None, Some(5), Some(&tools), None).unwrap();

        assert_eq!(spec.program, "/usr/bin/claude");
        assert!(spec.args.contains(&"--max-turns".into()));
        assert!(spec.args.contains(&"5".into()));
        assert!(spec.args.contains(&"--allowedTools".into()));
        assert!(spec.args.contains(&"Bash,Read".into()));
    }

    #[test]
    fn test_parse_assistant_message() {
        let runtime = ClaudeRuntime::new(None);
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hello world"}]}}"#;
        let events = runtime.parse_output_line(line);

        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::Message { role, content } => {
                assert_eq!(role, "assistant");
                assert_eq!(content, "Hello world");
            }
            _ => panic!("Expected Message event"),
        }
    }

    #[test]
    fn test_parse_tool_use() {
        let runtime = ClaudeRuntime::new(None);
        let line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}"#;
        let events = runtime.parse_output_line(line);

        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::ToolCall { tool, args } => {
                assert_eq!(tool, "Bash");
                assert_eq!(args["command"], "ls");
            }
            _ => panic!("Expected ToolCall event"),
        }
    }

    #[test]
    fn test_parse_result() {
        let runtime = ClaudeRuntime::new(None);
        let line = r#"{"type":"result","result":"Done","total_cost_usd":0.05,"num_turns":2}"#;
        let events = runtime.parse_output_line(line);

        assert!(events.len() >= 2);
        assert!(events.iter().any(|e| matches!(e, RuntimeEvent::Cost { usd } if (*usd - 0.05).abs() < f64::EPSILON)));
        assert!(events.iter().any(|e| matches!(e, RuntimeEvent::TurnCompleted { .. })));
    }

    #[test]
    fn test_parse_invalid_json() {
        let runtime = ClaudeRuntime::new(None);
        let events = runtime.parse_output_line("not json");

        assert_eq!(events.len(), 1);
        assert!(matches!(&events[0], RuntimeEvent::RawLog { .. }));
    }

    #[test]
    fn test_parse_empty_line() {
        let runtime = ClaudeRuntime::new(None);
        let events = runtime.parse_output_line("");
        assert!(events.is_empty());
    }
}
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test runtime::claude
```

Expected: 7 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/runtime/claude.rs
git commit -m "feat: add Claude CLI runtime adapter with JSONL parser"
```

---

### Task 3: Codex CLI 어댑터

**Files:**
- Create: `src-tauri/src/runtime/codex.rs`

- [ ] **Step 1: Codex 어댑터 구현**

`src-tauri/src/runtime/codex.rs`:

```rust
use crate::AppResult;
use super::adapter::*;

pub struct CodexRuntime {
    pub cli_path: String,
}

impl CodexRuntime {
    pub fn new(cli_path: Option<String>) -> Self {
        Self {
            cli_path: cli_path.unwrap_or_else(|| "codex".into()),
        }
    }
}

impl AgentRuntime for CodexRuntime {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Codex
    }

    fn build_command(
        &self,
        prompt: &str,
        work_dir: Option<&str>,
        _max_turns: Option<u32>,
        _allowed_tools: Option<&[String]>,
        extra_args: Option<&[String]>,
    ) -> AppResult<CommandSpec> {
        let mut args = vec![
            "exec".into(),
            "--json".into(),
            "--sandbox".into(),
            "workspace-write".into(),
            "--ephemeral".into(),
            "--ignore-user-config".into(),
            "--skip-git-repo-check".into(),
        ];

        if let Some(dir) = work_dir {
            args.push("-C".into());
            args.push(dir.into());
        }

        if let Some(extra) = extra_args {
            args.extend(extra.iter().cloned());
        }

        args.push(prompt.into());

        Ok(CommandSpec {
            program: self.cli_path.clone(),
            args,
            work_dir: None, // Codex uses -C flag instead
            env: vec![],
        })
    }

    fn parse_output_line(&self, line: &str) -> Vec<RuntimeEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return vec![];
        }

        let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                return vec![RuntimeEvent::RawLog {
                    stream: "stdout".into(),
                    line: trimmed.into(),
                }];
            }
        };

        let event_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match event_type {
            "thread.started" => {
                let thread_id = parsed
                    .get("thread_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                vec![RuntimeEvent::SessionStarted {
                    session_id: thread_id,
                }]
            }
            "turn.started" => vec![RuntimeEvent::TurnStarted],
            "turn.completed" => {
                let usage = parsed.get("usage").and_then(|u| {
                    Some(TokenUsage {
                        input_tokens: u.get("input_tokens")?.as_i64()?,
                        cached_input_tokens: u
                            .get("cached_input_tokens")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0),
                        output_tokens: u.get("output_tokens")?.as_i64()?,
                        reasoning_output_tokens: u
                            .get("reasoning_output_tokens")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0),
                    })
                });
                vec![RuntimeEvent::TurnCompleted { usage }]
            }
            "item.started" => {
                let item = &parsed["item"];
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match item_type {
                    "command_execution" => {
                        let command = item
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        vec![RuntimeEvent::CommandStarted { command }]
                    }
                    _ => vec![],
                }
            }
            "item.completed" => {
                let item = &parsed["item"];
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match item_type {
                    "agent_message" => {
                        let text = item
                            .get("text")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        vec![RuntimeEvent::Message {
                            role: "assistant".into(),
                            content: text,
                        }]
                    }
                    "command_execution" => {
                        let command = item
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let exit_code = item
                            .get("exit_code")
                            .and_then(|v| v.as_i64())
                            .map(|v| v as i32);
                        let output = item
                            .get("output")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let mut events = vec![];
                        if !output.is_empty() {
                            events.push(RuntimeEvent::CommandOutput {
                                command: command.clone(),
                                output,
                            });
                        }
                        events.push(RuntimeEvent::CommandCompleted {
                            command,
                            exit_code,
                        });
                        events
                    }
                    _ => vec![],
                }
            }
            _ => {
                vec![RuntimeEvent::RawLog {
                    stream: "stdout".into(),
                    line: trimmed.into(),
                }]
            }
        }
    }

    fn format_input(&self, message: &OutboundMessage) -> AppResult<Vec<u8>> {
        // Codex exec doesn't support stdin input in the same way
        // For follow-up, use `codex exec resume <session_id>`
        let mut bytes = message.content.as_bytes().to_vec();
        bytes.push(b'\n');
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command_basic() {
        let runtime = CodexRuntime::new(None);
        let spec = runtime.build_command("hello", Some("/tmp/project"), None, None, None).unwrap();

        assert_eq!(spec.program, "codex");
        assert!(spec.args.contains(&"exec".into()));
        assert!(spec.args.contains(&"--json".into()));
        assert!(spec.args.contains(&"--sandbox".into()));
        assert!(spec.args.contains(&"-C".into()));
        assert!(spec.args.contains(&"/tmp/project".into()));
        assert!(spec.args.contains(&"hello".into()));
    }

    #[test]
    fn test_parse_thread_started() {
        let runtime = CodexRuntime::new(None);
        let line = r#"{"type":"thread.started","thread_id":"abc-123"}"#;
        let events = runtime.parse_output_line(line);

        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::SessionStarted { session_id } => assert_eq!(session_id, "abc-123"),
            _ => panic!("Expected SessionStarted"),
        }
    }

    #[test]
    fn test_parse_turn_completed_with_usage() {
        let runtime = CodexRuntime::new(None);
        let line = r#"{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":500,"output_tokens":200,"reasoning_output_tokens":50}}"#;
        let events = runtime.parse_output_line(line);

        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::TurnCompleted { usage: Some(u) } => {
                assert_eq!(u.input_tokens, 1000);
                assert_eq!(u.cached_input_tokens, 500);
                assert_eq!(u.output_tokens, 200);
                assert_eq!(u.reasoning_output_tokens, 50);
            }
            _ => panic!("Expected TurnCompleted with usage"),
        }
    }

    #[test]
    fn test_parse_command_execution() {
        let runtime = CodexRuntime::new(None);

        let started = r#"{"type":"item.started","item":{"type":"command_execution","command":"bash -lc ls"}}"#;
        let events = runtime.parse_output_line(started);
        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::CommandStarted { command } => assert_eq!(command, "bash -lc ls"),
            _ => panic!("Expected CommandStarted"),
        }

        let completed = r#"{"type":"item.completed","item":{"type":"command_execution","command":"bash -lc ls","exit_code":0,"output":"file1\nfile2"}}"#;
        let events = runtime.parse_output_line(completed);
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[0], RuntimeEvent::CommandOutput { .. }));
        assert!(matches!(&events[1], RuntimeEvent::CommandCompleted { exit_code: Some(0), .. }));
    }

    #[test]
    fn test_parse_agent_message() {
        let runtime = CodexRuntime::new(None);
        let line = r#"{"type":"item.completed","item":{"type":"agent_message","text":"I have completed the task."}}"#;
        let events = runtime.parse_output_line(line);

        assert_eq!(events.len(), 1);
        match &events[0] {
            RuntimeEvent::Message { role, content } => {
                assert_eq!(role, "assistant");
                assert_eq!(content, "I have completed the task.");
            }
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_parse_turn_started() {
        let runtime = CodexRuntime::new(None);
        let events = runtime.parse_output_line(r#"{"type":"turn.started"}"#);
        assert_eq!(events.len(), 1);
        assert!(matches!(&events[0], RuntimeEvent::TurnStarted));
    }
}
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test runtime::codex
```

Expected: 6 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/runtime/codex.rs
git commit -m "feat: add Codex CLI runtime adapter with JSONL parser"
```

---

### Task 4: Runtime Registry

**Files:**
- Create: `src-tauri/src/runtime/registry.rs`

- [ ] **Step 1: Registry 구현**

`src-tauri/src/runtime/registry.rs`:

```rust
use std::collections::HashMap;
use std::sync::Arc;

use super::adapter::{AgentRuntime, RuntimeKind};
use super::claude::ClaudeRuntime;
use super::codex::CodexRuntime;

pub struct RuntimeRegistry {
    runtimes: HashMap<RuntimeKind, Arc<dyn AgentRuntime>>,
}

impl RuntimeRegistry {
    pub fn new(claude_path: Option<String>, codex_path: Option<String>) -> Self {
        let mut runtimes: HashMap<RuntimeKind, Arc<dyn AgentRuntime>> = HashMap::new();
        runtimes.insert(
            RuntimeKind::Claude,
            Arc::new(ClaudeRuntime::new(claude_path)),
        );
        runtimes.insert(
            RuntimeKind::Codex,
            Arc::new(CodexRuntime::new(codex_path)),
        );
        Self { runtimes }
    }

    pub fn get(&self, kind: RuntimeKind) -> Option<Arc<dyn AgentRuntime>> {
        self.runtimes.get(&kind).cloned()
    }

    pub fn runtime_for(runtime_type: &str) -> RuntimeKind {
        match runtime_type {
            "claude_cli" => RuntimeKind::Claude,
            "codex_cli" => RuntimeKind::Codex,
            _ => RuntimeKind::Claude, // default fallback
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_lookup() {
        let registry = RuntimeRegistry::new(None, None);

        let claude = registry.get(RuntimeKind::Claude);
        assert!(claude.is_some());
        assert_eq!(claude.unwrap().kind(), RuntimeKind::Claude);

        let codex = registry.get(RuntimeKind::Codex);
        assert!(codex.is_some());
        assert_eq!(codex.unwrap().kind(), RuntimeKind::Codex);
    }

    #[test]
    fn test_runtime_for_mapping() {
        assert_eq!(RuntimeRegistry::runtime_for("claude_cli"), RuntimeKind::Claude);
        assert_eq!(RuntimeRegistry::runtime_for("codex_cli"), RuntimeKind::Codex);
        assert_eq!(RuntimeRegistry::runtime_for("unknown"), RuntimeKind::Claude);
    }
}
```

- [ ] **Step 2: 테스트 실행**

```bash
cd src-tauri && cargo test runtime::registry
```

Expected: 2 tests passed

- [ ] **Step 3: 커밋**

```bash
git add src-tauri/src/runtime/registry.rs
git commit -m "feat: add runtime registry for CLI adapter lookup"
```

---

### Task 5: Process I/O (async line reader)

**Files:**
- Create: `src-tauri/src/process/mod.rs`
- Create: `src-tauri/src/process/io.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod process;`)

- [ ] **Step 1: 모듈 선언**

`src-tauri/src/process/mod.rs`:

```rust
pub mod io;
pub mod registry;
pub mod manager;
pub mod supervisor;
```

- [ ] **Step 2: Async line reader**

`src-tauri/src/process/io.rs`:

```rust
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::ChildStdout;
use tokio::sync::mpsc;

/// Reads lines from a child process stdout and sends them to a channel.
/// Returns when the stream is closed (process exits or stdout is dropped).
pub async fn stream_lines(
    stdout: ChildStdout,
    tx: mpsc::UnboundedSender<String>,
) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(line).is_err() {
            break; // receiver dropped
        }
    }
}

/// Reads stderr lines and sends them with a "stderr:" prefix.
pub async fn stream_stderr(
    stderr: tokio::process::ChildStderr,
    tx: mpsc::UnboundedSender<String>,
) {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(format!("stderr:{}", line)).is_err() {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::process::Command;

    #[tokio::test]
    async fn test_stream_lines_captures_output() {
        let mut child = Command::new("echo")
            .arg("hello world")
            .stdout(std::process::Stdio::piped())
            .spawn()
            .expect("failed to spawn echo");

        let stdout = child.stdout.take().unwrap();
        let (tx, mut rx) = mpsc::unbounded_channel();

        tokio::spawn(stream_lines(stdout, tx));

        let line = rx.recv().await;
        assert!(line.is_some());
        assert_eq!(line.unwrap().trim(), "hello world");

        child.wait().await.ok();
    }
}
```

- [ ] **Step 3: lib.rs에 모듈 등록**

```rust
mod process;
```

- [ ] **Step 4: 테스트 실행**

```bash
cd src-tauri && cargo test process::io
```

Expected: 1 test passed

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/process/ src-tauri/src/lib.rs
git commit -m "feat: add async line reader for CLI process stdout/stderr"
```

---

### Task 6: Process Registry + Manager

**Files:**
- Create: `src-tauri/src/process/registry.rs`
- Create: `src-tauri/src/process/manager.rs`
- Create: `src-tauri/src/process/supervisor.rs`

- [ ] **Step 1: Process Registry**

`src-tauri/src/process/registry.rs`:

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::process::Child;
use tokio::sync::mpsc;

/// Handle to a running agent process.
pub struct RunHandle {
    pub run_id: String,
    pub agent_id: String,
    pub child: Option<Child>,
    pub kill_tx: Option<mpsc::Sender<()>>,
}

/// Thread-safe registry of running processes.
pub struct ProcessRegistry {
    handles: Arc<RwLock<HashMap<String, RunHandle>>>,
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            handles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, run_id: String, handle: RunHandle) {
        self.handles.write().await.insert(run_id, handle);
    }

    pub async fn remove(&self, run_id: &str) -> Option<RunHandle> {
        self.handles.write().await.remove(run_id)
    }

    pub async fn contains(&self, run_id: &str) -> bool {
        self.handles.read().await.contains_key(run_id)
    }

    pub async fn active_count(&self) -> usize {
        self.handles.read().await.len()
    }

    pub async fn active_run_ids(&self) -> Vec<String> {
        self.handles.read().await.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_insert_and_remove() {
        let registry = ProcessRegistry::new();

        registry
            .insert(
                "run-1".into(),
                RunHandle {
                    run_id: "run-1".into(),
                    agent_id: "agent-1".into(),
                    child: None,
                    kill_tx: None,
                },
            )
            .await;

        assert!(registry.contains("run-1").await);
        assert_eq!(registry.active_count().await, 1);

        let handle = registry.remove("run-1").await;
        assert!(handle.is_some());
        assert!(!registry.contains("run-1").await);
    }
}
```

- [ ] **Step 2: Process Manager**

`src-tauri/src/process/manager.rs`:

```rust
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::mpsc;

use crate::runtime::adapter::{AgentRuntime, CommandSpec, RuntimeEvent};
use crate::db::{self, DbPool};
use super::io;
use super::registry::{ProcessRegistry, RunHandle};

pub struct ProcessManager {
    pub registry: Arc<ProcessRegistry>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(ProcessRegistry::new()),
        }
    }

    /// Spawn a CLI process and return a receiver for parsed RuntimeEvents.
    pub async fn spawn(
        &self,
        run_id: String,
        agent_id: String,
        runtime: Arc<dyn AgentRuntime>,
        spec: CommandSpec,
    ) -> Result<mpsc::UnboundedReceiver<RuntimeEvent>, crate::AppError> {
        let mut cmd = Command::new(&spec.program);
        cmd.args(&spec.args);

        if let Some(dir) = &spec.work_dir {
            cmd.current_dir(dir);
        }

        for (key, val) in &spec.env {
            cmd.env(key, val);
        }

        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.stdin(std::process::Stdio::piped());

        // On Windows, prevent console window from appearing
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = cmd.spawn().map_err(|e| crate::AppError::Internal {
            message: format!("Failed to spawn {}: {}", spec.program, e),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| crate::AppError::Internal {
            message: "Failed to capture stdout".into(),
        })?;

        let stderr = child.stderr.take().ok_or_else(|| crate::AppError::Internal {
            message: "Failed to capture stderr".into(),
        })?;

        // Channel for raw lines from stdout/stderr
        let (line_tx, mut line_rx) = mpsc::unbounded_channel::<String>();

        // Channel for parsed RuntimeEvents
        let (event_tx, event_rx) = mpsc::unbounded_channel::<RuntimeEvent>();

        // Spawn stdout reader
        let stdout_tx = line_tx.clone();
        tokio::spawn(io::stream_lines(stdout, stdout_tx));

        // Spawn stderr reader
        tokio::spawn(io::stream_stderr(stderr, line_tx));

        // Spawn parser task
        let runtime_clone = runtime.clone();
        tokio::spawn(async move {
            while let Some(line) = line_rx.recv().await {
                if line.starts_with("stderr:") {
                    let stderr_line = &line[7..];
                    let event = RuntimeEvent::RawLog {
                        stream: "stderr".into(),
                        line: stderr_line.into(),
                    };
                    if event_tx.send(event).is_err() {
                        break;
                    }
                } else {
                    let events = runtime_clone.parse_output_line(&line);
                    for event in events {
                        if event_tx.send(event).is_err() {
                            return;
                        }
                    }
                }
            }
        });

        // Kill channel
        let (kill_tx, _kill_rx) = mpsc::channel(1);

        // Store handle
        self.registry
            .insert(
                run_id.clone(),
                RunHandle {
                    run_id,
                    agent_id,
                    child: Some(child),
                    kill_tx: Some(kill_tx),
                },
            )
            .await;

        Ok(event_rx)
    }

    /// Kill a running process by run_id.
    pub async fn kill(&self, run_id: &str) -> Result<(), crate::AppError> {
        if let Some(mut handle) = self.registry.remove(run_id).await {
            if let Some(ref mut child) = handle.child {
                child.kill().await.map_err(|e| crate::AppError::Internal {
                    message: format!("Failed to kill process: {}", e),
                })?;
            }
            Ok(())
        } else {
            Err(crate::AppError::NotFound {
                entity: "run".into(),
                id: run_id.into(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::claude::ClaudeRuntime;
    use crate::runtime::adapter::CommandSpec;

    #[tokio::test]
    async fn test_spawn_echo_process() {
        let manager = ProcessManager::new();
        let runtime: Arc<dyn AgentRuntime> = Arc::new(ClaudeRuntime::new(None));

        let spec = CommandSpec {
            program: "echo".into(),
            args: vec!["hello from test".into()],
            work_dir: None,
            env: vec![],
        };

        let mut rx = manager
            .spawn("run-1".into(), "agent-1".into(), runtime, spec)
            .await
            .unwrap();

        // Should receive at least one event (RawLog since echo output isn't valid JSONL)
        let event = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
            .await
            .unwrap();
        assert!(event.is_some());

        // Cleanup
        assert!(manager.registry.contains("run-1").await);
    }
}
```

- [ ] **Step 3: Supervisor (minimal)**

`src-tauri/src/process/supervisor.rs`:

```rust
use std::sync::Arc;
use super::registry::ProcessRegistry;
use crate::db::DbPool;

/// Watches for process exits and updates DB status.
pub struct ProcessSupervisor {
    registry: Arc<ProcessRegistry>,
}

impl ProcessSupervisor {
    pub fn new(registry: Arc<ProcessRegistry>) -> Self {
        Self { registry }
    }

    /// Clean up all running processes (called on app shutdown).
    pub async fn shutdown_all(&self) {
        let run_ids = self.registry.active_run_ids().await;
        for run_id in run_ids {
            if let Some(mut handle) = self.registry.remove(&run_id).await {
                if let Some(ref mut child) = handle.child {
                    child.kill().await.ok();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::registry::RunHandle;

    #[tokio::test]
    async fn test_shutdown_all() {
        let registry = Arc::new(ProcessRegistry::new());
        registry
            .insert(
                "run-1".into(),
                RunHandle {
                    run_id: "run-1".into(),
                    agent_id: "a1".into(),
                    child: None,
                    kill_tx: None,
                },
            )
            .await;
        registry
            .insert(
                "run-2".into(),
                RunHandle {
                    run_id: "run-2".into(),
                    agent_id: "a2".into(),
                    child: None,
                    kill_tx: None,
                },
            )
            .await;

        let supervisor = ProcessSupervisor::new(registry.clone());
        supervisor.shutdown_all().await;

        assert_eq!(registry.active_count().await, 0);
    }
}
```

- [ ] **Step 4: 테스트 실행**

```bash
cd src-tauri && cargo test process
```

Expected: 4 tests passed (io: 1, registry: 1, manager: 1, supervisor: 1)

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/process/
git commit -m "feat: add process manager, registry, supervisor, and async I/O"
```

---

### Task 7: Tauri 이벤트 타입 + emit

**Files:**
- Create: `src-tauri/src/events/mod.rs`
- Create: `src-tauri/src/events/types.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod events;`)

- [ ] **Step 1: Events 모듈**

`src-tauri/src/events/mod.rs`:

```rust
pub mod types;
```

`src-tauri/src/events/types.rs`:

```rust
use serde::Serialize;
use crate::runtime::RuntimeEvent;

/// Event names for Tauri event system.
pub const EVENT_AGENT_OUTPUT: &str = "agent:output";
pub const EVENT_AGENT_STATUS: &str = "agent:status";
pub const EVENT_RUN_STARTED: &str = "run:started";
pub const EVENT_RUN_COMPLETED: &str = "run:completed";
pub const EVENT_RUN_FAILED: &str = "run:failed";
pub const EVENT_NEW_MESSAGE: &str = "message:new";

#[derive(Debug, Clone, Serialize)]
pub struct AgentOutputPayload {
    pub run_id: String,
    pub agent_id: String,
    pub event: RuntimeEvent,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentStatusPayload {
    pub agent_id: String,
    pub run_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunLifecyclePayload {
    pub run_id: String,
    pub agent_id: String,
    pub session_id: Option<String>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub error: Option<String>,
}
```

- [ ] **Step 2: lib.rs에 모듈 등록**

```rust
mod events;
```

- [ ] **Step 3: 빌드 확인**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: 커밋**

```bash
git add src-tauri/src/events/ src-tauri/src/lib.rs
git commit -m "feat: add Tauri event types for agent output and run lifecycle"
```

---

### Task 8: Run Commands (에이전트 실행 IPC)

**Files:**
- Create: `src-tauri/src/commands/run_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/app_state.rs` (ProcessManager, RuntimeRegistry 추가)
- Modify: `src-tauri/src/lib.rs` (setup에서 초기화, commands 등록)

- [ ] **Step 1: AppState 확장**

`src-tauri/src/app_state.rs`:

```rust
use crate::config::AppSettings;
use crate::db::DbPool;
use crate::process::manager::ProcessManager;
use crate::runtime::registry::RuntimeRegistry;

pub struct AppState {
    pub db: DbPool,
    pub settings: AppSettings,
    pub process_manager: ProcessManager,
    pub runtime_registry: RuntimeRegistry,
}
```

- [ ] **Step 2: Run commands**

`src-tauri/src/commands/run_commands.rs`:

```rust
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::{AppState, AppError};
use crate::db::{self, agents};
use crate::events::types::*;
use crate::runtime::registry::RuntimeRegistry;

#[derive(serde::Deserialize)]
pub struct StartRunInput {
    pub agent_id: String,
    pub prompt: String,
    pub session_id: Option<String>,
    pub work_directory: Option<String>,
    pub max_turns: Option<u32>,
    pub allowed_tools: Option<Vec<String>>,
}

#[tauri::command]
pub async fn start_agent_run(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartRunInput,
) -> Result<String, AppError> {
    // 1. Get agent info
    let agent = agents::get_by_id(&state.db, &input.agent_id).await?;

    // 2. Get runtime adapter
    let runtime_kind = RuntimeRegistry::runtime_for(&agent.runtime_type);
    let runtime = state
        .runtime_registry
        .get(runtime_kind)
        .ok_or_else(|| AppError::Config {
            message: format!("No runtime adapter for {}", agent.runtime_type),
        })?;

    // 3. Build command spec
    let spec = runtime.build_command(
        &input.prompt,
        input.work_directory.as_deref(),
        input.max_turns,
        input.allowed_tools.as_deref(),
        None,
    )?;

    // 4. Create agent_run record in DB
    let run_id = uuid::Uuid::new_v4().to_string();
    let cli_args_json = serde_json::to_string(&spec.args).unwrap_or_default();

    sqlx::query(
        "INSERT INTO agent_runs (id, agent_id, session_id, cli_command, cli_args, process_status)
         VALUES (?, ?, ?, ?, ?, 'starting')"
    )
    .bind(&run_id)
    .bind(&agent.id)
    .bind(&input.session_id)
    .bind(&spec.program)
    .bind(&cli_args_json)
    .execute(&state.db)
    .await?;

    // 5. Spawn process
    let mut event_rx = state
        .process_manager
        .spawn(run_id.clone(), agent.id.clone(), runtime, spec)
        .await?;

    // 6. Update status to running
    sqlx::query("UPDATE agent_runs SET process_status = 'running', started_at = datetime('now') WHERE id = ?")
        .bind(&run_id)
        .execute(&state.db)
        .await?;

    // Emit run started
    app.emit(EVENT_RUN_STARTED, RunLifecyclePayload {
        run_id: run_id.clone(),
        agent_id: agent.id.clone(),
        session_id: input.session_id.clone(),
        status: "running".into(),
        exit_code: None,
        error: None,
    }).ok();

    // 7. Spawn event forwarding task
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    let agent_id_clone = agent.id.clone();
    let db_pool = state.db.clone();
    let session_id = input.session_id.clone();

    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            // Emit to frontend
            app_clone.emit(EVENT_AGENT_OUTPUT, AgentOutputPayload {
                run_id: run_id_clone.clone(),
                agent_id: agent_id_clone.clone(),
                event: event.clone(),
            }).ok();

            // Store CLI log in DB
            match &event {
                crate::runtime::RuntimeEvent::RawLog { stream, line } => {
                    let log_id = uuid::Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO cli_logs (id, agent_run_id, stream, content, sequence)
                         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sequence), 0) + 1 FROM cli_logs WHERE agent_run_id = ?))"
                    )
                    .bind(&log_id)
                    .bind(&run_id_clone)
                    .bind(stream)
                    .bind(line)
                    .bind(&run_id_clone)
                    .execute(&db_pool)
                    .await
                    .ok();
                }
                _ => {}
            }
        }

        // Process ended — update DB
        sqlx::query(
            "UPDATE agent_runs SET process_status = 'completed', ended_at = datetime('now') WHERE id = ? AND process_status = 'running'"
        )
        .bind(&run_id_clone)
        .execute(&db_pool)
        .await
        .ok();

        app_clone.emit(EVENT_RUN_COMPLETED, RunLifecyclePayload {
            run_id: run_id_clone.clone(),
            agent_id: agent_id_clone,
            session_id,
            status: "completed".into(),
            exit_code: None,
            error: None,
        }).ok();
    });

    Ok(run_id)
}

#[tauri::command]
pub async fn stop_agent_run(
    app: AppHandle,
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), AppError> {
    state.process_manager.kill(&run_id).await?;

    sqlx::query(
        "UPDATE agent_runs SET process_status = 'cancelled', ended_at = datetime('now') WHERE id = ?"
    )
    .bind(&run_id)
    .execute(&state.db)
    .await?;

    app.emit(EVENT_RUN_COMPLETED, RunLifecyclePayload {
        run_id: run_id.clone(),
        agent_id: String::new(),
        session_id: None,
        status: "cancelled".into(),
        exit_code: None,
        error: None,
    }).ok();

    Ok(())
}

#[tauri::command]
pub async fn list_active_runs(
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    Ok(state.process_manager.registry.active_run_ids().await)
}
```

- [ ] **Step 3: commands/mod.rs 업데이트**

```rust
pub mod agent_commands;
pub mod workspace_commands;
pub mod message_commands;
pub mod run_commands;
```

- [ ] **Step 4: lib.rs setup 업데이트**

lib.rs의 `setup` 블록에서 AppState 생성 시 ProcessManager와 RuntimeRegistry도 추가:

```rust
use crate::process::manager::ProcessManager;
use crate::runtime::registry::RuntimeRegistry;

// ... inside setup ...
app_handle.manage(AppState {
    db: pool,
    settings: settings.clone(),
    process_manager: ProcessManager::new(),
    runtime_registry: RuntimeRegistry::new(
        settings.claude_cli_path.clone(),
        settings.codex_cli_path.clone(),
    ),
});
```

invoke_handler에 추가:
```rust
commands::run_commands::start_agent_run,
commands::run_commands::stop_agent_run,
commands::run_commands::list_active_runs,
```

- [ ] **Step 5: 프론트엔드 타입 업데이트**

`src/lib/tauri.ts`에 추가:

```ts
import { listen } from "@tauri-apps/api/event";

// Run types
export interface StartRunInput {
  agent_id: string;
  prompt: string;
  session_id?: string;
  work_directory?: string;
  max_turns?: number;
  allowed_tools?: string[];
}

export interface AgentOutputPayload {
  run_id: string;
  agent_id: string;
  event: Record<string, unknown>;
}

export interface RunLifecyclePayload {
  run_id: string;
  agent_id: string;
  session_id: string | null;
  status: string;
  exit_code: number | null;
  error: string | null;
}

// Add to api object
export const api = {
  // ... existing agent/workspace/channel/message methods ...
  runs: {
    start: (input: StartRunInput) => invoke<string>("start_agent_run", { input }),
    stop: (runId: string) => invoke<void>("stop_agent_run", { runId }),
    listActive: () => invoke<string[]>("list_active_runs"),
  },
};

// Event listeners
export const events = {
  onAgentOutput: (callback: (payload: AgentOutputPayload) => void) =>
    listen<AgentOutputPayload>("agent:output", (event) => callback(event.payload)),
  onRunStarted: (callback: (payload: RunLifecyclePayload) => void) =>
    listen<RunLifecyclePayload>("run:started", (event) => callback(event.payload)),
  onRunCompleted: (callback: (payload: RunLifecyclePayload) => void) =>
    listen<RunLifecyclePayload>("run:completed", (event) => callback(event.payload)),
};
```

- [ ] **Step 6: 빌드 확인**

```bash
cd src-tauri && cargo check
```

Expected: 컴파일 성공

- [ ] **Step 7: 전체 테스트**

```bash
cd src-tauri && cargo test --lib
```

Expected: 기존 20 + 신규 ~18 = 약 38 tests 전부 통과

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: add agent run commands with Tauri event streaming"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage**: RuntimeEvent, AgentRuntime trait, Claude/Codex 어댑터, 프로세스 spawn/kill, Tauri 이벤트 스트리밍, 프론트엔드 타입
- [x] **No placeholders**: 모든 코드 블록 완성
- [x] **Type consistency**: `RuntimeEvent`, `CommandSpec`, `AgentRuntime` 전체 일관
- [x] **Scope**: "CLI 런타임 + 프로세스 관리"에 집중, 오케스트레이션은 Plan 4

## Not in this plan

- Plan 3: Frontend (React UI)
- Plan 4: Orchestration (에이전트 간 통신, 권한 검증, 메시지 라우팅)
