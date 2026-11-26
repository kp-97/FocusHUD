import type {
  ChatMessageItem,
  ChatMessageParam,
  StreamChunkPayload,
  ToolCallItem,
} from "../../types/ai";
import { DEFAULT_AI_TOOLS } from "../../types/ai";
import {
  streamChat,
  onStreamChunk,
  persistChatMessage,
  loadAiSettings,
  abortChatStream,
} from "../../services/aiService";
import { handleToolExecution, formatToolFallbackResponse } from "./chatToolUtils";
import { buildNextIterationMessages, shouldContinueAgentLoop } from "./agentLoop";

export interface ActiveTurnState {
  sessionId: string;
  assistantId: string;
  accumulatedContent: string;
  toolCalls: ToolCallItem[];
  isGenerating: boolean;
  iteration: number;
  baseHistory: ChatMessageParam[];
}

type TurnSubscriber = (state: ActiveTurnState | null) => void;

class ChatCoordinator {
  private activeTurn: ActiveTurnState | null = null;
  private subscribers = new Set<TurnSubscriber>();
  private activeToolPromises: Array<
    Promise<{ id: string; name: string; arguments: string; result: string }>
  > = [];
  private isInitialized = false;
  private isAborted = false;

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    onStreamChunk((payload: StreamChunkPayload) => {
      this.handleChunk(payload).catch(() => {});
    });
  }

  public getActiveTurn(sessionId?: string | null): ActiveTurnState | null {
    if (!this.activeTurn) return null;
    if (sessionId && this.activeTurn.sessionId !== sessionId) return null;
    return this.activeTurn;
  }

  public subscribe(subscriber: TurnSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.activeTurn);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.activeTurn ? { ...this.activeTurn } : null);
      } catch {}
    }
  }

  public async startTurn(
    sessionId: string,
    history: ChatMessageParam[],
    initialAssistantId: string
  ): Promise<void> {
    this.isAborted = false;
    this.activeToolPromises = [];

    this.activeTurn = {
      sessionId,
      assistantId: initialAssistantId,
      accumulatedContent: "",
      toolCalls: [],
      isGenerating: true,
      iteration: 1,
      baseHistory: history,
    };

    this.notifySubscribers();

    const settings = loadAiSettings();
    const toolsToOffer = settings.enableTools
      ? DEFAULT_AI_TOOLS.filter((t) => t.name !== "get_system_diagnostics" || settings.enableContext)
      : undefined;

    try {
      await streamChat(sessionId, history, settings, toolsToOffer);
    } catch {
      this.finalizeTurn("Error connecting to AI Provider. Please verify settings.");
    }
  }

  public async stopTurn(): Promise<void> {
    if (!this.activeTurn || !this.activeTurn.isGenerating) return;

    this.isAborted = true;
    const currentSessionId = this.activeTurn.sessionId;
    const assistantId = this.activeTurn.assistantId;
    const content = this.activeTurn.accumulatedContent.trim()
      ? `${this.activeTurn.accumulatedContent}\n\n*[Stopped by operator]*`
      : "*[Generation stopped by operator]*";

    await abortChatStream(currentSessionId).catch(() => {});
    this.finalizeTurn(content, assistantId);
  }

  private async handleChunk(payload: StreamChunkPayload): Promise<void> {
    if (!this.activeTurn || this.isAborted) return;
    if (payload.sessionId !== this.activeTurn.sessionId) return;

    const assistantId = this.activeTurn.assistantId;

    if (payload.chunkType === "text") {
      this.activeTurn.accumulatedContent += payload.delta;
      this.notifySubscribers();
    } else if (payload.chunkType === "tool_call" && payload.toolCall) {
      const tool = payload.toolCall;
      const tcItem: ToolCallItem = {
        id: tool.id,
        name: tool.name,
        arguments: tool.arguments,
        status: "executing",
      };

      const existing = this.activeTurn.toolCalls;
      if (!existing.some((t) => t.id === tcItem.id)) {
        this.activeTurn.toolCalls = [...existing, tcItem];
        this.notifySubscribers();
      }

      const p = (async () => {
        const dummySetMessages = () => {};
        const result = await handleToolExecution(
          tool,
          assistantId,
          dummySetMessages,
          this.activeTurn?.sessionId || null
        );

        if (this.activeTurn && this.activeTurn.assistantId === assistantId) {
          this.activeTurn.toolCalls = this.activeTurn.toolCalls.map((t) =>
            t.id === tool.id ? { ...t, status: "success" as const, result } : t
          );
          this.notifySubscribers();
        }

        return {
          id: tool.id,
          name: tool.name,
          arguments: tool.arguments,
          result,
        };
      })();

      this.activeToolPromises.push(p);
    } else if (payload.chunkType === "done") {
      const executedTools = await Promise.all(this.activeToolPromises);
      this.activeToolPromises = [];

      if (this.isAborted || !this.activeTurn || this.activeTurn.assistantId !== assistantId) return;

      const shouldContinue = shouldContinueAgentLoop(
        executedTools.length,
        this.activeTurn.iteration
      );

      if (shouldContinue) {
        this.activeTurn.iteration += 1;
        const nextHistory = buildNextIterationMessages(
          this.activeTurn.baseHistory,
          this.activeTurn.accumulatedContent,
          executedTools.map((t) => ({ ...t, status: "success" as const }))
        );
        this.activeTurn.baseHistory = nextHistory;
        this.notifySubscribers();

        const settings = loadAiSettings();
        const toolsToOffer = settings.enableTools
          ? DEFAULT_AI_TOOLS.filter((t) => t.name !== "get_system_diagnostics" || settings.enableContext)
          : undefined;

        try {
          await streamChat(payload.sessionId, nextHistory, settings, toolsToOffer);
        } catch {
          this.finalizeTurn(this.activeTurn.accumulatedContent || "Agent execution failed.");
        }
      } else {
        const finalContent = this.activeTurn.accumulatedContent.trim()
          ? this.activeTurn.accumulatedContent
          : formatToolFallbackResponse(this.activeTurn.toolCalls);
        this.finalizeTurn(finalContent);
      }
    } else if (payload.chunkType === "error") {
      const errMsg = payload.delta || "AI streaming connection encountered an error.";
      this.finalizeTurn(this.activeTurn.accumulatedContent || errMsg);
    }
  }

  private finalizeTurn(content: string, overrideAssistantId?: string): void {
    if (!this.activeTurn) return;

    const targetAssistantId = overrideAssistantId || this.activeTurn.assistantId;
    const sessionId = this.activeTurn.sessionId;
    const toolCalls = this.activeTurn.toolCalls;

    const finalMessage: ChatMessageItem = {
      id: targetAssistantId,
      sessionId,
      role: "assistant",
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      createdAt: Date.now(),
    };

    persistChatMessage(finalMessage).catch(() => {});

    this.activeTurn = null;
    this.notifySubscribers();
  }
}

export const chatCoordinator = new ChatCoordinator();
