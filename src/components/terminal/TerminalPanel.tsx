import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTerminalStore, type TerminalLine } from "@/stores/terminal-store";
import { useUIStore } from "@/stores/ui-store";

const lineTypeClass: Record<TerminalLine["type"], string> = {
  stdout: "text-zinc-300",
  stderr: "text-rose-400",
  command: "text-emerald-400",
  system: "text-zinc-500",
  error: "text-rose-500",
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatContent(line: TerminalLine) {
  if (line.type === "command") {
    return `$ ${line.content}`;
  }

  return line.content;
}

export function TerminalPanel() {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const toggleTerminalPanel = useUIStore((s) => s.toggleTerminalPanel);
  const lines = useTerminalStore((s) => s.lines);
  const clearLines = useTerminalStore((s) => s.clearLines);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = viewport.scrollHeight;
  }, [lines.length]);

  return (
    <div className="flex h-[200px] flex-col border-t border-zinc-800 bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {t("terminal.title")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLines}
            className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            {t("terminal.clear")}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleTerminalPanel}
            className="text-zinc-500 hover:text-zinc-300"
            aria-label={t("terminal.close")}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div ref={viewportRef} className="flex-1 overflow-y-auto">
        <div className="space-y-0.5 p-3 font-mono text-xs">
          {lines.length > 0 ? (
            lines.map((line) => (
              <div key={line.id} className={cn("flex gap-3 leading-relaxed", lineTypeClass[line.type])}>
                <span className="shrink-0 select-none text-zinc-600">
                  {formatTime(line.timestamp)}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {formatContent(line)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-zinc-500">{t("terminal.noOutput")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
