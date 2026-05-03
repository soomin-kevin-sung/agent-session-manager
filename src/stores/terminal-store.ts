import { create } from "zustand";

export interface TerminalLine {
  id: string;
  runId: string;
  agentId: string;
  timestamp: string;
  type: "stdout" | "stderr" | "system" | "command" | "error";
  content: string;
}

interface TerminalState {
  lines: TerminalLine[];
  activeRunIds: Set<string>;

  addLine: (line: TerminalLine) => void;
  clearLines: () => void;
  setRunActive: (runId: string) => void;
  setRunInactive: (runId: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  activeRunIds: new Set<string>(),

  addLine: (line) =>
    set((state) => {
      const next = [...state.lines, line];
      // Keep max 1000 lines to prevent unbounded memory growth
      return { lines: next.length > 1000 ? next.slice(-1000) : next };
    }),
  clearLines: () => set({ lines: [] }),
  setRunActive: (runId) =>
    set((state) => {
      const activeRunIds = new Set(state.activeRunIds);
      activeRunIds.add(runId);
      return { activeRunIds };
    }),
  setRunInactive: (runId) =>
    set((state) => {
      const activeRunIds = new Set(state.activeRunIds);
      activeRunIds.delete(runId);
      return { activeRunIds };
    }),
}));
