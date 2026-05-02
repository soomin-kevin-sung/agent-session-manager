use serde::{Deserialize, Serialize};

pub const EVENT_AGENT_OUTPUT: &str = "agent:output";
pub const EVENT_RUN_STARTED: &str = "run:started";
pub const EVENT_RUN_COMPLETED: &str = "run:completed";
pub const EVENT_RUN_FAILED: &str = "run:failed";
pub const EVENT_RUN_CANCELLED: &str = "run:cancelled";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutputPayload {
    pub run_id: String,
    pub agent_id: String,
    pub event: crate::runtime::RuntimeEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunLifecyclePayload {
    pub run_id: String,
    pub agent_id: String,
    pub exit_code: Option<i32>,
    pub message: Option<String>,
}
