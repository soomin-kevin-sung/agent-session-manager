import { create } from "zustand";
import { api, type Agent, type CreateAgentInput } from "@/lib/tauri";

interface AgentState {
  agents: Agent[];
  activeRuns: Map<string, string>; // agentId -> runId

  fetchAgents: () => Promise<void>;
  createAgent: (input: CreateAgentInput) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  setRunActive: (agentId: string, runId: string) => void;
  setRunInactive: (agentId: string) => void;
  getAgentById: (id: string) => Agent | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeRuns: new Map(),

  fetchAgents: async () => {
    const agents = await api.agents.list();
    set({ agents });
  },

  createAgent: async (input) => {
    const agent = await api.agents.create(input);
    await get().fetchAgents();
    return agent;
  },

  deleteAgent: async (id) => {
    await api.agents.delete(id);
    await get().fetchAgents();
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

  getAgentById: (id) => get().agents.find((a) => a.id === id),
}));
