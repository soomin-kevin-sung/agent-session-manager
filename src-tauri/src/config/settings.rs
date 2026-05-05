use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub database_path: String,
    pub claude_cli_path: Option<String>,
    pub codex_cli_path: Option<String>,
    pub language: String,
    pub default_sandbox_mode: String,
    pub process_timeout_secs: u64,
    pub max_log_size_mb: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            database_path: "agent-session-manager.db".into(),
            claude_cli_path: Some("claude".into()),
            codex_cli_path: Some("codex".into()),
            language: "system".into(),
            default_sandbox_mode: "workspace-write".into(),
            process_timeout_secs: 300,
            max_log_size_mb: 100,
        }
    }
}

pub fn settings_path(app_dir: &Path) -> std::path::PathBuf {
    app_dir.join("settings.json")
}

pub fn load_from_file(path: &Path) -> AppResult<AppSettings> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = std::fs::read_to_string(path).map_err(|error| AppError::Config {
        message: format!("Failed to read settings: {}", error),
    })?;
    serde_json::from_str(&content).map_err(Into::into)
}

pub fn save_to_file(path: &Path, settings: &AppSettings) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| AppError::Config {
            message: format!("Failed to create settings directory: {}", error),
        })?;
    }

    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, content).map_err(|error| AppError::Config {
        message: format!("Failed to write settings: {}", error),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_round_trip_to_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("settings.json");
        let settings = AppSettings {
            claude_cli_path: Some("custom-claude".into()),
            codex_cli_path: Some("custom-codex".into()),
            language: "ko".into(),
            ..AppSettings::default()
        };

        save_to_file(&path, &settings).unwrap();
        let loaded = load_from_file(&path).unwrap();

        assert_eq!(loaded.claude_cli_path, Some("custom-claude".into()));
        assert_eq!(loaded.codex_cli_path, Some("custom-codex".into()));
        assert_eq!(loaded.language, "ko");
    }
}
