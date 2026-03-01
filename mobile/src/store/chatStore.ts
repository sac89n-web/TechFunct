import { create } from 'zustand';
import type { AIMessage, AIContext } from '../types';
import { aiAssistantService } from '../api/aiAssistantService';

interface ChatState {
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (question: string, context: AIContext) => Promise<void>;
  clearHistory: () => void;
}

let _msgId = 0;
const nextId = () => String(++_msgId);

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  sendMessage: async (question: string, context: AIContext) => {
    const userMsg: AIMessage = {
      id: nextId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    set(s => ({ messages: [...s.messages, userMsg], isLoading: true, error: null }));

    try {
      const response = await aiAssistantService.ask({ question, context });

      const aiMsg: AIMessage = {
        id: nextId(),
        role: 'assistant',
        content: response.answer,
        confidence: response.confidence,
        riskLevel: response.riskLevel,
        suggestedBias: response.suggestedBias,
        timestamp: Date.now(),
      };

      set(s => ({ messages: [...s.messages, aiMsg], isLoading: false }));
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'AI assistant unavailable';
      set(s => ({
        messages: [
          ...s.messages,
          {
            id: nextId(),
            role: 'assistant' as const,
            content: `⚠️ ${errMsg}`,
            timestamp: Date.now(),
          },
        ],
        isLoading: false,
        error: errMsg,
      }));
    }
  },

  clearHistory: () => set({ messages: [], error: null }),
}));
