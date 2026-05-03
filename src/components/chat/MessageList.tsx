import { useEffect, useRef } from "react";
import { EMPTY_MESSAGES, useMessageStore } from "@/stores/message-store";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { parseAgentIdFromDmChannelName } from "@/lib/channel-utils";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "@/components/chat/MessageItem";

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  const { t } = useTranslation();
  const messages = useMessageStore(
    (s) => s.messagesByChannel[channelId] ?? EMPTY_MESSAGES
  );
  const loading = useMessageStore((s) => s.loadingChannels.has(channelId));
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const activeRuns = useAgentStore((s) => s.activeRuns);
  const channel = useWorkspaceStore((s) =>
    s.channels.find((candidate) => candidate.id === channelId)
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const agentId =
    channel?.channel_type === "dm"
      ? parseAgentIdFromDmChannelName(channel.name)
      : null;
  const agentThinking = agentId ? activeRuns.has(agentId) : false;

  useEffect(() => {
    fetchMessages(channelId);
  }, [channelId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-zinc-800 border-t-emerald-400" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-0.5 p-4">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-20">
            <p className="text-sm text-zinc-500">{t("message.noMessages")}</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {agentThinking && (
          <div className="flex gap-3 rounded-md px-2 py-2">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-700">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center">
              <p className="text-sm text-zinc-400">{t("message.thinking")}</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
