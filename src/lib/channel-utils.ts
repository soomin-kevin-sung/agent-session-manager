import type { Channel } from "@/lib/tauri";

const DM_AGENT_ID_PATTERN = /\[([^\]]+)\]\s*$/;

export function parseAgentIdFromDmChannelName(name: string) {
  return name.match(DM_AGENT_ID_PATTERN)?.[1] ?? null;
}

export function findDmChannelByAgentId(channels: Channel[], agentId: string) {
  return channels.find(
    (channel) =>
      channel.channel_type === "dm" &&
      parseAgentIdFromDmChannelName(channel.name) === agentId,
  );
}
