use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Run status for process registry (internal use).
#[derive(Debug, Clone, PartialEq)]
pub enum RunStatus {
    Running,
    Cancelling,
    Completed,
}

pub struct RunHandle {
    pub run_id: String,
    pub agent_id: String,
    pub status: RunStatus,
    pub kill_tx: Option<tokio::sync::mpsc::Sender<()>>,
}

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

    /// Atomically transition status. Returns true if transition was valid.
    pub async fn transition(&self, run_id: &str, to: RunStatus) -> bool {
        let mut map = self.handles.write().await;
        if let Some(handle) = map.get_mut(run_id) {
            let valid = match (&handle.status, &to) {
                (RunStatus::Running, RunStatus::Cancelling) => true,
                (RunStatus::Running, RunStatus::Completed) => true,
                (RunStatus::Cancelling, RunStatus::Completed) => true,
                _ => false,
            };
            if valid {
                handle.status = to;
            }
            valid
        } else {
            false
        }
    }

    pub async fn get_status(&self, run_id: &str) -> Option<RunStatus> {
        self.handles.read().await.get(run_id).map(|h| h.status.clone())
    }

    pub async fn get_agent_id(&self, run_id: &str) -> Option<String> {
        self.handles.read().await.get(run_id).map(|h| h.agent_id.clone())
    }

    pub async fn active_count(&self) -> usize {
        self.handles.read().await.len()
    }

    /// Send kill signal to a running process. Returns true if the signal was sent.
    pub async fn send_kill(&self, run_id: &str) -> bool {
        let map = self.handles.read().await;
        if let Some(handle) = map.get(run_id) {
            if let Some(ref tx) = handle.kill_tx {
                return tx.try_send(()).is_ok();
            }
        }
        false
    }

    pub async fn active_run_ids(&self) -> Vec<String> {
        self.handles.read().await.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_state_transitions() {
        let registry = ProcessRegistry::new();
        registry.insert("r1".into(), RunHandle {
            run_id: "r1".into(),
            agent_id: "a1".into(),
            status: RunStatus::Running,
            kill_tx: None,
        }).await;

        // Valid: Running -> Cancelling
        assert!(registry.transition("r1", RunStatus::Cancelling).await);
        assert_eq!(registry.get_status("r1").await, Some(RunStatus::Cancelling));

        // Valid: Cancelling -> Completed
        assert!(registry.transition("r1", RunStatus::Completed).await);

        // Invalid: Completed -> Running
        assert!(!registry.transition("r1", RunStatus::Running).await);

        // Agent ID retrieval
        assert_eq!(registry.get_agent_id("r1").await, Some("a1".into()));

        // Non-existent run
        assert!(!registry.transition("r2", RunStatus::Cancelling).await);
    }
}
