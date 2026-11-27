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
  startTime: number;
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
      return this.handleChunk(payload).catch(() => {});
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
      startTime: Date.now(),
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
    await this.finalizeTurn(content, assistantId);
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
      const callId =
        tool.id && tool.id.trim() && !tool.id.startsWith("tc_")
          ? `${tool.id}_s${this.activeTurn.iteration}`
          : `tc_${this.activeTurn.iteration}_${Math.random().toString(36).slice(2, 7)}`;
      const normalizedTool = { ...tool, id: callId };
      const toolStartTime = Date.now();
      const currentStep = this.activeTurn.iteration;

      const tcItem: ToolCallItem = {
        id: callId,
        name: tool.name,
        arguments: tool.arguments,
        status: "executing",
        step: currentStep,
      };

      const existing = this.activeTurn.toolCalls;
      if (!existing.some((t) => t.id === tcItem.id)) {
        this.activeTurn.toolCalls = [...existing, tcItem];
        this.notifySubscribers();
      }

      const p = (async () => {
        const dummySetMessages = () => {};
        const result = await handleToolExecution(
          normalizedTool,
          assistantId,
          dummySetMessages,
          this.activeTurn?.sessionId || null
        );

        const durationMs = Math.max(1, Date.now() - toolStartTime);
        const isError = result.includes('"status":"error"') || result.includes('"error":');
        const status = isError ? ("error" as const) : ("success" as const);

        if (this.activeTurn && this.activeTurn.assistantId === assistantId) {
          this.activeTurn.toolCalls = this.activeTurn.toolCalls.map((t) =>
            t.id === callId
              ? { ...t, status, result, durationMs, step: t.step ?? currentStep }
              : t
          );
          this.notifySubscribers();
        }

        return {
          id: callId,
          name: tool.name,
          arguments: tool.arguments,
          result,
          durationMs,
          step: currentStep,
        };
      })();

      this.activeToolPromises.push(p);
    } else if (payload.chunkType === "done") {
      const executedTools = await Promise.all(this.activeToolPromises);
      this.activeToolPromises = [];

      if (this.isAborted || !this.activeTurn || this.activeTurn.assistantId !== assistantId) return;

      const allPreviousTools = this.activeTurn.toolCalls.filter(
        (t) => !executedTools.some((curr) => curr.id === t.id)
      );

      const shouldContinue = shouldContinueAgentLoop(
        executedTools.map((t) => ({ ...t, status: "success" as const })),
        this.activeTurn.iteration,
        allPreviousTools,
        this.activeTurn.accumulatedContent
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
          await this.finalizeTurn(this.activeTurn.accumulatedContent || "Agent execution failed.");
        }
      } else {
        const finalContent = this.activeTurn.accumulatedContent.trim()
          ? this.activeTurn.accumulatedContent
          : formatToolFallbackResponse(this.activeTurn.toolCalls);
        await this.finalizeTurn(finalContent);
      }
    } else if (payload.chunkType === "error") {
      const errMsg = payload.delta || "AI streaming connection encountered an error.";
      await this.finalizeTurn(this.activeTurn.accumulatedContent || errMsg);
    }
  }

  private async finalizeTurn(content: string, overrideAssistantId?: string): Promise<void> {
    if (!this.activeTurn) return;

    const targetAssistantId = overrideAssistantId || this.activeTurn.assistantId;
    const sessionId = this.activeTurn.sessionId;
    const totalDurationMs = Math.max(1, Date.now() - (this.activeTurn.startTime || Date.now()));
    const toolCalls = this.activeTurn.toolCalls.map((tc) =>
      tc.status === "executing"
        ? { ...tc, status: "success" as const, durationMs: tc.durationMs ?? 10 }
        : tc
    );

    const finalMessage: ChatMessageItem = {
      id: targetAssistantId,
      sessionId,
      role: "assistant",
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      durationMs: totalDurationMs,
      createdAt: Date.now(),
    };

    await persistChatMessage(finalMessage).catch(() => {});

    this.activeTurn = null;
    this.notifySubscribers();
  }
}

export const chatCoordinator = new ChatCoordinator();
