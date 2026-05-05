use super::adapter::*;
use crate::AppResult;

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
        model_name: Option<&str>,
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

        if let Some(model) = model_name {
            args.push("-m".into());
            args.push(model.into());
        }

        if let Some(extra) = extra_args {
            args.extend(extra.iter().cloned());
        }

        args.push(prompt.into());

        Ok(CommandSpec {
            program: self.cli_path.clone(),
            args,
            work_dir: None, // Codex uses -C flag
            env_vars: vec![
                ("CLAUDE_CODE_DISABLE_AUTO_MEMORY".into(), "1".into()),
            ],
            env_clear: false,
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
                let tid = parsed
                    .get("thread_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                vec![RuntimeEvent::SessionStarted {
                    session_id: tid.into(),
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
            "turn.failed" => {
                let msg = parsed
                    .get("message")
                    .or_else(|| parsed.get("error"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown failure")
                    .to_string();
                vec![RuntimeEvent::TurnFailed { message: msg }]
            }
            "error" => {
                let msg = parsed
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                vec![RuntimeEvent::Error { message: msg }]
            }
            "item.started" => {
                let item = &parsed["item"];
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match item_type {
                    "command_execution" => {
                        let cmd = item
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        vec![RuntimeEvent::CommandStarted { command: cmd }]
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
                        let cmd = item
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let exit_code = item
                            .get("exit_code")
                            .and_then(|v| v.as_i64())
                            .map(|v| v as i32);
                        // Accept both "aggregated_output" and "output" for version tolerance
                        let output = item
                            .get("aggregated_output")
                            .or_else(|| item.get("output"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let mut events = vec![];
                        if !output.is_empty() {
                            events.push(RuntimeEvent::CommandOutput {
                                command: cmd.clone(),
                                output,
                            });
                        }
                        events.push(RuntimeEvent::CommandCompleted {
                            command: cmd,
                            exit_code,
                        });
                        events
                    }
                    _ => vec![],
                }
            }
            // Preserve unknown structured events as RawLog
            _ => {
                vec![RuntimeEvent::RawLog {
                    stream: "stdout".into(),
                    line: trimmed.into(),
                }]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command() {
        let rt = CodexRuntime::new(None);
        let spec = rt
            .build_command("hello", Some("/tmp"), None, None, None, None)
            .unwrap();
        assert_eq!(spec.program, "codex");
        assert!(spec.args.contains(&"exec".into()));
        assert!(spec.args.contains(&"--json".into()));
        assert!(spec.args.contains(&"-C".into()));
        assert!(spec.args.contains(&"/tmp".into()));
    }

    #[test]
    fn test_build_command_with_model_name_before_prompt() {
        let rt = CodexRuntime::new(None);
        let spec = rt
            .build_command("hello", None, None, None, Some("gpt-5.2"), None)
            .unwrap();

        let model_index = spec
            .args
            .iter()
            .position(|arg| arg == "-m")
            .expect("Codex args should include -m");
        assert_eq!(
            spec.args.get(model_index + 1).map(String::as_str),
            Some("gpt-5.2")
        );
        assert!(
            model_index < spec.args.len() - 1,
            "model flag should be inserted before the prompt"
        );
        assert_eq!(spec.args.last().map(String::as_str), Some("hello"));
    }

    #[test]
    fn test_parse_thread_started() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(r#"{"type":"thread.started","thread_id":"abc"}"#);
        assert!(
            matches!(&events[0], RuntimeEvent::SessionStarted { session_id } if session_id == "abc")
        );
    }

    #[test]
    fn test_parse_turn_completed_with_usage() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"turn.completed","usage":{"input_tokens":1000,"output_tokens":200}}"#,
        );
        assert!(
            matches!(&events[0], RuntimeEvent::TurnCompleted { usage: Some(u) } if u.input_tokens == 1000)
        );
    }

    #[test]
    fn test_parse_agent_message() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"item.completed","item":{"type":"agent_message","text":"Done"}}"#,
        );
        assert!(matches!(&events[0], RuntimeEvent::Message { content, .. } if content == "Done"));
    }

    #[test]
    fn test_parse_command_with_aggregated_output() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"item.completed","item":{"type":"command_execution","command":"ls","exit_code":0,"aggregated_output":"file1\nfile2"}}"#
        );
        assert_eq!(events.len(), 2);
        assert!(
            matches!(&events[0], RuntimeEvent::CommandOutput { output, .. } if output == "file1\nfile2")
        );
        assert!(matches!(
            &events[1],
            RuntimeEvent::CommandCompleted {
                exit_code: Some(0),
                ..
            }
        ));
    }

    #[test]
    fn test_parse_command_with_output_fallback() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"item.completed","item":{"type":"command_execution","command":"ls","exit_code":0,"output":"fallback"}}"#
        );
        assert!(
            matches!(&events[0], RuntimeEvent::CommandOutput { output, .. } if output == "fallback")
        );
    }

    #[test]
    fn test_parse_turn_failed() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(r#"{"type":"turn.failed","message":"Auth error"}"#);
        assert!(
            matches!(&events[0], RuntimeEvent::TurnFailed { message } if message == "Auth error")
        );
    }

    #[test]
    fn test_parse_top_level_error() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(r#"{"type":"error","message":"Connection failed"}"#);
        assert!(
            matches!(&events[0], RuntimeEvent::Error { message } if message == "Connection failed")
        );
    }

    #[test]
    fn test_unknown_event_preserved_as_rawlog() {
        let rt = CodexRuntime::new(None);
        let events = rt.parse_output_line(r#"{"type":"item.updated","item":{"id":"x"}}"#);
        assert!(matches!(&events[0], RuntimeEvent::RawLog { .. }));
    }
}
