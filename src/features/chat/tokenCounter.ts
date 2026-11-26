import type { ChatMessageItem } from "../../types/ai";
import { DEFAULT_AI_TOOLS } from "../../types/ai";

export interface ContextBreakdown {
  systemTokens: number;
  chatTokens: number;
  toolTokens: number;
  totalTokens: number;
  maxTokens: number;
  pctUsed: number;
  pctChatOfUsed: number;
  pctToolOfUsed: number;
  pctSystemOfUsed: number;
  pctChatOfTotal: number;
  pctToolOfTotal: number;
  pctSystemOfTotal: number;
}

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gemma-4-12b-qat": 32768,
  "llama3.2": 128000,
  "llama3.1": 128000,
  "mistral": 32768,
  "qwen2.5": 32768,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-haiku-20241022": 200000,
  "gemini-1.5-flash": 1048576,
  "gemini-1.5-pro": 2097152,
};

export function getModelContextLimit(modelName?: string): number {
  if (!modelName) return 32768;
  const lower = modelName.toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (lower.includes(key)) return limit;
  }
  return 32768;
}

export function estimateTextTokens(text?: string | null): number {
  if (!text) return 0;
  // Approximation: ~4 chars per token for natural prose, ~3.3 for code/JSON
  const len = text.length;
  return Math.max(1, Math.ceil(len / 3.8));
}

export function calculateContextBreakdown(
  messages: ChatMessageItem[],
  modelName: string,
  systemPrompt?: string,
  tools: typeof DEFAULT_AI_TOOLS = DEFAULT_AI_TOOLS
): ContextBreakdown {
  const maxTokens = getModelContextLimit(modelName);

  // 1. System Prompt + time context tokens
  const baseSystemText = systemPrompt || "You are FocusHUD Tactical AI Assistant.";
  const systemTokens = estimateTextTokens(baseSystemText) + 60; // 60 for system time injection

  // 2. Tool Definitions tokens
  const toolDefsText = JSON.stringify(tools);
  let toolTokens = estimateTextTokens(toolDefsText);

  // 3. Chat Messages (User + Assistant text) and Tool Call results
  let chatTokens = 0;

  for (const msg of messages) {
    chatTokens += 4; // per-message envelope overhead
    if (msg.content) {
      chatTokens += estimateTextTokens(msg.content);
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        toolTokens += estimateTextTokens(tc.name);
        toolTokens += estimateTextTokens(tc.arguments);
        if (tc.result) {
          toolTokens += estimateTextTokens(tc.result);
        }
      }
    }
  }

  const totalTokens = Math.max(1, systemTokens + chatTokens + toolTokens);
  const pctUsed = Math.min(100, Math.round((totalTokens / maxTokens) * 1000) / 10);

  const pctChatOfUsed = Math.round((chatTokens / totalTokens) * 100);
  const pctToolOfUsed = Math.round((toolTokens / totalTokens) * 100);
  const pctSystemOfUsed = Math.max(0, 100 - pctChatOfUsed - pctToolOfUsed);

  const pctChatOfTotal = Math.min(100, Math.round((chatTokens / maxTokens) * 1000) / 10);
  const pctToolOfTotal = Math.min(100, Math.round((toolTokens / maxTokens) * 1000) / 10);
  const pctSystemOfTotal = Math.min(100, Math.round((systemTokens / maxTokens) * 1000) / 10);

  return {
    systemTokens,
    chatTokens,
    toolTokens,
    totalTokens,
    maxTokens,
    pctUsed,
    pctChatOfUsed,
    pctToolOfUsed,
    pctSystemOfUsed,
    pctChatOfTotal,
    pctToolOfTotal,
    pctSystemOfTotal,
  };
}
