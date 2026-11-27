import React from "react";
import { Clock, X, Trash2, CornerDownRight } from "lucide-react";

export interface ChatQueueBarProps {
  queuedMessages: string[];
  onDismiss: (index: number) => void;
  onClearAll: () => void;
}

export const ChatQueueBar: React.FC<ChatQueueBarProps> = ({
  queuedMessages,
  onDismiss,
  onClearAll,
}) => {
  if (queuedMessages.length === 0) return null;

  return (
    <div
      data-testid="queued-messages-bar"
      className="mb-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 p-2 text-amber-200 text-xs font-hud shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.15)] select-none"
    >
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-500/20 text-[10px] font-tech uppercase tracking-wider">
        <div className="flex items-center gap-1.5 text-amber-300 font-bold">
          <Clock className="w-3 h-3 text-amber-400 animate-spin" />
          <span>QUEUED ({queuedMessages.length}):</span>
          <span className="text-amber-400/60 font-mono text-[9px] lowercase">· auto-executes next</span>
        </div>

        {queuedMessages.length > 1 && (
          <button
            onClick={onClearAll}
            title="Clear all queued messages"
            className="flex items-center gap-0.5 text-[9px] text-amber-400/70 hover:text-red-300 transition cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span>CLEAR ALL</span>
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
        {queuedMessages.map((msg, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-black/60 border border-amber-500/20 text-[11px] font-mono group hover:border-amber-400/40 transition"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <CornerDownRight className="w-3 h-3 text-amber-400/70 shrink-0" />
              <span className="text-[10px] text-amber-400 font-tech font-bold shrink-0">#{idx + 1}</span>
              <span className="truncate text-amber-100/90" title={msg}>
                "{msg}"
              </span>
            </div>

            <button
              onClick={() => onDismiss(idx)}
              title="Remove from queue"
              aria-label={`Remove queued message #${idx + 1}`}
              className="text-amber-400/60 hover:text-red-400 p-0.5 rounded hover:bg-red-950/50 transition cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
