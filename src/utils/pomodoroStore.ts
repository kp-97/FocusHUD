import { useState, useEffect } from "react";

export type PomodoroMode = "focus" | "short_break" | "long_break";

export interface DailyStats {
  date: string;
  completedPomodoros: number;
  totalFocusMinutes: number;
}

export interface PomodoroState {
  mode: PomodoroMode;
  cycle: number;
  totalCycles: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  totalSeconds: number;
  timeLeft: number;
  isRunning: boolean;
  dailyStats: DailyStats;
}

const getTodayDateString = (): string => {
  return new Date().toISOString().split("T")[0];
};

const getStoredNumber = (key: string, fallbackKey: string, defaultValue: number): number => {
  const val = localStorage.getItem(key) || localStorage.getItem(fallbackKey);
  return val ? parseInt(val, 10) : defaultValue;
};

const loadInitialDailyStats = (): DailyStats => {
  const today = getTodayDateString();
  const raw = localStorage.getItem("focushud_pomodoro_daily") || localStorage.getItem("focusdock_pomodoro_daily");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DailyStats;
      if (parsed.date === today) {
        return parsed;
      }
    } catch {
      // Fallback
    }
  }
  return { date: today, completedPomodoros: 0, totalFocusMinutes: 0 };
};

const initialFocusMinutes = getStoredNumber("focushud_pomodoro_focus_min", "focusdock_pomodoro_focus_min", 25);
const initialShortBreak = getStoredNumber("focushud_pomodoro_short_min", "focusdock_pomodoro_short_min", 5);
const initialLongBreak = getStoredNumber("focushud_pomodoro_long_min", "focusdock_pomodoro_long_min", 15);
const initialTotalCycles = getStoredNumber("focushud_pomodoro_total_cycles", "focusdock_pomodoro_total_cycles", 4);

let state: PomodoroState = {
  mode: "focus",
  cycle: 1,
  totalCycles: initialTotalCycles,
  focusMinutes: initialFocusMinutes,
  shortBreakMinutes: initialShortBreak,
  longBreakMinutes: initialLongBreak,
  totalSeconds: initialFocusMinutes * 60,
  timeLeft: initialFocusMinutes * 60,
  isRunning: false,
  dailyStats: loadInitialDailyStats(),
};

type Listener = (state: PomodoroState) => void;
const listeners = new Set<Listener>();

let intervalId: ReturnType<typeof setInterval> | null = null;

const notify = () => {
  listeners.forEach((l) => l({ ...state }));
};

const tick = () => {
  if (!state.isRunning) return;

  if (state.timeLeft <= 1) {
    // Session completed
    handleCompleted();
  } else {
    state = { ...state, timeLeft: state.timeLeft - 1 };
    notify();
  }
};

const updateTimerLoop = () => {
  if (state.isRunning && !intervalId) {
    intervalId = setInterval(tick, 1000);
    if (intervalId && typeof (intervalId as any).unref === "function") {
      (intervalId as any).unref();
    }
  } else if (!state.isRunning && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const handleCompleted = () => {
  const today = getTodayDateString();
  const isFocus = state.mode === "focus";
  const updatedDaily: DailyStats = {
    date: today,
    completedPomodoros: (state.dailyStats.date === today ? state.dailyStats.completedPomodoros : 0) + (isFocus ? 1 : 0),
    totalFocusMinutes: (state.dailyStats.date === today ? state.dailyStats.totalFocusMinutes : 0) + (isFocus ? state.focusMinutes : 0),
  };
  localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(updatedDaily));

  if (isFocus) {
    if (state.cycle >= state.totalCycles) {
      state = {
        ...state,
        cycle: 1,
        mode: "long_break",
        totalSeconds: state.longBreakMinutes * 60,
        timeLeft: state.longBreakMinutes * 60,
        isRunning: false,
        dailyStats: updatedDaily,
      };
    } else {
      state = {
        ...state,
        cycle: state.cycle + 1,
        mode: "short_break",
        totalSeconds: state.shortBreakMinutes * 60,
        timeLeft: state.shortBreakMinutes * 60,
        isRunning: false,
        dailyStats: updatedDaily,
      };
    }
  } else {
    // Break finished -> back to focus
    state = {
      ...state,
      mode: "focus",
      totalSeconds: state.focusMinutes * 60,
      timeLeft: state.focusMinutes * 60,
      isRunning: false,
      dailyStats: updatedDaily,
    };
  }

  updateTimerLoop();
  notify();
};

export const getPomodoroState = (): PomodoroState => ({ ...state });

export const subscribePomodoro = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const pomodoroActions = {
  toggleRun: () => {
    state = { ...state, isRunning: !state.isRunning };
    updateTimerLoop();
    notify();
  },

  start: () => {
    if (!state.isRunning) {
      state = { ...state, isRunning: true };
      updateTimerLoop();
      notify();
    }
  },

  pause: () => {
    if (state.isRunning) {
      state = { ...state, isRunning: false };
      updateTimerLoop();
      notify();
    }
  },

  reset: () => {
    let mins = state.focusMinutes;
    if (state.mode === "short_break") mins = state.shortBreakMinutes;
    if (state.mode === "long_break") mins = state.longBreakMinutes;
    state = {
      ...state,
      isRunning: false,
      totalSeconds: mins * 60,
      timeLeft: mins * 60,
    };
    updateTimerLoop();
    notify();
  },

  switchMode: (newMode: PomodoroMode) => {
    let mins = state.focusMinutes;
    if (newMode === "short_break") mins = state.shortBreakMinutes;
    if (newMode === "long_break") mins = state.longBreakMinutes;
    state = {
      ...state,
      mode: newMode,
      isRunning: false,
      totalSeconds: mins * 60,
      timeLeft: mins * 60,
    };
    updateTimerLoop();
    notify();
  },

  adjustMinutes: (delta: number) => {
    const newTotal = Math.max(60, Math.min(3600 * 2, state.totalSeconds + delta * 60));
    let newFocusMinutes = state.focusMinutes;
    if (!state.isRunning && state.mode === "focus") {
      newFocusMinutes = Math.round(newTotal / 60);
      localStorage.setItem("focushud_pomodoro_focus_min", String(newFocusMinutes));
    }
    state = {
      ...state,
      totalSeconds: newTotal,
      timeLeft: newTotal,
      focusMinutes: newFocusMinutes,
    };
    notify();
  },

  setFocusMinutes: (mins: number) => {
    localStorage.setItem("focushud_pomodoro_focus_min", String(mins));
    state = {
      ...state,
      focusMinutes: mins,
      ...(state.mode === "focus" && !state.isRunning
        ? { totalSeconds: mins * 60, timeLeft: mins * 60 }
        : {}),
    };
    notify();
  },

  setShortBreakMinutes: (mins: number) => {
    localStorage.setItem("focushud_pomodoro_short_min", String(mins));
    state = {
      ...state,
      shortBreakMinutes: mins,
      ...(state.mode === "short_break" && !state.isRunning
        ? { totalSeconds: mins * 60, timeLeft: mins * 60 }
        : {}),
    };
    notify();
  },

  setLongBreakMinutes: (mins: number) => {
    localStorage.setItem("focushud_pomodoro_long_min", String(mins));
    state = {
      ...state,
      longBreakMinutes: mins,
      ...(state.mode === "long_break" && !state.isRunning
        ? { totalSeconds: mins * 60, timeLeft: mins * 60 }
        : {}),
    };
    notify();
  },

  setTotalCycles: (cycles: number) => {
    localStorage.setItem("focushud_pomodoro_total_cycles", String(cycles));
    state = {
      ...state,
      totalCycles: cycles,
      cycle: state.cycle > cycles ? 1 : state.cycle,
    };
    notify();
  },
};

export function usePomodoro() {
  const [current, setCurrent] = useState<PomodoroState>(getPomodoroState);

  useEffect(() => {
    return subscribePomodoro(setCurrent);
  }, []);

  return {
    ...current,
    ...pomodoroActions,
  };
}
