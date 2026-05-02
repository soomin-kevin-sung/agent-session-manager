import { useEffect, useRef } from "react";
import { useMessageStore } from "@/stores/message-store";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "@/components/chat/MessageItem";

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  const { t } = useTranslation();
  const { messages, loading, fetchMessages } = useMessageStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(channelId);
  }, [channelId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
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
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
