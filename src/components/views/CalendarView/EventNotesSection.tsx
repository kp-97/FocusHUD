import React, { useState, useRef, useEffect } from "react";
import { FileText, Search, Plus, Check, X } from "lucide-react";
import { NoteItem } from "../../../types/hud";

export interface EventNotesSectionProps {
  availableNotes: NoteItem[];
  selectedNoteIds: string[];
  onToggleAttachNote: (noteId: string) => void;
  onCreateNote?: (title: string, calendarEventId?: string) => NoteItem;
  onNavigateToNote?: (noteId: string) => void;
  calendarEventId?: string;
}

export const EventNotesSection: React.FC<EventNotesSectionProps> = ({
  availableNotes,
  selectedNoteIds,
  onToggleAttachNote,
  onCreateNote,
  onNavigateToNote,
  calendarEventId,
}) => {
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);
  const noteSearchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        noteSearchContainerRef.current &&
        !noteSearchContainerRef.current.contains(e.target as Node)
      ) {
        setIsNoteDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredNotes = availableNotes.filter((n) =>
    n.title.toLowerCase().includes(noteSearchQuery.trim().toLowerCase())
  );
  const exactMatchExists = availableNotes.some(
    (n) => n.title.trim().toLowerCase() === noteSearchQuery.trim().toLowerCase()
  );

  const handleCreateAndAttach = (titleToCreate?: string) => {
    const rawTitle = titleToCreate ?? noteSearchQuery;
    if (!rawTitle.trim() || !onCreateNote) return;
    const created = onCreateNote(rawTitle.trim(), calendarEventId);
    onToggleAttachNote(created.id);
    setNoteSearchQuery("");
    setIsNoteDropdownOpen(false);
  };

  return (
    <div className="border-t border-cyan-500/15 pt-2 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
        <FileText className="w-3.5 h-3.5" />
        <span>Attached Notes</span>
        {selectedNoteIds.length > 0 && (
          <span className="text-[10px] text-cyan-500/70 font-mono">
            ({selectedNoteIds.length})
          </span>
        )}
      </div>

      {/* Attached Notes Chips List */}
      {selectedNoteIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-0.5">
          {selectedNoteIds.map((id) => {
            const note = availableNotes.find((n) => n.id === id);
            const titleDisplay = note ? note.title : "Untitled Note";
            return (
              <div
                key={id}
                data-testid={`attached-note-chip-${id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-tech text-cyan-200 shadow-[0_0_6px_rgba(0,229,255,0.15)] group"
              >
                <span
                  className={`truncate max-w-[130px] ${
                    onNavigateToNote ? "cursor-pointer hover:underline text-cyan-100" : ""
                  }`}
                  title={onNavigateToNote ? "Click to jump to note" : undefined}
                  onClick={() => onNavigateToNote && onNavigateToNote(id)}
                >
                  {titleDisplay}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleAttachNote(id)}
                  title="Remove note"
                  data-testid={`remove-attached-note-${id}`}
                  className="p-0.5 rounded-full hover:bg-cyan-500/30 text-cyan-400 hover:text-cyan-100 cursor-pointer transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search Box with Live Dropdown & Instant Quick-Create */}
      <div ref={noteSearchContainerRef} className="relative">
        <div className="flex items-center gap-1.5 bg-[#03070d] border border-cyan-500/30 focus-within:border-cyan-400 rounded px-2 py-1.5 text-xs text-cyan-200 transition">
          <Search className="w-3.5 h-3.5 text-cyan-500/60 shrink-0" />
          <input
            type="text"
            placeholder="Search existing notes or type to create..."
            data-testid="note-search-input"
            value={noteSearchQuery}
            onFocus={() => setIsNoteDropdownOpen(true)}
            onChange={(e) => {
              setNoteSearchQuery(e.target.value);
              setIsNoteDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (noteSearchQuery.trim()) {
                  const match = availableNotes.find(
                    (n) => n.title.trim().toLowerCase() === noteSearchQuery.trim().toLowerCase()
                  );
                  if (match) {
                    onToggleAttachNote(match.id);
                    setNoteSearchQuery("");
                    setIsNoteDropdownOpen(false);
                  } else {
                    handleCreateAndAttach();
                  }
                }
              } else if (e.key === "Escape") {
                setIsNoteDropdownOpen(false);
              }
            }}
            className="flex-1 bg-transparent outline-none placeholder:text-cyan-500/40 text-xs"
          />
          {noteSearchQuery && (
            <button
              type="button"
              onClick={() => setNoteSearchQuery("")}
              className="p-0.5 rounded hover:bg-cyan-500/20 text-cyan-500/60 hover:text-cyan-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdown Menu below search input */}
        {isNoteDropdownOpen && (
          <div
            data-testid="note-search-dropdown"
            className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-lg bg-[#071322] border border-cyan-500/40 shadow-[0_12px_28px_rgba(0,0,0,0.85)] flex flex-col p-1 text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            {noteSearchQuery.trim() && !exactMatchExists && onCreateNote && (
              <button
                type="button"
                onClick={() => handleCreateAndAttach()}
                data-testid="note-quick-create-btn"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-tech text-cyan-200 hover:bg-cyan-500/20 transition cursor-pointer border-b border-cyan-500/20 mb-1"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  Create & attach <span className="font-semibold text-cyan-100">"{noteSearchQuery.trim()}"</span>
                </span>
              </button>
            )}

            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => {
                const isAttached = selectedNoteIds.includes(note.id);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      onToggleAttachNote(note.id);
                      setNoteSearchQuery("");
                    }}
                    data-testid={`attach-note-option-${note.id}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-left transition cursor-pointer ${
                      isAttached
                        ? "bg-cyan-500/20 text-cyan-100 font-medium"
                        : "text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-cyan-400/70 shrink-0" />
                      <span className="truncate">{note.title || "Untitled Note"}</span>
                    </div>
                    {isAttached && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : !noteSearchQuery.trim() ? (
              <div className="px-3 py-2 text-[11px] text-cyan-500/50 italic text-center">
                No notes available. Type above to create one.
              </div>
            ) : exactMatchExists ? null : (
              <div className="px-3 py-1.5 text-[11px] text-cyan-500/60 italic text-center">
                Press Enter to create this note.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

