import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { ChannelSidebar } from "@/components/channel/ChannelSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemberPanel } from "@/components/agent/MemberPanel";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { AgentCreationModal } from "@/components/agent/AgentCreationModal";
import { WorkspaceCreationModal } from "@/components/workspace/WorkspaceCreationModal";
import { HomeView } from "@/components/home/HomeView";
import { OnboardingPage } from "@/components/onboarding/OnboardingPage";
import { SessionCreationModal } from "@/components/session/SessionCreationModal";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAgentStore } from "@/stores/agent-store";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useEffect, useState } from "react";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";

function readOnboardingCompleted() {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  } catch (error) {
    console.error("Failed to read onboarding state", error);
    return false;
  }
}

export function AppLayout() {
  const { showMemberPanel, showTerminalPanel } = useUIStore();
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const [onboardingCompleted, setOnboardingCompleted] = useState(readOnboardingCompleted);

  useTauriEvents();

  useEffect(() => {
    void fetchWorkspaces();
    void fetchAgents();
  }, [fetchWorkspaces, fetchAgents]);

  useEffect(() => {
    const syncOnboardingState = () => {
      setOnboardingCompleted(readOnboardingCompleted());
    };

    window.addEventListener("storage", syncOnboardingState);
    window.addEventListener("onboarding-completed", syncOnboardingState);

    return () => {
      window.removeEventListener("storage", syncOnboardingState);
      window.removeEventListener("onboarding-completed", syncOnboardingState);
    };
  }, []);

  const workspacesLoaded = useWorkspaceStore((s) => s.workspacesLoaded);
  const workspaceLoadError = useWorkspaceStore((s) => s.workspaceLoadError);
  const isHome = activeWorkspaceId === null;
  const shouldShowOnboarding = workspacesLoaded && !onboardingCompleted && workspaces.length === 0;

  // Show nothing until workspaces are loaded to prevent onboarding flash
  if (!workspacesLoaded) {
    return <div className="dark h-screen min-h-[800px] w-screen min-w-[1280px] bg-zinc-950" />;
  }

  if (workspaceLoadError) {
    return (
      <div className="dark flex h-screen min-h-[800px] w-screen min-w-[1280px] items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="max-w-md rounded-md border border-red-900/60 bg-zinc-900 p-5 shadow-xl">
          <h1 className="text-base font-semibold text-red-300">
            Failed to load workspaces
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{workspaceLoadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark flex h-screen min-h-[800px] w-screen min-w-[1280px] overflow-hidden bg-zinc-950 text-zinc-100">
      {shouldShowOnboarding ? (
        <OnboardingPage />
      ) : (
        <>
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
        </>
      )}
      {/* Modals — always rendered once, controlled by store state */}
      <AgentCreationModal />
      <WorkspaceCreationModal />
      <SessionCreationModal />
    </div>
  );
}
