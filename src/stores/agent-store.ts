import { create } from "zustand";
import { api, type Agent, type CreateAgentInput, type UpdateAgentInput } from "@/lib/tauri";

interface AgentState {
  agents: Agent[];
  activeRuns: Map<string, string>; // agentId -> runId
  activeRunChannels: Map<string, string>; // runId -> channelId

  fetchAgents: () => Promise<void>;
  createAgent: (input: CreateAgentInput) => Promise<Agent>;
  updateAgent: (id: string, input: UpdateAgentInput) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  setRunActive: (agentId: string, runId: string) => void;
  setRunInactive: (agentId: string) => void;
  setRunChannel: (runId: string, channelId: string) => void;
  clearRunChannel: (runId: string) => void;
  getAgentById: (id: string) => Agent | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeRuns: new Map(),
  activeRunChannels: new Map(),

  fetchAgents: async () => {
    try {
      const agents = await api.agents.list();
      set({ agents });
    } catch (error) {
      console.error("Failed to fetch agents", error);
      set({ agents: [] });
    }
  },

  createAgent: async (input) => {
    try {
      const agent = await api.agents.create(input);
      await get().fetchAgents();
      return agent;
    } catch (error) {
      console.error("Failed to create agent", error);
      throw error;
    }
  },

  updateAgent: async (id, input) => {
    try {
      const agent = await api.agents.update(id, input);
      await get().fetchAgents();
      return agent;
    } catch (error) {
      console.error("Failed to update agent", error);
      throw error;
    }
  },

  deleteAgent: async (id) => {
    try {
      await api.agents.delete(id);
      await get().fetchAgents();
    } catch (error) {
      console.error("Failed to delete agent", error);
      throw error;
    }
  },

  setRunActive: (agentId, runId) => {
    set((state) => {
      const runs = new Map(state.activeRuns);
      runs.set(agentId, runId);
      return { activeRuns: runs };
    });
  },

  setRunInactive: (agentId) => {
    set((state) => {
      const runs = new Map(state.activeRuns);
      runs.delete(agentId);
      return { activeRuns: runs };
    });
  },

  setRunChannel: (runId, channelId) => {
    set((state) => {
      const channels = new Map(state.activeRunChannels);
      channels.set(runId, channelId);
      return { activeRunChannels: channels };
    });
  },

  clearRunChannel: (runId) => {
    set((state) => {
      const channels = new Map(state.activeRunChannels);
      channels.delete(runId);
      return { activeRunChannels: channels };
    });
  },

  getAgentById: (id) => get().agents.find((a) => a.id === id),
}));
