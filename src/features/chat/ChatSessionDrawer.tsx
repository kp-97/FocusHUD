import React from "react";
import { Plus, Trash2, X, MessageSquare, History } from "lucide-react";
import type { ChatSessionItem } from "../../types/ai";

export interface ChatSessionDrawerProps {
  sessions: ChatSessionItem[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export const ChatSessionDrawer: React.FC<ChatSessionDrawerProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex flex-col p-3 text-cyan-200 font-hud border border-cyan-500/40 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2 mb-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-cyan-100">
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>SESSION LOGS</span>
        </div>
        <button
          onClick={onClose}
          className="text-cyan-400/60 hover:text-cyan-100 transition p-1 cursor-pointer"
          title="Close Sessions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New Session Button */}
      <button
        onClick={() => {
          onCreateSession();
          onClose();
        }}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-400/50 hover:border-cyan-300 text-cyan-100 text-xs font-tech tracking-wider uppercase transition cursor-pointer mb-3 shadow-[0_0_10px_rgba(0,229,255,0.2)]"
      >
        <Plus className="w-3.5 h-3.5 text-cyan-300" />
        <span>NEW CHAT SESSION</span>
      </button>

      {/* Sessions List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {sessions.length === 0 ? (
          <div className="text-center text-cyan-500/50 py-8 text-xs font-tech">
            No previous chat sessions found.
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            const dateStr = new Date(session.updatedAt || session.createdAt).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
            );

            return (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  onClose();
                }}
                className={`group flex items-center justify-between p-2 rounded border transition cursor-pointer ${
                  isActive
                    ? "bg-cyan-900/40 border-cyan-400 text-cyan-100 shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                    : "bg-black/40 border-cyan-500/20 text-cyan-400/80 hover:bg-cyan-950/30 hover:border-cyan-400/50 hover:text-cyan-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight font-tech">
                      {session.title || "Untitled Session"}
                    </p>
                    <p className="text-[10px] text-cyan-500/60 truncate mt-0.5">
                      {session.provider}:{session.model} · {dateStr}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="text-cyan-400/50 hover:text-red-400 p-1 transition cursor-pointer shrink-0 ml-1"
                  title="Delete Session"
                  aria-label={`Delete ${session.title || "Session"}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
