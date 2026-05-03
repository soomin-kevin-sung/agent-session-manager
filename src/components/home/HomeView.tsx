import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { FolderPlus, ArrowRight } from "lucide-react";

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
  const setWorkspaceCreationModal = useUIStore(
    (s) => s.setWorkspaceCreationModal
  );

  const hasWorkspaces = workspaces.length > 0;

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
              <button
                key={ws.id}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                onClick={() => setActiveWorkspace(ws.id)}
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
                <ArrowRight className="size-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </button>
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
    </div>
  );
}
