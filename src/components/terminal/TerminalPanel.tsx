import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface TerminalTab {
  id: string;
  label: string;
  output: string[];
}

export function TerminalPanel() {
  const { t } = useTranslation();
  const toggleTerminalPanel = useUIStore((s) => s.toggleTerminalPanel);

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "1", label: `${t("terminal.session")} 1`, output: [] },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const addTab = () => {
    const newId = String(Date.now());
    const newTab: TerminalTab = {
      id: newId,
      label: `${t("terminal.session")} ${tabs.length + 1}`,
      output: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const removeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      if (next.length === 0) {
        toggleTerminalPanel();
        return prev;
      }
      if (activeTabId === id) {
        setActiveTabId(next[0].id);
      }
      return next;
    });
  };

  return (
    <div className="flex h-[200px] flex-col border-t border-zinc-800 bg-zinc-950">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-2">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                tab.id === activeTabId
                  ? "border-b-2 border-zinc-100 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
              >
                <X className="size-3" />
              </span>
            </button>
          ))}
          <button
            onClick={addTab}
            className="p-1.5 text-zinc-500 hover:text-zinc-300"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleTerminalPanel}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Terminal output */}
      <ScrollArea className="flex-1">
        <div className="p-3 font-mono text-xs text-zinc-400">
          {activeTab && activeTab.output.length > 0 ? (
            activeTab.output.map((line, i) => (
              <div key={i} className="leading-relaxed">
                {line}
              </div>
            ))
          ) : (
            <p className="text-zinc-600">{t("terminal.noOutput")}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
