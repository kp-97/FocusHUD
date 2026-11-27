import React, { useState, useEffect, useRef } from "react";
import { Layers, X } from "lucide-react";
import {
  calculateContextBreakdown,
  ContextBreakdown,
} from "../../../features/chat/tokenCounter";
import { resolveEffectiveContextLimit } from "../../../features/chat/gpuContextCalculator";
import {
  fetchChatSessions,
  fetchChatMessages,
  loadAiSettings,
} from "../../../services/aiService";
import { chatCoordinator } from "../../../features/chat/chatCoordinator";
import type { ChatMessageItem } from "../../../types/ai";

export const RightRailContextMeter: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [model, setModel] = useState<string>("gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [explicitMaxTokens, setExplicitMaxTokens] = useState<number | undefined>(undefined);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  const refreshContext = async () => {
    try {
      const settings = loadAiSettings();
      setModel(settings.model || "gpt-4o");
      setSystemPrompt(settings.systemPrompt || "");
      const resolvedMax = resolveEffectiveContextLimit(
        settings.contextSize,
        settings.model,
        settings.provider
      );
      setExplicitMaxTokens(resolvedMax);

      const activeTurn = chatCoordinator.getActiveTurn();
      let targetSessionId = activeTurn?.sessionId;

      if (!targetSessionId) {
        targetSessionId = localStorage.getItem("focushud_last_chat_session_id") || undefined;
      }

      if (!targetSessionId) {
        const sessions = await fetchChatSessions();
        if (sessions.length > 0) {
          targetSessionId = sessions[0].id;
        }
      }

      if (targetSessionId) {
        const msgs = await fetchChatMessages(targetSessionId);
        setMessages(msgs);
      }
    } catch {}
  };

  useEffect(() => {
    refreshContext();

    const unsubCoordinator = chatCoordinator.subscribe((turn) => {
      if (turn) {
        // If an active turn is in progress, synthesize live message state
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
                toolCalls: turn.toolCalls,
                createdAt: Date.now(),
              },
            ];
          }
          return prev.map((m) =>
            m.id === turn.assistantId
              ? { ...m, content: turn.accumulatedContent, toolCalls: turn.toolCalls }
              : m
          );
        });
      } else {
        refreshContext();
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "focushud_last_chat_session_id" ||
        e.key === "focushud_ai_settings"
      ) {
        refreshContext();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsubCoordinator();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Handle outside click / ESC for dialog
  useEffect(() => {
    if (!isDetailsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setIsDetailsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDetailsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetailsOpen]);

  const breakdown: ContextBreakdown = calculateContextBreakdown(
    messages,
    model,
    systemPrompt,
    undefined,
    explicitMaxTokens
  );

  const formatTok = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  return (
    <>
      {/* 52px Right Rail Compact Meter */}
      <button
        onClick={() => setIsDetailsOpen(true)}
        title={`Context Window: ${breakdown.totalTokens.toLocaleString()} / ${breakdown.maxTokens.toLocaleString()} tokens (${breakdown.pctUsed}%)`}
        aria-label="AI Context Window Meter"
        data-testid="right-rail-context-meter"
        className="w-full flex flex-col items-center justify-center py-1 px-1 rounded hover:bg-amber-500/10 transition cursor-pointer select-none group"
      >
        <div className="flex items-center gap-1 text-[9px] font-tech text-amber-400 mb-0.5">
          <Layers className="w-2.5 h-2.5 text-amber-400 group-hover:scale-110 transition" />
          <span className="font-bold tracking-widest uppercase">CTX</span>
        </div>

        {/* Mini Multi-Segment Progress Bar */}
        <div className="w-[36px] h-1.5 bg-black/60 rounded-full overflow-hidden flex border border-amber-500/30">
          <div
            style={{ width: `${Math.max(2, breakdown.pctChatOfUsed)}%` }}
            className="h-full bg-cyan-400"
            title={`Chat: ${breakdown.pctChatOfUsed}%`}
          />
          <div
            style={{ width: `${Math.max(2, breakdown.pctToolOfUsed)}%` }}
            className="h-full bg-amber-400"
            title={`Tools: ${breakdown.pctToolOfUsed}%`}
          />
          <div
            style={{ width: `${Math.max(2, breakdown.pctSystemOfUsed)}%` }}
            className="h-full bg-purple-400"
            title={`System: ${breakdown.pctSystemOfUsed}%`}
          />
        </div>

        <div className="text-[8px] font-mono text-amber-300/80 mt-0.5 tracking-tighter">
          {formatTok(breakdown.totalTokens)}/{formatTok(breakdown.maxTokens)}
        </div>
      </button>

      {/* Flyout Tactical Details Dialog */}
      {isDetailsOpen && (
        <div
          ref={detailsRef}
          data-testid="context-meter-details"
          className="fixed right-[56px] top-1/2 -translate-y-1/2 w-72 bg-[#050b14] border border-amber-500/40 rounded-sm shadow-[0_0_24px_rgba(255,145,0,0.25)] z-50 p-3 font-tech select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-200 tracking-wider uppercase">
                CONTEXT TELEMETRY
              </span>
            </div>
            <button
              onClick={() => setIsDetailsOpen(false)}
              className="text-amber-400/60 hover:text-amber-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Model & Window Info */}
          <div className="flex items-center justify-between text-[10px] text-amber-400/80 mb-2">
            <span>MODEL: {model}</span>
            <span className="font-mono text-amber-300">
              {breakdown.totalTokens.toLocaleString()} / {breakdown.maxTokens.toLocaleString()} (
              {breakdown.pctUsed}%)
            </span>
          </div>

          {/* Full Segmented Context Bar */}
          <div className="w-full h-2.5 bg-black/80 rounded overflow-hidden flex border border-amber-500/40 mb-3">
            <div
              style={{ width: `${breakdown.pctChatOfUsed}%` }}
              className="h-full bg-cyan-400"
            />
            <div
              style={{ width: `${breakdown.pctToolOfUsed}%` }}
              className="h-full bg-amber-400"
            />
            <div
              style={{ width: `${breakdown.pctSystemOfUsed}%` }}
              className="h-full bg-purple-400"
            />
          </div>

          {/* Detailed Breakdown Legend & Stats */}
          <div className="space-y-2 text-[10px]">
            {/* Chat Context */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-cyan-200">Chat Messages</span>
              </div>
              <div className="font-mono text-right text-cyan-300">
                <span>{breakdown.chatTokens.toLocaleString()} tok</span>
                <span className="text-cyan-500/80 ml-1.5">({breakdown.pctChatOfUsed}%)</span>
              </div>
            </div>

            {/* Tool Context */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-200">Tool Context & Schema</span>
              </div>
              <div className="font-mono text-right text-amber-300">
                <span>{breakdown.toolTokens.toLocaleString()} tok</span>
                <span className="text-amber-500/80 ml-1.5">({breakdown.pctToolOfUsed}%)</span>
              </div>
            </div>

            {/* System Prompt Context */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-purple-200">System & Time Prompt</span>
              </div>
              <div className="font-mono text-right text-purple-300">
                <span>{breakdown.systemTokens.toLocaleString()} tok</span>
                <span className="text-purple-500/80 ml-1.5">({breakdown.pctSystemOfUsed}%)</span>
              </div>
            </div>

            {/* Remaining Capacity */}
            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-amber-400/60">
              <span>Free Window Space</span>
              <span className="font-mono">
                {(breakdown.maxTokens - breakdown.totalTokens).toLocaleString()} tok (
                {(100 - breakdown.pctUsed).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
