import React, { useState } from "react";
import { X, Trash2, Clock, MapPin, AlignLeft, FileText, Plus, Check } from "lucide-react";
import { CalendarEvent, NoteItem } from "../../../types/hud";
import { formatTime12 } from "../../../utils/calendarFormatters";

interface EventEditModalProps {
  initialEvent?: Partial<CalendarEvent>;
  availableNotes: NoteItem[];
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  onClose: () => void;
  onCreateNote?: (title: string, calendarEventId?: string) => NoteItem;
  onNavigateToNote?: (noteId: string) => void;
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  initialEvent,
  availableNotes,
  onSave,
  onDelete,
  onClose,
  onCreateNote,
  onNavigateToNote,
}) => {
  const isEditing = Boolean(initialEvent?.id);

  const [title, setTitle] = useState(initialEvent?.title || "");
  const [date, setDate] = useState(initialEvent?.date || new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(initialEvent?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initialEvent?.endTime || "10:00");
  const [isAllDay, setIsAllDay] = useState(Boolean(initialEvent?.isAllDay));
  const [location, setLocation] = useState(initialEvent?.location || "");
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [color, setColor] = useState(initialEvent?.color || "#00e5ff");

  // Linked notes (notes whose calendarEventId matches this event's id)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() => {
    if (!initialEvent?.id) return [];
    return availableNotes
      .filter((n) => n.calendarEventId === initialEvent.id)
      .map((n) => n.id);
  });

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const eventToSave: CalendarEvent = {
      id: initialEvent?.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      date,
      startTime: isAllDay ? "00:00" : startTime,
      endTime: isAllDay ? "23:59" : endTime,
      isAllDay,
      location: location.trim(),
      description: description.trim(),
      color,
      createdAt: initialEvent?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(eventToSave);
  };

  const handleCreateNewNote = () => {
    if (!newNoteTitle.trim() || !onCreateNote) return;
    const created = onCreateNote(newNoteTitle.trim(), initialEvent?.id);
    setSelectedNoteIds((prev) => [...prev, created.id]);
    setNewNoteTitle("");
    setIsAddingNote(false);
  };

  const toggleAttachNote = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  return (
    <div
      data-testid="event-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="event-modal-content"
        className="w-full max-w-md rounded-xl bg-[#071322] border border-cyan-500/30 shadow-[0_16px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-hud text-cyan-300"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-[#050b14]/70">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-orbitron font-semibold tracking-wider text-cyan-200">
              {isEditing ? "EDIT EVENT" : "NEW EVENT"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(initialEvent!.id!)}
                title="Delete Event"
                data-testid="event-delete-btn"
                className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-500/20 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              data-testid="event-close-btn"
              className="p-1 rounded text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-4 flex flex-col gap-3 text-xs">
          {/* Title Input */}
          <div>
            <input
              type="text"
              autoFocus
              required
              data-testid="event-title-input"
              placeholder="Add title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#03070d] border-b-2 border-cyan-500/40 focus:border-cyan-400 px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-500/40 outline-none font-medium transition"
            />
          </div>

          {/* Date & Time Row */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-2 text-cyan-400/80">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="date"
                required
                data-testid="event-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400"
              />
              <label className="flex items-center gap-1.5 ml-auto text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="event-allday-checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-cyan-500/40 text-cyan-500 focus:ring-0 bg-[#03070d]"
                />
                <span>All day</span>
              </label>
            </div>

            {!isAllDay && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="time"
                  required
                  data-testid="event-starttime-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400 font-mono"
                />
                <span className="text-cyan-500/60">–</span>
                <input
                  type="time"
                  required
                  data-testid="event-endtime-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400 font-mono"
                />
                <span className="text-[10px] text-cyan-400/60 font-mono">
                  ({formatTime12(startTime)} – {formatTime12(endTime)})
                </span>
              </div>
            )}
          </div>

          {/* Location Input */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              data-testid="event-location-input"
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1 bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400 placeholder:text-cyan-500/40"
            />
          </div>

          {/* Description Input */}
          <div className="flex items-start gap-2">
            <AlignLeft className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />
            <textarea
              rows={2}
              data-testid="event-description-input"
              placeholder="Add description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400 placeholder:text-cyan-500/40 resize-none"
            />
          </div>

          {/* Color Picker Row */}
          <div className="flex items-center gap-2 pl-6">
            <span className="text-[11px] text-cyan-500/70">Accent:</span>
            <div className="flex items-center gap-1.5">
              {["#00e5ff", "#ff9100", "#00e676", "#ff5252", "#d500f9", "#ffd600"].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full transition cursor-pointer ${
                    color === c ? "ring-2 ring-white scale-110" : "opacity-70 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Linked Notes Section */}
          <div className="border-t border-cyan-500/15 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
                <FileText className="w-3.5 h-3.5" />
                <span>Attached Notes</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNote((v) => !v)}
                data-testid="toggle-add-note-btn"
                className="flex items-center gap-1 text-[10px] font-tech text-cyan-300 hover:text-cyan-100 px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
              >
                <Plus className="w-3 h-3" />
                <span>New Note</span>
              </button>
            </div>

            {/* Create new linked note inline */}
            {isAddingNote && (
              <div className="flex items-center gap-1.5 bg-[#03070d] p-1.5 rounded border border-cyan-500/30">
                <input
                  type="text"
                  placeholder="Note title..."
                  data-testid="new-note-title-input"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-cyan-100 outline-none px-1"
                />
                <button
                  type="button"
                  onClick={handleCreateNewNote}
                  data-testid="confirm-add-note-btn"
                  className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/40 text-[10px] border border-cyan-500/40"
                >
                  Create
                </button>
              </div>
            )}

            {/* List of existing notes to toggle attachment */}
            {availableNotes.length > 0 && (
              <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 py-1">
                {availableNotes.map((note) => {
                  const isAttached = selectedNoteIds.includes(note.id);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => toggleAttachNote(note.id)}
                      data-testid={`attach-note-${note.id}`}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-tech border transition cursor-pointer ${
                        isAttached
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_6px_rgba(0,229,255,0.2)]"
                          : "bg-[#03070d] border-cyan-500/20 text-cyan-400/60 hover:text-cyan-300"
                      }`}
                    >
                      {isAttached && <Check className="w-2.5 h-2.5 text-cyan-300" />}
                      <span className="truncate max-w-[120px]">{note.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Attached notes jump links */}
            {selectedNoteIds.length > 0 && onNavigateToNote && (
              <div className="flex flex-wrap gap-1 text-[10px] text-cyan-500/60">
                <span>Jump to:</span>
                {selectedNoteIds.map((id) => {
                  const note = availableNotes.find((n) => n.id === id);
                  if (!note) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onNavigateToNote(id)}
                      className="underline text-cyan-300 hover:text-cyan-100"
                    >
                      {note.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-cyan-500/20 pt-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              data-testid="event-cancel-btn"
              className="px-3 py-1 rounded-full text-xs text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="event-save-btn"
              className="px-4 py-1 rounded-full text-xs font-semibold bg-cyan-500/30 text-cyan-100 border border-cyan-400 hover:bg-cyan-500/50 shadow-[0_0_12px_rgba(0,229,255,0.3)] transition"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
