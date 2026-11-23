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
});
