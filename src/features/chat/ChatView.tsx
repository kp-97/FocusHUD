import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { WaveformVisualizer } from "../../components/ui/WaveformVisualizer";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatSessionDrawer } from "./ChatSessionDrawer";
import { ChatHeader } from "./ChatHeader";
import { ChatInputBar } from "./ChatInputBar";
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
  const isGeneratingRef = useRef<boolean>(false);
  isGeneratingRef.current = isGenerating;
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCompacting, setIsCompacting] = useState<boolean>(false);
  const [compactSuccess, setCompactSuccess] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const activeAssistantMsgRef = useRef<HTMLDivElement | null>(null);
  const latestUserMsgRef = useRef<HTMLDivElement | null>(null);
  const latestUserMsgIdRef = useRef<string | null>(null);

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

  const scrollToLatestUserMessage = useCallback(() => {
    if (latestUserMsgRef.current) {
      latestUserMsgRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

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

  // Threshold-based auto-compaction hook
  const settings = loadAiSettings();
  useAutoCompaction(
    currentSessionId,
    messages,
    isGenerating,
    settings.autoCompactThresholdPct ?? 70,
    (compacted) => setMessages(compacted),
    settings.model,
    settings.systemPrompt,
    settings.contextSize,
    settings.provider
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

    const userMsgId = "u_" + Date.now();
    latestUserMsgIdRef.current = userMsgId;

    const userMsg: ChatMessageType = {
      id: userMsgId,
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

    // Automatically scroll down to the user's message when they send/press Enter
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollToLatestUserMessage();
      }, 30);
    });

    const formattedHistory: ChatMessageParam[] = nextMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    await chatCoordinator.startTurn(activeSession, formattedHistory, assistantId);
  }, [scrollToLatestUserMessage]);

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

    if (isGenerating || isGeneratingRef.current) {
      setQueuedMessages((prev) => [...prev, text]);
      return;
    }

    isGeneratingRef.current = true;
    await executeSend(text);
  };

  // Stop active generation
  const handleStop = async () => {
    await chatCoordinator.stopTurn();
    setIsGenerating(false);
  };

  // Manual compaction with active UX indicator
  const handleManualCompact = async () => {
    if (!currentSessionId || messages.length <= 2 || isGenerating || isCompacting) return;
    setIsCompacting(true);
    try {
      const [compacted] = await Promise.all([
        compactSession(currentSessionId, messages),
        new Promise((resolve) => setTimeout(resolve, 500)), // Visible feedback duration
      ]);
      setMessages(compacted);
      setCompactSuccess(true);
      setTimeout(() => setCompactSuccess(false), 2000);
    } finally {
      setIsCompacting(false);
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

      {/* Header with Streaming Mode Toggle, Compact Button, and Sessions */}
      <ChatHeader
        isCompact={isCompact}
        streamMode={streamMode}
        onToggleStreamMode={() => setStreamMode(!streamMode)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onCreateSession={handleCreateSession}
        onDeleteCurrentSession={() => {
          if (currentSessionId) handleDeleteSession(currentSessionId);
        }}
        onManualCompact={handleManualCompact}
        isCompacting={isCompacting}
        compactSuccess={compactSuccess}
        canCompact={messages.length > 2}
        isGenerating={isGenerating}
      />

      {/* Active Compaction HUD Status Banner */}
      {isCompacting && (
        <div
          data-testid="compacting-banner"
          className="flex items-center justify-center gap-2 py-1 px-3 mb-1.5 rounded bg-cyan-950/80 border border-cyan-400/60 text-cyan-200 text-[10px] font-tech uppercase tracking-wider animate-pulse shadow-[0_0_12px_rgba(0,229,255,0.25)] shrink-0"
        >
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span className="font-bold">Compacting context checkpoint...</span>
        </div>
      )}

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
          const isLatestUser = msg.role === "user" && msg.id === latestUserMsgIdRef.current;
          return (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              isGenerating={isLastAssistant && isGenerating}
              refCallback={(node) => {
                if (isLastAssistant) {
                  activeAssistantMsgRef.current = node;
                }
                if (isLatestUser) {
                  latestUserMsgRef.current = node;
                }
              }}
            />
          );
        })}
      </div>

      {/* Expanding Antigravity-Style Prompt Box with Integrated Queue Stack */}
      <ChatInputBar
        inputText={inputText}
        onChangeInputText={setInputText}
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={isGenerating}
        queuedMessages={queuedMessages}
        onRemoveQueuedMessage={(idx) =>
          setQueuedMessages((prev) => prev.filter((_, i) => i !== idx))
        }
        onClearQueuedMessages={() => setQueuedMessages([])}
      />
    </div>
  );
};
