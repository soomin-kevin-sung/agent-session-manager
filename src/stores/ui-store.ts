import { create } from "zustand";

interface UIState {
  showMemberPanel: boolean;
  showTerminalPanel: boolean;
  showAgentCreationModal: boolean;
  showWorkspaceCreationModal: boolean;
  showSessionCreationModal: boolean;
  showSettingsModal: boolean;
  editingAgentId: string | null;

  toggleMemberPanel: () => void;
  toggleTerminalPanel: () => void;
  setAgentCreationModal: (show: boolean) => void;
  setWorkspaceCreationModal: (show: boolean) => void;
  setSessionCreationModal: (show: boolean) => void;
  setSettingsModal: (show: boolean) => void;
  setEditingAgent: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showMemberPanel: true,
  showTerminalPanel: false,
  showAgentCreationModal: false,
  showWorkspaceCreationModal: false,
  showSessionCreationModal: false,
  showSettingsModal: false,
  editingAgentId: null,

  toggleMemberPanel: () => set((s) => ({ showMemberPanel: !s.showMemberPanel })),
  toggleTerminalPanel: () => set((s) => ({ showTerminalPanel: !s.showTerminalPanel })),
  setAgentCreationModal: (show) => set({ showAgentCreationModal: show }),
  setWorkspaceCreationModal: (show) => set({ showWorkspaceCreationModal: show }),
  setSessionCreationModal: (show) => set({ showSessionCreationModal: show }),
  setSettingsModal: (show) => set({ showSettingsModal: show }),
  setEditingAgent: (id) => set({ editingAgentId: id }),
}));
