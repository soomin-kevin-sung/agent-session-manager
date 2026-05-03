import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";

export function WorkspaceCreationModal() {
  const { t } = useTranslation();
  const show = useUIStore((s) => s.showWorkspaceCreationModal);
  const setShow = useUIStore((s) => s.setWorkspaceCreationModal);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const isFirstWorkspace = useWorkspaceStore((s) => s.workspaces.length === 0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    setShow(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createWorkspace(name.trim(), description.trim() || undefined);
      if (useUIStore.getState().showWorkspaceCreationModal) {
        resetForm();
        setShow(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => {
      if (!open) handleClose();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFirstWorkspace ? t("workspace.firstCreate") : t("workspace.create")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="ws-name" className="text-sm text-zinc-400">{t("workspace.name")}</label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workspace.name")}
            />
          </div>
          <div>
            <label htmlFor="ws-desc" className="text-sm text-zinc-400">{t("workspace.description")}</label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("workspace.description")}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>{t("common.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
