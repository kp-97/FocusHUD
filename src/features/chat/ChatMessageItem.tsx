import React, { useState, useEffect } from "react";
import { Bot, User, Sparkles, CheckCircle2, Wrench, AlertCircle, Clock } from "lucide-react";
import type { ChatMessageItem as ChatMessageType } from "../../types/ai";
import { MarkdownPreview } from "../notes/NotesView/MarkdownPreview";
import { formatDurationMs } from "../../utils/formatters";

export interface ChatMessageItemProps {
  message: ChatMessageType;
  isGenerating?: boolean;
  refCallback?: (node: HTMLDivElement | null) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isGenerating = false,
  refCallback,
}) => {
  const isUser = message.role === "user";
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Real-time elapsed duration ticker while generation is active
  const [liveElapsed, setLiveElapsed] = useState<string>("0.0");
  useEffect(() => {
    if (!isGenerating || isUser) return;
    const start = message.createdAt || Date.now();
    const update = () => {
      const elapsedSec = (Date.now() - start) / 1000;
      setLiveElapsed(elapsedSec.toFixed(1));
    };
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [isGenerating, isUser, message.createdAt]);

  return (
    <div
      ref={refCallback}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} font-hud select-text w-full min-w-0`}
    >
      {/* Header Info */}
      <div className="flex items-center gap-1.5 text-[9px] text-cyan-500/60 mb-0.5 px-1 uppercase tracking-wider select-none w-full">
        {isUser ? (
          <>
            <span>OPERATOR</span>
            <User className="w-2.5 h-2.5 text-cyan-400" />
            <span>· {formattedTime}</span>
          </>
        ) : (
          <>
            <Bot className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-amber-400/80 font-bold">TACTICAL AI</span>
            <span>· {formattedTime}</span>

            {/* Total Elapsed Prompt Time */}
            {(isGenerating || message.durationMs !== undefined) && (
              <span
                data-testid="message-elapsed-time"
                className="ml-auto inline-flex items-center gap-1 text-[9px] font-mono font-medium text-amber-400/70"
                title="Total response time"
              >
                <Clock
                  className={`w-2.5 h-2.5 ${
                    isGenerating ? "text-cyan-400 animate-spin" : "text-amber-400/60"
                  }`}
                />
                <span>{isGenerating ? `${liveElapsed}s` : formatDurationMs(message.durationMs)}</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* Bubble Container */}
      <div
        className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed border break-words [overflow-wrap:anywhere] min-w-0 ${
          isUser
            ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.15)]"
            : "bg-[#090b10] border-amber-500/30 text-amber-100/90 shadow-[0_0_12px_rgba(255,145,0,0.1)]"
        }`}
      >
        {/* Tool Call Badges */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1 select-none">
            {message.toolCalls.map((tc, idx) => (
              <div
                key={tc.id || idx}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 border border-amber-500/40 text-[10px] text-amber-300 font-tech"
              >
                <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="font-semibold uppercase tracking-wider">{tc.name}</span>
                <span className="text-amber-400/60 truncate max-w-[150px]">{tc.arguments}</span>
                <div className="ml-auto shrink-0 flex items-center gap-1.5">
                  {tc.step !== undefined && (
                    <span
                      data-testid={`tool-step-${idx}`}
                      className="px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[8px] font-mono text-amber-300 font-semibold"
                    >
                      STEP {tc.step}
                    </span>
                  )}
                  {tc.durationMs !== undefined && (
                    <span
                      data-testid={`tool-duration-${idx}`}
                      className="inline-flex items-center gap-0.5 text-amber-400/80 text-[9px] font-mono"
                    >
                      <Clock className="w-2 h-2 text-amber-400/40" />
                      {formatDurationMs(tc.durationMs)}
                    </span>
                  )}
                  {tc.status === "error" ? (
                    <span className="inline-flex items-center gap-0.5 text-red-400 text-[9px]">
                      <AlertCircle className="w-2.5 h-2.5" /> Failed
                    </span>
                  ) : tc.status === "executing" ? (
                    <span className="inline-flex items-center gap-0.5 text-cyan-300 text-[9px]">
                      <Sparkles className="w-2.5 h-2.5 animate-spin" /> Executing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[9px]">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Done
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        {message.content ? (
          <div className="font-sans leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">
            <MarkdownPreview
              content={message.content}
              variant={isUser ? "cyan" : "amber"}
              hideEmptyPlaceholder
              className="text-xs break-words [overflow-wrap:anywhere] min-w-0"
            />
          </div>
        ) : isGenerating ? (
          <span className="inline-flex items-center gap-1 text-cyan-400/60 italic text-[11px]">
            <Sparkles className="w-3 h-3 animate-spin" /> Generating response...
          </span>
        ) : null}
      </div>
    </div>
  );
};
