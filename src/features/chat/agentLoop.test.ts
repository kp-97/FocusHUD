import { describe, it, expect } from "vitest";
import {
  MAX_AGENT_DEPTH,
  shouldContinueAgentLoop,
  buildNextIterationMessages,
} from "./agentLoop";
import type { ChatMessageParam, ToolCallItem } from "../../types/ai";

describe("agentLoop - Autonomous multi-step loop logic", () => {
  it("enforces MAX_AGENT_DEPTH limit", () => {
    expect(MAX_AGENT_DEPTH).toBe(5);
    expect(shouldContinueAgentLoop(1, 1)).toBe(true);
    expect(shouldContinueAgentLoop(1, 4)).toBe(true);
    expect(shouldContinueAgentLoop(1, 5)).toBe(false);
    expect(shouldContinueAgentLoop(1, 6)).toBe(false);
  });

  it("stops loop when no tool calls were emitted in current iteration", () => {
    expect(shouldContinueAgentLoop(0, 1)).toBe(false);
    expect(shouldContinueAgentLoop(0, 3)).toBe(false);
  });

  it("builds next iteration messages with assistant tool_calls and tool role outputs", () => {
    const baseHistory: ChatMessageParam[] = [
      { role: "user", content: "Delete the meeting scheduled for today 2pm" },
    ];

    const toolCalls: ToolCallItem[] = [
      {
        id: "call_abc",
        name: "get_calendar_events",
        arguments: JSON.stringify({ query: "meeting" }),
        status: "success",
        result: JSON.stringify({
          count: 1,
          events: [{ id: "evt_99", title: "Meeting", date: "2026-11-26" }],
        }),
      },
    ];

    const nextHistory = buildNextIterationMessages(baseHistory, "", toolCalls);

    // Should contain base user message + assistant message + tool message
    expect(nextHistory.length).toBe(3);
    expect(nextHistory[0].role).toBe("user");

    // Assistant message contains tool_calls
    const assistantMsg = nextHistory[1];
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls?.[0].id).toBe("call_abc");
    expect(assistantMsg.toolCalls?.[0].function.name).toBe("get_calendar_events");

    // Tool response message contains toolCallId and result content
    const toolMsg = nextHistory[2];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.toolCallId).toBe("call_abc");
    expect(toolMsg.name).toBe("get_calendar_events");
    expect(toolMsg.content).toContain("evt_99");
  });

  it("handles null content and empty tool result gracefully", () => {
    const baseHistory: ChatMessageParam[] = [];
    const toolCalls: ToolCallItem[] = [
      {
        id: "call_xyz",
        name: "delete_task",
        arguments: JSON.stringify({ id: "t_1" }),
        status: "success",
      },
    ];

    const nextHistory = buildNextIterationMessages(baseHistory, "   ", toolCalls);
    expect(nextHistory[0].content).toBeNull();
    expect(nextHistory[1].content).toBe(JSON.stringify({ status: "success" }));
  });
});
