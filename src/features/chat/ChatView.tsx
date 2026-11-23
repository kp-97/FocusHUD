import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, Radio, History } from "lucide-react";
import { WaveformVisualizer } from "../../components/ui/WaveformVisualizer";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatSessionDrawer } from "./ChatSessionDrawer";
import type {
  ChatMessageItem as ChatMessageType,
  ChatSessionItem,
  StreamChunkPayload,
  ToolCallItem,
} from "../../types/ai";
import { DEFAULT_AI_TOOLS } from "../../types/ai";
import {
  fetchChatSessions,
  persistChatSession,
  removeChatSession,
  fetchChatMessages,
  persistChatMessage,
  streamChat,
  onStreamChunk,
  loadAiSettings,
  executeAiToolCall,
} from "../../services/aiService";
import { getSystemDiagnostics } from "../../services/tauriBridge";

export interface ChatViewProps {
  isCompact?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ isCompact = false }) => {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const [streamMode, setStreamMode] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const activeAssistantMsgRef = useRef<HTMLDivElement | null>(null);
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const accumulatedContentRef = useRef<string>("");

  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  const streamModeRef = useRef(streamMode);
  streamModeRef.current = streamMode;

  const scrollToStartOfResponse = useCallback(() => {
    if (activeAssistantMsgRef.current) {
      activeAssistantMsgRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const scrollToStartOfResponseRef = useRef(scrollToStartOfResponse);
  scrollToStartOfResponseRef.current = scrollToStartOfResponse;

  // Initialize or load sessions
  const loadInitialData = useCallback(async () => {
    try {
      const existingSessions = await fetchChatSessions();
      setSessions(existingSessions);

      if (existingSessions.length > 0) {
        const latest = existingSessions[0];
        setCurrentSessionId(latest.id);
        const msgs = await fetchChatMessages(latest.id);
        setMessages(msgs);
      } else {
        await handleCreateSession();
      }
    } catch {
      // Fallback greeting if session load fails
      setMessages([
        {
          id: "m_welcome",
          sessionId: "default",
          role: "assistant",
          content: "FocusHUD Tactical Intelligence Online. How may I assist your workflow today?",
          createdAt: Date.now(),
        },
      ]);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle switching sessions
  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    try {
      const msgs = await fetchChatMessages(sessionId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  // Create a new session
  const handleCreateSession = async () => {
    const settings = loadAiSettings();
    const newSession: ChatSessionItem = {
      id: "sess_" + Date.now(),
      title: "Tactical Query",
      provider: settings.provider,
      model: settings.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persistChatSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([
      {
        id: "m_init_" + Date.now(),
        sessionId: newSession.id,
        role: "assistant",
        content: `FocusHUD AI Agent initialized (${settings.provider}:${settings.model}). Ready for instructions.`,
        createdAt: Date.now(),
      },
    ]);
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: string) => {
    await removeChatSession(sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (currentSessionId === sessionId) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        handleCreateSession();
      }
    }
  };

  // Wire up incoming stream chunk listener once on mount
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isCancelled = false;

    onStreamChunk(async (payload: StreamChunkPayload) => {
      if (isCancelled) return;
      const assistantId = currentAssistantMsgIdRef.current;
      if (!assistantId) return;
      if (currentSessionIdRef.current && payload.sessionId !== currentSessionIdRef.current) return;

      if (payload.chunkType === "text") {
        accumulatedContentRef.current += payload.delta;
        if (streamModeRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: accumulatedContentRef.current }
                : msg
            )
          );
        }
      } else if (payload.chunkType === "tool_call" && payload.toolCall) {
        const tool = payload.toolCall;
        const toolCallItem: ToolCallItem = {
          id: tool.id,
          name: tool.name,
          arguments: tool.arguments,
          status: "executing",
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, toolCalls: [...(msg.toolCalls || []), toolCallItem] }
              : msg
          )
        );

        try {
          const resultStr = await executeAiToolCall(tool.name, tool.arguments);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    toolCalls: (msg.toolCalls || []).map((tc) =>
                      tc.id === tool.id ? { ...tc, status: "success", result: resultStr } : tc
                    ),
                  }
                : msg
            )
          );
        } catch {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    toolCalls: (msg.toolCalls || []).map((tc) =>
                      tc.id === tool.id ? { ...tc, status: "error" } : tc
                    ),
                  }
                : msg
            )
          );
        }
      } else if (payload.chunkType === "done" || payload.chunkType === "error") {
        const finalContent =
          payload.chunkType === "error" && !accumulatedContentRef.current
            ? (payload.delta || "Error connecting to AI Provider. Please verify settings.")
            : accumulatedContentRef.current;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: finalContent } : msg
          )
        );
        setIsGenerating(false);

        const activeSess = currentSessionIdRef.current;
        if (activeSess && payload.chunkType === "done") {
          persistChatMessage({
            id: assistantId,
            sessionId: activeSess,
            role: "assistant",
            content: finalContent,
            createdAt: Date.now(),
          }).catch(() => {});
        }

        setTimeout(() => {
          scrollToStartOfResponseRef.current();
        }, 50);
      }
    }).then((fn) => {
      if (isCancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || isGenerating) return;

    const settings = loadAiSettings();
    let activeSession = currentSessionId;
    if (!activeSession) {
      activeSession = "sess_" + Date.now();
      setCurrentSessionId(activeSession);
      const newSession: ChatSessionItem = {
        id: activeSession,
        title: inputText.trim().slice(0, 24),
        provider: settings.provider,
        model: settings.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      persistChatSession(newSession).catch(() => {});
      setSessions((prev) => [newSession, ...prev]);
    }

    const userText = inputText.trim();
    setInputText("");

    const userMsg: ChatMessageType = {
      id: "u_" + Date.now(),
      sessionId: activeSession,
      role: "user",
      content: userText,
      createdAt: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    persistChatMessage(userMsg).catch(() => {});

    setIsGenerating(true);
    accumulatedContentRef.current = "";

    const assistantId = "a_" + Date.now();
    currentAssistantMsgIdRef.current = assistantId;

    const initialAssistantMsg: ChatMessageType = {
      id: assistantId,
      sessionId: activeSession,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    setMessages([...nextMessages, initialAssistantMsg]);

    try {
      // Build conversation payload with context injection if enabled
      let contextPrefix = "";
      if (settings.enableContext) {
        try {
          const diag = await getSystemDiagnostics();
          if (diag) {
            contextPrefix = `[Current FocusHUD Telemetry: CPU ${diag.cpu_usage.toFixed(1)}%, Mem ${diag.ram_usage.toFixed(1)}% (${(diag.ram_used_bytes / (1024 * 1024)).toFixed(0)}MB / ${(diag.ram_total_bytes / (1024 * 1024)).toFixed(0)}MB)]\n`;
          }
        } catch {}
      }

      const formattedHistory = nextMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m, idx, arr) => {
          if (idx === arr.length - 1 && contextPrefix && m.role === "user") {
            return { role: m.role, content: contextPrefix + m.content };
          }
          return { role: m.role, content: m.content };
        });

      await streamChat(
        activeSession,
        formattedHistory,
        settings,
        settings.enableTools ? DEFAULT_AI_TOOLS : undefined
      );
    } catch {
      setIsGenerating(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Error connecting to AI Provider. Please verify settings." }
            : msg
        )
      );
    }
  };

  return (
    <div
      data-testid="chat-view"
      className={`relative h-full w-full flex flex-col ${
        isCompact ? "p-1.5" : "p-2.5"
      } bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none`}
    >
      {/* Session Drawer Overlay */}
      {isDrawerOpen && (
        <ChatSessionDrawer
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Header with Streaming Mode Toggle & Sessions Button */}
      <div
        className={`w-full flex items-center justify-between border-b border-cyan-500/30 ${
          isCompact ? "pb-1 mb-1" : "pb-2 mb-2"
        } text-[10px] font-tech uppercase tracking-wider shrink-0`}
      >
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          {!isCompact && <span className="font-bold text-cyan-200">AI AGENT CHAT</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {/* History/Sessions Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            title="Chat Sessions History"
            aria-label="Chat Sessions History"
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 bg-black/40 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 transition cursor-pointer"
          >
            <History className="w-3 h-3 text-cyan-400" />
            {!isCompact && <span>LOGS</span>}
          </button>

          {/* Streaming Mode Toggle */}
          <button
            onClick={() => setStreamMode(!streamMode)}
            title="Toggle between real-time streaming and complete message dispatch"
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition cursor-pointer ${
              streamMode
                ? "bg-cyan-950/60 border-cyan-400/60 text-cyan-200 shadow-[0_0_8px_rgba(0,229,255,0.3)]"
                : "bg-black/40 border-cyan-500/20 text-cyan-400/70 hover:text-cyan-200"
            }`}
          >
            <Radio
              className={`w-3 h-3 ${streamMode ? "text-cyan-400 animate-pulse" : "text-neutral-500"}`}
            />
            <span>{streamMode ? "STREAM" : "COMPLETE"}</span>
          </button>
        </div>
      </div>

      {/* Voice Waveform Visualizer */}
      <div className={`${isCompact ? "mb-1" : "mb-2"} shrink-0`}>
        <WaveformVisualizer isCompact={isCompact} />
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesContainerRef}
        data-testid="chat-messages-container"
        className={`flex-1 min-h-0 overflow-y-auto ${
          isCompact ? "space-y-1.5" : "space-y-2.5"
        } pr-1`}
      >
        {messages.map((msg, idx) => {
          const isLastAssistant = msg.role === "assistant" && idx === messages.length - 1;
          return (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              isGenerating={isLastAssistant && isGenerating}
              refCallback={isLastAssistant ? (node) => (activeAssistantMsgRef.current = node) : undefined}
            />
          );
        })}
      </div>

      {/* Input Box */}
      <div className="mt-2 pt-2 border-t border-cyan-500/30 flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask tactical agent or request task/goal action..."
          disabled={isGenerating}
          aria-label="Ask tactical agent"
          className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 transition"
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isGenerating}
          title="Send Command"
          aria-label="Send Command"
          className="p-1.5 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 disabled:opacity-40 transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
