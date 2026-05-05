import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { Home, Plus, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const WORKSPACE_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-purple-600",
  "bg-teal-600",
  "bg-pink-600",
];

function getWorkspaceColor(index: number) {
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function WorkspaceSidebar() {
  const { t } = useTranslation();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, goHome } =
    useWorkspaceStore();
  const setWorkspaceCreationModal = useUIStore(
    (s) => s.setWorkspaceCreationModal
  );
  const setSettingsModal = useUIStore((s) => s.setSettingsModal);
  const isHome = activeWorkspaceId === null;

  return (
    <TooltipProvider>
      <div className="flex w-[72px] flex-col items-center gap-2 bg-zinc-950 py-3">
        <Tooltip>
          <TooltipTrigger
            className="relative flex cursor-pointer items-center justify-center"
            onClick={goHome}
          >
            {isHome && (
              <span className="absolute -left-4 h-8 w-1 rounded-r-full bg-zinc-100" />
            )}
            <div
              className={`flex size-10 items-center justify-center transition-all ${
                isHome
                  ? "rounded-2xl bg-zinc-700 text-zinc-100"
                  : "rounded-full bg-zinc-800 text-zinc-400 hover:rounded-2xl hover:text-zinc-100"
              }`}
            >
              <Home className="size-5" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{t("home.title")}</TooltipContent>
        </Tooltip>

        <Separator className="mx-auto w-8 bg-zinc-800" />

        {workspaces.map((ws, i) => {
          const isActive = ws.id === activeWorkspaceId;
          return (
            <Tooltip key={ws.id}>
              <TooltipTrigger
                className="relative flex items-center justify-center"
                onClick={() => setActiveWorkspace(ws.id)}
              >
                {isActive && (
                  <span className="absolute -left-4 h-8 w-1 rounded-r-full bg-zinc-100" />
                )}
                <div
                  className={`flex size-10 items-center justify-center text-sm font-semibold text-white transition-all ${getWorkspaceColor(i)} ${
                    isActive ? "rounded-2xl" : "rounded-full hover:rounded-2xl"
                  }`}
                >
                  {getInitials(ws.name)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{ws.name}</TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="mx-auto w-8 bg-zinc-800" />

        <Tooltip>
          <TooltipTrigger
            className="flex cursor-pointer size-10 items-center justify-center rounded-full bg-zinc-800 text-emerald-400 transition-all hover:rounded-2xl hover:bg-zinc-800 hover:text-emerald-300"
            onClick={() => setWorkspaceCreationModal(true)}
            aria-label={t("workspace.add")}
          >
            <Plus className="size-5" />
          </TooltipTrigger>
          <TooltipContent side="right">
            {t("workspace.add")}
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger
            className="flex cursor-pointer size-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => setSettingsModal(true)}
            aria-label={t("common.settings")}
          >
            <Settings className="size-5" />
          </TooltipTrigger>
          <TooltipContent side="right">
            {t("common.settings")}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
