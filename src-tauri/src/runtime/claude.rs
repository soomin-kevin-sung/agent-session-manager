use super::adapter::*;
use crate::AppResult;

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
            "--verbose".into(),
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
            "system" => {
                if let Some(sid) = parsed.get("session_id").and_then(|v| v.as_str()) {
                    vec![RuntimeEvent::SessionStarted {
                        session_id: sid.into(),
                    }]
                } else {
                    vec![]
                }
            }
            "assistant" => {
                let mut events = vec![];

                if let Some(arr) = parsed
                    .pointer("/message/content")
                    .and_then(|c| c.as_array())
                {
                    for block in arr {
                        let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        match block_type {
                            "text" => {
                                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                                    if !text.is_empty() {
                                        events.push(RuntimeEvent::Message {
                                            role: "assistant".into(),
                                            content: text.into(),
                                        });
                                    }
                                }
                            }
                            "tool_use" => {
                                let tool = block
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("unknown");
                                let args = block
                                    .get("input")
                                    .cloned()
                                    .unwrap_or(serde_json::Value::Null);
                                events.push(RuntimeEvent::ToolCall {
                                    tool: tool.into(),
                                    args,
                                });
                            }
                            _ => {}
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command_basic() {
        let rt = ClaudeRuntime::new(None);
        let spec = rt
            .build_command("hello", Some("/tmp"), None, None, None)
            .unwrap();
        assert_eq!(spec.program, "claude");
        assert!(spec.args.contains(&"-p".into()));
        assert!(spec.args.contains(&"stream-json".into()));
        assert_eq!(spec.work_dir, Some("/tmp".into()));
        assert!(!spec.env_clear);
    }

    #[test]
    fn test_build_command_with_options() {
        let rt = ClaudeRuntime::new(Some("/usr/bin/claude".into()));
        let tools = vec!["Bash".into(), "Read".into()];
        let spec = rt
            .build_command("test", None, Some(5), Some(&tools), None)
            .unwrap();
        assert_eq!(spec.program, "/usr/bin/claude");
        assert!(spec.args.contains(&"5".into()));
        assert!(spec.args.contains(&"Bash,Read".into()));
    }

    #[test]
    fn test_parse_assistant_text() {
        let rt = ClaudeRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}"#,
        );
        assert_eq!(events.len(), 1);
        assert!(matches!(&events[0], RuntimeEvent::Message { content, .. } if content == "Hello"));
    }

    #[test]
    fn test_parse_tool_use() {
        let rt = ClaudeRuntime::new(None);
        let events = rt.parse_output_line(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}"#
        );
        assert_eq!(events.len(), 1);
        assert!(matches!(&events[0], RuntimeEvent::ToolCall { tool, .. } if tool == "Bash"));
    }

    #[test]
    fn test_parse_result() {
        let rt = ClaudeRuntime::new(None);
        let events =
            rt.parse_output_line(r#"{"type":"result","result":"Done","total_cost_usd":0.05}"#);
        assert!(events.iter().any(
            |e| matches!(e, RuntimeEvent::Cost { usd } if (*usd - 0.05).abs() < f64::EPSILON)
        ));
        assert!(events
            .iter()
            .any(|e| matches!(e, RuntimeEvent::TurnCompleted { .. })));
        assert!(!events
            .iter()
            .any(|e| matches!(e, RuntimeEvent::Message { .. })));
    }

    #[test]
    fn test_parse_invalid_json_becomes_rawlog() {
        let rt = ClaudeRuntime::new(None);
        let events = rt.parse_output_line("not json");
        assert!(matches!(&events[0], RuntimeEvent::RawLog { .. }));
    }

    #[test]
    fn test_parse_empty_line() {
        let rt = ClaudeRuntime::new(None);
        assert!(rt.parse_output_line("").is_empty());
    }
}
