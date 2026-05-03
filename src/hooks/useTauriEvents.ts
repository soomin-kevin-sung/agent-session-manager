import { useEffect } from "react";
import {
  events,
  type AgentOutputPayload,
  type Message,
  type RunLifecyclePayload,
} from "@/lib/tauri";
import { useAgentStore } from "@/stores/agent-store";
import { useMessageStore } from "@/stores/message-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { findDmChannelByAgentId } from "@/lib/channel-utils";

function getChannelIdForRun(payload: AgentOutputPayload) {
  const { activeRunChannels } = useAgentStore.getState();
  const mappedChannelId = activeRunChannels.get(payload.run_id);
  if (mappedChannelId) return mappedChannelId;

  return findDmChannelByAgentId(
    useWorkspaceStore.getState().channels,
    payload.agent_id
  )?.id;
}

function createLocalAgentMessage(
  channelId: string,
  payload: AgentOutputPayload
): Message | null {
  const { event } = payload;
  if (event.event_type !== "Message" || !event.content.trim()) {
    return null;
  }

  return {
    id: `local-agent-${payload.run_id}-${crypto.randomUUID()}`,
    channel_id: channelId,
    sender_type: "agent",
    sender_user_id: null,
    sender_agent_id: payload.agent_id,
    content: event.content,
    message_type: "chat",
    status: "created",
    metadata: null,
    parent_id: null,
    thread_root_id: null,
    created_at: new Date().toISOString(),
  };
}

export function useTauriEvents() {
  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      try {
        const unlisten1 = await events.onAgentOutput(
          (payload: AgentOutputPayload) => {
            const channelId = getChannelIdForRun(payload);
            if (!channelId) return;

            const message = createLocalAgentMessage(channelId, payload);
            if (message) {
              useMessageStore.getState().addMessage(channelId, message);
            }
          },
        );
        if (cancelled) { unlisten1(); return; }
        unlisteners.push(unlisten1);

        // Run lifecycle events
        const unlisten2 = await events.onRunStarted(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            store.setRunActive(payload.agent_id, payload.run_id);
            if (payload.channel_id) {
              store.setRunChannel(payload.run_id, payload.channel_id);
            }
          },
        );
        if (cancelled) { unlisten2(); return; }
        unlisteners.push(unlisten2);

        const unlisten3 = await events.onRunCompleted(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            const channelId =
              payload.channel_id ?? store.activeRunChannels.get(payload.run_id);
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
            store.clearRunChannel(payload.run_id);
            if (channelId) {
              void useMessageStore.getState().fetchMessages(channelId);
            }
          },
        );
        if (cancelled) { unlisten3(); return; }
        unlisteners.push(unlisten3);

        const unlisten4 = await events.onRunFailed(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            const channelId =
              payload.channel_id ?? store.activeRunChannels.get(payload.run_id);
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
            store.clearRunChannel(payload.run_id);
            if (channelId) {
              const messageStore = useMessageStore.getState();
              const failureMessage =
                payload.message ??
                `Run failed with exit code ${payload.exit_code ?? "unknown"}`;
              void messageStore
                .fetchMessages(channelId)
                .finally(() =>
                  messageStore.addSystemMessage(channelId, failureMessage)
                );
            }
          },
        );
        if (cancelled) { unlisten4(); return; }
        unlisteners.push(unlisten4);

        const unlisten5 = await events.onRunCancelled(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            const channelId =
              payload.channel_id ?? store.activeRunChannels.get(payload.run_id);
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
            store.clearRunChannel(payload.run_id);
            if (channelId) {
              void useMessageStore.getState().fetchMessages(channelId);
            }
          },
        );
        if (cancelled) { unlisten5(); return; }
        unlisteners.push(unlisten5);
      } catch {
        // Tauri runtime not available (e.g. running in browser dev mode).
        // Silently ignore so the app still renders.
      }
    };

    setup();

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
