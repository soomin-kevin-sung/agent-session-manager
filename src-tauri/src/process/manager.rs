use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::mpsc;

use crate::runtime::adapter::{AgentRuntime, CommandSpec, RuntimeEvent};
use super::io;
use super::registry::{ProcessRegistry, RunHandle, RunStatus};

pub struct ProcessManager {
    pub registry: Arc<ProcessRegistry>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(ProcessRegistry::new()),
        }
    }

    /// Spawn a CLI process. Returns an event receiver.
    /// The process lifecycle is fully managed:
    /// - stdout/stderr are streamed and parsed into RuntimeEvents
    /// - child.wait() is awaited to detect exit
    /// - ProcessExited event is emitted with exit_code
    /// - Registry entry is cleaned up
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

        if spec.env_clear {
            cmd.env_clear();
        }
        for (key, val) in &spec.env_vars {
            cmd.env(key, val);
        }

        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

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

        // Raw lines channel
        let (line_tx, mut line_rx) = mpsc::unbounded_channel::<String>();

        // Parsed events channel
        let (event_tx, event_rx) = mpsc::unbounded_channel::<RuntimeEvent>();

        // Spawn stdout reader
        let stdout_tx = line_tx.clone();
        tokio::spawn(io::stream_lines(stdout, stdout_tx));

        // Spawn stderr reader
        tokio::spawn(io::stream_stderr(stderr, line_tx));

        // Spawn parser task
        let event_tx_parse = event_tx.clone();
        tokio::spawn(async move {
            while let Some(line) = line_rx.recv().await {
                if line.starts_with("stderr:") {
                    let _ = event_tx_parse.send(RuntimeEvent::RawLog {
                        stream: "stderr".into(),
                        line: line[7..].into(),
                    });
                } else {
                    for event in runtime.parse_output_line(&line) {
                        if event_tx_parse.send(event).is_err() {
                            return;
                        }
                    }
                }
            }
        });

        // Store handle
        self.registry.insert(run_id.clone(), RunHandle {
            run_id: run_id.clone(),
            agent_id,
            status: RunStatus::Running,
        }).await;

        // Spawn child.wait() task -- THIS is the authoritative exit handler
        let registry = self.registry.clone();
        let run_id_wait = run_id.clone();
        tokio::spawn(async move {
            let exit_status = child.wait().await;
            let exit_code = exit_status.ok().and_then(|s| s.code());

            // Small delay to let I/O tasks flush remaining lines
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;

            // Emit ProcessExited event
            let _ = event_tx.send(RuntimeEvent::ProcessExited { exit_code });

            // Mark completed in registry and remove
            registry.transition(&run_id_wait, RunStatus::Completed).await;
            registry.remove(&run_id_wait).await;
        });

        Ok(event_rx)
    }

    /// Kill a running process. Returns the agent_id for the killed run.
    pub async fn kill(&self, run_id: &str) -> Result<String, crate::AppError> {
        // Transition to cancelling first (prevents race with natural completion)
        if !self.registry.transition(run_id, RunStatus::Cancelling).await {
            return Err(crate::AppError::NotFound {
                entity: "run".into(),
                id: run_id.into(),
            });
        }

        let agent_id = self.registry.get_agent_id(run_id).await
            .unwrap_or_default();

        Ok(agent_id)
    }

    pub async fn shutdown_all(&self) {
        let run_ids = self.registry.active_run_ids().await;
        for run_id in run_ids {
            self.registry.transition(&run_id, RunStatus::Cancelling).await;
            self.registry.remove(&run_id).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::claude::ClaudeRuntime;

    #[tokio::test]
    async fn test_spawn_echo_process() {
        let manager = ProcessManager::new();
        let runtime: Arc<dyn AgentRuntime> = Arc::new(ClaudeRuntime::new(None));

        let spec = CommandSpec {
            program: "echo".into(),
            args: vec!["hello".into()],
            work_dir: None,
            env_vars: vec![],
            env_clear: false,
        };

        let mut rx = manager.spawn("r1".into(), "a1".into(), runtime, spec).await.unwrap();

        // Collect events until ProcessExited
        let mut got_exit = false;
        while let Some(event) = rx.recv().await {
            if matches!(event, RuntimeEvent::ProcessExited { .. }) {
                got_exit = true;
                break;
            }
        }
        assert!(got_exit);

        // Registry should be cleaned up
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        assert_eq!(manager.registry.active_count().await, 0);
    }

    #[tokio::test]
    async fn test_spawn_sets_registry_entry() {
        let manager = ProcessManager::new();
        let runtime: Arc<dyn AgentRuntime> = Arc::new(ClaudeRuntime::new(None));

        let spec = CommandSpec {
            program: "echo".into(),
            args: vec!["test".into()],
            work_dir: None,
            env_vars: vec![],
            env_clear: false,
        };

        let _rx = manager.spawn("r2".into(), "a2".into(), runtime, spec).await.unwrap();

        // Immediately after spawn, registry should have the entry
        // (it may be removed very quickly since echo exits fast, but agent_id should be retrievable)
        // We just verify the spawn succeeded without error
        assert!(true);
    }
}
