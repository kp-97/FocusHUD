import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCompactSummary, compactSession } from "./chatCompactor";
import type { ChatMessageItem } from "../../types/ai";
import * as aiService from "../../services/aiService";

vi.mock("../../services/aiService", () => ({
  persistChatMessage: vi.fn().mockResolvedValue(undefined),
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

  it("compacts session down to checkpoint and latest context", async () => {
    const compacted = await compactSession("s1", sampleMessages);
    expect(compacted.length).toBeLessThan(sampleMessages.length);
    expect(compacted[0].id).toContain("compact_");
    expect(compacted[0].content).toContain("Context Compaction Checkpoint");
    expect(aiService.persistChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "s1",
        role: "assistant",
      })
    );
  });

  it("does not compact sessions with 2 or fewer messages", async () => {
    const shortMessages = sampleMessages.slice(0, 2);
    const result = await compactSession("s1", shortMessages);
    expect(result).toHaveLength(2);
    expect(aiService.persistChatMessage).not.toHaveBeenCalled();
  });
});
