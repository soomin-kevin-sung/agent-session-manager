import { create } from "zustand";
import { api, type Workspace, type Channel } from "@/lib/tauri";

interface WorkspaceState {
  workspaces: Workspace[];
  workspacesLoaded: boolean;
  workspaceLoadError: string | null;
  activeWorkspaceId: string | null;
  channels: Channel[];
  activeChannelId: string | null;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  setActiveChannel: (id: string) => void;
  goHome: () => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    name: string,
    description?: string
  ) => Promise<Workspace>;
  createChannel: (
    name: string,
    channelType: "dm" | "group",
    workspaceId?: string
  ) => Promise<Channel>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  workspacesLoaded: false,
  workspaceLoadError: null,
  activeWorkspaceId: null,
  channels: [],
  activeChannelId: null,

  fetchWorkspaces: async () => {
    try {
      const workspaces = await api.workspaces.list();
      const currentActiveId = get().activeWorkspaceId;

      if (workspaces.length === 0) {
        set({
          workspaces,
          workspacesLoaded: true,
          workspaceLoadError: null,
          activeWorkspaceId: null,
          activeChannelId: null,
          channels: [],
        });
        return;
      }

      set({ workspaces, workspacesLoaded: true, workspaceLoadError: null });
      if (currentActiveId === null) {
        await get().setActiveWorkspace(workspaces[0].id);
        return;
      }

      const activeExists = workspaces.some((w) => w.id === currentActiveId);
      if (!activeExists) {
        await get().setActiveWorkspace(workspaces[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces", error);
      set({
        workspaces: [],
        workspacesLoaded: true,
        workspaceLoadError: getErrorMessage(error, "Failed to fetch workspaces"),
        activeWorkspaceId: null,
        activeChannelId: null,
        channels: [],
      });
    }
  },

  setActiveWorkspace: async (id: string) => {
    set({ activeWorkspaceId: id, activeChannelId: null, channels: [] });
    try {
      const channels = await api.channels.list(id);
      if (get().activeWorkspaceId !== id) return;
      set({ channels });
      if (channels.length > 0) {
        set({ activeChannelId: channels[0].id });
      }
    } catch (error) {
      console.error("Failed to fetch channels", error);
      if (get().activeWorkspaceId === id) {
        set({ channels: [], activeChannelId: null });
      }
    }
  },

  setActiveChannel: (id: string) => set({ activeChannelId: id }),

  goHome: () => set({ activeWorkspaceId: null, activeChannelId: null, channels: [] }),

  createWorkspace: async (name, description) => {
    try {
      const ws = await api.workspaces.create(name, description);
      await get().fetchWorkspaces();
      await get().setActiveWorkspace(ws.id);
      return ws;
    } catch (error) {
      console.error("Failed to create workspace", error);
      throw error;
    }
  },

  updateWorkspace: async (id, name, description) => {
    try {
      const ws = await api.workspaces.update(id, name, description);
      set((state) => ({
        workspaces: state.workspaces.map((item) =>
          item.id === id ? ws : item
        ),
      }));
      return ws;
    } catch (error) {
      console.error("Failed to update workspace", error);
      throw error;
    }
  },

  createChannel: async (name, channelType, workspaceId) => {
    const wsId = workspaceId ?? get().activeWorkspaceId;
    if (!wsId) throw new Error("No active workspace");
    try {
      const ch = await api.channels.create({
        workspace_id: wsId,
        name,
        channel_type: channelType,
      });
      if (get().activeWorkspaceId === wsId) {
        await get().setActiveWorkspace(wsId);
      }
      return ch;
    } catch (error) {
      console.error("Failed to create channel", error);
      throw error;
    }
  },
}));
