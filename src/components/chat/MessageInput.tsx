import { useState, useCallback, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMessageStore } from "@/stores/message-store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const { t } = useTranslation();
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const [content, setContent] = useState("");

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    await sendMessage(channelId, trimmed);
  }, [content, channelId, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800 p-4">
      <div className="flex items-end gap-2 rounded-lg bg-zinc-800 px-3 py-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("message.placeholder")}
          className="min-h-[20px] flex-1 resize-none border-0 bg-transparent p-0 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:border-transparent"
          rows={1}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSend}
          disabled={!content.trim()}
          className="shrink-0 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
