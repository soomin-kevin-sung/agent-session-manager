import { create } from "zustand";
import { api, type Message } from "@/lib/tauri";

export const EMPTY_MESSAGES: Message[] = [];

interface MessageState {
  messagesByChannel: Record<string, Message[]>;
  loadingChannels: Set<string>;

  fetchMessages: (channelId: string) => Promise<void>;
  addMessage: (channelId: string, message: Message) => void;
  addSystemMessage: (channelId: string, content: string) => void;
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
        [channelId]: [
          ...(state.messagesByChannel[channelId] ?? []).filter(
            (existing) => existing.id !== message.id
          ),
          message,
        ],
      },
    }));
  },

  addSystemMessage: (channelId, content) => {
    get().addMessage(channelId, {
      id: `local-system-${crypto.randomUUID()}`,
      channel_id: channelId,
      sender_type: "system",
      sender_user_id: null,
      sender_agent_id: null,
      content,
      message_type: "system",
      status: "created",
      metadata: null,
      parent_id: null,
      thread_root_id: null,
      created_at: new Date().toISOString(),
    });
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

  getMessages: (channelId) => get().messagesByChannel[channelId] ?? EMPTY_MESSAGES,

  clearMessages: (channelId) => {
    set((state) => {
      const updated = { ...state.messagesByChannel };
      delete updated[channelId];
      return { messagesByChannel: updated };
    });
  },
}));
