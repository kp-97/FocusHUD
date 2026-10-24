import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { NoteItem } from "../../../types/hud";
import { NotesList, NoteFilter } from "./NotesList";
import { NoteEditor } from "./NoteEditor";
import { loadNotes, saveNotes } from "../../../stores/layoutStore";
import {
  fetchNotes,
  persistNote,
  removeNote,
  onDbChange,
  isTauriEnvironment,
} from "../../../services/dbService";

interface NotesViewProps {
  isLeftDock?: boolean;
  onBackToMonitoring?: () => void;
}

const NOTES_CHANNEL_NAME = "focushud_notes_channel";
const notesChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(NOTES_CHANNEL_NAME)
    : null;

export const NotesView: React.FC<NotesViewProps> = ({
  isLeftDock = false,
  onBackToMonitoring,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    const list = loadNotes();
    return list.length > 0 ? list[0].id : null;
  });

  const [filter, setFilter] = useState<NoteFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  // In compact layout (or single pane), track if viewing editor or list
  const [viewingDetailOnCompact, setViewingDetailOnCompact] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(300);

  // Debounce timer ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep ref to latest notes for listeners and unmount flush
  const notesRef = useRef<NoteItem[]>(notes);
  notesRef.current = notes;

  // Track container width for responsive split vs single pane layout
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
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

  // Fetch initial notes from SQLite on mount
  useEffect(() => {
    let active = true;
    if (isTauriEnvironment()) {
      fetchNotes().then((dbNotes) => {
        if (!active) return;
        if (dbNotes && dbNotes.length > 0) {
          const mapped: NoteItem[] = dbNotes.map((n) => ({
            id: n.id,
            parentId: n.parentId,
            goalId: n.goalId,
            taskId: n.taskId,
            actionPlanId: n.actionPlanId,
            title: n.title,
            content: n.content,
            isPinned: n.isPinned,
            sortOrder: n.sortOrder,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          }));
          setNotes(mapped);
          setSelectedNoteId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
        } else {
          // If SQLite is empty, persist default notes
          const initial = loadNotes();
          if (initial.length > 0) {
            persistNote({
              ...initial[0],
            }).catch(() => {});
          }
        }
      });
    }

    // Dual-window cross-dock synchronization via Tauri SQLite events
    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === "notes" || payload.entity === "all") {
        fetchNotes().then((dbNotes) => {
          if (!active || !dbNotes) return;
          const mapped: NoteItem[] = dbNotes.map((n) => ({
            id: n.id,
            parentId: n.parentId,
            goalId: n.goalId,
            taskId: n.taskId,
            actionPlanId: n.actionPlanId,
            title: n.title,
            content: n.content,
            isPinned: n.isPinned,
            sortOrder: n.sortOrder,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          }));
          setNotes(mapped);
          setSelectedNoteId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || null));
        });
      }
    });

    // Dual-window cross-dock synchronization via BroadcastChannel
    const handleBroadcast = (e: MessageEvent) => {
      if (e.data && e.data.type === "SYNC_NOTES" && Array.isArray(e.data.notes)) {
        setNotes(e.data.notes);
        if (e.data.selectedId && e.data.broadcastSelect) {
          setSelectedNoteId(e.data.selectedId);
        }
      }
    };

    if (notesChannel) {
      notesChannel.addEventListener("message", handleBroadcast);
    }

    // Storage event sync (browser fallback)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "focushud_notes" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setNotes(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten && unlisten());
      if (notesChannel) {
        notesChannel.removeEventListener("message", handleBroadcast);
      }
      window.removeEventListener("storage", handleStorage);
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
        // Save to localStorage
        saveNotes(updatedList);

        // Broadcast to other dock window
        if (notesChannel) {
          notesChannel.postMessage({
            type: "SYNC_NOTES",
            notes: updatedList,
          });
        }

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
      if (!selectedNoteId) return;

      setNotes((prevNotes) => {
        let changedTarget: NoteItem | null = null;
        const next = prevNotes.map((n) => {
          if (n.id === selectedNoteId) {
            const updated = updater(n);
            changedTarget = {
              ...updated,
              updatedAt: Date.now(),
            };
            return changedTarget;
          }
          return n;
        });

        if (changedTarget) {
          triggerAutoSave(next, changedTarget);
        }
        return next;
      });
    },
    [selectedNoteId, triggerAutoSave]
  );

  // Note Field Handlers
  const handleChangeTitle = (newTitle: string) => {
    updateNote((prev) => ({ ...prev, title: newTitle }));
  };

  const handleChangeContent = (newContent: string) => {
    updateNote((prev) => ({ ...prev, content: newContent }));
  };

  const handleTogglePin = (id?: string) => {
    const targetId = id || selectedNoteId;
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
      setNotes(remaining);
      saveNotes(remaining);

      if (notesChannel) {
        notesChannel.postMessage({
          type: "SYNC_NOTES",
          notes: remaining,
        });
      }

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

  const activeNote = notes.find((n) => n.id === selectedNoteId) || null;
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
      {/* If split master-detail is supported */}
      {isSplitLayout ? (
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden divide-x divide-cyan-500/20">
          {/* Left: Notes List */}
          <div className="w-56 shrink-0 h-full overflow-hidden">
            <NotesList
              notes={notes}
              selectedNoteId={selectedNoteId}
              onSelectNote={(id) => setSelectedNoteId(id)}
              onNewNote={handleNewNote}
              onTogglePin={handleTogglePin}
              onDeleteNote={handleDeleteNote}
              filter={filter}
              onChangeFilter={setFilter}
              searchQuery={searchQuery}
              onChangeSearchQuery={setSearchQuery}
              isCompact={false}
            />
          </div>

          {/* Right: Note Editor */}
          <div className="flex-1 min-w-0 h-full overflow-hidden">
            {activeNote ? (
              <NoteEditor
                note={activeNote}
                onChangeTitle={handleChangeTitle}
                onChangeContent={handleChangeContent}
                onTogglePin={() => handleTogglePin(activeNote.id)}
                onDeleteNote={() => handleDeleteNote(activeNote.id)}
                onChangeLink={handleChangeLink}
                saveStatus={saveStatus}
                isCompact={false}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-cyan-500/40 text-xs font-tech">
                <span>SELECT OR CREATE A NOTE</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Single-Pane Compact Layout (Master-detail drilldown) */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          {viewingDetailOnCompact && activeNote ? (
            <NoteEditor
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
              onBackToList={() => setViewingDetailOnCompact(false)}
              isCompact={true}
            />
          ) : (
            <NotesList
              notes={notes}
              selectedNoteId={selectedNoteId}
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
              isCompact={true}
            />
          )}
        </div>
      )}
    </div>
  );
};
