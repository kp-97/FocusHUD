import React from "react";
import { Bot, User, Sparkles, CheckCircle2, Wrench, AlertCircle } from "lucide-react";
import type { ChatMessageItem as ChatMessageType } from "../../types/ai";
import { MarkdownPreview } from "../notes/NotesView/MarkdownPreview";

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

  return (
    <div
      ref={refCallback}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} font-hud select-text w-full min-w-0`}
    >
      {/* Header Info */}
      <div className="flex items-center gap-1 text-[9px] text-cyan-500/60 mb-0.5 px-1 uppercase tracking-wider select-none">
        {isUser ? (
          <>
            <span>OPERATOR</span>
            <User className="w-2.5 h-2.5 text-cyan-400" />
          </>
        ) : (
          <>
            <Bot className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-amber-400/80">TACTICAL AI</span>
          </>
        )}
        <span>· {formattedTime}</span>
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
                <div className="ml-auto shrink-0 flex items-center gap-1">
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
