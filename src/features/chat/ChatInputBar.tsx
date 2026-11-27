import React, { useRef, useEffect, useCallback } from "react";
import { Send, Square, CornerDownLeft, Clock, X, Trash2 } from "lucide-react";

export interface ChatInputBarProps {
  inputText: string;
  onChangeInputText: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  queuedMessages?: string[];
  onRemoveQueuedMessage?: (index: number) => void;
  onClearQueuedMessages?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputText,
  onChangeInputText,
  onSend,
  onStop,
  isGenerating,
  queuedMessages = [],
  onRemoveQueuedMessage,
  onClearQueuedMessages,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-expand textarea height to fit content, up to max-height (180px)
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 38), 180);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [inputText, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift + Enter: move cursor to next line (textarea default behavior)
        return;
      }
      // Enter without Shift: send prompt or queue if generating
      e.preventDefault();
      if (inputText.trim()) {
        onSend();
        if (textareaRef.current) {
          textareaRef.current.style.height = "38px";
        }
      }
    }
  };

  const handleActionClick = () => {
    if (!inputText.trim()) return;
    onSend();
    if (textareaRef.current) {
      textareaRef.current.style.height = "38px";
    }
  };

  return (
    <div className="mt-1 pt-1 border-t border-cyan-500/20 shrink-0 select-none flex flex-col gap-1.5">
      {/* Queued Messages Stack (Google Antigravity style) */}
      {queuedMessages.length > 0 && (
        <div
          data-testid="queued-messages-bar"
          className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[10px] font-tech text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-spin" />
              <span className="font-bold tracking-wider uppercase text-amber-300">
                QUEUED ({queuedMessages.length}):
              </span>
              <span className="text-amber-400/60 text-[9px] hidden sm:inline">
                Auto-executes when current turn completes
              </span>
            </div>

            {queuedMessages.length > 1 && onClearQueuedMessages && (
              <button
                type="button"
                onClick={onClearQueuedMessages}
                title="Clear all queued messages"
                className="flex items-center gap-0.5 text-amber-400/70 hover:text-red-400 text-[9px] cursor-pointer transition"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>CLEAR ALL</span>
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {queuedMessages.map((msg, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-black/50 border border-amber-500/20 rounded px-2 py-0.5"
              >
                <span className="text-[9px] font-mono text-amber-400 font-bold shrink-0">
                  #{idx + 1}
                </span>
                <span className="truncate flex-1 italic text-amber-200/90 font-mono text-[10px]">
                  "{msg}"
                </span>
                {onRemoveQueuedMessage && (
                  <button
                    type="button"
                    onClick={() => onRemoveQueuedMessage(idx)}
                    title={`Dismiss queued message #${idx + 1}`}
                    aria-label="Dismiss queued message"
                    className="text-amber-400/60 hover:text-red-400 p-0.5 cursor-pointer shrink-0 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Antigravity-Style Expanding Prompt Box Container */}
      <div className="relative flex flex-col bg-[#050b14] border border-cyan-500/30 rounded-xl focus-within:border-cyan-400/70 focus-within:shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-all">
        {/* Expanding Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => onChangeInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isGenerating
              ? "Agent busy... Ask tactical agent or queue (Shift+Enter for newline, Enter to queue)"
              : "Ask tactical agent or request task/goal action... (Shift+Enter for newline)"
          }
          aria-label="Ask tactical agent"
          className="w-full bg-transparent text-xs text-cyan-100 placeholder-cyan-500/40 px-3 pt-2.5 pb-1 focus:outline-none resize-none leading-relaxed select-text overflow-y-auto max-h-[180px]"
        />

        {/* Footer Toolbar Inside Prompt Box */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-1 border-t border-cyan-500/10 text-[10px] text-cyan-500/50 font-tech">
          <div className="flex items-center gap-2 select-none">
            <span className="hidden sm:inline">
              <kbd className="px-1 py-0.2 rounded bg-black/50 border border-cyan-500/30 text-[9px] text-cyan-300">
                Shift
              </kbd>{" "}
              +{" "}
              <kbd className="px-1 py-0.2 rounded bg-black/50 border border-cyan-500/30 text-[9px] text-cyan-300">
                Enter
              </kbd>{" "}
              newline
            </span>
            <span className="opacity-60">·</span>
            <span>
              <kbd className="px-1 py-0.2 rounded bg-black/50 border border-cyan-500/30 text-[9px] text-cyan-300">
                Enter
              </kbd>{" "}
              {isGenerating ? "queue" : "send"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {isGenerating ? (
              <>
                {inputText.trim() && (
                  <button
                    type="button"
                    onClick={handleActionClick}
                    title="Queue Message for next turn"
                    aria-label="Queue Message"
                    data-testid="chat-queue-button"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-tech font-bold uppercase transition cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                  >
                    <CornerDownLeft className="w-3 h-3 text-amber-400" />
                    <span>QUEUE</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop Active Generation"
                  aria-label="Stop Generation"
                  data-testid="chat-stop-button"
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-950/80 hover:bg-red-900 border border-red-500/60 hover:border-red-400 text-red-200 text-[10px] font-tech font-bold uppercase tracking-wider transition cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse"
                >
                  <Square className="w-3 h-3 fill-red-400 text-red-400" />
                  <span>STOP</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleActionClick}
                disabled={!inputText.trim()}
                title="Send Command (Enter)"
                aria-label="Send Command"
                data-testid="chat-send-button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300 text-cyan-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-[0_0_8px_rgba(0,229,255,0.2)]"
              >
                <span className="font-bold text-[10px]">SEND</span>
                <Send className="w-3 h-3 text-cyan-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
