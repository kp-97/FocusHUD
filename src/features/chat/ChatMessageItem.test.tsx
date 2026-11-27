import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatMessageItem } from "./ChatMessageItem";
import type { ChatMessageItem as ChatMessageType } from "../../types/ai";

describe("ChatMessageItem", () => {
  it("renders user message without AI duration badge", () => {
    const userMsg: ChatMessageType = {
      id: "u_1",
      sessionId: "sess_1",
      role: "user",
      content: "Can you analyze this project?",
      createdAt: 1700000000000,
    };

    render(<ChatMessageItem message={userMsg} />);
    expect(screen.getByText("OPERATOR")).toBeInTheDocument();
    expect(screen.getByText("Can you analyze this project?")).toBeInTheDocument();
    expect(screen.queryByTestId("message-elapsed-time")).not.toBeInTheDocument();
  });

  it("renders assistant message with total duration and step-level elapsed times", () => {
    const assistantMsg: ChatMessageType = {
      id: "a_1",
      sessionId: "sess_1",
      role: "assistant",
      content: "Analysis complete.",
      createdAt: 1700000000000,
      durationMs: 3450,
      toolCalls: [
        {
          id: "tc_1",
          name: "search_notes",
          arguments: '{"query":"assignment 1"}',
          status: "success",
          durationMs: 142,
          step: 1,
        },
        {
          id: "tc_2",
          name: "get_tasks",
          arguments: '{"status":"all"}',
          status: "success",
          durationMs: 85,
          step: 2,
        },
      ],
    };

    render(<ChatMessageItem message={assistantMsg} />);

    // Header info
    expect(screen.getByText("TACTICAL AI")).toBeInTheDocument();
    const totalTimeEl = screen.getByTestId("message-elapsed-time");
    expect(totalTimeEl).toBeInTheDocument();
    expect(totalTimeEl).toHaveTextContent("3.5s");

    // Tool steps
    expect(screen.getByTestId("tool-step-0")).toHaveTextContent("STEP 1");
    expect(screen.getByTestId("tool-duration-0")).toHaveTextContent("142ms");

    expect(screen.getByTestId("tool-step-1")).toHaveTextContent("STEP 2");
    expect(screen.getByTestId("tool-duration-1")).toHaveTextContent("85ms");
  });

  it("renders live elapsed duration ticker when isGenerating is true", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const assistantMsg: ChatMessageType = {
      id: "a_2",
      sessionId: "sess_1",
      role: "assistant",
      content: "",
      createdAt: now,
    };

    render(<ChatMessageItem message={assistantMsg} isGenerating={true} />);

    const totalTimeEl = screen.getByTestId("message-elapsed-time");
    expect(totalTimeEl).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(totalTimeEl).toHaveTextContent("1.5s");
    vi.useRealTimers();
  });
});
