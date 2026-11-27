import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCompactSummary,
  compactSession,
  shouldTriggerThresholdCompaction,
} from "./chatCompactor";
import type { ChatMessageItem } from "../../types/ai";
import * as aiService from "../../services/aiService";

vi.mock("../../services/aiService", () => ({
  persistChatMessage: vi.fn().mockResolvedValue(undefined),
  replaceChatMessages: vi.fn().mockResolvedValue(undefined),
}));

describe("chatCompactor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleMessages: ChatMessageItem[] = [
    {
      id: "u1",
      sessionId: "s1",
      role: "user",
      content: "Check my tasks for today",
      createdAt: 1000,
    },
    {
      id: "a1",
      sessionId: "s1",
      role: "assistant",
      content: "Found 2 pending tasks.",
      toolCalls: [
        {
          id: "t1",
          name: "get_tasks",
          arguments: "{}",
          result: "[]",
          status: "success",
        },
      ],
      createdAt: 2000,
    },
    {
      id: "u2",
      sessionId: "s1",
      role: "user",
      content: "Delete the first task",
      createdAt: 3000,
    },
    {
      id: "a2",
      sessionId: "s1",
      role: "assistant",
      content: "Task deleted successfully.",
      toolCalls: [
        {
          id: "t2",
          name: "delete_task",
          arguments: "{\"id\":\"t1\"}",
          result: "success",
          status: "success",
        },
      ],
      createdAt: 4000,
    },
  ];

  it("generates a structured compaction summary with user prompts and tools", () => {
    const summary = generateCompactSummary(sampleMessages);
    expect(summary).toContain("Context Compaction Checkpoint");
    expect(summary).toContain("Delete the first task");
    expect(summary).toContain("get_tasks");
    expect(summary).toContain("delete_task");
  });

  it("compacts session down to checkpoint and replaces stored messages", async () => {
    const compacted = await compactSession("s1", sampleMessages);
    expect(compacted.length).toBeLessThan(sampleMessages.length);
    expect(compacted[0].id).toContain("compact_");
    expect(compacted[0].content).toContain("Context Compaction Checkpoint");
    expect(aiService.replaceChatMessages).toHaveBeenCalledWith("s1", compacted);
  });

  it("does not compact sessions with 2 or fewer messages", async () => {
    const shortMessages = sampleMessages.slice(0, 2);
    const result = await compactSession("s1", shortMessages);
    expect(result).toHaveLength(2);
    expect(aiService.replaceChatMessages).not.toHaveBeenCalled();
  });

  it("evaluates shouldTriggerThresholdCompaction based on context threshold", () => {
    // Disabled threshold (0)
    expect(shouldTriggerThresholdCompaction(sampleMessages, 0, "llama3.2", "", 8192)).toBe(false);

    // Short messages
    expect(shouldTriggerThresholdCompaction(sampleMessages.slice(0, 2), 70, "llama3.2", "", 8192)).toBe(false);

    // Large message payload that exceeds 70% of a 512 token context
    const heavyMessages: ChatMessageItem[] = [
      { id: "h1", sessionId: "s1", role: "user", content: "A".repeat(1500), createdAt: 1 },
      { id: "h2", sessionId: "s1", role: "assistant", content: "B".repeat(1500), createdAt: 2 },
      { id: "h3", sessionId: "s1", role: "user", content: "C".repeat(1500), createdAt: 3 },
    ];
    expect(shouldTriggerThresholdCompaction(heavyMessages, 70, "llama3.2", "", 1024)).toBe(true);

    // Same heavy messages under a massive 128k context do not trigger 70% threshold
    expect(shouldTriggerThresholdCompaction(heavyMessages, 70, "llama3.2", "", 128000)).toBe(false);
  });
});
