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
  created_by_type: "user" | "agent";
  created_by_id: string;
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

// Run types
export interface StartRunInput {
  agent_id: string;
  prompt: string;
  work_dir?: string;
  max_turns?: number;
  allowed_tools?: string[];
  extra_args?: string[];
}

export interface AgentOutputPayload {
  run_id: string;
  agent_id: string;
  event: Record<string, unknown>;
}

export interface RunLifecyclePayload {
  run_id: string;
  agent_id: string;
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
    create: (input: { name: string; description?: string; created_by_type: string; created_by_id: string }) =>
      invoke<Workspace>("create_workspace", { input }),
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
