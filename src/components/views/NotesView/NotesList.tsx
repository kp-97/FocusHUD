import React, { useRef, useEffect } from "react";
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Target,
  CheckSquare,
  Workflow,
  FileText,
  X,
} from "lucide-react";
import { NoteItem } from "../../../types/hud";

export type NoteFilter = "all" | "standalone" | "linked";

interface NotesListProps {
  notes: NoteItem[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onTogglePin: (id: string) => void;
  onDeleteNote: (id: string) => void;
  filter: NoteFilter;
  onChangeFilter: (f: NoteFilter) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  isCompact?: boolean;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  onTogglePin,
  onDeleteNote,
  filter,
  onChangeFilter,
  searchQuery,
  onChangeSearchQuery,
  isCompact: _isCompact = false,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input when Ctrl+F is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter notes according to selected tab and search query
  const filteredNotes = notes.filter((n) => {
    // Tab filter
    if (filter === "standalone" && (n.goalId || n.taskId || n.actionPlanId)) {
      return false;
    }
    if (filter === "linked" && !n.goalId && !n.taskId && !n.actionPlanId) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (n.title || "").toLowerCase().includes(q);
      const matchContent = (n.content || "").toLowerCase().includes(q);
      return matchTitle || matchContent;
    }

    return true;
  });

  // Sort: pinned first, then updated_at desc
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const date = new Date(ts);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderContextBadge = (note: NoteItem) => {
    if (note.goalId) {
      return (
        <span
          title="Linked to Goal"
          className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-tech text-cyan-300 shrink-0"
        >
          <Target className="w-2.5 h-2.5 text-cyan-400" />
          GOAL
        </span>
      );
    }
    if (note.taskId) {
      return (
        <span
          title="Linked to Task"
          className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-[9px] font-tech text-amber-300 shrink-0"
        >
          <CheckSquare className="w-2.5 h-2.5 text-amber-400" />
          TASK
        </span>
      );
    }
    if (note.actionPlanId) {
      return (
        <span
          title="Linked to Action Plan"
          className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-purple-950/80 border border-purple-500/40 text-[9px] font-tech text-purple-300 shrink-0"
        >
          <Workflow className="w-2.5 h-2.5 text-purple-400" />
          PLAN
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#03070d] text-cyan-200 select-none overflow-hidden">
      {/* Header with New Note Action */}
      <div className="flex items-center justify-between p-2 border-b border-cyan-500/20 bg-black/40 shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-orbitron font-bold text-xs tracking-wider text-cyan-200 truncate">
            NOTES
          </span>
          <span className="text-[10px] font-mono text-cyan-400/60 bg-cyan-950/80 px-1 rounded border border-cyan-500/20">
            {notes.length}
          </span>
        </div>

        <button
          onClick={onNewNote}
          title="Create New Note (Ctrl+N)"
          className="hud-btn px-2 py-1 rounded text-[10px] font-tech tracking-wider uppercase flex items-center gap-1 text-cyan-200 border-cyan-500/40 hover:border-cyan-400 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span>NEW</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-2 border-b border-cyan-500/20 bg-[#050b14] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-cyan-500/60 absolute left-2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Search notes... (Ctrl+F)"
            className="w-full bg-black/70 border border-cyan-500/30 rounded pl-7 pr-7 py-1 text-xs text-cyan-200 font-tech placeholder:text-cyan-600/60 focus:outline-none focus:border-cyan-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onChangeSearchQuery("")}
              className="absolute right-2 text-cyan-500/60 hover:text-cyan-200 p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs (All / Standalone / Linked) */}
      <div className="flex items-center border-b border-cyan-500/20 px-2 py-1 bg-black/20 text-[10px] font-tech shrink-0 gap-1">
        <button
          onClick={() => onChangeFilter("all")}
          className={`px-2 py-0.5 rounded transition uppercase cursor-pointer ${
            filter === "all"
              ? "bg-cyan-500/20 text-cyan-100 font-bold border border-cyan-500/40"
              : "text-cyan-400/60 hover:text-cyan-300"
          }`}
        >
          ALL ({notes.length})
        </button>
        <button
          onClick={() => onChangeFilter("standalone")}
          className={`px-2 py-0.5 rounded transition uppercase cursor-pointer ${
            filter === "standalone"
              ? "bg-cyan-500/20 text-cyan-100 font-bold border border-cyan-500/40"
              : "text-cyan-400/60 hover:text-cyan-300"
          }`}
        >
          SCRATCHPAD
        </button>
        <button
          onClick={() => onChangeFilter("linked")}
          className={`px-2 py-0.5 rounded transition uppercase cursor-pointer ${
            filter === "linked"
              ? "bg-cyan-500/20 text-cyan-100 font-bold border border-cyan-500/40"
              : "text-cyan-400/60 hover:text-cyan-300"
          }`}
        >
          LINKED
        </button>
      </div>

      {/* Scrollable List of Notes */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
        {sortedNotes.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-cyan-500/40">
            <FileText className="w-6 h-6 mb-1 opacity-50" />
            <p className="text-xs font-tech">NO NOTES FOUND</p>
            {searchQuery ? (
              <p className="text-[10px]">No results match "{searchQuery}"</p>
            ) : (
              <p className="text-[10px]">Click NEW NOTE to start jotting</p>
            )}
          </div>
        ) : (
          sortedNotes.map((note) => {
            const isSelected = note.id === selectedNoteId;
            const snippet = (note.content || "")
              .replace(/^[#\s\-*\[\]xX]+/, "")
              .slice(0, 70);

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`group relative p-2 rounded transition cursor-pointer border ${
                  isSelected
                    ? "bg-cyan-950/60 border-cyan-400/80 shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                    : "bg-[#050b14]/80 border-cyan-500/20 hover:border-cyan-400/50 hover:bg-cyan-950/30"
                }`}
              >
                {/* Note Header: Pin Indicator + Title + Timestamp */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {note.isPinned && (
                      <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-semibold truncate ${
                        isSelected ? "text-cyan-100 font-bold" : "text-cyan-200"
                      }`}
                    >
                      {note.title || "UNTITLED NOTE"}
                    </span>
                  </div>

                  <span className="text-[9px] font-mono text-cyan-500/60 shrink-0">
                    {formatTimestamp(note.updatedAt)}
                  </span>
                </div>

                {/* Content Snippet */}
                <p className="text-[11px] text-cyan-400/60 line-clamp-2 font-mono leading-tight mb-1">
                  {snippet || "(Empty note)"}
                </p>

                {/* Footer: Contextual Badge & Hover Actions */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1">
                    {renderContextBadge(note)}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(note.id);
                      }}
                      title={note.isPinned ? "Unpin Note" : "Pin Note to Top"}
                      className={`p-1 rounded transition cursor-pointer ${
                        note.isPinned
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-cyan-500/50 hover:text-cyan-200 hover:bg-cyan-500/20"
                      }`}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      title="Delete Note"
                      className="p-1 rounded text-cyan-500/50 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
