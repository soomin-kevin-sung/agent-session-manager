import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/ui-store";
import type { Channel } from "@/lib/tauri";
import { Hash, Search, Terminal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface ChannelHeaderProps {
  channel: Channel;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
  const { t } = useTranslation();
  const { toggleMemberPanel, toggleTerminalPanel } = useUIStore();

  return (
    <TooltipProvider>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2">
          {channel.channel_type === "group" ? (
            <Hash className="size-5 text-zinc-400" />
          ) : (
            <span className="size-2 rounded-full bg-emerald-400" />
          )}
          <h3 className="text-sm font-semibold text-zinc-100">
            {channel.name}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleTerminalPanel}
                  aria-label={t("terminal.title")}
                />
              }
            >
              <Terminal className="size-4 text-zinc-400" />
            </TooltipTrigger>
            <TooltipContent>{t("terminal.title")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleMemberPanel}
                  aria-label={t("agent.members")}
                />
              }
            >
              <Users className="size-4 text-zinc-400" />
            </TooltipTrigger>
            <TooltipContent>{t("agent.members")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={t("common.search")} />}
            >
              <Search className="size-4 text-zinc-400" />
            </TooltipTrigger>
            <TooltipContent>{t("common.search")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
