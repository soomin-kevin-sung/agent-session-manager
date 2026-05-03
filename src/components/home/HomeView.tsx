import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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

function getCardColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length];
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

export function HomeView() {
  const { t } = useTranslation();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const setWorkspaceCreationModal = useUIStore(
    (s) => s.setWorkspaceCreationModal
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-950">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-100">
            {t("home.title")}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{t("home.welcome")}</p>
        </div>

        {workspaces.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
            {workspaces.map((ws, i) => (
              <button
                key={ws.id}
                className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center transition-colors hover:border-zinc-700"
                onClick={() => setActiveWorkspace(ws.id)}
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-full text-lg font-bold text-white ${getCardColor(i)}`}
                >
                  {getInitial(ws.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {ws.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-400">
                    {ws.description || t("home.noDescription")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {workspaces.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-zinc-400">
              {t("workspace.emptyStateDescription")}
            </p>
          </div>
        )}

        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setWorkspaceCreationModal(true)}
        >
          <Plus className="mr-2 size-4" />
          {t("workspace.create")}
        </Button>
      </div>
    </div>
  );
}
