import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  CheckCircle2,
} from "lucide-react";
import {
  loadEvents,
  saveEvents,
  loadTasks,
  loadNotes,
  saveNotes,
  getTodayString,
  broadcastNavChange,
} from "../../stores/layoutStore";
import { CalendarEvent, TaskItem, NoteItem } from "../../types/hud";
import {
  CalendarMode,
  CALENDAR_MODES,
  formatDateISO,
  getMondayOfWeek,
  getCalendarHeaderTitle,
  navigateDate,
  DAYS_OF_WEEK_SHORT,
  formatHour12,
  formatTime12,
} from "../../utils/calendarFormatters";
import { EventEditModal } from "./CalendarView/EventEditModal";
import {
  fetchCalendarEvents,
  saveCalendarEvent as persistCalendarEvent,
  deleteCalendarEvent as removeCalendarEvent,
  onDbChange,
  isTauriEnvironment,
} from "../../services/dbService";
import { dbEventsToApp, appEventsToDb } from "../../services/dbAdapters";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 52; // pixels per hour in timetable

export interface CalendarItemDisplay {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  color?: string;
  isTask?: boolean;
  completed?: boolean;
  originalEvent?: CalendarEvent;
}

// Helper to recursively flatten tasks
const flattenTasks = (taskList: TaskItem[]): TaskItem[] => {
  const result: TaskItem[] = [];
  const recurse = (list: TaskItem[]) => {
    for (const t of list) {
      result.push(t);
      if (t.subtasks && t.subtasks.length > 0) {
        recurse(t.subtasks);
      }
    }
  };
  recurse(taskList);
  return result;
};

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [tasks] = useState<TaskItem[]>(loadTasks);
  const [notes, setNotes] = useState<NoteItem[]>(loadNotes);

  const [mode, setMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem("focushud_calendar_mode");
    return (saved as CalendarMode) || "week";
  });

  // Independent Events and Tasks toggle states
  const [showEvents, setShowEvents] = useState<boolean>(() => {
    const saved = localStorage.getItem("focushud_show_events");
    return saved !== null ? saved === "true" : true;
  });

  const [showTasks, setShowTasks] = useState<boolean>(() => {
    const saved = localStorage.getItem("focushud_show_tasks");
    return saved !== null ? saved === "true" : true;
  });

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timetableScrollRef = useRef<HTMLDivElement>(null);

  // Modal State for Create / Edit
  const [activeModalEvent, setActiveModalEvent] = useState<Partial<CalendarEvent> | null>(null);

  // Sync with Tauri SQLite backend if available
  useEffect(() => {
    let active = true;
    if (isTauriEnvironment()) {
      fetchCalendarEvents().then((dbEvents) => {
        if (active && dbEvents.length > 0) {
          setEvents(dbEventsToApp(dbEvents));
        }
      });
    }

    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === "calendar_events" || payload.entity === "all") {
        fetchCalendarEvents().then((dbEvents) => {
          if (active) setEvents(dbEventsToApp(dbEvents));
        });
      }
      if (payload.entity === "notes" || payload.entity === "all") {
        setNotes(loadNotes());
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten && unlisten());
    };
  }, []);

  // Persist mode & independent display toggles
  useEffect(() => {
    localStorage.setItem("focushud_calendar_mode", mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("focushud_show_events", String(showEvents));
  }, [showEvents]);

  useEffect(() => {
    localStorage.setItem("focushud_show_tasks", String(showTasks));
  }, [showTasks]);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Keyboard Shortcuts: Alt + D, W, M, Y, A, X & standard single keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeModalEvent) return; // Do not intercept shortcuts when edit modal is open

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const key = e.key.toUpperCase();

      // Alt + hotkey
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const found = CALENDAR_MODES.find((m) => m.shortcutKey === key);
        if (found) {
          e.preventDefault();
          setMode(found.id);
          return;
        }
      }

      // Single-key mode shortcuts or navigation when no modifier key is active
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        if (key === "T") {
          e.preventDefault();
          setCurrentDate(new Date());
        } else if (key === "J" || key === "N") {
          e.preventDefault();
          setCurrentDate((d) => navigateDate(d, mode, 1));
        } else if (key === "K" || key === "P") {
          e.preventDefault();
          setCurrentDate((d) => navigateDate(d, mode, -1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, activeModalEvent]);

  // Auto-scroll timetable to morning / current hour on initial load or mode switch
  useEffect(() => {
    if ((mode === "day" || mode === "week" || mode === "4days") && timetableScrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollHour = Math.max(0, currentHour >= 8 ? currentHour - 2 : 7);
      timetableScrollRef.current.scrollTop = scrollHour * HOUR_HEIGHT;
    }
  }, [mode]);

  // Unified items mapped from both Events and Tasks independently
  const displayItems = useMemo<CalendarItemDisplay[]>(() => {
    const list: CalendarItemDisplay[] = [];

    if (showEvents) {
      events.forEach((e) => {
        list.push({
          id: e.id,
          title: e.title,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          color: e.color || "#00e5ff",
          isTask: false,
          originalEvent: e,
        });
      });
    }

    if (showTasks) {
      const flat = flattenTasks(tasks);
      flat.forEach((t) => {
        list.push({
          id: t.id,
          title: t.title,
          date: t.dueDate || t.completedAt || getTodayString(),
          startTime: "09:00",
          endTime: "10:00",
          color: t.completed ? "#00e676" : "#ff9100",
          isTask: true,
          completed: t.completed,
        });
      });
    }

    return list;
  }, [showEvents, showTasks, events, tasks]);

  // CRUD Operations
  const handleSaveEvent = (savedEvent: CalendarEvent) => {
    const exists = events.some((e) => e.id === savedEvent.id);
    const updated = exists
      ? events.map((e) => (e.id === savedEvent.id ? savedEvent : e))
      : [...events, savedEvent];

    setEvents(updated);
    saveEvents(updated);

    if (isTauriEnvironment()) {
      persistCalendarEvent(appEventsToDb([savedEvent])[0]).catch(() => {});
    }

    setActiveModalEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    const updated = events.filter((e) => e.id !== eventId);
    setEvents(updated);
    saveEvents(updated);

    if (isTauriEnvironment()) {
      removeCalendarEvent(eventId).catch(() => {});
    }

    setActiveModalEvent(null);
  };

  const handleCreateNoteForEvent = (title: string, calendarEventId?: string): NoteItem => {
    const newNote: NoteItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      content: "",
      calendarEventId: calendarEventId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
    return newNote;
  };

  const handleNavigateToNote = (noteId: string) => {
    localStorage.setItem("focushud_active_note_id", noteId);
    broadcastNavChange("notes");
    setActiveModalEvent(null);
  };

  // Click on empty hour block to create new event
  const handleSlotClick = (dateISO: string, hour: number) => {
    const startH = String(hour).padStart(2, "0");
    const endH = String((hour + 1) % 24).padStart(2, "0");
    setActiveModalEvent({
      date: dateISO,
      startTime: `${startH}:00`,
      endTime: `${endH}:00`,
      title: "",
    });
  };

  // Click on existing event chip to edit
  const handleEventClick = (item: CalendarItemDisplay) => {
    if (item.isTask || !item.originalEvent) return;
    setActiveModalEvent(item.originalEvent);
  };

  // Navigation handlers
  const handleToday = () => setCurrentDate(new Date());
  const handlePrev = () => setCurrentDate((d) => navigateDate(d, mode, -1));
  const handleNext = () => setCurrentDate((d) => navigateDate(d, mode, 1));

  const activeModeOption = CALENDAR_MODES.find((m) => m.id === mode) || CALENDAR_MODES[1];
  const headerTitle = getCalendarHeaderTitle(mode, currentDate);
  const todayISO = getTodayString();

  // Current time marker calculation
  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const timeIndicatorTop = (currentMinutesFromMidnight / 60) * HOUR_HEIGHT;

  // Jump to specific day in Day view
  const jumpToDay = (date: Date) => {
    setCurrentDate(date);
    setMode("day");
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none">
      {/* ================= HEADER BAR ================= */}
      <div className="h-14 shrink-0 flex items-center justify-between px-3 border-b border-cyan-500/20 bg-[#050b14] z-20">
        {/* Left Navigation Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToday}
            data-testid="today-button"
            className="rounded-full px-3.5 py-1 text-xs font-medium border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/15 hover:border-cyan-400/50 transition cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              title="Previous"
              data-testid="prev-button"
              className="p-1 rounded-full text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              title="Next"
              data-testid="next-button"
              className="p-1 rounded-full text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h1
            data-testid="calendar-header-title"
            className="text-base font-orbitron font-medium text-cyan-100 tracking-wide select-text ml-1"
          >
            {headerTitle}
          </h1>
        </div>

        {/* Right Controls: Mode Dropdown + Independent Events/Tasks Toggles */}
        <div className="flex items-center gap-2 relative">
          {/* View Mode Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              data-testid="mode-dropdown-button"
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-cyan-500/30 text-cyan-200 bg-[#050b14] hover:bg-cyan-500/15 hover:border-cyan-400/50 transition cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.05)]"
            >
              <span>{activeModeOption.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70" />
            </button>

            {isDropdownOpen && (
              <div
                data-testid="mode-dropdown-menu"
                className="absolute right-0 mt-1.5 w-44 rounded-lg bg-[#071322] border border-cyan-500/30 shadow-[0_8px_24px_rgba(0,0,0,0.7)] backdrop-blur py-1 z-50 text-xs font-tech"
              >
                {CALENDAR_MODES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setMode(opt.id);
                      setIsDropdownOpen(false);
                    }}
                    data-testid={`mode-option-${opt.id}`}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition cursor-pointer ${
                      mode === opt.id
                        ? "bg-cyan-500/25 text-cyan-100 font-semibold border-l-2 border-cyan-400"
                        : "text-cyan-300/80 hover:bg-cyan-500/15 hover:text-cyan-100"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-mono text-cyan-400/60 uppercase">
                      {opt.shortcutKey}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Independent Events & Tasks Toggle Buttons */}
          <div data-testid="data-type-toggle" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowEvents((v) => !v)}
              title={showEvents ? "Hide Events" : "Show Events"}
              data-testid="toggle-events-button"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-tech border transition cursor-pointer ${
                showEvents
                  ? "bg-cyan-600/30 text-cyan-100 border-cyan-400/50 shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                  : "bg-[#050b14] text-cyan-500/40 border-cyan-500/20 hover:text-cyan-400/70"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Events</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTasks((v) => !v)}
              title={showTasks ? "Hide Tasks" : "Show Tasks"}
              data-testid="toggle-tasks-button"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-tech border transition cursor-pointer ${
                showTasks
                  ? "bg-cyan-600/30 text-cyan-100 border-cyan-400/50 shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                  : "bg-[#050b14] text-cyan-500/40 border-cyan-500/20 hover:text-cyan-400/70"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tasks</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= VIEW BODY ================= */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {mode === "day" && (
          <DayView
            date={currentDate}
            items={displayItems}
            hourHeight={HOUR_HEIGHT}
            scrollRef={timetableScrollRef}
            timeIndicatorTop={timeIndicatorTop}
            todayISO={todayISO}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}

        {mode === "week" && (
          <WeekView
            date={currentDate}
            items={displayItems}
            hourHeight={HOUR_HEIGHT}
            scrollRef={timetableScrollRef}
            timeIndicatorTop={timeIndicatorTop}
            todayISO={todayISO}
            onSelectDay={jumpToDay}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}

        {mode === "4days" && (
          <FourDaysView
            date={currentDate}
            items={displayItems}
            hourHeight={HOUR_HEIGHT}
            scrollRef={timetableScrollRef}
            timeIndicatorTop={timeIndicatorTop}
            todayISO={todayISO}
            onSelectDay={jumpToDay}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}

        {mode === "month" && (
          <MonthView
            date={currentDate}
            items={displayItems}
            todayISO={todayISO}
            onSelectDay={jumpToDay}
            onEventClick={handleEventClick}
          />
        )}

        {mode === "year" && (
          <YearView
            date={currentDate}
            items={displayItems}
            todayISO={todayISO}
            onSelectDay={jumpToDay}
          />
        )}

        {mode === "schedule" && (
          <ScheduleView
            date={currentDate}
            items={displayItems}
            todayISO={todayISO}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Quick-Add / Edit Modal */}
      {activeModalEvent && (
        <EventEditModal
          initialEvent={activeModalEvent}
          availableNotes={notes}
          onSave={handleSaveEvent}
          onDelete={activeModalEvent.id ? handleDeleteEvent : undefined}
          onClose={() => setActiveModalEvent(null)}
          onCreateNote={handleCreateNoteForEvent}
          onNavigateToNote={handleNavigateToNote}
        />
      )}
    </div>
  );
};

// =========================================================================
// 1. DAY VIEW
// =========================================================================
interface DayViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  hourHeight: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  timeIndicatorTop: number;
  todayISO: string;
  onSlotClick: (dateISO: string, hour: number) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

const DayView: React.FC<DayViewProps> = ({
  date,
  items,
  hourHeight,
  scrollRef,
  timeIndicatorTop,
  todayISO,
  onSlotClick,
  onEventClick,
}) => {
  const dateISO = formatDateISO(date);
  const isToday = dateISO === todayISO;
  const dayItems = items.filter((item) => item.date === dateISO);

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* Day header banner */}
      <div className="h-10 shrink-0 flex items-center px-4 border-b border-cyan-500/20 bg-[#050b14]/60 text-xs font-tech">
        <span className="text-cyan-500/70 uppercase">
          {DAYS_OF_WEEK_SHORT[(date.getDay() + 6) % 7]}
        </span>
        <span
          className={`ml-2 text-sm font-bold ${
            isToday ? "text-amber-300 font-orbitron" : "text-cyan-200"
          }`}
        >
          {date.getDate()}
        </span>
      </div>

      {/* 24-hour Timetable (12H labels) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="relative min-w-[320px]" style={{ height: HOURS.length * hourHeight }}>
          {/* Current time line */}
          {isToday && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none flex items-center"
              style={{ top: timeIndicatorTop }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ff5252] -ml-1" />
              <div className="flex-1 h-[2px] bg-red-400 shadow-[0_0_6px_#ff5252]" />
            </div>
          )}

          {/* Hourly Slots */}
          {HOURS.map((hour) => {
            const time12Label = formatHour12(hour);
            const slotItems = dayItems.filter((it) => {
              const startH = it.startTime ? parseInt(it.startTime.split(":")[0], 10) : 9;
              return startH === hour;
            });

            return (
              <div
                key={hour}
                onClick={() => onSlotClick(dateISO, hour)}
                data-testid={`day-slot-${hour}`}
                className="flex border-b border-cyan-500/10 hover:bg-cyan-500/5 transition cursor-pointer group"
                style={{ height: hourHeight }}
              >
                <div className="w-16 shrink-0 text-[10px] text-cyan-500/60 font-mono text-center pt-1 select-none">
                  {time12Label}
                </div>
                <div className="flex-1 border-l border-cyan-500/15 p-1 relative flex flex-col gap-1">
                  {slotItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(item);
                      }}
                      data-testid={`event-item-${item.id}`}
                      style={{ borderLeftColor: item.color || "#00e5ff" }}
                      className="px-2 py-1 rounded bg-[#071322] border-l-2 text-xs font-tech text-cyan-100 flex items-center justify-between shadow-[0_0_8px_rgba(0,229,255,0.15)] hover:bg-cyan-900/40 transition truncate"
                    >
                      <span className="truncate">{item.title}</span>
                      {item.startTime && (
                        <span className="text-[10px] font-mono text-cyan-400/60 ml-2 shrink-0">
                          {formatTime12(item.startTime)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. WEEK VIEW
// =========================================================================
interface WeekViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  hourHeight: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  timeIndicatorTop: number;
  todayISO: string;
  onSelectDay: (d: Date) => void;
  onSlotClick: (dateISO: string, hour: number) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

const WeekView: React.FC<WeekViewProps> = ({
  date,
  items,
  hourHeight,
  scrollRef,
  timeIndicatorTop,
  todayISO,
  onSelectDay,
  onSlotClick,
  onEventClick,
}) => {
  const monday = getMondayOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatDateISO(d);
    return {
      date: d,
      iso,
      dayName: DAYS_OF_WEEK_SHORT[i],
      dateNum: d.getDate(),
      isToday: iso === todayISO,
    };
  });

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* 7-Day Header */}
      <div className="h-12 shrink-0 flex border-b border-cyan-500/20 bg-[#050b14]/70">
        <div className="w-16 shrink-0" />
        {weekDays.map((wd) => (
          <button
            key={wd.iso}
            onClick={() => onSelectDay(wd.date)}
            className={`flex-1 flex flex-col items-center justify-center border-l border-cyan-500/15 transition cursor-pointer hover:bg-cyan-500/10 ${
              wd.isToday ? "bg-amber-950/20" : ""
            }`}
          >
            <span className="text-[9px] font-tech text-cyan-500/60 uppercase">{wd.dayName}</span>
            <span
              className={`text-xs font-semibold ${
                wd.isToday
                  ? "w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold shadow-[0_0_8px_#ffb300]"
                  : "text-cyan-200"
              }`}
            >
              {wd.dateNum}
            </span>
          </button>
        ))}
      </div>

      {/* Timetable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto relative">
        <div className="relative min-w-[560px]" style={{ height: HOURS.length * hourHeight }}>
          {/* Current time line across today */}
          {weekDays.some((w) => w.isToday) && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none flex items-center"
              style={{ top: timeIndicatorTop }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ff5252] -ml-1" />
              <div className="flex-1 h-[2px] bg-red-400 shadow-[0_0_6px_#ff5252]" />
            </div>
          )}

          {HOURS.map((hour) => {
            const time12Label = formatHour12(hour);

            return (
              <div
                key={hour}
                className="flex border-b border-cyan-500/10 hover:bg-cyan-500/5 transition"
                style={{ height: hourHeight }}
              >
                <div className="w-16 shrink-0 text-[10px] text-cyan-500/60 font-mono text-center pt-1 select-none">
                  {time12Label}
                </div>
                {weekDays.map((wd) => {
                  const cellItems = items.filter((it) => {
                    if (it.date !== wd.iso) return false;
                    const startH = it.startTime ? parseInt(it.startTime.split(":")[0], 10) : 9;
                    return startH === hour;
                  });

                  return (
                    <div
                      key={wd.iso}
                      onClick={() => onSlotClick(wd.iso, hour)}
                      data-testid={`week-slot-${wd.iso}-${hour}`}
                      className="flex-1 border-l border-cyan-500/15 p-0.5 relative flex flex-col gap-1 overflow-hidden cursor-pointer hover:bg-cyan-500/10 transition"
                    >
                      {cellItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(item);
                          }}
                          data-testid={`event-item-${item.id}`}
                          style={{ borderLeftColor: item.color || "#00e5ff" }}
                          className="px-1 py-0.5 rounded bg-[#071322] border-l-2 text-[10px] font-tech text-cyan-100 truncate shadow-[0_0_6px_rgba(0,229,255,0.15)] hover:bg-cyan-900/40 transition cursor-pointer"
                        >
                          {item.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. 4 DAYS VIEW
// =========================================================================
interface FourDaysViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  hourHeight: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  timeIndicatorTop: number;
  todayISO: string;
  onSelectDay: (d: Date) => void;
  onSlotClick: (dateISO: string, hour: number) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

const FourDaysView: React.FC<FourDaysViewProps> = ({
  date,
  items,
  hourHeight,
  scrollRef,
  timeIndicatorTop,
  todayISO,
  onSelectDay,
  onSlotClick,
  onEventClick,
}) => {
  const fourDays = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(date);
    d.setDate(date.getDate() + i);
    const iso = formatDateISO(d);
    return {
      date: d,
      iso,
      dayName: DAYS_OF_WEEK_SHORT[(d.getDay() + 6) % 7],
      dateNum: d.getDate(),
      isToday: iso === todayISO,
    };
  });

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* 4 Days Header */}
      <div className="h-12 shrink-0 flex border-b border-cyan-500/20 bg-[#050b14]/70">
        <div className="w-16 shrink-0" />
        {fourDays.map((fd) => (
          <button
            key={fd.iso}
            onClick={() => onSelectDay(fd.date)}
            className={`flex-1 flex flex-col items-center justify-center border-l border-cyan-500/15 transition cursor-pointer hover:bg-cyan-500/10 ${
              fd.isToday ? "bg-amber-950/20" : ""
            }`}
          >
            <span className="text-[9px] font-tech text-cyan-500/60 uppercase">{fd.dayName}</span>
            <span
              className={`text-xs font-semibold ${
                fd.isToday
                  ? "w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold shadow-[0_0_8px_#ffb300]"
                  : "text-cyan-200"
              }`}
            >
              {fd.dateNum}
            </span>
          </button>
        ))}
      </div>

      {/* Timetable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto relative">
        <div className="relative min-w-[440px]" style={{ height: HOURS.length * hourHeight }}>
          {fourDays.some((w) => w.isToday) && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none flex items-center"
              style={{ top: timeIndicatorTop }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ff5252] -ml-1" />
              <div className="flex-1 h-[2px] bg-red-400 shadow-[0_0_6px_#ff5252]" />
            </div>
          )}

          {HOURS.map((hour) => {
            const time12Label = formatHour12(hour);

            return (
              <div
                key={hour}
                className="flex border-b border-cyan-500/10 hover:bg-cyan-500/5 transition"
                style={{ height: hourHeight }}
              >
                <div className="w-16 shrink-0 text-[10px] text-cyan-500/60 font-mono text-center pt-1 select-none">
                  {time12Label}
                </div>
                {fourDays.map((fd) => {
                  const cellItems = items.filter((it) => {
                    if (it.date !== fd.iso) return false;
                    const startH = it.startTime ? parseInt(it.startTime.split(":")[0], 10) : 9;
                    return startH === hour;
                  });

                  return (
                    <div
                      key={fd.iso}
                      onClick={() => onSlotClick(fd.iso, hour)}
                      data-testid={`fourdays-slot-${fd.iso}-${hour}`}
                      className="flex-1 border-l border-cyan-500/15 p-1 relative flex flex-col gap-1 overflow-hidden cursor-pointer hover:bg-cyan-500/10 transition"
                    >
                      {cellItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(item);
                          }}
                          data-testid={`event-item-${item.id}`}
                          style={{ borderLeftColor: item.color || "#00e5ff" }}
                          className="px-1.5 py-0.5 rounded bg-[#071322] border-l-2 text-xs font-tech text-cyan-100 truncate shadow-[0_0_6px_rgba(0,229,255,0.15)] hover:bg-cyan-900/40 transition cursor-pointer"
                        >
                          {item.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 4. MONTH VIEW
// =========================================================================
interface MonthViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onSelectDay: (d: Date) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  date,
  items,
  todayISO,
  onSelectDay,
  onEventClick,
}) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const prevMonthDays = new Date(year, month, 0).getDate();
  const leadingDays = Array.from({ length: startDayOfWeek }, (_, i) => {
    const dayNum = prevMonthDays - startDayOfWeek + i + 1;
    const d = new Date(year, month - 1, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: false };
  });

  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => {
    const dayNum = i + 1;
    const d = new Date(year, month, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: true };
  });

  const totalCellsSoFar = leadingDays.length + currentMonthDays.length;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const trailingDays = Array.from({ length: targetTotal - totalCellsSoFar }, (_, i) => {
    const dayNum = i + 1;
    const d = new Date(year, month + 1, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: false };
  });

  const allMonthCells = [...leadingDays, ...currentMonthDays, ...trailingDays];

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* Day header row */}
      <div className="grid grid-cols-7 border-b border-cyan-500/20 bg-[#050b14]/70 text-center py-1.5 text-[10px] font-tech text-cyan-500/70">
        {DAYS_OF_WEEK_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Month 7x5 or 7x6 Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 border-b border-cyan-500/15">
        {allMonthCells.map((cell) => {
          const isToday = cell.iso === todayISO;
          const dayItems = items.filter((it) => it.date === cell.iso);
          const visibleItems = dayItems.slice(0, 2);
          const moreCount = dayItems.length - visibleItems.length;

          return (
            <div
              key={cell.iso}
              onClick={() => onSelectDay(cell.date)}
              className={`border-r border-b border-cyan-500/10 p-1 flex flex-col justify-start transition cursor-pointer hover:bg-cyan-500/10 ${
                cell.isCurrentMonth ? "bg-[#03070d]" : "bg-[#020509]/80 opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-tech rounded-full px-1.5 py-0.5 ${
                    isToday
                      ? "bg-amber-400 text-black font-bold shadow-[0_0_8px_#ffb300]"
                      : "text-cyan-300/80"
                  }`}
                >
                  {cell.dayNum}
                </span>
                {dayItems.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_4px_#00e5ff]" />
                )}
              </div>

              <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                {visibleItems.map((it) => (
                  <div
                    key={it.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(it);
                    }}
                    style={{ borderLeftColor: it.color || "#00e5ff" }}
                    className="px-1 py-0.5 rounded bg-[#071322] border-l-2 text-[9px] font-tech text-cyan-100 truncate cursor-pointer hover:bg-cyan-900/40"
                  >
                    {it.title}
                  </div>
                ))}
                {moreCount > 0 && (
                  <span className="text-[8.5px] font-mono text-cyan-400/60 pl-1">
                    +{moreCount} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =========================================================================
// 5. YEAR VIEW
// =========================================================================
interface YearViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onSelectDay: (d: Date) => void;
}

const YearView: React.FC<YearViewProps> = ({ date, items, todayISO, onSelectDay }) => {
  const year = date.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="h-full w-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-[#03070d]">
      {months.map((m) => {
        const firstDay = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const startDayOfWeek = (firstDay.getDay() + 6) % 7;
        const monthName = firstDay.toLocaleString("en-US", { month: "short" });

        return (
          <div
            key={m}
            className="p-2.5 rounded-lg border border-cyan-500/20 bg-[#050b14] flex flex-col shadow-[0_0_12px_rgba(0,229,255,0.05)]"
          >
            <div className="text-xs font-orbitron font-bold text-cyan-200 mb-1.5 uppercase tracking-wider">
              {monthName}
            </div>

            <div className="grid grid-cols-7 text-center text-[8px] font-tech text-cyan-500/50 pb-1 border-b border-cyan-500/10">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-tech mt-1">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="p-0.5" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const d = new Date(year, m, dayNum);
                const iso = formatDateISO(d);
                const isToday = iso === todayISO;
                const hasItems = items.some((it) => it.date === iso);

                return (
                  <button
                    key={iso}
                    onClick={() => onSelectDay(d)}
                    className={`p-0.5 rounded flex flex-col items-center justify-center transition cursor-pointer hover:bg-cyan-500/20 ${
                      isToday
                        ? "bg-amber-400 text-black font-bold"
                        : hasItems
                        ? "text-cyan-100 font-medium"
                        : "text-cyan-400/60"
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasItems && !isToday && (
                      <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5 shadow-[0_0_3px_#00e5ff]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =========================================================================
// 6. SCHEDULE VIEW
// =========================================================================
interface ScheduleViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onEventClick: (item: CalendarItemDisplay) => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ date, items, todayISO, onEventClick }) => {
  const monday = getMondayOfWeek(date);
  const daysFeed = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatDateISO(d);
    return {
      date: d,
      iso,
      dayName: DAYS_OF_WEEK_SHORT[(d.getDay() + 6) % 7],
      fullDateLabel: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      isToday: iso === todayISO,
      items: items.filter((it) => it.date === iso),
    };
  });

  const activeDays = daysFeed.filter((d) => d.items.length > 0 || d.isToday);

  return (
    <div className="h-full w-full overflow-y-auto p-4 bg-[#03070d]">
      {activeDays.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-cyan-500/50 font-tech">
          <CalendarIcon className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
          <p className="text-sm">No scheduled events or tasks in this period</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {activeDays.map((d) => (
            <div
              key={d.iso}
              className={`p-3 rounded-lg border transition ${
                d.isToday
                  ? "border-amber-400/40 bg-amber-950/10 shadow-[0_0_12px_rgba(255,179,0,0.1)]"
                  : "border-cyan-500/20 bg-[#050b14]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-cyan-500/15">
                <span
                  className={`text-xs font-orbitron font-bold tracking-wider ${
                    d.isToday ? "text-amber-300" : "text-cyan-200"
                  }`}
                >
                  {d.fullDateLabel}
                </span>
                {d.isToday && (
                  <span className="text-[9px] font-tech uppercase px-1.5 py-0.2 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200">
                    TODAY
                  </span>
                )}
              </div>

              {d.items.length === 0 ? (
                <p className="text-[11px] font-tech text-cyan-500/40 italic">
                  No scheduled items for this date
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {d.items.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => onEventClick(it)}
                      style={{ borderLeftColor: it.color || "#00e5ff" }}
                      className="px-2.5 py-1.5 rounded bg-[#071322] border-l-2 flex items-center justify-between text-xs font-tech text-cyan-100 shadow-[0_0_6px_rgba(0,229,255,0.1)] hover:bg-cyan-900/30 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {it.isTask && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              it.completed ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                        )}
                        <span className="truncate">{it.title}</span>
                      </div>
                      {it.startTime && (
                        <span className="text-[10px] font-mono text-cyan-400/60 ml-3 shrink-0">
                          {formatTime12(it.startTime)}
                          {it.endTime ? ` - ${formatTime12(it.endTime)}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
