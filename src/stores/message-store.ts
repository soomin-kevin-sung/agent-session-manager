import { create } from "zustand";
import { api, type Message } from "@/lib/tauri";

interface MessageState {
  messagesByChannel: Record<string, Message[]>;
  loadingChannels: Set<string>;

  fetchMessages: (channelId: string) => Promise<void>;
  addMessage: (channelId: string, message: Message) => void;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  getMessages: (channelId: string) => Message[];
  clearMessages: (channelId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: {},
  loadingChannels: new Set(),

  fetchMessages: async (channelId) => {
    set((state) => ({
      loadingChannels: new Set(state.loadingChannels).add(channelId),
    }));
    try {
      const messages = await api.messages.list(channelId, 100);
      set((state) => {
        const loading = new Set(state.loadingChannels);
        loading.delete(channelId);
        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: messages.reverse(),
          },
          loadingChannels: loading,
        };
      });
    } catch (error) {
      console.error("Failed to fetch messages", error);
      set((state) => {
        const loading = new Set(state.loadingChannels);
        loading.delete(channelId);
        return { loadingChannels: loading };
      });
    }
  },

  addMessage: (channelId, message) => {
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [channelId]: [...(state.messagesByChannel[channelId] ?? []), message],
      },
    }));
  },

  sendMessage: async (channelId, content) => {
    try {
      const msg = await api.messages.send({
        channel_id: channelId,
        sender_type: "user",
        content,
        message_type: "chat",
      });
      get().addMessage(channelId, msg);
    } catch (error) {
      console.error("Failed to send message", error);
      throw error;
    }
  },

  getMessages: (channelId) => get().messagesByChannel[channelId] ?? [],

  clearMessages: (channelId) => {
    set((state) => {
      const updated = { ...state.messagesByChannel };
      delete updated[channelId];
      return { messagesByChannel: updated };
    });
  },
}));
