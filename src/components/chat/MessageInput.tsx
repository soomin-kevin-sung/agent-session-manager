import { useState, useCallback, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMessageStore } from "@/stores/message-store";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { api } from "@/lib/tauri";
import { parseAgentIdFromDmChannelName } from "@/lib/channel-utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const { t } = useTranslation();
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const addSystemMessage = useMessageStore((s) => s.addSystemMessage);
  const setRunActive = useAgentStore((s) => s.setRunActive);
  const setRunChannel = useAgentStore((s) => s.setRunChannel);
  const channels = useWorkspaceStore((s) => s.channels);
  const [content, setContent] = useState("");
  const [error, setError] = useState(false);

  const startAgentRun = useCallback(
    async (prompt: string) => {
      const channel = channels.find((ch) => ch.id === channelId);
      if (channel?.channel_type !== "dm") return;

      const agentId = parseAgentIdFromDmChannelName(channel.name);
      if (!agentId) return;

      try {
        const runId = await api.runs.start({
          agent_id: agentId,
          prompt,
          channel_id: channelId,
          session_id: undefined,
        });
        setRunActive(agentId, runId);
        setRunChannel(runId, channelId);
      } catch (runError) {
        const message =
          runError instanceof Error ? runError.message : String(runError);
        addSystemMessage(
          channelId,
          t("message.agentRunFailed", { message })
        );
      }
    },
    [addSystemMessage, channelId, channels, setRunActive, setRunChannel, t]
  );

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const saved = content;
    setContent("");
    setError(false);
    try {
      await sendMessage(channelId, trimmed);
    } catch {
      setContent(saved);
      setError(true);
      return;
    }

    await startAgentRun(trimmed);
  }, [content, channelId, sendMessage, startAgentRun]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800 p-4">
      <div
        className={`flex items-end gap-2 rounded-lg px-3 py-2 ${
          error ? "bg-rose-950/30 ring-1 ring-rose-500/50" : "bg-zinc-800"
        }`}
      >
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(false);
          }}
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
          aria-label={t("message.send")}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
