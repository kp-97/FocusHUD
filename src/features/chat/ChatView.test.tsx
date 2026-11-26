import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ChatView } from "./ChatView";
import * as aiService from "../../services/aiService";

vi.mock("../../components/ui/WaveformVisualizer", () => ({
  WaveformVisualizer: () => <div data-testid="waveform-mock" />,
}));

describe("ChatView Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders ChatView with header and initial message", async () => {
    render(<ChatView />);

    expect(screen.getByTestId("chat-view")).toBeInTheDocument();
    expect(screen.getByText(/AI AGENT CHAT/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/FocusHUD AI Agent initialized/i)).toBeInTheDocument();
    });
  });

  it("toggles streaming mode button", async () => {
    render(<ChatView />);

    const toggleBtn = screen.getByTitle(
      /Toggle between real-time streaming and complete message dispatch/i
    );
    expect(toggleBtn).toHaveTextContent("STREAM");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent("COMPLETE");
  });

  it("opens and closes the session drawer", async () => {
    render(<ChatView />);

    const logsBtn = screen.getByRole("button", { name: /Chat Sessions History/i });
    fireEvent.click(logsBtn);

    expect(screen.getByText(/SESSION LOGS/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /NEW CHAT SESSION/i })).toBeInTheDocument();

    const closeBtn = screen.getByTitle(/Close Sessions/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/SESSION LOGS/i)).not.toBeInTheDocument();
  });

  it("allows user to type and send a prompt", async () => {
    const streamChatSpy = vi.spyOn(aiService, "streamChat").mockResolvedValue(undefined);

    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByText(/FocusHUD AI Agent initialized/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask tactical agent/i);
    fireEvent.change(input, { target: { value: "Review telemetry" } });

    const sendBtn = screen.getByRole("button", { name: /Send Command/i });
    fireEvent.click(sendBtn);

    expect(screen.getByText("Review telemetry")).toBeInTheDocument();
    await waitFor(() => {
      expect(streamChatSpy).toHaveBeenCalled();
    });
  });

  it("renders markdown formatting in messages", async () => {
    vi.spyOn(aiService, "fetchChatSessions").mockResolvedValue([
      {
        id: "sess_1",
        title: "Test Session",
        provider: "ollama",
        model: "llama3.2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    vi.spyOn(aiService, "fetchChatMessages").mockResolvedValue([
      {
        id: "msg_md",
        sessionId: "sess_1",
        role: "assistant",
        content: "### **Task Management**\n* **Create Tasks:** Available tool\n`inline_code`",
        createdAt: Date.now(),
      },
    ]);

    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Task Management");
      expect(screen.getByText("Create Tasks:")).toBeInTheDocument();
      expect(screen.getByText("inline_code")).toBeInTheDocument();
    });
  });

  it("allows starting a new conversation via header button", async () => {
    const persistSessionSpy = vi.spyOn(aiService, "persistChatSession").mockResolvedValue(undefined);

    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start New Conversation/i })).toBeInTheDocument();
    });

    const newBtn = screen.getByRole("button", { name: /Start New Conversation/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(persistSessionSpy).toHaveBeenCalled();
    });
  });

  it("allows deleting the current conversation with inline confirmation", async () => {
    const removeSessionSpy = vi.spyOn(aiService, "removeChatSession").mockResolvedValue(undefined);
    vi.spyOn(aiService, "fetchChatSessions").mockResolvedValue([
      {
        id: "sess_to_delete",
        title: "Deletable Session",
        provider: "ollama",
        model: "llama3.2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete Current Conversation/i })).toBeInTheDocument();
    });

    const delBtn = screen.getByRole("button", { name: /Delete Current Conversation/i });
    fireEvent.click(delBtn);

    expect(screen.getByText("DEL?")).toBeInTheDocument();
    const yesBtn = screen.getByRole("button", { name: /Confirm Delete Conversation/i });
    fireEvent.click(yesBtn);

    await waitFor(() => {
      expect(removeSessionSpy).toHaveBeenCalledWith("sess_to_delete");
    });
  });

  it("renders stop button during generation and allows stopping", async () => {
    const { chatCoordinator } = await import("./chatCoordinator");
    const stopSpy = vi.spyOn(chatCoordinator, "stopTurn").mockResolvedValue(undefined);

    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByText(/FocusHUD AI Agent initialized/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask tactical agent/i);
    fireEvent.change(input, { target: { value: "Run heavy task" } });

    const sendBtn = screen.getByTestId("chat-send-button");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByTestId("chat-stop-button")).toBeInTheDocument();
    });

    const stopBtn = screen.getByTestId("chat-stop-button");
    fireEvent.click(stopBtn);

    expect(stopSpy).toHaveBeenCalled();
  });

  it("queues messages when user sends while agent is generating", async () => {
    render(<ChatView />);

    await waitFor(() => {
      expect(screen.getByText(/FocusHUD AI Agent initialized/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask tactical agent/i);
    fireEvent.change(input, { target: { value: "First message" } });
    fireEvent.click(screen.getByTestId("chat-send-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-stop-button")).toBeInTheDocument();
    });

    // While generating, queue a second message
    fireEvent.change(input, { target: { value: "Second queued message" } });
    expect(screen.getByTestId("chat-queue-button")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chat-queue-button"));

    expect(screen.getByTestId("queued-messages-bar")).toBeInTheDocument();
    expect(screen.getByText(/QUEUED \(1\):/i)).toBeInTheDocument();
    expect(screen.getByText(/"Second queued message"/i)).toBeInTheDocument();
  });
});
