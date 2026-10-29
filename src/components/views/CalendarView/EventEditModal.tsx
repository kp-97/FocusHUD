import React, { useState, useRef, useEffect } from "react";
import { X, Trash2, Clock, MapPin, AlignLeft, FileText, Plus, Check, RotateCw, ChevronDown, Search } from "lucide-react";
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

export interface CustomRecurrenceConfig {
  interval: number;
  unit: "day" | "week" | "month" | "year";
  daysOfWeek: number[]; // 0 = Mon, 6 = Sun
  endType: "never" | "on" | "after";
  endDate?: string;
  occurrences?: number;
}

const DAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

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

  // Recurrence state
  const [recurrence, setRecurrence] = useState<string>(initialEvent?.recurrence || "none");
  const [isRecurrenceDropdownOpen, setIsRecurrenceDropdownOpen] = useState(false);
  const [isCustomRecurrenceOpen, setIsCustomRecurrenceOpen] = useState(false);

  // Custom recurrence configuration
  const [customInterval, setCustomInterval] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<"day" | "week" | "month" | "year">("week");
  const [customDays, setCustomDays] = useState<number[]>([new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1]);
  const [endType, setEndType] = useState<"never" | "on" | "after">("never");
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [occurrences, setOccurrences] = useState<number>(13);

  // Linked notes (notes whose calendarEventId matches this event's id)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() => {
    if (!initialEvent?.id) return [];
    return availableNotes
      .filter((n) => n.calendarEventId === initialEvent.id)
      .map((n) => n.id);
  });

  // Note search & combobox dropdown state
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

  // Get dynamic recurrence label for the current date
  const eventDateObj = new Date(date + "T00:00:00");
  const weekdayName = eventDateObj.toLocaleDateString("en-US", { weekday: "long" });
  const monthDayName = eventDateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const recurrenceOptions = [
    { id: "none", label: "Does not repeat" },
    { id: "daily", label: "Daily" },
    { id: "weekly", label: `Weekly on ${weekdayName}` },
    { id: "monthly_last", label: `Monthly on the last ${weekdayName}` },
    { id: "annually", label: `Annually on ${monthDayName}` },
    { id: "weekday", label: "Every weekday (Monday to Friday)" },
    { id: "custom", label: "Custom..." },
  ];

  const getActiveRecurrenceLabel = () => {
    if (recurrence.startsWith("custom:")) {
      return "Custom...";
    }
    const found = recurrenceOptions.find((o) => o.id === recurrence);
    return found ? found.label : "Does not repeat";
  };

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
      recurrence,
      color,
      createdAt: initialEvent?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(eventToSave);
  };

  const handleCreateAndAttachNote = (titleToCreate?: string) => {
    const rawTitle = titleToCreate ?? noteSearchQuery;
    if (!rawTitle.trim() || !onCreateNote) return;
    const created = onCreateNote(rawTitle.trim(), initialEvent?.id);
    setSelectedNoteIds((prev) => [...prev, created.id]);
    setNoteSearchQuery("");
    setIsNoteDropdownOpen(false);
  };

  const toggleAttachNote = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const filteredNotes = availableNotes.filter((n) =>
    n.title.toLowerCase().includes(noteSearchQuery.trim().toLowerCase())
  );
  const exactMatchExists = availableNotes.some(
    (n) => n.title.trim().toLowerCase() === noteSearchQuery.trim().toLowerCase()
  );

  const handleApplyCustomRecurrence = () => {
    const config: CustomRecurrenceConfig = {
      interval: customInterval,
      unit: customUnit,
      daysOfWeek: customDays,
      endType,
      endDate: endType === "on" ? endDate : undefined,
      occurrences: endType === "after" ? occurrences : undefined,
    };
    setRecurrence(`custom:${JSON.stringify(config)}`);
    setIsCustomRecurrenceOpen(false);
  };

  const toggleCustomDay = (dayIndex: number) => {
    setCustomDays((prev) =>
      prev.includes(dayIndex)
        ? prev.length > 1 ? prev.filter((d) => d !== dayIndex) : prev
        : [...prev, dayIndex].sort()
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
        className="w-full max-w-md rounded-xl bg-[#071322] border border-cyan-500/30 shadow-[0_16px_40px_rgba(0,0,0,0.8)] overflow-visible flex flex-col font-hud text-cyan-300 relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-[#050b14]/70 rounded-t-xl">
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
                  step={60}
                  data-testid="event-starttime-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 outline-none focus:border-cyan-400 font-mono"
                />
                <span className="text-cyan-500/60">–</span>
                <input
                  type="time"
                  required
                  step={60}
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

          {/* Recurrence Dropdown Selector */}
          <div className="relative pl-6">
            <button
              type="button"
              onClick={() => setIsRecurrenceDropdownOpen((v) => !v)}
              data-testid="recurrence-dropdown-btn"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#03070d] border border-cyan-500/30 hover:border-cyan-400 text-cyan-200 hover:text-cyan-100 transition cursor-pointer text-xs w-full justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                <span className="truncate">{getActiveRecurrenceLabel()}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-500/60" />
            </button>

            {isRecurrenceDropdownOpen && (
              <div
                data-testid="recurrence-menu"
                className="absolute left-6 right-0 top-full mt-1 bg-[#091528] border border-cyan-500/30 rounded-lg shadow-[0_12px_28px_rgba(0,0,0,0.8)] z-50 py-1 font-tech"
              >
                {recurrenceOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setIsRecurrenceDropdownOpen(false);
                      if (opt.id === "custom") {
                        setIsCustomRecurrenceOpen(true);
                      } else {
                        setRecurrence(opt.id);
                      }
                    }}
                    data-testid={`recurrence-opt-${opt.id}`}
                    className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-100 ${
                      recurrence === opt.id
                        ? "bg-cyan-500/25 text-cyan-100 font-semibold"
                        : "text-cyan-300/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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

          {/* Linked Notes Section (Approach C: Combined Search + Instant Quick Create Dropdown) */}
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
                        onClick={() => toggleAttachNote(id)}
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
                        // If exact match exists, toggle it; otherwise create new note
                        const match = availableNotes.find(
                          (n) => n.title.trim().toLowerCase() === noteSearchQuery.trim().toLowerCase()
                        );
                        if (match) {
                          toggleAttachNote(match.id);
                          setNoteSearchQuery("");
                          setIsNoteDropdownOpen(false);
                        } else {
                          handleCreateAndAttachNote();
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
                  {/* Quick-create row when typing a new note title */}
                  {noteSearchQuery.trim() && !exactMatchExists && onCreateNote && (
                    <button
                      type="button"
                      onClick={() => handleCreateAndAttachNote()}
                      data-testid="note-quick-create-btn"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-tech text-cyan-200 hover:bg-cyan-500/20 transition cursor-pointer border-b border-cyan-500/20 mb-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        Create & attach <span className="font-semibold text-cyan-100">"{noteSearchQuery.trim()}"</span>
                      </span>
                    </button>
                  )}

                  {/* Filtered list of existing notes */}
                  {filteredNotes.length > 0 ? (
                    filteredNotes.map((note) => {
                      const isAttached = selectedNoteIds.includes(note.id);
                      return (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => {
                            toggleAttachNote(note.id);
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

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-cyan-500/20 pt-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              data-testid="event-cancel-btn"
              className="px-3 py-1 rounded-full text-xs text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/10 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="event-save-btn"
              className="px-4 py-1 rounded-full text-xs font-semibold bg-cyan-500/30 text-cyan-100 border border-cyan-400 hover:bg-cyan-500/50 shadow-[0_0_12px_rgba(0,229,255,0.3)] transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>

        {/* Custom Recurrence Modal Overlay */}
        {isCustomRecurrenceOpen && (
          <div
            data-testid="custom-recurrence-overlay"
            className="absolute inset-0 z-50 rounded-xl bg-[#071322] border border-cyan-400/60 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.9)] flex flex-col justify-between font-hud"
          >
            <div>
              <h2 className="text-sm font-orbitron font-semibold text-cyan-100 mb-4 tracking-wide">
                Custom recurrence
              </h2>

              {/* Repeat every N [unit] */}
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span>Repeat every</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  data-testid="custom-interval-input"
                  value={customInterval}
                  onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-12 bg-[#03070d] border border-cyan-500/40 rounded px-2 py-1 text-center text-cyan-100"
                />
                <select
                  data-testid="custom-unit-select"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as any)}
                  className="bg-[#03070d] border border-cyan-500/40 rounded px-2 py-1 text-cyan-200 outline-none"
                >
                  <option value="day">day{customInterval > 1 ? "s" : ""}</option>
                  <option value="week">week{customInterval > 1 ? "s" : ""}</option>
                  <option value="month">month{customInterval > 1 ? "s" : ""}</option>
                  <option value="year">year{customInterval > 1 ? "s" : ""}</option>
                </select>
              </div>

              {/* Repeat on (days of week) when unit is week */}
              {customUnit === "week" && (
                <div className="mb-4">
                  <span className="block text-xs text-cyan-400/80 mb-2">Repeat on</span>
                  <div className="flex items-center gap-1.5">
                    {DAYS_SHORT.map((dayLabel, idx) => {
                      const isSelected = customDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCustomDay(idx)}
                          data-testid={`custom-day-${idx}`}
                          className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                            isSelected
                              ? "bg-cyan-500 text-black shadow-[0_0_8px_#00e5ff]"
                              : "bg-[#03070d] text-cyan-400/60 border border-cyan-500/20 hover:text-cyan-200"
                          }`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ends configuration */}
              <div className="flex flex-col gap-2.5 text-xs">
                <span className="text-cyan-400/80">Ends</span>

                {/* Never */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === "never"}
                    onChange={() => setEndType("never")}
                    className="text-cyan-500 focus:ring-0 bg-[#03070d]"
                  />
                  <span>Never</span>
                </label>

                {/* On [Date] */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === "on"}
                    onChange={() => setEndType("on")}
                    className="text-cyan-500 focus:ring-0 bg-[#03070d]"
                  />
                  <span>On</span>
                  <input
                    type="date"
                    disabled={endType !== "on"}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-0.5 text-cyan-200 outline-none disabled:opacity-40"
                  />
                </label>

                {/* After N occurrences */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === "after"}
                    onChange={() => setEndType("after")}
                    className="text-cyan-500 focus:ring-0 bg-[#03070d]"
                  />
                  <span>After</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    disabled={endType !== "after"}
                    value={occurrences}
                    onChange={(e) => setOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 bg-[#03070d] border border-cyan-500/30 rounded px-2 py-0.5 text-center text-cyan-200 outline-none disabled:opacity-40"
                  />
                  <span>occurrences</span>
                </label>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setIsCustomRecurrenceOpen(false)}
                className="px-3 py-1 rounded-full text-xs text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomRecurrence}
                data-testid="custom-recurrence-done-btn"
                className="px-4 py-1 rounded-full text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.4)] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
