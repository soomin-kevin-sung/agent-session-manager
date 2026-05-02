import { useTranslation } from "react-i18next";
import { useAgentStore } from "@/stores/agent-store";
import type { Message } from "@/lib/tauri";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, Terminal } from "lucide-react";
import { useState } from "react";

const SENDER_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-purple-600",
  "bg-teal-600",
];

function hashColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const { t } = useTranslation();
  const getAgentById = useAgentStore((s) => s.getAgentById);

  // System messages
  if (message.sender_type === "system") {
    return (
      <div className="flex items-center gap-3 py-2">
        <Separator className="flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-500">{message.content}</span>
        <Separator className="flex-1 bg-zinc-800" />
      </div>
    );
  }

  const isAgent = message.sender_type === "agent";
  const agent = isAgent && message.sender_agent_id
    ? getAgentById(message.sender_agent_id)
    : null;
  const senderName = isAgent
    ? agent?.name ?? "Agent"
    : t("common.user");
  const senderId = message.sender_agent_id ?? message.sender_user_id ?? "u";
  const avatarColor = hashColor(senderId);
  const initial = senderName[0]?.toUpperCase() ?? "?";

  const hasCliLog = message.metadata != null;
  const messageType = message.message_type;
  const showBadge =
    messageType === "report" ||
    messageType === "review" ||
    messageType === "command";

  return (
    <div className="group flex gap-3 rounded-md px-2 py-1 hover:bg-zinc-800/50">
      {/* Avatar */}
      <div
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor}`}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            {senderName}
          </span>
          {showBadge && (
            <Badge variant="secondary" className="text-[10px] capitalize">
              {messageType}
            </Badge>
          )}
          <span className="text-xs text-zinc-500">
            {formatTime(message.created_at)}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-sm text-zinc-300">
          {message.content}
        </p>

        {hasCliLog && <CollapsibleCliLog metadata={message.metadata!} />}
      </div>
    </div>
  );
}

function CollapsibleCliLog({ metadata }: { metadata: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
        <ChevronRight
          className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Terminal className="size-3" />
        <span>CLI Log</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-zinc-950 p-2 font-mono text-xs text-zinc-400">
          {metadata}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
