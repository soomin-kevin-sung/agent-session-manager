import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { ChannelSidebar } from "@/components/channel/ChannelSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemberPanel } from "@/components/agent/MemberPanel";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { AgentCreationModal } from "@/components/agent/AgentCreationModal";
import { WorkspaceCreationModal } from "@/components/workspace/WorkspaceCreationModal";
import { HomeView } from "@/components/home/HomeView";
import { SessionCreationModal } from "@/components/session/SessionCreationModal";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAgentStore } from "@/stores/agent-store";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useEffect, useRef } from "react";

export function AppLayout() {
  const { showMemberPanel, showTerminalPanel } = useUIStore();
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const hasAutoOpened = useRef(false);

  useTauriEvents();

  useEffect(() => {
    fetchWorkspaces();
    fetchAgents();
  }, [fetchWorkspaces, fetchAgents]);

  useEffect(() => {
    if (workspaces.length === 0 && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      useUIStore.getState().setWorkspaceCreationModal(true);
    }
  }, [workspaces]);

  const isHome = activeWorkspaceId === null;

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <WorkspaceSidebar />
      {isHome ? (
        <HomeView />
      ) : (
        <>
          <ChannelSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <ChatArea />
            {showTerminalPanel && <TerminalPanel />}
          </div>
          {showMemberPanel && <MemberPanel />}
        </>
      )}
      <AgentCreationModal />
      <WorkspaceCreationModal />
      <SessionCreationModal />
    </div>
  );
}
