import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { ChannelSidebar } from "@/components/channel/ChannelSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemberPanel } from "@/components/agent/MemberPanel";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { AgentCreationModal } from "@/components/agent/AgentCreationModal";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAgentStore } from "@/stores/agent-store";
import { useEffect } from "react";

export function AppLayout() {
  const { showMemberPanel, showTerminalPanel } = useUIStore();
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  useEffect(() => {
    fetchWorkspaces();
    fetchAgents();
  }, [fetchWorkspaces, fetchAgents]);

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <WorkspaceSidebar />
      <ChannelSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <ChatArea />
        {showTerminalPanel && <TerminalPanel />}
      </div>
      {showMemberPanel && <MemberPanel />}
      <AgentCreationModal />
    </div>
  );
}
