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
