import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RightRailContextMeter } from "./RightRailContextMeter";

vi.mock("../../../services/aiService", () => ({
  fetchChatSessions: vi.fn().mockResolvedValue([{ id: "s1", title: "Session 1" }]),
  fetchChatMessages: vi.fn().mockResolvedValue([
    {
      id: "m1",
      sessionId: "s1",
      role: "user",
      content: "Hello AI",
      createdAt: Date.now(),
    },
    {
      id: "m2",
      sessionId: "s1",
      role: "assistant",
      content: "Hello human",
      createdAt: Date.now(),
    },
  ]),
  loadAiSettings: vi.fn().mockReturnValue({
    provider: "openai",
    model: "gpt-4o",
    systemPrompt: "You are tactical AI.",
  }),
}));

describe("RightRailContextMeter Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the compact CTX meter on the rail", async () => {
    render(<RightRailContextMeter />);

    await waitFor(() => {
      expect(screen.getByTestId("right-rail-context-meter")).toBeInTheDocument();
      expect(screen.getByText("CTX")).toBeInTheDocument();
    });
  });

  it("opens details flyout with breakdown percentages when clicked", async () => {
    render(<RightRailContextMeter />);

    const meterBtn = await screen.findByTestId("right-rail-context-meter");
    fireEvent.click(meterBtn);

    expect(screen.getByTestId("context-meter-details")).toBeInTheDocument();
    expect(screen.getByText("CONTEXT TELEMETRY")).toBeInTheDocument();
    expect(screen.getByText("Chat Messages")).toBeInTheDocument();
    expect(screen.getByText("Tool Context & Schema")).toBeInTheDocument();
    expect(screen.getByText("System & Time Prompt")).toBeInTheDocument();
  });
});
