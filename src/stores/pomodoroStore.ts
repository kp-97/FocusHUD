import { useState, useEffect } from "react";
import { playSessionCompleteSound } from "../services/audioService";

export type PomodoroMode = "focus" | "short_break" | "long_break";

export interface DailyStats {
  date: string;
  completedPomodoros: number;
  totalFocusMinutes: number;
  focusSecondsElapsed?: number;
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
        return {
          date: today,
          completedPomodoros: Number(parsed.completedPomodoros) || 0,
          totalFocusMinutes: Number(parsed.totalFocusMinutes) || 0,
          focusSecondsElapsed: Number(parsed.focusSecondsElapsed) || 0,
        };
      }
    } catch {
      // Fallback
    }
  }
  return { date: today, completedPomodoros: 0, totalFocusMinutes: 0, focusSecondsElapsed: 0 };
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
let isLocalTicker = false;

// Cross-window Pomodoro synchronization via BroadcastChannel
const POMODORO_CHANNEL_NAME = "focushud_pomodoro_channel";
const pomodoroChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(POMODORO_CHANNEL_NAME)
    : null;

const WINDOW_ID =
  typeof window !== "undefined"
    ? `win_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    : "win_node";

export type PomodoroSyncActionType =
  | "START"
  | "PAUSE"
  | "STOP"
  | "TICK"
  | "COMPLETE"
  | "SWITCH_MODE"
  | "RESET"
  | "SKIP_PHASE"
  | "ADJUST"
  | "SETTINGS_CHANGE"
  | "STATS_UPDATE"
  | "REQUEST_SYNC";

export interface PomodoroSyncPayload {
  type: PomodoroSyncActionType;
  state: PomodoroState;
  senderId: string;
  timestamp: number;
}

export const broadcastPomodoroSync = (type: PomodoroSyncActionType) => {
  const payload: PomodoroSyncPayload = {
    type,
    state: { ...state, dailyStats: { ...state.dailyStats } },
    senderId: WINDOW_ID,
    timestamp: Date.now(),
  };

  if (pomodoroChannel) {
    pomodoroChannel.postMessage(payload);
  }

  try {
    localStorage.setItem("focushud_last_pomodoro_sync", JSON.stringify(payload));
  } catch {
    // Ignore storage quota or disabled storage
  }
};

const handleIncomingSync = (payload: PomodoroSyncPayload) => {
  if (!payload || payload.senderId === WINDOW_ID) return;

  const { type, state: remoteState } = payload;

  switch (type) {
    case "START": {
      isLocalTicker = false;
      state = { ...remoteState, dailyStats: { ...remoteState.dailyStats } };
      updateTimerLoop();
      notify();
      break;
    }
    case "TICK": {
      state = { ...remoteState, dailyStats: { ...remoteState.dailyStats } };
      notify();
      break;
    }
    case "PAUSE":
    case "STOP":
    case "RESET":
    case "SWITCH_MODE":
    case "SKIP_PHASE":
    case "COMPLETE": {
      isLocalTicker = false;
      state = { ...remoteState, dailyStats: { ...remoteState.dailyStats } };
      updateTimerLoop();
      notify();
      break;
    }
    case "ADJUST":
    case "SETTINGS_CHANGE":
    case "STATS_UPDATE": {
      state = { ...remoteState, dailyStats: { ...remoteState.dailyStats } };
      notify();
      break;
    }
    case "REQUEST_SYNC": {
      if (isLocalTicker || state.isRunning) {
        broadcastPomodoroSync("TICK");
      }
      break;
    }
  }
};

if (pomodoroChannel) {
  pomodoroChannel.addEventListener("message", (e: MessageEvent) => {
    if (e.data && e.data.type) {
      handleIncomingSync(e.data as PomodoroSyncPayload);
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === "focushud_last_pomodoro_sync" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.type) {
          handleIncomingSync(parsed as PomodoroSyncPayload);
        }
      } catch {}
    }
  });

  try {
    if (pomodoroChannel) {
      pomodoroChannel.postMessage({
        type: "REQUEST_SYNC",
        state: { ...state },
        senderId: WINDOW_ID,
        timestamp: Date.now(),
      });
    }
  } catch {}
}

const notify = () => {
  listeners.forEach((l) => l({ ...state }));
};

const tick = () => {
  if (!state.isRunning) return;

  const today = getTodayDateString();
  let updatedDaily: DailyStats = { ...state.dailyStats };
  if (updatedDaily.date !== today) {
    updatedDaily = {
      date: today,
      completedPomodoros: 0,
      totalFocusMinutes: 0,
      focusSecondsElapsed: 0,
    };
  }

  // If in focus phase, track seconds elapsed and increment focus minutes every 60s
  if (state.mode === "focus") {
    const nextSeconds = (updatedDaily.focusSecondsElapsed || 0) + 1;
    if (nextSeconds >= 60) {
      updatedDaily = {
        ...updatedDaily,
        focusSecondsElapsed: nextSeconds - 60,
        totalFocusMinutes: updatedDaily.totalFocusMinutes + 1,
      };
      localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(updatedDaily));
    } else {
      updatedDaily = {
        ...updatedDaily,
        focusSecondsElapsed: nextSeconds,
      };
    }
  }

  if (state.timeLeft <= 1) {
    // Session completed
    handleCompleted(updatedDaily);
  } else {
    state = {
      ...state,
      timeLeft: state.timeLeft - 1,
      dailyStats: updatedDaily,
    };
    notify();
    broadcastPomodoroSync("TICK");
  }
};

const updateTimerLoop = () => {
  if (state.isRunning && isLocalTicker && !intervalId) {
    intervalId = setInterval(tick, 1000);
    if (intervalId && typeof (intervalId as unknown as { unref?: () => void }).unref === "function") {
      (intervalId as unknown as { unref: () => void }).unref();
    }
  } else if ((!state.isRunning || !isLocalTicker) && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const handleCompleted = (currentDaily?: DailyStats) => {
  playSessionCompleteSound();

  const today = getTodayDateString();
  const isFocus = state.mode === "focus";
  const baseDaily = currentDaily || state.dailyStats;
  const updatedDaily: DailyStats = {
    date: today,
    completedPomodoros: (baseDaily.date === today ? baseDaily.completedPomodoros : 0) + (isFocus ? 1 : 0),
    totalFocusMinutes: baseDaily.date === today ? baseDaily.totalFocusMinutes : 0,
    focusSecondsElapsed: baseDaily.date === today ? (baseDaily.focusSecondsElapsed || 0) : 0,
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

  isLocalTicker = false;
  updateTimerLoop();
  notify();
  broadcastPomodoroSync("COMPLETE");
};

export const getPomodoroState = (): PomodoroState => ({ ...state });

export const subscribePomodoro = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const _getIsLocalTicker = () => isLocalTicker;
export const _setIsLocalTicker = (val: boolean) => {
  isLocalTicker = val;
};
export const _handleIncomingSyncForTesting = handleIncomingSync;

export const pomodoroActions = {
  toggleRun: () => {
    const nextRunning = !state.isRunning;
    isLocalTicker = nextRunning;
    state = { ...state, isRunning: nextRunning };
    updateTimerLoop();
    notify();
    broadcastPomodoroSync(nextRunning ? "START" : "PAUSE");
  },

  start: () => {
    if (!state.isRunning) {
      isLocalTicker = true;
      state = { ...state, isRunning: true };
      updateTimerLoop();
      notify();
      broadcastPomodoroSync("START");
    }
  },

  pause: () => {
    if (state.isRunning) {
      isLocalTicker = false;
      state = { ...state, isRunning: false };
      localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(state.dailyStats));
      updateTimerLoop();
      notify();
      broadcastPomodoroSync("PAUSE");
    }
  },

  stop: () => {
    isLocalTicker = false;
    // Cancels the active timer: stops running and resets countdown back to initial duration for current mode
    let mins = state.focusMinutes;
    if (state.mode === "short_break") mins = state.shortBreakMinutes;
    if (state.mode === "long_break") mins = state.longBreakMinutes;

    state = {
      ...state,
      isRunning: false,
      totalSeconds: mins * 60,
      timeLeft: mins * 60,
    };

    localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(state.dailyStats));
    updateTimerLoop();
    notify();
    broadcastPomodoroSync("STOP");
  },

  cancel: () => {
    pomodoroActions.stop();
  },

  skipPhase: () => {
    isLocalTicker = false;
    const isFocus = state.mode === "focus";
    let nextMode: PomodoroMode = "focus";
    let nextCycle = state.cycle;
    let nextMins = state.focusMinutes;

    if (isFocus) {
      if (state.cycle >= state.totalCycles) {
        nextMode = "long_break";
        nextCycle = 1;
        nextMins = state.longBreakMinutes;
      } else {
        nextMode = "short_break";
        nextCycle = state.cycle + 1;
        nextMins = state.shortBreakMinutes;
      }
    } else {
      nextMode = "focus";
      nextMins = state.focusMinutes;
    }

    state = {
      ...state,
      mode: nextMode,
      cycle: nextCycle,
      totalSeconds: nextMins * 60,
      timeLeft: nextMins * 60,
      isRunning: false,
    };

    localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(state.dailyStats));
    updateTimerLoop();
    notify();
    broadcastPomodoroSync("SKIP_PHASE");
  },

  reset: () => {
    isLocalTicker = false;
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
    broadcastPomodoroSync("RESET");
  },

  setCycle: (cycle: number) => {
    state = {
      ...state,
      cycle: Math.max(1, Math.min(state.totalCycles, cycle)),
    };
    notify();
    broadcastPomodoroSync("SETTINGS_CHANGE");
  },

  resetDailyStats: () => {
    const today = getTodayDateString();
    const fresh: DailyStats = {
      date: today,
      completedPomodoros: 0,
      totalFocusMinutes: 0,
      focusSecondsElapsed: 0,
    };
    localStorage.removeItem("focushud_pomodoro_daily");
    localStorage.removeItem("focusdock_pomodoro_daily");
    state = { ...state, dailyStats: fresh };
    notify();
    broadcastPomodoroSync("STATS_UPDATE");
  },

  setDailyStats: (stats: Partial<DailyStats>) => {
    state = { ...state, dailyStats: { ...state.dailyStats, ...stats } };
    localStorage.setItem("focushud_pomodoro_daily", JSON.stringify(state.dailyStats));
    notify();
    broadcastPomodoroSync("STATS_UPDATE");
  },

  reloadDailyStats: () => {
    state = { ...state, dailyStats: loadInitialDailyStats() };
    notify();
    broadcastPomodoroSync("STATS_UPDATE");
  },

  switchMode: (newMode: PomodoroMode) => {
    isLocalTicker = false;
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
    broadcastPomodoroSync("SWITCH_MODE");
  },

  adjustMinutes: (delta: number) => {
    // If delta is negative (decrement) and timeLeft is less than 1 minute (60s), do nothing
    if (delta < 0 && state.timeLeft < 60) {
      return;
    }

    const deltaSeconds = delta * 60;
    const newTimeLeft = Math.max(0, Math.min(3600 * 2, state.timeLeft + deltaSeconds));
    const newTotal = Math.max(newTimeLeft, state.totalSeconds + deltaSeconds);

    let newFocusMinutes = state.focusMinutes;
    let newShortBreak = state.shortBreakMinutes;
    let newLongBreak = state.longBreakMinutes;

    if (!state.isRunning && state.timeLeft === state.totalSeconds) {
      const mins = Math.max(1, Math.round(newTimeLeft / 60));
      if (state.mode === "focus") {
        newFocusMinutes = mins;
        localStorage.setItem("focushud_pomodoro_focus_min", String(mins));
      } else if (state.mode === "short_break") {
        newShortBreak = mins;
        localStorage.setItem("focushud_pomodoro_short_min", String(mins));
      } else if (state.mode === "long_break") {
        newLongBreak = mins;
        localStorage.setItem("focushud_pomodoro_long_min", String(mins));
      }
    }

    state = {
      ...state,
      totalSeconds: newTotal,
      timeLeft: newTimeLeft,
      focusMinutes: newFocusMinutes,
      shortBreakMinutes: newShortBreak,
      longBreakMinutes: newLongBreak,
    };
    notify();
    broadcastPomodoroSync("ADJUST");
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
    broadcastPomodoroSync("SETTINGS_CHANGE");
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
    broadcastPomodoroSync("SETTINGS_CHANGE");
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
    broadcastPomodoroSync("SETTINGS_CHANGE");
  },

  setTotalCycles: (cycles: number) => {
    localStorage.setItem("focushud_pomodoro_total_cycles", String(cycles));
    state = {
      ...state,
      totalCycles: cycles,
      cycle: state.cycle > cycles ? 1 : state.cycle,
    };
    notify();
    broadcastPomodoroSync("SETTINGS_CHANGE");
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
