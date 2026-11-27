import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInputBar } from "./ChatInputBar";

describe("ChatInputBar Component", () => {
  it("renders textarea and send button when idle", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();
    const handleChange = vi.fn();

    render(
      <ChatInputBar
        inputText=""
        onChangeInputText={handleChange}
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={false}
      />
    );

    const textarea = screen.getByLabelText(/Ask tactical agent/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(screen.getByText(/Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/newline/i)).toBeInTheDocument();

    const sendBtn = screen.getByTestId("chat-send-button");
    expect(sendBtn).toBeDisabled();
  });

  it("calls onSend when Enter is pressed without Shift", () => {
    const handleSend = vi.fn();

    render(
      <ChatInputBar
        inputText="Plan my day"
        onChangeInputText={vi.fn()}
        onSend={handleSend}
        onStop={vi.fn()}
        isGenerating={false}
      />
    );

    const textarea = screen.getByLabelText(/Ask tactical agent/i);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it("does not call onSend when Shift+Enter is pressed (moves cursor to next line)", () => {
    const handleSend = vi.fn();

    render(
      <ChatInputBar
        inputText="First line"
        onChangeInputText={vi.fn()}
        onSend={handleSend}
        onStop={vi.fn()}
        isGenerating={false}
      />
    );

    const textarea = screen.getByLabelText(/Ask tactical agent/i);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(handleSend).not.toHaveBeenCalled();
  });

  it("renders stop button and queue button when isGenerating is true", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <ChatInputBar
        inputText="Next queued command"
        onChangeInputText={vi.fn()}
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={true}
      />
    );

    expect(screen.getByTestId("chat-stop-button")).toBeInTheDocument();
    const queueBtn = screen.getByTestId("chat-queue-button");
    expect(queueBtn).toBeInTheDocument();

    fireEvent.click(queueBtn);
    expect(handleSend).toHaveBeenCalled();

    const stopBtn = screen.getByTestId("chat-stop-button");
    fireEvent.click(stopBtn);
    expect(handleStop).toHaveBeenCalled();
  });
});
