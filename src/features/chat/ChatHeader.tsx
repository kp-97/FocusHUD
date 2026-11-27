import React, { useState } from "react";
import { Bot, Radio, History, Plus, Trash2, Archive, Loader2, Check } from "lucide-react";

export interface ChatHeaderProps {
  isCompact?: boolean;
  streamMode: boolean;
  onToggleStreamMode: () => void;
  onOpenDrawer: () => void;
  onCreateSession: () => void;
  onDeleteCurrentSession: () => void;
  onManualCompact: () => void;
  isCompacting: boolean;
  compactSuccess: boolean;
  canCompact: boolean;
  isGenerating: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isCompact = false,
  streamMode,
  onToggleStreamMode,
  onOpenDrawer,
  onCreateSession,
  onDeleteCurrentSession,
  onManualCompact,
  isCompacting,
  compactSuccess,
  canCompact,
  isGenerating,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`w-full flex items-center justify-between border-b border-cyan-500/30 ${
        isCompact ? "pb-1 mb-1" : "pb-2 mb-2"
      } text-[10px] font-tech uppercase tracking-wider shrink-0 select-none`}
    >
      <div className="flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5 text-cyan-400" />
        {!isCompact && <span className="font-bold text-cyan-200">AI AGENT CHAT</span>}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Compact Button with live state indicators */}
        <button
          onClick={onManualCompact}
          title={
            isCompacting
              ? "Compacting Chat History..."
              : "Compact Chat History to Conserve Context Tokens"
          }
          aria-label="Compact Chat History"
          data-testid="chat-compact-button"
          disabled={!canCompact || isGenerating || isCompacting}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition cursor-pointer disabled:opacity-40 ${
            isCompacting
              ? "bg-cyan-900/60 border-cyan-400 text-cyan-100 shadow-[0_0_8px_rgba(0,229,255,0.4)]"
              : compactSuccess
              ? "bg-emerald-950/60 border-emerald-400 text-emerald-200"
              : "bg-black/40 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100"
          }`}
        >
          {isCompacting ? (
            <>
              <Loader2 className="w-3 h-3 text-cyan-300 animate-spin" data-testid="compacting-spinner" />
              {!isCompact && <span className="text-[9px] font-bold">COMPACTING...</span>}
            </>
          ) : compactSuccess ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              {!isCompact && <span className="text-[9px] font-bold text-emerald-300">COMPACTED!</span>}
            </>
          ) : (
            <>
              <Archive className="w-3 h-3 text-cyan-400" />
              {!isCompact && <span>COMPACT</span>}
            </>
          )}
        </button>

        {/* New Chat Button */}
        <button
          onClick={onCreateSession}
          title="Start New Conversation"
          aria-label="Start New Conversation"
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 bg-black/40 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 transition cursor-pointer"
        >
          <Plus className="w-3 h-3 text-cyan-400" />
          {!isCompact && <span>NEW</span>}
        </button>

        {/* History/Sessions Drawer Button */}
        <button
          onClick={onOpenDrawer}
          title="Chat Sessions History"
          aria-label="Chat Sessions History"
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 bg-black/40 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 transition cursor-pointer"
        >
          <History className="w-3 h-3 text-cyan-400" />
          {!isCompact && <span>LOGS</span>}
        </button>

        {/* Delete Current Conversation Button */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 rounded px-1.5 py-0.5 text-[9px] font-tech text-red-200 select-none">
            <span>DEL?</span>
            <button
              onClick={() => {
                setConfirmDelete(false);
                onDeleteCurrentSession();
              }}
              aria-label="Confirm Delete Conversation"
              className="font-bold text-red-400 hover:text-red-200 underline cursor-pointer"
            >
              YES
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-cyan-300 hover:text-cyan-100 cursor-pointer ml-0.5"
            >
              NO
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete Current Conversation"
            aria-label="Delete Current Conversation"
            className="flex items-center p-1 rounded border border-cyan-500/30 hover:border-red-400/60 bg-black/40 hover:bg-red-950/40 text-cyan-400/60 hover:text-red-400 transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        {/* Streaming Mode Toggle */}
        <button
          onClick={onToggleStreamMode}
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
  );
};
