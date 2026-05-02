import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTranslation } from "react-i18next";

export function ChatArea() {
  const { t } = useTranslation();
  const { activeChannelId, channels } = useWorkspaceStore();
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (!activeChannelId || !activeChannel) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-900">
        <p className="text-zinc-500">{t("channel.noChannel")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-900">
      <ChannelHeader channel={activeChannel} />
      <MessageList channelId={activeChannelId} />
      <MessageInput channelId={activeChannelId} />
    </div>
  );
}
