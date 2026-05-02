use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

    CommandStarted { command: String },
    CommandOutput { command: String, output: String },
    CommandCompleted { command: String, exit_code: Option<i32> },

    ToolCall { tool: String, args: Value },
    ToolResult { tool: String, output: Value, status: String },

    Usage { usage: TokenUsage },
    Cost { usd: f64 },

    Error { message: String },
    RawLog { stream: String, line: String },

    /// Emitted by process manager when child exits
    ProcessExited { exit_code: Option<i32>, was_cancelling: bool },
}

/// Specification for spawning a CLI process.
#[derive(Debug, Clone)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub work_dir: Option<String>,
    pub env_vars: Vec<(String, String)>,
    pub env_clear: bool,
}

/// Trait that each CLI runtime must implement (one-shot execution).
pub trait AgentRuntime: Send + Sync {
    fn kind(&self) -> RuntimeKind;

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
}
