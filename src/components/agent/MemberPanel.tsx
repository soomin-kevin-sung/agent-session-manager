import { useTranslation } from "react-i18next";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useMessageStore } from "@/stores/message-store";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

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
  const { channels, setActiveChannel, createChannel } = useWorkspaceStore();
  const { fetchMessages } = useMessageStore();
  const { setAgentCreationModal } = useUIStore();

  const onlineAgents = agents.filter((a) => activeRuns.has(a.id));
  const offlineAgents = agents.filter((a) => !activeRuns.has(a.id));

  const handleAgentDoubleClick = async (agent: { id: string; name: string }) => {
    // Check if DM channel already exists
    const existing = channels.find(
      (ch) => ch.channel_type === "dm" && ch.name === agent.name
    );

    if (existing) {
      // Open existing DM
      setActiveChannel(existing.id);
      fetchMessages(existing.id);
    } else {
      // Create new DM channel and open it
      const ch = await createChannel(agent.name, "dm");
      setActiveChannel(ch.id);
      fetchMessages(ch.id);
    }
  };

  return (
    <div className="flex w-60 flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h3 className="text-sm font-semibold text-zinc-100">
          {t("agent.members")}
        </h3>
        <button
          onClick={() => setAgentCreationModal(true)}
          className="text-zinc-400 hover:text-zinc-200"
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
              onDoubleClick={() => handleAgentDoubleClick(agent)}
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
              onDoubleClick={() => handleAgentDoubleClick(agent)}
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
  onDoubleClick,
}: {
  name: string;
  model: string | null;
  runtime: string;
  color: string;
  online: boolean;
  onDoubleClick: () => void;
}) {
  const { t } = useTranslation();
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/50"
      onDoubleClick={onDoubleClick}
      title={t("dm.doubleClickToOpen")}
    >
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
    </div>
  );
}
