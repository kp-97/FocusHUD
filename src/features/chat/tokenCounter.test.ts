import { describe, it, expect } from "vitest";
import {
  calculateContextBreakdown,
  getModelContextLimit,
  estimateTextTokens,
} from "./tokenCounter";
import type { ChatMessageItem } from "../../types/ai";

describe("tokenCounter", () => {
  it("resolves model context limit correctly", () => {
    expect(getModelContextLimit("gpt-4o")).toBe(128000);
    expect(getModelContextLimit("llama3.2:latest")).toBe(128000);
    expect(getModelContextLimit("gemini-1.5-flash")).toBe(1048576);
    expect(getModelContextLimit("unknown-custom")).toBe(32768);
  });

  it("estimates token count from text length", () => {
    expect(estimateTextTokens("")).toBe(0);
    expect(estimateTextTokens("Hello world")).toBeGreaterThanOrEqual(2);
  });

  it("calculates breakdown between chat, tools, and system prompt", () => {
    const messages: ChatMessageItem[] = [
      {
        id: "m1",
        sessionId: "s1",
        role: "user",
        content: "What is on my calendar today?",
        createdAt: Date.now(),
      },
      {
        id: "m2",
        sessionId: "s1",
        role: "assistant",
        content: "Found 2 events.",
        toolCalls: [
          {
            id: "tc1",
            name: "get_calendar_events",
            arguments: "{}",
            result: JSON.stringify({ events: ["a", "b"] }),
            status: "success",
          },
        ],
        createdAt: Date.now(),
      },
    ];

    const breakdown = calculateContextBreakdown(messages, "gpt-4o", "System prompt here");

    expect(breakdown.chatTokens).toBeGreaterThan(0);
    expect(breakdown.toolTokens).toBeGreaterThan(0);
    expect(breakdown.systemTokens).toBeGreaterThan(0);
    expect(breakdown.totalTokens).toBe(
      breakdown.systemTokens + breakdown.chatTokens + breakdown.toolTokens
    );
    expect(breakdown.maxTokens).toBe(128000);
    expect(breakdown.pctChatOfUsed + breakdown.pctToolOfUsed + breakdown.pctSystemOfUsed).toBe(100);
  });
});
