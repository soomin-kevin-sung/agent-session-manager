import { useEffect } from "react";
import { events, type RunLifecyclePayload } from "@/lib/tauri";
import { useAgentStore } from "@/stores/agent-store";

export function useTauriEvents() {
  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      try {
        // Run lifecycle events
        const unlisten2 = await events.onRunStarted(
          (payload: RunLifecyclePayload) => {
            useAgentStore.getState().setRunActive(payload.agent_id, payload.run_id);
          },
        );
        if (cancelled) { unlisten2(); return; }
        unlisteners.push(unlisten2);

        const unlisten3 = await events.onRunCompleted(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
          },
        );
        if (cancelled) { unlisten3(); return; }
        unlisteners.push(unlisten3);

        const unlisten4 = await events.onRunFailed(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
          },
        );
        if (cancelled) { unlisten4(); return; }
        unlisteners.push(unlisten4);

        const unlisten5 = await events.onRunCancelled(
          (payload: RunLifecyclePayload) => {
            const store = useAgentStore.getState();
            if (store.activeRuns.get(payload.agent_id) === payload.run_id) {
              store.setRunInactive(payload.agent_id);
            }
          },
        );
        if (cancelled) { unlisten5(); return; }
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
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
