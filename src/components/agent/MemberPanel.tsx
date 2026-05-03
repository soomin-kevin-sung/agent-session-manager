import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useMessageStore } from "@/stores/message-store";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Plus } from "lucide-react";

const AGENT_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-purple-600",
];

function getAgentColor(index: number) {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

export function MemberPanel() {
  const { t } = useTranslation();
  const { agents, activeRuns } = useAgentStore();
  const { channels, activeWorkspaceId, setActiveChannel, createChannel } =
    useWorkspaceStore();
  const { fetchMessages } = useMessageStore();
  const { setAgentCreationModal } = useUIStore();

  // Pending guard to prevent duplicate DM creation
  const pendingDm = useRef<Set<string>>(new Set());

  const onlineAgents = agents.filter((a) => activeRuns.has(a.id));
  const offlineAgents = agents.filter((a) => !activeRuns.has(a.id));

  // Find existing DM channel for an agent by checking channel name pattern "dm:<agentId>"
  // We use the convention: DM channel name = agent name, and channel_type = "dm"
  // To disambiguate same-name agents, we store agent.id in the DM channel name as "agent.name"
  // and match by iterating channel_members. But since we don't have channel_members in frontend,
  // we use a unique DM channel name convention: "<agentName> (#<agentId short>)"
  // Simpler approach: just use agent.id as part of channel name for uniqueness.

  const findDmChannel = useCallback(
    (agentId: string) => {
      return channels.find(
        (ch) => ch.channel_type === "dm" && ch.name.endsWith(`[${agentId}]`)
      );
    },
    [channels]
  );

  const openOrCreateDm = useCallback(
    async (agent: { id: string; name: string }) => {
      // Prevent duplicate creation
      if (pendingDm.current.has(agent.id)) return;

      const existing = findDmChannel(agent.id);
      if (existing) {
        setActiveChannel(existing.id);
        fetchMessages(existing.id);
        return;
      }

      pendingDm.current.add(agent.id);
      try {
        // Channel name includes agent id for uniqueness: "AgentName [agent-id]"
        const dmName = `${agent.name} [${agent.id}]`;
        const ch = await createChannel(dmName, "dm");

        // Guard: check workspace hasn't changed during await
        if (useWorkspaceStore.getState().activeWorkspaceId !== activeWorkspaceId) {
          return;
        }

        setActiveChannel(ch.id);
        fetchMessages(ch.id);
      } finally {
        pendingDm.current.delete(agent.id);
      }
    },
    [
      activeWorkspaceId,
      findDmChannel,
      setActiveChannel,
      fetchMessages,
      createChannel,
    ]
  );

  return (
    <div className="flex w-60 flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h3 className="text-sm font-semibold text-zinc-100">
          {t("agent.members")}
        </h3>
        <button
          onClick={() => setAgentCreationModal(true)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label={t("agent.create")}
        >
          <Plus className="size-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Online agents */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {t("common.online")} — {onlineAgents.length}
          </p>
          {onlineAgents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              name={agent.name}
              model={agent.model_name}
              runtime={agent.runtime_type}
              color={getAgentColor(i)}
              online
              onOpenDm={() => openOrCreateDm(agent)}
            />
          ))}

          {onlineAgents.length > 0 && offlineAgents.length > 0 && (
            <Separator className="my-3 bg-zinc-800" />
          )}

          {/* Offline agents */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {t("common.offline")} — {offlineAgents.length}
          </p>
          {offlineAgents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              name={agent.name}
              model={agent.model_name}
              runtime={agent.runtime_type}
              color={getAgentColor(onlineAgents.length + i)}
              online={false}
              onOpenDm={() => openOrCreateDm(agent)}
            />
          ))}

          {agents.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-500">
              {t("agent.noAgents")}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AgentCard({
  name,
  model,
  runtime,
  color,
  online,
  onOpenDm,
}: {
  name: string;
  model: string | null;
  runtime: string;
  color: string;
  online: boolean;
  onOpenDm: () => void;
}) {
  const { t } = useTranslation();
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div className="group mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/50">
      <div className="relative">
        <div
          className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white ${color} ${!online ? "opacity-50" : ""}`}
        >
          {initial}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-zinc-900 ${
            online ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${online ? "text-zinc-200" : "text-zinc-500"}`}
        >
          {name}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {runtime} {model ? `· ${model}` : ""}
        </p>
      </div>
      {/* Explicit DM button — visible on hover, keyboard accessible */}
      <button
        onClick={onOpenDm}
        className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
        aria-label={t("dm.openDm", { name })}
        title={t("dm.openDm", { name })}
      >
        <MessageSquare className="size-4" />
      </button>
    </div>
  );
}
