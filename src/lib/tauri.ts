import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Agent types
export interface Agent {
  id: string;
  name: string;
  runtime_type: string;
  provider: string;
  model_name: string | null;
  persona: string | null;
  config: string | null;
  enabled: boolean;
  created_by_type: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  runtime_type: "claude_cli" | "codex_cli";
  provider: "anthropic" | "openai";
  model_name?: string;
  persona?: string;
  config?: string;
  permissions: string[];  // e.g. ["create_agent", "execute_cli", "create_session"]
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_by_type: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

// Channel types
export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  channel_type: "dm" | "group";
  created_at: string;
  updated_at: string;
}

// Message types
export interface Message {
  id: string;
  channel_id: string;
  sender_type: "user" | "agent" | "system";
  sender_user_id: string | null;
  sender_agent_id: string | null;
  content: string;
  message_type: string;
  status: string;
  metadata: string | null;
  parent_id: string | null;
  thread_root_id: string | null;
  created_at: string;
}

// Session types
export interface Session {
  id: string;
  workspace_id: string;
  channel_id: string;
  name: string;
  work_directory: string;
  git_branch: string | null;
  status: string;
  created_by_type: string;
  created_by_id: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionMember {
  session_id: string;
  agent_id: string;
  role: string;
  joined_at: string;
  left_at: string | null;
}

export interface CreateSessionInput {
  workspace_id: string;
  name: string;
  work_directory: string;
  agent_ids: string[];
}

// Permission types
export interface AgentPermission {
  id: string;
  agent_id: string;
  scope_type: string;
  scope_id: string | null;
  permission_type: string;
  granted_by_type: string;
  granted_by_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// Run types
export interface StartRunInput {
  agent_id: string;
  session_id?: string;
  channel_id?: string;
  prompt: string;
  work_dir?: string;
  max_turns?: number;
  allowed_tools?: string[];
  extra_args?: string[];
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
}

export type RuntimeEvent =
  | { event_type: "SessionStarted"; session_id: string }
  | { event_type: "TurnStarted" }
  | { event_type: "TurnCompleted"; usage: TokenUsage | null }
  | { event_type: "TurnFailed"; message: string }
  | { event_type: "Message"; role: string; content: string }
  | { event_type: "CommandStarted"; command: string }
  | { event_type: "CommandOutput"; command: string; output: string }
  | { event_type: "CommandCompleted"; command: string; exit_code: number | null }
  | { event_type: "ToolCall"; tool: string; args: JsonValue }
  | { event_type: "ToolResult"; tool: string; output: JsonValue; status: string }
  | { event_type: "Usage"; usage: TokenUsage }
  | { event_type: "Cost"; usd: number }
  | { event_type: "Error"; message: string }
  | { event_type: "RawLog"; stream: string; line: string }
  | { event_type: "ProcessExited"; exit_code: number | null; was_cancelling: boolean };

export interface AgentOutputPayload {
  run_id: string;
  agent_id: string;
  event: RuntimeEvent;
}

export interface RunLifecyclePayload {
  run_id: string;
  agent_id: string;
  channel_id?: string | null;
  exit_code: number | null;
  message: string | null;
}

// Event constants
export const EVENTS = {
  AGENT_OUTPUT: "agent:output",
  RUN_STARTED: "run:started",
  RUN_COMPLETED: "run:completed",
  RUN_FAILED: "run:failed",
  RUN_CANCELLED: "run:cancelled",
} as const;

// API functions
export const api = {
  agents: {
    create: (input: CreateAgentInput) => invoke<Agent>("create_agent", { input }),
    get: (id: string) => invoke<Agent>("get_agent", { id }),
    list: () => invoke<Agent[]>("list_agents"),
    delete: (id: string) => invoke<void>("delete_agent", { id }),
  },
  workspaces: {
    create: (name: string, description?: string) =>
      invoke<Workspace>("create_workspace", { name, description }),
    list: () => invoke<Workspace[]>("list_workspaces"),
  },
  channels: {
    create: (input: { workspace_id: string; name: string; channel_type: string }) =>
      invoke<Channel>("create_channel", { input }),
    list: (workspaceId: string) => invoke<Channel[]>("list_channels", { workspaceId }),
  },
  messages: {
    send: (input: {
      channel_id: string; sender_type: string;
      sender_user_id?: string; sender_agent_id?: string;
      content: string; message_type: string;
    }) => invoke<Message>("send_message", { input }),
    list: (channelId: string, limit?: number) =>
      invoke<Message[]>("list_messages", { channelId, limit }),
  },
  sessions: {
    create: (input: CreateSessionInput) => invoke<Session>("create_session", { input }),
    get: (id: string) => invoke<Session>("get_session", { id }),
    updateStatus: (id: string, status: string) => invoke<Session>("update_session_status", { id, status }),
    addMember: (sessionId: string, agentId: string, role: string) => invoke<void>("add_session_member", { sessionId, agentId, role }),
    listMembers: (sessionId: string) => invoke<SessionMember[]>("list_session_members", { sessionId }),
  },
  permissions: {
    check: (agentId: string, permissionType: string, scopeType: string, scopeId?: string) => invoke<boolean>("check_permission", { agentId, permissionType, scopeType, scopeId }),
    listForAgent: (agentId: string) => invoke<AgentPermission[]>("list_agent_permissions", { agentId }),
  },
  runs: {
    start: (input: StartRunInput) => invoke<string>("start_agent_run", { input }),
    stop: (runId: string) => invoke<void>("stop_agent_run", { runId }),
    listActive: () => invoke<string[]>("list_active_runs"),
  },
};

// Event listeners
export const events = {
  onAgentOutput: (handler: (payload: AgentOutputPayload) => void): Promise<UnlistenFn> =>
    listen<AgentOutputPayload>(EVENTS.AGENT_OUTPUT, (e) => handler(e.payload)),
  onRunStarted: (handler: (payload: RunLifecyclePayload) => void): Promise<UnlistenFn> =>
    listen<RunLifecyclePayload>(EVENTS.RUN_STARTED, (e) => handler(e.payload)),
  onRunCompleted: (handler: (payload: RunLifecyclePayload) => void): Promise<UnlistenFn> =>
    listen<RunLifecyclePayload>(EVENTS.RUN_COMPLETED, (e) => handler(e.payload)),
  onRunFailed: (handler: (payload: RunLifecyclePayload) => void): Promise<UnlistenFn> =>
    listen<RunLifecyclePayload>(EVENTS.RUN_FAILED, (e) => handler(e.payload)),
  onRunCancelled: (handler: (payload: RunLifecyclePayload) => void): Promise<UnlistenFn> =>
    listen<RunLifecyclePayload>(EVENTS.RUN_CANCELLED, (e) => handler(e.payload)),
};
