import { describe, it, expect, beforeEach, vi } from "vitest";
import { chatCoordinator } from "./chatCoordinator";
import * as aiService from "../../services/aiService";

vi.mock("../../services/aiService", () => ({
  streamChat: vi.fn().mockResolvedValue(undefined),
  onStreamChunk: vi.fn(),
  persistChatMessage: vi.fn().mockResolvedValue(undefined),
  loadAiSettings: vi.fn().mockReturnValue({
    provider: "openai",
    model: "gpt-4o",
    enableTools: true,
  }),
  abortChatStream: vi.fn().mockResolvedValue(undefined),
}));

describe("chatCoordinator", () => {
  let chunkHandler: (payload: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiService.onStreamChunk).mockImplementation((cb: any) => {
      chunkHandler = cb;
      return Promise.resolve(() => {});
    });
    chatCoordinator.init();
  });

  it("starts a turn and notifies subscribers", async () => {
    const subscriber = vi.fn();
    const unsub = chatCoordinator.subscribe(subscriber);

    await chatCoordinator.startTurn("sess_1", [{ role: "user", content: "hello" }], "a_1");

    expect(chatCoordinator.getActiveTurn("sess_1")).not.toBeNull();
    expect(aiService.streamChat).toHaveBeenCalledWith(
      "sess_1",
      [{ role: "user", content: "hello" }],
      expect.anything(),
      expect.anything()
    );
    expect(subscriber).toHaveBeenCalled();
    unsub();
  });

  it("accumulates text chunks and finalizes on done", async () => {
    const subscriber = vi.fn();
    const unsub = chatCoordinator.subscribe(subscriber);

    await chatCoordinator.startTurn("sess_2", [{ role: "user", content: "test" }], "a_2");

    chunkHandler({ sessionId: "sess_2", chunkType: "text", delta: "Hello " });
    chunkHandler({ sessionId: "sess_2", chunkType: "text", delta: "world!" });

    const active = chatCoordinator.getActiveTurn("sess_2");
    expect(active?.accumulatedContent).toBe("Hello world!");

    await chunkHandler({ sessionId: "sess_2", chunkType: "done", delta: "" });

    expect(chatCoordinator.getActiveTurn("sess_2")).toBeNull();
    expect(aiService.persistChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a_2",
        sessionId: "sess_2",
        content: "Hello world!",
      })
    );
    unsub();
  });

  it("stops an active turn cleanly and calls abortChatStream", async () => {
    await chatCoordinator.startTurn("sess_3", [{ role: "user", content: "abort me" }], "a_3");

    chunkHandler({ sessionId: "sess_3", chunkType: "text", delta: "Partial response..." });

    await chatCoordinator.stopTurn();

    expect(aiService.abortChatStream).toHaveBeenCalledWith("sess_3");
    expect(chatCoordinator.getActiveTurn("sess_3")).toBeNull();
    expect(aiService.persistChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a_3",
        sessionId: "sess_3",
        content: expect.stringContaining("Partial response..."),
      })
    );
  });
});
