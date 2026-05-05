import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMessageStore } from "@/stores/message-store";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { api, type SessionMember } from "@/lib/tauri";
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
  const agents = useAgentStore((s) => s.agents);
  const channels = useWorkspaceStore((s) => s.channels);
  const [content, setContent] = useState("");
  const [error, setError] = useState(false);
  const [sessionMembers, setSessionMembers] = useState<SessionMember[] | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const channel = channels.find((ch) => ch.id === channelId);
  const sessionId = channel?.session_id ?? null;

  useEffect(() => {
    let cancelled = false;

    setSessionMembers(null);
    setSelectedAgentId("");

    if (!sessionId) return;

    void api.sessions
      .listMembers(sessionId)
      .then((members) => {
        if (cancelled) return;
        setSessionMembers(members);
        setSelectedAgentId(members[0]?.agent_id ?? "");
      })
      .catch((memberError) => {
        if (cancelled) return;
        console.error("Failed to load session members", memberError);
        setSessionMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const getSessionMembers = useCallback(async () => {
    if (!sessionId) return [];
    if (sessionMembers) return sessionMembers;

    const members = await api.sessions.listMembers(sessionId);
    setSessionMembers(members);
    setSelectedAgentId((current) => current || members[0]?.agent_id || "");
    return members;
  }, [sessionId, sessionMembers]);

  const getAgentName = useCallback(
    (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId,
    [agents]
  );

  const startAgentRun = useCallback(
    async (prompt: string) => {
      let agentId: string | null = null;
      const channel = channels.find((ch) => ch.id === channelId);
      const currentSessionId = channel?.session_id ?? null;

      if (currentSessionId) {
        const members = await getSessionMembers();
        if (members.length === 0) {
          addSystemMessage(channelId, t("session.noMembers"));
          return;
        }
        agentId =
          members.length === 1
            ? members[0].agent_id
            : selectedAgentId || members[0].agent_id;
      } else {
        if (channel?.channel_type !== "dm") return;
        agentId = parseAgentIdFromDmChannelName(channel.name);
      }

      if (!agentId) return;

      try {
        const runId = await api.runs.start({
          agent_id: agentId,
          prompt,
          channel_id: channelId,
          session_id: currentSessionId ?? undefined,
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
    [
      addSystemMessage,
      channelId,
      channels,
      getSessionMembers,
      selectedAgentId,
      setRunActive,
      setRunChannel,
      t,
    ]
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
        {sessionId && sessionMembers && sessionMembers.length > 1 && (
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            aria-label={t("session.selectAgent")}
            className="h-8 max-w-44 shrink-0 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
          >
            {sessionMembers.map((member) => (
              <option key={member.agent_id} value={member.agent_id}>
                {getAgentName(member.agent_id)}
              </option>
            ))}
          </select>
        )}
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
