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

interface ModelOption {
  value: string;
  label: string;
  runtime: "claude_cli" | "codex_cli";
  provider: "anthropic" | "openai";
  group: string;
}

const ALL_MODELS: ModelOption[] = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "gpt-5.5", label: "Codex GPT-5.5", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "o3", label: "Codex o3", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "o4-mini", label: "Codex o4-mini", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "gpt-4.1", label: "Codex GPT-4.1", runtime: "codex_cli", provider: "openai", group: "Codex" },
];

const GROUPS = [...new Set(ALL_MODELS.map((m) => m.group))];

interface Preset {
  id: string;
  key: string;
  defaultPermissions?: string[];
}

const ALL_PERMISSIONS = ["execute_cli", "create_agent", "create_session", "assign_task", "review"];

const PRESETS: Preset[] = [
  { id: "custom", key: "custom" },
  { id: "manager", key: "manager", defaultPermissions: ALL_PERMISSIONS },
  { id: "developer", key: "developer" },
  { id: "frontend-developer", key: "frontendDeveloper" },
  { id: "backend-developer", key: "backendDeveloper" },
  { id: "code-reviewer", key: "codeReviewer" },
  { id: "project-manager", key: "projectManager", defaultPermissions: ["create_agent", "create_session", "assign_task", "review"] },
  { id: "devops-engineer", key: "devopsEngineer" },
  { id: "qa-engineer", key: "qaEngineer" },
];

const AVAILABLE_PERMISSIONS = [
  { key: "execute_cli", labelKey: "permissions.executeCli" },
  { key: "create_agent", labelKey: "permissions.createAgent" },
  { key: "create_session", labelKey: "permissions.createSession" },
  { key: "assign_task", labelKey: "permissions.assignTask" },
  { key: "review", labelKey: "permissions.review" },
] as const;

export function AgentCreationModal() {
  const { t } = useTranslation();
  const { showAgentCreationModal, setAgentCreationModal } = useUIStore();
  const createAgent = useAgentStore((s) => s.createAgent);

  const [name, setName] = useState("");
  const [selectedModel, setSelectedModel] = useState(ALL_MODELS[0].value);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [isModified, setIsModified] = useState(false);
  const [role, setRole] = useState("");
  const [expertise, setExpertise] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["execute_cli"]);
  const [submitting, setSubmitting] = useState(false);

  const model = ALL_MODELS.find((m) => m.value === selectedModel) ?? ALL_MODELS[0];

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  };

  const getPresetValues = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.id === "custom") {
      return { role: "", expertise: "", description: "" };
    }
    return {
      role: t(`agent.presets.${preset.key}.role`),
      expertise: t(`agent.presets.${preset.key}.expertise`),
      description: t(`agent.presets.${preset.key}.description`),
    };
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    setIsModified(false);
    if (presetId === "custom") {
      setRole("");
      setExpertise("");
      setDescription("");
      setPermissions(["execute_cli"]);
    } else {
      const values = getPresetValues(presetId);
      setRole(values.role);
      setExpertise(values.expertise);
      setDescription(values.description);
      const preset = PRESETS.find((p) => p.id === presetId);
      setPermissions(preset?.defaultPermissions ?? ["execute_cli"]);
    }
  };

  const checkModified = (newRole: string, newExpertise: string, newDescription: string) => {
    if (selectedPreset === "custom") return;
    const defaults = getPresetValues(selectedPreset);
    const modified =
      newRole !== defaults.role ||
      newExpertise !== defaults.expertise ||
      newDescription !== defaults.description;
    setIsModified(modified);
  };

  const handleResetToPreset = () => {
    const values = getPresetValues(selectedPreset);
    setRole(values.role);
    setExpertise(values.expertise);
    setDescription(values.description);
    setIsModified(false);
  };

  const buildPersonaJson = (): string | undefined => {
    const persona: Record<string, string> = {};
    if (role.trim()) persona.role = role.trim();
    if (expertise.trim()) persona.expertise = expertise.trim();
    if (description.trim()) persona.description = description.trim();
    return Object.keys(persona).length > 0
      ? JSON.stringify(persona)
      : undefined;
  };

  const resetForm = () => {
    setName("");
    setSelectedModel(ALL_MODELS[0].value);
    setSelectedPreset("custom");
    setIsModified(false);
    setRole("");
    setExpertise("");
    setDescription("");
    setPermissions(["execute_cli"]);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return; // prevent close during submission
    resetForm();
    setAgentCreationModal(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const input: CreateAgentInput = {
        name: name.trim(),
        runtime_type: model.runtime,
        provider: model.provider,
        model_name: model.value,
        persona: buildPersonaJson(),
        permissions,
      };
      await createAgent(input);
      // Only close if modal is still open (prevents race with manual close)
      if (useUIStore.getState().showAgentCreationModal) {
        resetForm();
        setAgentCreationModal(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={showAgentCreationModal}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("agent.create")}</DialogTitle>
          <DialogDescription>{t("agent.createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="agent-name"
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              {t("agent.name")}
            </label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agent.namePlaceholder")}
            />
          </div>

          {/* Model — single grouped dropdown */}
          <div>
            <label
              htmlFor="agent-model"
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              {t("agent.model")}
            </label>
            <select
              id="agent-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
            >
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {ALL_MODELS.filter((m) => m.group === group).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Persona — structured fields */}
          <fieldset className="space-y-2 rounded-md border border-zinc-800 p-3">
            <legend className="px-1 text-xs font-medium text-zinc-400">
              {t("agent.persona")}
            </legend>

            {/* Preset */}
            <div>
              <label
                htmlFor="agent-preset"
                className="mb-1 block text-xs text-zinc-500"
              >
                {t("agent.presetLabel")}
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="agent-preset"
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t(`agent.presets.${p.key}.label`)}
                    </option>
                  ))}
                </select>
                {isModified && selectedPreset !== "custom" && (
                  <>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {t("agent.presetModified")}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToPreset}
                      className="shrink-0 cursor-pointer text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {t("agent.presetReset")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="agent-role"
                className="mb-1 block text-xs text-zinc-500"
              >
                {t("agent.role")}
              </label>
              <Input
                id="agent-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  checkModified(e.target.value, expertise, description);
                }}
                placeholder={t("agent.rolePlaceholder")}
              />
            </div>

            {/* Expertise */}
            <div>
              <label
                htmlFor="agent-expertise"
                className="mb-1 block text-xs text-zinc-500"
              >
                {t("agent.expertise")}
              </label>
              <Input
                id="agent-expertise"
                value={expertise}
                onChange={(e) => {
                  setExpertise(e.target.value);
                  checkModified(role, e.target.value, description);
                }}
                placeholder={t("agent.expertisePlaceholder")}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="agent-description"
                className="mb-1 block text-xs text-zinc-500"
              >
                {t("agent.description")}
              </label>
              <Textarea
                id="agent-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  checkModified(role, expertise, e.target.value);
                }}
                placeholder={t("agent.descriptionPlaceholder")}
                rows={2}
              />
            </div>
          </fieldset>

          {/* Permissions */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {t("agent.permissions")}
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.key)}
                    onChange={() => togglePermission(perm.key)}
                    className="rounded accent-emerald-500"
                  />
                  {t(perm.labelKey)}
                </label>
              ))}
            </div>
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
