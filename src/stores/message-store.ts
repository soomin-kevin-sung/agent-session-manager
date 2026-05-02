import { create } from "zustand";
import { api, type Message } from "@/lib/tauri";

interface MessageState {
  messages: Message[];
  loading: boolean;

  fetchMessages: (channelId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  loading: false,

  fetchMessages: async (channelId) => {
    set({ loading: true });
    const messages = await api.messages.list(channelId, 100);
    set({ messages: messages.reverse(), loading: false });
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  sendMessage: async (channelId, content) => {
    const msg = await api.messages.send({
      channel_id: channelId,
      sender_type: "user",
      content,
      message_type: "chat",
    });
    get().addMessage(msg);
  },

  clearMessages: () => set({ messages: [] }),
}));
