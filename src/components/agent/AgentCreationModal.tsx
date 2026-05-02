import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/ui-store";
import { useAgentStore } from "@/stores/agent-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CreateAgentInput } from "@/lib/tauri";

export function AgentCreationModal() {
  const { t } = useTranslation();
  const { showAgentCreationModal, setAgentCreationModal } = useUIStore();
  const createAgent = useAgentStore((s) => s.createAgent);

  const [name, setName] = useState("");
  const [runtimeType, setRuntimeType] = useState<"claude_cli" | "codex_cli">(
    "claude_cli"
  );
  const [modelName, setModelName] = useState("");
  const [persona, setPersona] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const input: CreateAgentInput = {
        name: name.trim(),
        runtime_type: runtimeType,
        provider: runtimeType === "claude_cli" ? "anthropic" : "openai",
        model_name: modelName.trim() || undefined,
        persona: persona.trim() || undefined,
        created_by_type: "user",
        created_by_id: "default",
      };
      await createAgent(input);
      resetForm();
      setAgentCreationModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setRuntimeType("claude_cli");
    setModelName("");
    setPersona("");
  };

  return (
    <Dialog
      open={showAgentCreationModal}
      onOpenChange={setAgentCreationModal}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent.create")}</DialogTitle>
          <DialogDescription>
            {t("agent.create")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("agent.name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agent.name")}
            />
          </div>

          {/* Runtime */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("agent.runtime")}
            </label>
            <div className="flex gap-2">
              <Button
                variant={runtimeType === "claude_cli" ? "default" : "outline"}
                size="sm"
                onClick={() => setRuntimeType("claude_cli")}
              >
                {t("agent.claude")}
              </Button>
              <Button
                variant={runtimeType === "codex_cli" ? "default" : "outline"}
                size="sm"
                onClick={() => setRuntimeType("codex_cli")}
              >
                {t("agent.codex")}
              </Button>
            </div>
          </div>

          {/* Model name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("agent.model")}
            </label>
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="claude-sonnet-4-20250514"
            />
          </div>

          {/* Persona */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("agent.persona")}
            </label>
            <Textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder='{"role": "developer", ...}'
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAgentCreationModal(false)}
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
