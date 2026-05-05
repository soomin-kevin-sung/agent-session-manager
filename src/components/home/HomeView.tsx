import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Workspace } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FolderPlus, ArrowRight, Pencil } from "lucide-react";

const CARD_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-purple-600",
  "bg-teal-600",
  "bg-pink-600",
];

export function HomeView() {
  const { t } = useTranslation();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const setWorkspaceCreationModal = useUIStore(
    (s) => s.setWorkspaceCreationModal
  );
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasWorkspaces = workspaces.length > 0;

  useEffect(() => {
    if (!editingWorkspace) return;
    setEditName(editingWorkspace.name);
    setEditDescription(editingWorkspace.description ?? "");
  }, [editingWorkspace]);

  const handleSaveWorkspace = async () => {
    if (!editingWorkspace || !editName.trim() || submitting) return;

    setSubmitting(true);
    try {
      await updateWorkspace(
        editingWorkspace.id,
        editName.trim(),
        editDescription.trim() || undefined
      );
      setEditingWorkspace(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-zinc-950 p-8">
      <div className="w-full max-w-xl py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">
            {t("home.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("home.welcome")}</p>
        </div>

        {/* Workspace list */}
        {hasWorkspaces && (
          <div className="mb-6 space-y-2">
            {workspaces.map((ws, i) => (
              <div
                key={ws.id}
                role="button"
                tabIndex={0}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                onClick={() => setActiveWorkspace(ws.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void setActiveWorkspace(ws.id);
                  }
                }}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {ws.name}
                  </div>
                  {ws.description && (
                    <div className="truncate text-xs text-zinc-500">
                      {ws.description}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t("workspace.edit", { defaultValue: "Edit workspace" })}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingWorkspace(ws);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <ArrowRight className="size-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasWorkspaces && (
          <div className="mb-6 rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center">
            <FolderPlus className="mx-auto mb-3 size-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              {t("workspace.emptyStateDescription")}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={() => setWorkspaceCreationModal(true)}
            className="gap-2"
          >
            <FolderPlus className="size-4" />
            {hasWorkspaces ? t("workspace.create") : t("workspace.firstCreate")}
          </Button>
        </div>
      </div>
      <Dialog
        open={Boolean(editingWorkspace)}
        onOpenChange={(open) => {
          if (!open && !submitting) setEditingWorkspace(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.edit", { defaultValue: "Edit Workspace" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="workspace-edit-name" className="mb-1 block text-xs font-medium text-zinc-400">
                {t("workspace.name")}
              </label>
              <Input
                id="workspace-edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder={t("workspace.name")}
              />
            </div>
            <div>
              <label htmlFor="workspace-edit-description" className="mb-1 block text-xs font-medium text-zinc-400">
                {t("workspace.description")}
              </label>
              <Textarea
                id="workspace-edit-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder={t("workspace.description")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWorkspace(null)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveWorkspace} disabled={!editName.trim() || submitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
