import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore } from "@/stores/agent-store";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/tauri";
import {
  AVAILABLE_PERMISSIONS,
  PRESETS,
  buildPersonaJson,
  getModelsForAgent,
  parsePersona,
} from "@/components/agent/agent-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AgentEditModal() {
  const { t } = useTranslation();
  const editingAgentId = useUIStore((s) => s.editingAgentId);
  const setEditingAgent = useUIStore((s) => s.setEditingAgent);
  const agents = useAgentStore((s) => s.agents);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);

  const agent = agents.find((item) => item.id === editingAgentId);
  const modelOptions = useMemo(
    () => (agent ? getModelsForAgent(agent) : []),
    [agent]
  );

  const [name, setName] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("custom");
  const [isModified, setIsModified] = useState(false);
  const [role, setRole] = useState("");
  const [expertise, setExpertise] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agent) return;

    const persona = parsePersona(agent.persona);
    setName(agent.name);
    setSelectedModel(agent.model_name ?? modelOptions[0]?.value ?? "");
    setSelectedPreset("custom");
    setIsModified(false);
    setRole(persona.role);
    setExpertise(persona.expertise);
    setDescription(persona.description);

    let cancelled = false;
    void api.permissions
      .listForAgent(agent.id)
      .then((items) => {
        if (!cancelled) {
          setPermissions(items.map((item) => item.permission_type));
        }
      })
      .catch((error) => {
        console.error("Failed to fetch agent permissions", error);
        if (!cancelled) setPermissions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [agent, modelOptions]);

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
      return;
    }

    const values = getPresetValues(presetId);
    setRole(values.role);
    setExpertise(values.expertise);
    setDescription(values.description);
  };

  const checkModified = (
    newRole: string,
    newExpertise: string,
    newDescription: string
  ) => {
    if (selectedPreset === "custom") return;
    const defaults = getPresetValues(selectedPreset);
    setIsModified(
      newRole !== defaults.role ||
        newExpertise !== defaults.expertise ||
        newDescription !== defaults.description
    );
  };

  const handleResetToPreset = () => {
    const values = getPresetValues(selectedPreset);
    setRole(values.role);
    setExpertise(values.expertise);
    setDescription(values.description);
    setIsModified(false);
  };

  const handleClose = () => {
    if (submitting) return;
    setEditingAgent(null);
  };

  const handleSave = async () => {
    if (!agent || !name.trim() || submitting) return;

    setSubmitting(true);
    try {
      await updateAgent(agent.id, {
        name: name.trim(),
        model_name: selectedModel || undefined,
        persona: buildPersonaJson(role, expertise, description),
        enabled: agent.enabled,
      });
      if (useUIStore.getState().editingAgentId === agent.id) {
        setEditingAgent(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || submitting) return;

    const confirmed = window.confirm(
      t("agent.deleteConfirm", {
        name: agent.name,
        defaultValue:
          "Delete {{name}}? Existing DM channels and messages may remain.",
      })
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await deleteAgent(agent.id);
      if (useUIStore.getState().editingAgentId === agent.id) {
        setEditingAgent(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(editingAgentId)}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("agent.edit", { defaultValue: "Edit Agent" })}
          </DialogTitle>
          <DialogDescription>
            {agent?.id ?? t("agent.notSelected", { defaultValue: "No agent selected" })}
          </DialogDescription>
        </DialogHeader>

        {agent && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="agent-edit-name"
                className="mb-1 block text-xs font-medium text-zinc-400"
              >
                {t("agent.name")}
              </label>
              <Input
                id="agent-edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("agent.namePlaceholder")}
              />
            </div>

            <div>
              <label
                htmlFor="agent-edit-model"
                className="mb-1 block text-xs font-medium text-zinc-400"
              >
                {t("agent.model")}
              </label>
              <select
                id="agent-edit-model"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
              >
                {modelOptions.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2 rounded-md border border-zinc-800 p-3">
              <legend className="px-1 text-xs font-medium text-zinc-400">
                {t("agent.persona")}
              </legend>

              <div>
                <label
                  htmlFor="agent-edit-preset"
                  className="mb-1 block text-xs text-zinc-500"
                >
                  {t("agent.presetLabel")}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="agent-edit-preset"
                    value={selectedPreset}
                    onChange={(event) => handlePresetChange(event.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
                  >
                    {PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {t(`agent.presets.${preset.key}.label`)}
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

              <div>
                <label
                  htmlFor="agent-edit-role"
                  className="mb-1 block text-xs text-zinc-500"
                >
                  {t("agent.role")}
                </label>
                <Input
                  id="agent-edit-role"
                  value={role}
                  onChange={(event) => {
                    setRole(event.target.value);
                    checkModified(event.target.value, expertise, description);
                  }}
                  placeholder={t("agent.rolePlaceholder")}
                />
              </div>

              <div>
                <label
                  htmlFor="agent-edit-expertise"
                  className="mb-1 block text-xs text-zinc-500"
                >
                  {t("agent.expertise")}
                </label>
                <Input
                  id="agent-edit-expertise"
                  value={expertise}
                  onChange={(event) => {
                    setExpertise(event.target.value);
                    checkModified(role, event.target.value, description);
                  }}
                  placeholder={t("agent.expertisePlaceholder")}
                />
              </div>

              <div>
                <label
                  htmlFor="agent-edit-description"
                  className="mb-1 block text-xs text-zinc-500"
                >
                  {t("agent.description")}
                </label>
                <Textarea
                  id="agent-edit-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    checkModified(role, expertise, event.target.value);
                  }}
                  placeholder={t("agent.descriptionPlaceholder")}
                  rows={2}
                />
              </div>
            </fieldset>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                {t("agent.permissions")}
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex cursor-not-allowed items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission.key)}
                      disabled
                      className="rounded accent-emerald-500"
                      readOnly
                    />
                    {t(permission.labelKey)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!agent || submitting}
          >
            {t("common.delete")}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!agent || !name.trim() || submitting}
            >
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
