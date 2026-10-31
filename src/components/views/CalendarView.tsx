import React, { useState, useEffect } from "react";
import {
  saveEvents,
  saveNotes,
  getTodayString,
  broadcastNavChange,
} from "../../stores/layoutStore";
import { CalendarEvent, NoteItem } from "../../types/hud";
import { getCalendarHeaderTitle } from "../../utils/calendarFormatters";
import { EventEditModal } from "./CalendarView/EventEditModal";
import {
  saveCalendarEvent as persistCalendarEvent,
  deleteCalendarEvent as removeCalendarEvent,
  persistNote,
  isTauriEnvironment,
} from "../../services/dbService";
import { useSyncCalendarEvents, useSyncTasks, useSyncNotes } from "../../hooks/useSyncEntity";
import {
  appEventsToDb,
  appNotesToDb,
} from "../../services/dbAdapters";
import { CalendarItemDisplay } from "./CalendarView/types";
import { HOUR_HEIGHT } from "./CalendarView/constants";
import { useCalendarNavigation } from "./CalendarView/useCalendarNavigation";
import { useCalendarDisplayItems } from "./CalendarView/useCalendarDisplayItems";
import { CalendarHeader } from "./CalendarView/CalendarHeader";
import {
  DayView,
  WeekView,
  FourDaysView,
  MonthView,
  YearView,
  ScheduleView,
} from "./CalendarView/views";

export type { CalendarItemDisplay };

export const CalendarView: React.FC = () => {
  const [events, , setEvents] = useSyncCalendarEvents();
  const [tasks] = useSyncTasks();
  const [notes, , setNotes] = useSyncNotes();

  // Modal State for Create / Edit
  const [activeModalEvent, setActiveModalEvent] = useState<Partial<CalendarEvent> | null>(null);

  // Dedicated calendar navigation hook (shortcuts, date navigation, auto-scroll)
  const {
    mode,
    setMode,
    currentDate,
    timetableScrollRef,
    handleToday,
    handlePrev,
    handleNext,
    jumpToDay,
  } = useCalendarNavigation({ isModalOpen: !!activeModalEvent });

  // Independent Events and Tasks toggle states
  const [showEvents, setShowEvents] = useState<boolean>(() => {
    const saved = localStorage.getItem("focushud_show_events");
    return saved !== null ? saved === "true" : true;
  });

  const [showTasks, setShowTasks] = useState<boolean>(() => {
    const saved = localStorage.getItem("focushud_show_tasks");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("focushud_show_events", String(showEvents));
  }, [showEvents]);

  useEffect(() => {
    localStorage.setItem("focushud_show_tasks", String(showTasks));
  }, [showTasks]);

  // Unified items mapped from both Events and Tasks independently
  const displayItems = useCalendarDisplayItems(events, tasks, showEvents, showTasks);

  // CRUD Operations
  const handleSaveEvent = (savedEvent: CalendarEvent, attachedNoteIds?: string[]) => {
    const exists = events.some((e) => e.id === savedEvent.id);
    const updated = exists
      ? events.map((e) => (e.id === savedEvent.id ? savedEvent : e))
      : [...events, savedEvent];

    setEvents(updated);
    saveEvents(updated);

    if (isTauriEnvironment()) {
      persistCalendarEvent(appEventsToDb([savedEvent])[0]).catch(() => { });
    }

    if (attachedNoteIds) {
      let notesChanged = false;
      const updatedNotes = notes.map((n) => {
        if (attachedNoteIds.includes(n.id) && n.calendarEventId !== savedEvent.id) {
          notesChanged = true;
          return { ...n, calendarEventId: savedEvent.id, updatedAt: Date.now() };
        } else if (!attachedNoteIds.includes(n.id) && n.calendarEventId === savedEvent.id) {
          notesChanged = true;
          return { ...n, calendarEventId: null, updatedAt: Date.now() };
        }
        return n;
      });

      if (notesChanged) {
        setNotes(updatedNotes);
        saveNotes(updatedNotes);
      }
    }

    setActiveModalEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    const updated = events.filter((e) => e.id !== eventId);
    setEvents(updated);
    saveEvents(updated);

    if (isTauriEnvironment()) {
      removeCalendarEvent(eventId).catch(() => { });
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
    if (isTauriEnvironment()) {
      persistNote(appNotesToDb([newNote])[0]).catch(() => {});
    }
    return newNote;
  };

  const handleNavigateToNote = (noteId: string) => {
    localStorage.setItem("focushud_active_note_id", noteId);
    broadcastNavChange("notes");
    setActiveModalEvent(null);
  };

  // Click on empty hour block or 15-minute increment to create new event
  const handleSlotClick = (dateISO: string, hour: number, minute: number = 0) => {
    const startH = String(hour).padStart(2, "0");
    const startM = String(minute).padStart(2, "0");
    const endMinutes = hour * 60 + minute + 60; // 1 hour duration
    const endH = String(Math.floor((endMinutes / 60) % 24)).padStart(2, "0");
    const endM = String(endMinutes % 60).padStart(2, "0");

    setActiveModalEvent({
      date: dateISO,
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
      title: "",
      recurrence: "none",
    });
  };

  // Click on existing event chip to edit
  const handleEventClick = (item: CalendarItemDisplay) => {
    if (item.isTask || !item.originalEvent) return;
    setActiveModalEvent(item.originalEvent);
  };

  const headerTitle = getCalendarHeaderTitle(mode, currentDate);
  const todayISO = getTodayString();

  // Current time marker calculation
  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const timeIndicatorTop = (currentMinutesFromMidnight / 60) * HOUR_HEIGHT;

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none">
      <CalendarHeader
        mode={mode}
        setMode={setMode}
        headerTitle={headerTitle}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        showEvents={showEvents}
        setShowEvents={setShowEvents}
        showTasks={showTasks}
        setShowTasks={setShowTasks}
      />

      {/* ================= VIEW BODY ================= */}
      <div className="flex-1 min-h-0 overflow-hidden relative z-10">
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
