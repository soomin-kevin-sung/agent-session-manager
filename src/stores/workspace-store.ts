import { create } from "zustand";
import { api, type Workspace, type Channel } from "@/lib/tauri";
import { useUIStore } from "@/stores/ui-store";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  channels: Channel[];
  activeChannelId: string | null;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  setActiveChannel: (id: string) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  createChannel: (name: string, channelType: "dm" | "group") => Promise<Channel>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  channels: [],
  activeChannelId: null,

  fetchWorkspaces: async () => {
    const workspaces = await api.workspaces.list();
    set({ workspaces });
    if (workspaces.length > 0 && !get().activeWorkspaceId) {
      await get().setActiveWorkspace(workspaces[0].id);
    }
    if (workspaces.length === 0) {
      useUIStore.getState().setWorkspaceCreationModal(true);
    }
  },

  setActiveWorkspace: async (id: string) => {
    set({ activeWorkspaceId: id, activeChannelId: null, channels: [] });
    const channels = await api.channels.list(id);
    // Guard: only update if this workspace is still active
    if (get().activeWorkspaceId !== id) return;
    set({ channels });
    if (channels.length > 0) {
      set({ activeChannelId: channels[0].id });
    }
  },

  setActiveChannel: (id: string) => set({ activeChannelId: id }),

  createWorkspace: async (name, description) => {
    const ws = await api.workspaces.create(name, description);
    await get().fetchWorkspaces();
    return ws;
  },

  createChannel: async (name, channelType) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) throw new Error("No active workspace");
    const ch = await api.channels.create({
      workspace_id: wsId,
      name,
      channel_type: channelType,
    });
    await get().setActiveWorkspace(wsId);
    return ch;
  },
}));
