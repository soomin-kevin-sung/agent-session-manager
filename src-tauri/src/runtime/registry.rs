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
        runtimes.insert(RuntimeKind::Claude, Arc::new(ClaudeRuntime::new(claude_path)));
        runtimes.insert(RuntimeKind::Codex, Arc::new(CodexRuntime::new(codex_path)));
        Self { runtimes }
    }

    pub fn get(&self, kind: RuntimeKind) -> Option<Arc<dyn AgentRuntime>> {
        self.runtimes.get(&kind).cloned()
    }

    /// Map a runtime_type string (from DB) to a RuntimeKind.
    pub fn runtime_for(runtime_type: &str) -> RuntimeKind {
        match runtime_type {
            "codex_cli" => RuntimeKind::Codex,
            _ => RuntimeKind::Claude, // default to Claude
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_lookup() {
        let registry = RuntimeRegistry::new(None, None);
        let claude = registry.get(RuntimeKind::Claude).unwrap();
        assert_eq!(claude.kind(), RuntimeKind::Claude);

        let codex = registry.get(RuntimeKind::Codex).unwrap();
        assert_eq!(codex.kind(), RuntimeKind::Codex);
    }

    #[test]
    fn test_runtime_for_mapping() {
        assert_eq!(RuntimeRegistry::runtime_for("claude_cli"), RuntimeKind::Claude);
        assert_eq!(RuntimeRegistry::runtime_for("codex_cli"), RuntimeKind::Codex);
        assert_eq!(RuntimeRegistry::runtime_for("unknown"), RuntimeKind::Claude);
    }
}
