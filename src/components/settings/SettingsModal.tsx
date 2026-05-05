import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { api, type AppSettings } from "@/lib/tauri";
import { useUIStore } from "@/stores/ui-store";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LANGUAGE_KEY = "language";

function defaultSettings(): AppSettings {
  return {
    database_path: "agent-session-manager.db",
    claude_cli_path: "claude",
    codex_cli_path: "codex",
    language: "system",
    default_sandbox_mode: "workspace-write",
    process_timeout_secs: 300,
    max_log_size_mb: 100,
  };
}

function resolveLanguage(language: AppSettings["language"]) {
  if (language === "system") {
    return navigator.language.startsWith("ko") ? "ko" : "en";
  }
  return language;
}

export function SettingsModal() {
  const { t } = useTranslation();
  const show = useUIStore((s) => s.showSettingsModal);
  const setShow = useUIStore((s) => s.setSettingsModal);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!show) return;

    let cancelled = false;
    void api.settings
      .load()
      .then((loaded) => {
        if (cancelled) return;
        const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
        setSettings({
          ...defaultSettings(),
          ...loaded,
          claude_cli_path: loaded.claude_cli_path ?? "claude",
          codex_cli_path: loaded.codex_cli_path ?? "codex",
          language:
            savedLanguage === "ko" || savedLanguage === "en" || savedLanguage === "system"
              ? savedLanguage
              : loaded.language,
        });
        setSaved(false);
      })
      .catch((error) => {
        console.error("Failed to load settings", error);
        if (!cancelled) setSettings(defaultSettings());
      });

    return () => {
      cancelled = true;
    };
  }, [show]);

  const handleSave = async () => {
    if (submitting) return;

    const nextSettings: AppSettings = {
      ...settings,
      claude_cli_path: settings.claude_cli_path?.trim() || "claude",
      codex_cli_path: settings.codex_cli_path?.trim() || "codex",
    };

    setSubmitting(true);
    try {
      const savedSettings = await api.settings.save(nextSettings);
      localStorage.setItem(LANGUAGE_KEY, savedSettings.language);
      await i18n.changeLanguage(resolveLanguage(savedSettings.language));
      setSettings(savedSettings);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open && !submitting) setShow(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="claude-cli-path" className="mb-1 block text-xs font-medium text-zinc-400">
              {t("settings.claudePath")}
            </label>
            <Input
              id="claude-cli-path"
              value={settings.claude_cli_path ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  claude_cli_path: event.target.value,
                }))
              }
              placeholder="claude"
            />
          </div>

          <div>
            <label htmlFor="codex-cli-path" className="mb-1 block text-xs font-medium text-zinc-400">
              {t("settings.codexPath")}
            </label>
            <Input
              id="codex-cli-path"
              value={settings.codex_cli_path ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  codex_cli_path: event.target.value,
                }))
              }
              placeholder="codex"
            />
          </div>

          <div>
            <label htmlFor="language" className="mb-1 block text-xs font-medium text-zinc-400">
              {t("settings.language")}
            </label>
            <select
              id="language"
              value={settings.language}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  language: event.target.value as AppSettings["language"],
                }))
              }
              className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-500/40"
            >
              <option value="system">{t("settings.languageSystem")}</option>
              <option value="ko">{t("settings.languageKorean", { defaultValue: "Korean" })}</option>
              <option value="en">{t("settings.languageEnglish", { defaultValue: "English" })}</option>
            </select>
          </div>

          {saved && <p className="text-xs text-emerald-400">{t("settings.saved")}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {t("settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
