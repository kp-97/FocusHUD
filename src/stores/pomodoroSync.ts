import type { PomodoroState } from "./pomodoroStore";

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

const POMODORO_CHANNEL_NAME = "focushud_pomodoro_channel";
export const pomodoroChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(POMODORO_CHANNEL_NAME)
    : null;

export const WINDOW_ID =
  typeof window !== "undefined"
    ? `win_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    : "win_node";

export const postPomodoroSync = (
  type: PomodoroSyncActionType,
  state: PomodoroState
): void => {
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

export const setupPomodoroSyncListeners = (
  handleSync: (payload: PomodoroSyncPayload) => void,
  getState: () => PomodoroState
): void => {
  if (pomodoroChannel) {
    pomodoroChannel.addEventListener("message", (e: MessageEvent) => {
      if (e.data && e.data.type) {
        handleSync(e.data as PomodoroSyncPayload);
      }
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === "focushud_last_pomodoro_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.type) {
            handleSync(parsed as PomodoroSyncPayload);
          }
        } catch {}
      }
    });

    try {
      if (pomodoroChannel) {
        pomodoroChannel.postMessage({
          type: "REQUEST_SYNC",
          state: { ...getState() },
          senderId: WINDOW_ID,
          timestamp: Date.now(),
        });
      }
    } catch {}
  }
};

