import { useState, useEffect, useRef } from "react";
import {
  CalendarMode,
  CALENDAR_MODES,
  navigateDate,
} from "../../../utils/calendarFormatters";
import { HOUR_HEIGHT } from "./constants";

export interface UseCalendarNavigationOptions {
  isModalOpen?: boolean;
}

export function useCalendarNavigation(options: UseCalendarNavigationOptions = {}) {
  const { isModalOpen = false } = options;

  const [mode, setMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem("focushud_calendar_mode");
    return (saved as CalendarMode) || "week";
  });

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const timetableScrollRef = useRef<HTMLDivElement>(null);

  // Persist mode to local storage
  useEffect(() => {
    localStorage.setItem("focushud_calendar_mode", mode);
  }, [mode]);

  // Keyboard Shortcuts: Alt + D, W, M, Y, A, X & standard single keys (T, J/N, K/P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return; // Do not intercept shortcuts when modal is open

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
  }, [mode, isModalOpen]);

  // Auto-scroll timetable to morning / current hour on initial load or mode switch
  useEffect(() => {
    if ((mode === "day" || mode === "week" || mode === "4days") && timetableScrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollHour = Math.max(0, currentHour >= 8 ? currentHour - 2 : 7);
      timetableScrollRef.current.scrollTop = scrollHour * HOUR_HEIGHT;
    }
  }, [mode]);

  const handleToday = () => setCurrentDate(new Date());
  const handlePrev = () => setCurrentDate((d) => navigateDate(d, mode, -1));
  const handleNext = () => setCurrentDate((d) => navigateDate(d, mode, 1));

  const jumpToDay = (date: Date) => {
    setCurrentDate(date);
    setMode("day");
  };

  return {
    mode,
    setMode,
    currentDate,
    setCurrentDate,
    timetableScrollRef,
    handleToday,
    handlePrev,
    handleNext,
    jumpToDay,
  };
}

