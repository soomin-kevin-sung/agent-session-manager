import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export function EmptyWorkspaceState() {
  const { t } = useTranslation();
  const setShow = useUIStore((s) => s.setWorkspaceCreationModal);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-5xl">🤖</span>
        <h2 className="text-xl font-semibold text-zinc-100">
          {t("workspace.emptyState")}
        </h2>
        <p className="max-w-sm text-sm text-zinc-400">
          {t("workspace.emptyStateDescription")}
        </p>
        <Button
          className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setShow(true)}
        >
          {t("workspace.firstCreate")}
        </Button>
      </div>
    </div>
  );
}
