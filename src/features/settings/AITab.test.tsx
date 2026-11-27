import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AITab } from "./AITab";
import * as aiService from "../../services/aiService";

describe("AITab Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all AI providers and default settings", () => {
    render(<AITab />);

    expect(screen.getByText(/AI MODEL PROVIDER/i)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE: OLLAMA/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ollama/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anthropic/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gemini/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Model Identifier/i)).toHaveValue("llama3.2");
  });

  it("auto-saves immediately on change to localStorage", () => {
    render(<AITab />);

    const modelInput = screen.getByLabelText(/Model Identifier/i);
    fireEvent.change(modelInput, { target: { value: "custom-local-model" } });

    const saved = aiService.loadAiSettings();
    expect(saved.model).toBe("custom-local-model");
  });

  it("switches provider and updates model defaults", () => {
    render(<AITab />);

    const openaiButton = screen.getByRole("button", { name: /OPENAI/i });
    fireEvent.click(openaiButton);

    expect(screen.getByLabelText(/Model Identifier/i)).toHaveValue("gpt-4o-mini");
    expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
  });

  it("toggles API key visibility", () => {
    render(<AITab />);

    // Switch to OpenAI to reveal API key input
    fireEvent.click(screen.getByRole("button", { name: /OPENAI/i }));

    const keyInput = screen.getByLabelText(/API Key/i);
    expect(keyInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByTitle(/Show API Key/i);
    fireEvent.click(toggleBtn);

    expect(keyInput).toHaveAttribute("type", "text");
  });

  it("detects local https and allows one-click fix to http://", () => {
    render(<AITab />);

    const endpointInput = screen.getByLabelText(/API Endpoint URL/i);
    fireEvent.change(endpointInput, { target: { value: "https://localhost:1234/v1/chat/completions" } });

    expect(screen.getByText(/Local servers \(LM Studio, Ollama\) use HTTP, not HTTPS/i)).toBeInTheDocument();

    const fixBtn = screen.getByRole("button", { name: /Fix to http:\/\//i });
    fireEvent.click(fixBtn);

    expect(endpointInput).toHaveValue("http://localhost:1234/v1/chat/completions");
  });

  it("queries model server and allows selecting an available model", async () => {
    render(<AITab />);

    const testBtn = screen.getByRole("button", { name: /TEST SERVER & FETCH MODELS/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Server operational! Discovered/i)).toBeInTheDocument();
    });

    const modelBadge = screen.getByTitle(/Select model: mistral/i);
    expect(modelBadge).toBeInTheDocument();

    fireEvent.click(modelBadge);
    expect(screen.getByLabelText(/Model Identifier/i)).toHaveValue("mistral");
  });

  it("allows selecting context window size and auto-saves", () => {
    render(<AITab />);

    const select = screen.getByLabelText(/Context Window & GPU VRAM Allocation/i);
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "16384" } });

    const saved = aiService.loadAiSettings();
    expect(saved.contextSize).toBe(16384);
  });

  it("allows selecting auto-compact context threshold and auto-saves", () => {
    render(<AITab />);

    const select = screen.getByLabelText(/Auto-Compact Threshold/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("70");

    fireEvent.change(select, { target: { value: "80" } });

    const saved = aiService.loadAiSettings();
    expect(saved.autoCompactThresholdPct).toBe(80);
  });
});
