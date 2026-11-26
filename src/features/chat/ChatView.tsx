import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, Radio, History, Plus, Trash2, Square, Clock, X, Archive } from "lucide-react";
import { WaveformVisualizer } from "../../components/ui/WaveformVisualizer";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatSessionDrawer } from "./ChatSessionDrawer";
import type {
  ChatMessageItem as ChatMessageType,
  ChatMessageParam,
  ChatSessionItem,
} from "../../types/ai";
import {
  fetchChatSessions,
  persistChatSession,
  removeChatSession,
  fetchChatMessages,
  persistChatMessage,
  loadAiSettings,
} from "../../services/aiService";
import { chatCoordinator } from "./chatCoordinator";
import { compactSession, useAutoCompaction } from "./chatCompactor";

const LAST_SESSION_STORAGE_KEY = "focushud_last_chat_session_id";

export interface ChatViewProps {
  isCompact?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ isCompact = false }) => {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const [streamMode, setStreamMode] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const activeAssistantMsgRef = useRef<HTMLDivElement | null>(null);
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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

      const activeTurn = chatCoordinator.getActiveTurn();
      const savedSessionId = localStorage.getItem(LAST_SESSION_STORAGE_KEY);

      let targetSessionId: string | null = null;
      if (activeTurn && existingSessions.some((s) => s.id === activeTurn.sessionId)) {
        targetSessionId = activeTurn.sessionId;
      } else if (savedSessionId && existingSessions.some((s) => s.id === savedSessionId)) {
        targetSessionId = savedSessionId;
      } else if (existingSessions.length > 0) {
        targetSessionId = existingSessions[0].id;
      }

      if (targetSessionId) {
        setCurrentSessionId(targetSessionId);
        const msgs = await fetchChatMessages(targetSessionId);
        setMessages(msgs);
      } else {
        await handleCreateSession();
      }
    } catch {
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

  // Auto-compaction hook
  const settings = loadAiSettings();
  useAutoCompaction(
    currentSessionId,
    messages,
    isGenerating,
    settings.autoCompactMinutes ?? 1,
    (compacted) => setMessages(compacted)
  );

  // Handle switching sessions
  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    try {
      localStorage.setItem(LAST_SESSION_STORAGE_KEY, sessionId);
      const msgs = await fetchChatMessages(sessionId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  // Create a new session
  const handleCreateSession = async () => {
    const currentSettings = loadAiSettings();
    const newSession: ChatSessionItem = {
      id: "sess_" + Date.now(),
      title: "Tactical Query",
      provider: currentSettings.provider,
      model: currentSettings.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persistChatSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    localStorage.setItem(LAST_SESSION_STORAGE_KEY, newSession.id);
    setMessages([
      {
        id: "m_init_" + Date.now(),
        sessionId: newSession.id,
        role: "assistant",
        content: `FocusHUD AI Agent initialized (${currentSettings.provider}:${currentSettings.model}). Ready for instructions.`,
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

  // Core execution logic for sending a user prompt
  const executeSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const currentSettings = loadAiSettings();
    let activeSession = currentSessionIdRef.current;
    if (!activeSession) {
      activeSession = "sess_" + Date.now();
      setCurrentSessionId(activeSession);
      const newSession: ChatSessionItem = {
        id: activeSession,
        title: text.trim().slice(0, 24),
        provider: currentSettings.provider,
        model: currentSettings.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      persistChatSession(newSession).catch(() => {});
      setSessions((prev) => [newSession, ...prev]);
    }

    localStorage.setItem(LAST_SESSION_STORAGE_KEY, activeSession);

    const userMsg: ChatMessageType = {
      id: "u_" + Date.now(),
      sessionId: activeSession,
      role: "user",
      content: text.trim(),
      createdAt: Date.now(),
    };

    const currentMsgs = messagesRef.current;
    const nextMessages = [...currentMsgs, userMsg];
    setMessages(nextMessages);
    persistChatMessage(userMsg).catch(() => {});

    setIsGenerating(true);
    const assistantId = "a_" + Date.now();

    const initialAssistantMsg: ChatMessageType = {
      id: assistantId,
      sessionId: activeSession,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    setMessages([...nextMessages, initialAssistantMsg]);

    const formattedHistory: ChatMessageParam[] = nextMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    await chatCoordinator.startTurn(activeSession, formattedHistory, assistantId);
  }, []);

  // Wire up incoming stream chunk listener via chatCoordinator
  useEffect(() => {
    chatCoordinator.init();
    let renderRaf: number | null = null;

    const unsubscribe = chatCoordinator.subscribe((turn) => {
      if (!turn || turn.sessionId !== currentSessionIdRef.current) {
        setIsGenerating(false);
        if (!turn && currentSessionIdRef.current) {
          fetchChatMessages(currentSessionIdRef.current)
            .then((msgs) => {
              setMessages(msgs);
              setTimeout(() => {
                scrollToStartOfResponseRef.current();
              }, 50);

              // Check if queued messages exist to auto-execute next
              setQueuedMessages((currentQueue) => {
                if (currentQueue.length > 0) {
                  const [nextMsg, ...rest] = currentQueue;
                  setTimeout(() => {
                    executeSend(nextMsg);
                  }, 150);
                  return rest;
                }
                return currentQueue;
              });
            })
            .catch(() => {});
        }
        return;
      }

      setIsGenerating(turn.isGenerating);

      // Throttled RAF render to prevent UI freezing during fast token streaming
      if (renderRaf) return;
      renderRaf = requestAnimationFrame(() => {
        renderRaf = null;
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === turn.assistantId);
          if (!exists) {
            return [
              ...prev,
              {
                id: turn.assistantId,
                sessionId: turn.sessionId,
                role: "assistant",
                content: turn.accumulatedContent,
                toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
                createdAt: Date.now(),
              },
            ];
          }
          return prev.map((msg) =>
            msg.id === turn.assistantId
              ? {
                  ...msg,
                  content: turn.accumulatedContent,
                  toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : msg.toolCalls,
                }
              : msg
          );
        });
      });
    });

    return () => {
      if (renderRaf) cancelAnimationFrame(renderRaf);
      unsubscribe();
    };
  }, [executeSend]);

  // Send message or queue if busy
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");

    if (isGenerating) {
      setQueuedMessages((prev) => [...prev, text]);
      return;
    }

    await executeSend(text);
  };

  // Stop active generation
  const handleStop = async () => {
    await chatCoordinator.stopTurn();
    setIsGenerating(false);
  };

  // Manual compaction button
  const handleManualCompact = async () => {
    if (!currentSessionId || messages.length <= 2 || isGenerating) return;
    const compacted = await compactSession(currentSessionId, messages);
    setMessages(compacted);
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
          {/* Compact Button */}
          <button
            onClick={handleManualCompact}
            title="Compact Chat History to Conserve Context Tokens"
            aria-label="Compact Chat History"
            disabled={messages.length <= 2 || isGenerating}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 bg-black/40 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 transition cursor-pointer disabled:opacity-40"
          >
            <Archive className="w-3 h-3 text-cyan-400" />
            {!isCompact && <span>COMPACT</span>}
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleCreateSession}
            title="Start New Conversation"
            aria-label="Start New Conversation"
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 bg-black/40 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            {!isCompact && <span>NEW</span>}
          </button>

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

          {/* Delete Current Conversation Button */}
          {confirmDeleteSession ? (
            <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 rounded px-1.5 py-0.5 text-[9px] font-tech text-red-200 select-none">
              <span>DEL?</span>
              <button
                onClick={async () => {
                  setConfirmDeleteSession(false);
                  if (currentSessionId) {
                    await handleDeleteSession(currentSessionId);
                  }
                }}
                aria-label="Confirm Delete Conversation"
                className="font-bold text-red-400 hover:text-red-200 underline cursor-pointer"
              >
                YES
              </button>
              <button
                onClick={() => setConfirmDeleteSession(false)}
                className="text-cyan-300 hover:text-cyan-100 cursor-pointer ml-0.5"
              >
                NO
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteSession(true)}
              title="Delete Current Conversation"
              aria-label="Delete Current Conversation"
              className="flex items-center p-1 rounded border border-cyan-500/30 hover:border-red-400/60 bg-black/40 hover:bg-red-950/40 text-cyan-400/60 hover:text-red-400 transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

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

      {/* Queued Messages Notification Bar */}
      {queuedMessages.length > 0 && (
        <div
          data-testid="queued-messages-bar"
          className="flex items-center gap-1.5 px-2 py-1 mb-1 rounded bg-amber-950/50 border border-amber-500/40 text-[10px] font-tech text-amber-200 shrink-0"
        >
          <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-spin" />
          <span className="font-bold tracking-wider uppercase">QUEUED ({queuedMessages.length}):</span>
          <span className="truncate flex-1 italic text-amber-300/80 font-mono">"{queuedMessages[0]}"</span>
          <button
            onClick={() => setQueuedMessages((prev) => prev.slice(1))}
            title="Dismiss queued message"
            aria-label="Dismiss queued message"
            className="text-amber-400/60 hover:text-red-400 p-0.5 cursor-pointer ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input Box & Action Controls */}
      <div className="mt-1 pt-1.5 border-t border-cyan-500/30 flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isGenerating ? "Agent busy... Type to queue next message" : "Ask tactical agent or request task/goal action..."}
          aria-label="Ask tactical agent"
          className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 transition"
        />

        {isGenerating ? (
          <div className="flex items-center gap-1">
            {inputText.trim() && (
              <button
                onClick={handleSend}
                title="Queue Message"
                aria-label="Queue Message"
                data-testid="chat-queue-button"
                className="px-2 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-tech font-bold uppercase transition cursor-pointer"
              >
                QUEUE
              </button>
            )}
            <button
              onClick={handleStop}
              title="Stop Generation"
              aria-label="Stop Generation"
              data-testid="chat-stop-button"
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/60 hover:border-red-400 text-red-200 text-xs font-tech font-bold uppercase tracking-wider transition cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span>STOP</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            title="Send Command"
            aria-label="Send Command"
            data-testid="chat-send-button"
            className="p-1.5 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 disabled:opacity-40 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
