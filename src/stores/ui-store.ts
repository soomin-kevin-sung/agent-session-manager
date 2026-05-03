import { create } from "zustand";

interface UIState {
  showMemberPanel: boolean;
  showTerminalPanel: boolean;
  showAgentCreationModal: boolean;
  showWorkspaceCreationModal: boolean;
  showSessionCreationModal: boolean;

  toggleMemberPanel: () => void;
  toggleTerminalPanel: () => void;
  setAgentCreationModal: (show: boolean) => void;
  setWorkspaceCreationModal: (show: boolean) => void;
  setSessionCreationModal: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showMemberPanel: true,
  showTerminalPanel: false,
  showAgentCreationModal: false,
  showWorkspaceCreationModal: false,
  showSessionCreationModal: false,

  toggleMemberPanel: () => set((s) => ({ showMemberPanel: !s.showMemberPanel })),
  toggleTerminalPanel: () => set((s) => ({ showTerminalPanel: !s.showTerminalPanel })),
  setAgentCreationModal: (show) => set({ showAgentCreationModal: show }),
  setWorkspaceCreationModal: (show) => set({ showWorkspaceCreationModal: show }),
  setSessionCreationModal: (show) => set({ showSessionCreationModal: show }),
}));
