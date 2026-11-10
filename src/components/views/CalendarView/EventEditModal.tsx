import React, { useState } from "react";
import { X, Trash2, Clock, MapPin, AlignLeft, RotateCw, ChevronDown } from "lucide-react";
import { CalendarEvent, NoteItem } from "../../../types/hud";
import { formatTime12 } from "../../../utils/calendarFormatters";
import { formatDateToISO } from "../../../utils/formatters";
import { EventNotesSection } from "./EventNotesSection";
import { EventCustomRecurrenceModal, CustomRecurrenceConfig } from "./EventCustomRecurrenceModal";

export type { CustomRecurrenceConfig };

interface EventEditModalProps {
  initialEvent?: Partial<CalendarEvent>;
  availableNotes: NoteItem[];
  onSave: (event: CalendarEvent, attachedNoteIds?: string[]) => void;
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
  const [date, setDate] = useState(initialEvent?.date || formatDateToISO());
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
    return formatDateToISO(d);
  });
  const [occurrences, setOccurrences] = useState<number>(13);

  // Linked notes (notes whose calendarEventId matches this event's id)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() => {
    if (!initialEvent?.id) return [];
    return availableNotes
      .filter((n) => n.calendarEventId === initialEvent.id)
      .map((n) => n.id);
  });


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

    onSave(eventToSave, selectedNoteIds);
  };

  const toggleAttachNote = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

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

          {/* Linked Notes Section */}
          <EventNotesSection
            availableNotes={availableNotes}
            selectedNoteIds={selectedNoteIds}
            onToggleAttachNote={toggleAttachNote}
            onCreateNote={onCreateNote}
            onNavigateToNote={onNavigateToNote}
            calendarEventId={initialEvent?.id}
          />

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
        <EventCustomRecurrenceModal
          isOpen={isCustomRecurrenceOpen}
          interval={customInterval}
          unit={customUnit}
          daysOfWeek={customDays}
          endType={endType}
          endDate={endDate}
          occurrences={occurrences}
          onChangeInterval={setCustomInterval}
          onChangeUnit={setCustomUnit}
          onToggleDay={toggleCustomDay}
          onChangeEndType={setEndType}
          onChangeEndDate={setEndDate}
          onChangeOccurrences={setOccurrences}
          onCancel={() => setIsCustomRecurrenceOpen(false)}
          onDone={handleApplyCustomRecurrence}
        />
      </div>
    </div>
  );
};
