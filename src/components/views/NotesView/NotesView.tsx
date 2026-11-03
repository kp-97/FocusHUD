import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { NoteItem } from "../../../types/hud";
import { NotesList, NoteFilter } from "./NotesList";
import { NoteEditor } from "./NoteEditor";
import { useSyncNotes } from "../../../hooks/useSyncEntity";
import { saveNotes } from "../../../stores/layoutStore";
import {
  persistNote,
  removeNote,
  isTauriEnvironment,
} from "../../../services/dbService";

export interface NotesViewProps {
  isLeftDock?: boolean;
  isCompact?: boolean;
  onBackToMonitoring?: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  isLeftDock = false,
  isCompact = false,
  onBackToMonitoring,
}) => {
  const [notes, saveAndSetNotes, setNotes] = useSyncNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    return notes.length > 0 ? notes[0].id : null;
  });

  const [filter, setFilter] = useState<NoteFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  // In compact layout (or single pane), track if viewing editor or list
  const [viewingDetailOnCompact, setViewingDetailOnCompact] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return 600;
  });

  const activeId =
    selectedNoteId && notes.some((n) => n.id === selectedNoteId)
      ? selectedNoteId
      : notes[0]?.id || null;
  const activeNote = notes.find((n) => n.id === activeId) || null;

  // Debounce timer ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep ref to latest notes for listeners and unmount flush
  const notesRef = useRef<NoteItem[]>(notes);
  notesRef.current = notes;

  // Track container width for responsive split vs single pane layout
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setContainerWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
      }
    };
    updateWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", updateWidth);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // Debounced auto-save function (350ms)
  const triggerAutoSave = useCallback((updatedList: NoteItem[], targetNote: NoteItem) => {
    setSaveStatus("saving");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        saveNotes(updatedList);

        // Persist to SQLite
        if (isTauriEnvironment()) {
          await persistNote({
            id: targetNote.id,
            parentId: targetNote.parentId || null,
            goalId: targetNote.goalId || null,
            taskId: targetNote.taskId || null,
            actionPlanId: targetNote.actionPlanId || null,
            title: targetNote.title,
            content: targetNote.content,
            isPinned: targetNote.isPinned || false,
            sortOrder: targetNote.sortOrder || 0,
            createdAt: targetNote.createdAt || Date.now(),
            updatedAt: targetNote.updatedAt || Date.now(),
          });
        }
      } finally {
        setSaveStatus("saved");
      }
    }, 350);
  }, []);

  // Update a note in state and trigger auto-save
  const updateNote = useCallback(
    (updater: (prevNote: NoteItem) => NoteItem) => {
      const targetId = activeId;
      if (!targetId) return;

      setSaveStatus("saving");

      const prevNotes = notesRef.current;
      let changedTarget: NoteItem | null = null;
      const next = prevNotes.map((n) => {
        if (n.id === targetId) {
          const updated = updater(n);
          changedTarget = {
            ...updated,
            updatedAt: Date.now(),
          };
          return changedTarget;
        }
        return n;
      });

      setNotes(next);
      if (changedTarget) {
        triggerAutoSave(next, changedTarget);
      }
    },
    [activeId, triggerAutoSave, setNotes]
  );

  // Note Field Handlers
  const handleChangeTitle = (newTitle: string) => {
    updateNote((prev) => ({ ...prev, title: newTitle }));
  };

  const handleChangeContent = (newContent: string) => {
    updateNote((prev) => ({ ...prev, content: newContent }));
  };

  const handleTogglePin = (id?: string) => {
    const targetId = id || activeId;
    if (!targetId) return;

    setNotes((prevNotes) => {
      let changedTarget: NoteItem | null = null;
      const next = prevNotes.map((n) => {
        if (n.id === targetId) {
          changedTarget = { ...n, isPinned: !n.isPinned, updatedAt: Date.now() };
          return changedTarget;
        }
        return n;
      });
      if (changedTarget) {
        triggerAutoSave(next, changedTarget);
      }
      return next;
    });
  };

  const handleChangeLink = (links: {
    goalId?: string | null;
    taskId?: string | null;
    actionPlanId?: string | null;
  }) => {
    updateNote((prev) => ({
      ...prev,
      goalId: links.goalId !== undefined ? links.goalId : prev.goalId,
      taskId: links.taskId !== undefined ? links.taskId : prev.taskId,
      actionPlanId: links.actionPlanId !== undefined ? links.actionPlanId : prev.actionPlanId,
    }));
  };

  // Create New Note Action (Ctrl+N)
  const handleNewNote = useCallback(() => {
    const newNote: NoteItem = {
      id: "note_" + Date.now(),
      title: "UNTITLED NOTE",
      content: "",
      isPinned: false,
      sortOrder: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const next = [newNote, ...notesRef.current];
    setNotes(next);
    setSelectedNoteId(newNote.id);
    setViewingDetailOnCompact(true);
    triggerAutoSave(next, newNote);
  }, [triggerAutoSave]);

  // Delete Note Action (Ctrl+Delete)
  const handleDeleteNote = useCallback(
    async (idToDelete?: string) => {
      const targetId = idToDelete || selectedNoteId;
      if (!targetId) return;

      const remaining = notesRef.current.filter((n) => n.id !== targetId);
      saveAndSetNotes(remaining);

      if (isTauriEnvironment()) {
        removeNote(targetId).catch(() => {});
      }

      if (selectedNoteId === targetId) {
        const nextSelected = remaining.length > 0 ? remaining[0].id : null;
        setSelectedNoteId(nextSelected);
        if (!nextSelected) {
          setViewingDetailOnCompact(false);
        }
      }
    },
    [selectedNoteId]
  );

  // Keyboard Shortcuts: Ctrl+N, Ctrl+Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New Note
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewNote();
        return;
      }

      // Ctrl+Delete: Delete active note
      if ((e.ctrlKey || e.metaKey) && (e.key === "Delete" || e.key === "Backspace")) {
        // Only trigger if not actively typing in an input/textarea
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          handleDeleteNote();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewNote, handleDeleteNote]);

  const isSplitLayout = containerWidth >= 480;

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col bg-[#03070d] text-cyan-200 select-none overflow-hidden relative font-hud"
    >
      {/* Return to Monitoring Banner if rendered in Left Dock */}
      {isLeftDock && onBackToMonitoring && (
        <div className="flex items-center justify-between px-2 py-1 border-b border-cyan-500/30 bg-black/60 text-[10px] font-tech text-cyan-300 shrink-0">
          <button
            onClick={onBackToMonitoring}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-100 transition cursor-pointer font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO MONITORING</span>
          </button>
          <span className="text-cyan-500/60 font-mono text-[9px]">LEFT DOCK</span>
        </div>
      )}
      {/* Responsive layout: unified container to prevent unmounting NoteEditor across width thresholds */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden divide-x divide-cyan-500/20">
        {/* Left: Notes List */}
        <div
          className={`h-full overflow-hidden ${
            isSplitLayout
              ? "w-56 shrink-0 block"
              : viewingDetailOnCompact
                ? "hidden"
                : "w-full flex-1 block"
          }`}
        >
          <NotesList
            notes={notes}
            selectedNoteId={activeId}
            isCompact={isCompact}
            onSelectNote={(id) => {
              setSelectedNoteId(id);
              setViewingDetailOnCompact(true);
            }}
            onNewNote={handleNewNote}
            onTogglePin={handleTogglePin}
            onDeleteNote={handleDeleteNote}
            filter={filter}
            onChangeFilter={setFilter}
            searchQuery={searchQuery}
            onChangeSearchQuery={setSearchQuery}
          />
        </div>

        {/* Right: Note Editor */}
        <div
          className={`h-full overflow-hidden ${
            isSplitLayout
              ? "flex-1 min-w-0 block"
              : viewingDetailOnCompact
                ? "w-full flex-1 block"
                : "hidden"
          }`}
        >
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              onChangeTitle={handleChangeTitle}
              onChangeContent={handleChangeContent}
              onTogglePin={() => handleTogglePin(activeNote.id)}
              onDeleteNote={() => {
                handleDeleteNote(activeNote.id);
                setViewingDetailOnCompact(false);
              }}
              onChangeLink={handleChangeLink}
              saveStatus={saveStatus}
              onBackToList={!isSplitLayout ? () => setViewingDetailOnCompact(false) : undefined}
              isCompact={!isSplitLayout}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-cyan-500/40 text-xs font-tech">
              <span>SELECT OR CREATE A NOTE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
