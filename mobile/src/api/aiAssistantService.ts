/**
 * AI Trading Assistant Service
 *
 * Calls POST /api/ai/assistant on the backend.
 *
 * Backend endpoint (to be added to MarketAnalytics.API):
 *   POST /api/ai/assistant
 *   Body: { question: string, context: AIContext }
 *   Response: { answer: string, confidence: number, riskLevel: string, suggestedBias: string }
 *
 * The backend should forward to an LLM (Claude/OpenAI) with the context injected
 * into the system prompt. The mobile app never calls the LLM directly.
 */
import axiosClient from './axiosClient';
import type { AIRequest, AIResponse } from '../types';

export const aiAssistantService = {
  ask: async (request: AIRequest): Promise<AIResponse> => {
    const { data } = await axiosClient.post<AIResponse>('/api/ai/assistant', request);
    return data;
  },
};
