import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/ui-store";
import { useAgentStore } from "@/stores/agent-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useMessageStore } from "@/stores/message-store";
import { api } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SessionCreationModal() {
  const { t } = useTranslation();
  const { showSessionCreationModal, setSessionCreationModal } = useUIStore();
  const { agents } = useAgentStore();
  const { activeWorkspaceId, setActiveWorkspace, setActiveChannel } =
    useWorkspaceStore();
  const { fetchMessages } = useMessageStore();

  const [name, setName] = useState("");
  const [workDirectory, setWorkDirectory] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const resetForm = () => {
    setName("");
    setWorkDirectory("");
    setSelectedAgentIds([]);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    setSessionCreationModal(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !activeWorkspaceId || submitting) return;
    setSubmitting(true);
    try {
      const session = await api.sessions.create({
        workspace_id: activeWorkspaceId,
        name: name.trim(),
        work_directory: workDirectory.trim() || ".",
        agent_ids: selectedAgentIds,
      });
      await setActiveWorkspace(activeWorkspaceId);
      if (session.channel_id) {
        setActiveChannel(session.channel_id);
        fetchMessages(session.channel_id);
      }
      if (useUIStore.getState().showSessionCreationModal) {
        resetForm();
        setSessionCreationModal(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={showSessionCreationModal}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("session.create")}</DialogTitle>
          <DialogDescription>{t("session.create")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Session name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("session.name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("session.name")}
            />
          </div>

          {/* Work directory */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("session.workDirectory")}
            </label>
            <Input
              value={workDirectory}
              onChange={(e) => setWorkDirectory(e.target.value)}
              placeholder="/path/to/project"
            />
          </div>

          {/* Agent selection */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("session.selectAgents")}
            </label>
            {agents.length === 0 ? (
              <p className="text-xs text-zinc-500">
                {t("session.noAgentsAvailable")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgentIds.includes(agent.id)}
                      onChange={() => toggleAgent(agent.id)}
                      className="rounded accent-emerald-500"
                    />
                    {agent.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || submitting}
          >
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
