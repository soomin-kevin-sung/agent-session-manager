import { invoke } from "@tauri-apps/api/core";

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
};
