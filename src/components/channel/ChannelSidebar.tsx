import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAgentStore } from "@/stores/agent-store";
import { useUIStore } from "@/stores/ui-store";
import { useMessageStore } from "@/stores/message-store";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Hash, Plus, User } from "lucide-react";
import { useState } from "react";

export function ChannelSidebar() {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspaceId,
    channels,
    activeChannelId,
    setActiveChannel,
    createChannel,
  } = useWorkspaceStore();
  const { agents, activeRuns } = useAgentStore();
  const { setAgentCreationModal } = useUIStore();
  const { fetchMessages } = useMessageStore();

  const [dmOpen, setDmOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(true);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const dmChannels = channels.filter((c) => c.channel_type === "dm");
  const groupChannels = channels.filter((c) => c.channel_type === "group");

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId);
    fetchMessages(channelId);
  };

  const handleCreateChannel = async (type: "dm" | "group") => {
    if (type === "dm") {
      setAgentCreationModal(true);
    } else {
      const name = prompt(t("channel.name"));
      if (name) {
        const ch = await createChannel(name, "group");
        handleChannelClick(ch.id);
      }
    }
  };

  return (
    <div className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Workspace name header */}
      <div className="flex h-12 items-center border-b border-zinc-800 px-4">
        <h2 className="truncate text-sm font-bold text-zinc-100">
          {activeWorkspace?.name ?? t("app.title")}
        </h2>
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {/* DM Section */}
          <Collapsible open={dmOpen} onOpenChange={setDmOpen}>
            <div className="flex items-center justify-between px-1 py-1">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200">
                <ChevronDown
                  className={`size-3 transition-transform ${dmOpen ? "" : "-rotate-90"}`}
                />
                {t("channel.dm")}
              </CollapsibleTrigger>
              <button
                onClick={() => handleCreateChannel("dm")}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <CollapsibleContent>
              {dmChannels.map((ch) => {
                const isActive = ch.id === activeChannelId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-700/50 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <AgentStatusDot
                      agentName={ch.name}
                      agents={agents}
                      activeRuns={activeRuns}
                    />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Group Sessions Section */}
          <Collapsible open={sessionsOpen} onOpenChange={setSessionsOpen}>
            <div className="flex items-center justify-between px-1 py-1">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200">
                <ChevronDown
                  className={`size-3 transition-transform ${sessionsOpen ? "" : "-rotate-90"}`}
                />
                {t("channel.sessions")}
              </CollapsibleTrigger>
              <button
                onClick={() => handleCreateChannel("group")}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <CollapsibleContent>
              {groupChannels.map((ch) => {
                const isActive = ch.id === activeChannelId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-700/50 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <Hash className="size-4 shrink-0 text-zinc-500" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* User status bar */}
      <div className="flex items-center gap-2 border-t border-zinc-800 p-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-zinc-700">
          <User className="size-4 text-zinc-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">
            {t("common.user")}
          </p>
          <p className="text-xs text-emerald-400">{t("common.online")}</p>
        </div>
      </div>
    </div>
  );
}

function AgentStatusDot({
  agentName,
  agents,
  activeRuns,
}: {
  agentName: string;
  agents: { id: string; name: string }[];
  activeRuns: Map<string, string>;
}) {
  const agent = agents.find((a) => a.name === agentName);
  const isOnline = agent ? activeRuns.has(agent.id) : false;

  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <span
        className={`size-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-zinc-500"}`}
      />
    </span>
  );
}
