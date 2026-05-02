import { useEffect } from "react";
import {
  events,
  type AgentOutputPayload,
  type RunLifecyclePayload,
} from "@/lib/tauri";
import { useMessageStore } from "@/stores/message-store";
import { useAgentStore } from "@/stores/agent-store";

export function useTauriEvents() {
  const addMessage = useMessageStore((s) => s.addMessage);
  const setRunActive = useAgentStore((s) => s.setRunActive);
  const setRunInactive = useAgentStore((s) => s.setRunInactive);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      try {
        // Agent output events -- add messages from agents to the message list
        const unlisten1 = await events.onAgentOutput(
          (payload: AgentOutputPayload) => {
            const evt = payload.event;
            if (evt.event_type === "Message") {
              addMessage({
                id: crypto.randomUUID(),
                channel_id: "", // Will be resolved by the backend in real usage
                sender_type: "agent",
                sender_user_id: null,
                sender_agent_id: payload.agent_id,
                content: (evt as Record<string, unknown>).content as string || "",
                message_type: "chat",
                status: "delivered",
                metadata: null,
                parent_id: null,
                thread_root_id: null,
                created_at: new Date().toISOString(),
              });
            }
          },
        );
        unlisteners.push(unlisten1);

        // Run lifecycle events
        const unlisten2 = await events.onRunStarted(
          (payload: RunLifecyclePayload) => {
            setRunActive(payload.agent_id, payload.run_id);
          },
        );
        unlisteners.push(unlisten2);

        const unlisten3 = await events.onRunCompleted(
          (payload: RunLifecyclePayload) => {
            setRunInactive(payload.agent_id);
          },
        );
        unlisteners.push(unlisten3);

        const unlisten4 = await events.onRunFailed(
          (payload: RunLifecyclePayload) => {
            setRunInactive(payload.agent_id);
          },
        );
        unlisteners.push(unlisten4);

        const unlisten5 = await events.onRunCancelled(
          (payload: RunLifecyclePayload) => {
            setRunInactive(payload.agent_id);
          },
        );
        unlisteners.push(unlisten5);
      } catch {
        // Tauri runtime not available (e.g. running in browser dev mode).
        // Silently ignore so the app still renders.
        console.warn(
          "Tauri event listeners could not be registered. Running outside Tauri?",
        );
      }
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [addMessage, setRunActive, setRunInactive]);
}
