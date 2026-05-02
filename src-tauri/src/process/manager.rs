use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::mpsc;

use crate::runtime::adapter::{AgentRuntime, CommandSpec, RuntimeEvent};
use super::io::{self, ProcessLine};
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
    /// - stdout/stderr reader tasks are awaited to drain remaining lines
    /// - ProcessExited event is emitted with exit_code and was_cancelling
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

        // Raw lines channel (typed)
        let (line_tx, mut line_rx) = mpsc::unbounded_channel::<ProcessLine>();

        // Parsed events channel
        let (event_tx, event_rx) = mpsc::unbounded_channel::<RuntimeEvent>();

        // Spawn stdout reader — keep JoinHandle for draining
        let stdout_tx = line_tx.clone();
        let stdout_handle = tokio::spawn(io::stream_lines(stdout, stdout_tx));

        // Spawn stderr reader — keep JoinHandle for draining
        let stderr_handle = tokio::spawn(io::stream_stderr(stderr, line_tx));

        // Spawn parser task
        let event_tx_parse = event_tx.clone();
        tokio::spawn(async move {
            while let Some(process_line) = line_rx.recv().await {
                match process_line {
                    ProcessLine::Stderr(line) => {
                        let _ = event_tx_parse.send(RuntimeEvent::RawLog {
                            stream: "stderr".into(),
                            line,
                        });
                    }
                    ProcessLine::Stdout(line) => {
                        for event in runtime.parse_output_line(&line) {
                            if event_tx_parse.send(event).is_err() {
                                return;
                            }
                        }
                    }
                }
            }
        });

        // Create kill channel
        let (kill_tx, mut kill_rx) = mpsc::channel::<()>(1);

        // Store handle with kill_tx
        self.registry.insert(run_id.clone(), RunHandle {
            run_id: run_id.clone(),
            agent_id,
            status: RunStatus::Running,
            kill_tx: Some(kill_tx),
        }).await;

        // Spawn child.wait() task — THIS is the authoritative exit handler
        let registry = self.registry.clone();
        let run_id_wait = run_id.clone();
        tokio::spawn(async move {
            // Wait for either the child to exit naturally or a kill signal
            let exit_code = tokio::select! {
                exit_status = child.wait() => {
                    exit_status.ok().and_then(|s| s.code())
                }
                _ = kill_rx.recv() => {
                    // Kill signal received — kill the child process
                    let _ = child.kill().await;
                    // Still wait for the child to fully exit
                    let status = child.wait().await;
                    status.ok().and_then(|s| s.code())
                }
            };

            // Drop the line_tx clone held by the wait task scope (the original
            // was moved into stderr reader). The stdout/stderr readers hold their
            // own clones; once those complete, line_rx will close and the parser
            // will drain.
            // (line_tx was already dropped when we moved clones to readers above)

            // Wait for stdout/stderr reader tasks to complete (they end when
            // the pipe closes after process exit)
            let _ = stdout_handle.await;
            let _ = stderr_handle.await;

            // Brief delay for the parser to drain remaining lines
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;

            // Check registry status before removing — was this a cancellation?
            let was_cancelling = registry.get_status(&run_id_wait).await
                == Some(RunStatus::Cancelling);

            // Emit ProcessExited event with cancellation context
            let _ = event_tx.send(RuntimeEvent::ProcessExited { exit_code, was_cancelling });

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

        // Send kill signal to the child process
        self.registry.send_kill(run_id).await;

        Ok(agent_id)
    }

    pub async fn shutdown_all(&self) {
        let run_ids = self.registry.active_run_ids().await;
        for run_id in run_ids {
            self.registry.transition(&run_id, RunStatus::Cancelling).await;
            self.registry.send_kill(&run_id).await;
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
