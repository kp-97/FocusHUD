import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPomodoroState,
  pomodoroActions,
  subscribePomodoro,
  _getIsLocalTicker,
  _handleIncomingSyncForTesting,
  PomodoroState,
} from "./pomodoroStore";

describe("pomodoroStore", () => {
  beforeEach(() => {
    localStorage.clear();
    pomodoroActions.pause();
    pomodoroActions.resetDailyStats();
    pomodoroActions.setCycle(1);
    pomodoroActions.switchMode("focus");
    pomodoroActions.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    pomodoroActions.pause();
    pomodoroActions.reset();
  });

  it("provides initial state with default focus minutes", () => {
    const state = getPomodoroState();
    expect(state.mode).toBe("focus");
    expect(state.totalSeconds).toBe(25 * 60);
    expect(state.timeLeft).toBe(25 * 60);
    expect(state.isRunning).toBe(false);
  });

  it("toggles running state", () => {
    expect(getPomodoroState().isRunning).toBe(false);
    pomodoroActions.toggleRun();
    expect(getPomodoroState().isRunning).toBe(true);
    pomodoroActions.toggleRun();
    expect(getPomodoroState().isRunning).toBe(false);
  });

  it("resets timer back to full duration", () => {
    pomodoroActions.start();
    pomodoroActions.adjustMinutes(-5);
    expect(getPomodoroState().timeLeft).toBe(20 * 60);
    pomodoroActions.reset();
    expect(getPomodoroState().isRunning).toBe(false);
    expect(getPomodoroState().timeLeft).toBe(25 * 60);
  });

  it("switches modes cleanly", () => {
    pomodoroActions.switchMode("short_break");
    const state = getPomodoroState();
    expect(state.mode).toBe("short_break");
    expect(state.timeLeft).toBe(state.shortBreakMinutes * 60);
    expect(state.isRunning).toBe(false);
  });

  it("notifies subscribers when actions change state", () => {
    const listener = vi.fn();
    const unsub = subscribePomodoro(listener);
    expect(listener).not.toHaveBeenCalled();

    pomodoroActions.toggleRun();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    pomodoroActions.toggleRun();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("stop / cancel action", () => {
    it("cancels active focus timer: stops running, stays in focus mode, and resets countdown back to full duration", () => {
      pomodoroActions.start();
      expect(getPomodoroState().isRunning).toBe(true);
      expect(getPomodoroState().mode).toBe("focus");

      // Advance/adjust time so some time has elapsed
      pomodoroActions.adjustMinutes(-5);
      expect(getPomodoroState().timeLeft).toBe(20 * 60);

      pomodoroActions.stop();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("focus");
      expect(state.cycle).toBe(1);
      expect(state.timeLeft).toBe(state.focusMinutes * 60);
    });

    it("cancels active break timer: stops running, stays in break mode, and resets countdown back to full break duration", () => {
      pomodoroActions.switchMode("short_break");
      const breakMins = getPomodoroState().shortBreakMinutes;
      pomodoroActions.start();
      pomodoroActions.adjustMinutes(-1);
      expect(getPomodoroState().timeLeft).toBe((breakMins - 1) * 60);

      pomodoroActions.cancel();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("short_break");
      expect(state.timeLeft).toBe(state.shortBreakMinutes * 60);
    });

    it("skipPhase advances to next phase when explicitly called", () => {
      pomodoroActions.start();
      pomodoroActions.skipPhase();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("short_break");
      expect(state.cycle).toBe(2);
    });
  });

  describe("adjustMinutes (+/- 1m increments)", () => {
    it("increments remaining time by 1 minute (60 seconds)", () => {
      const initialTime = getPomodoroState().timeLeft;
      pomodoroActions.adjustMinutes(1);
      expect(getPomodoroState().timeLeft).toBe(initialTime + 60);
    });

    it("decrements remaining time by 1 minute when timeLeft >= 60s", () => {
      const initialTime = getPomodoroState().timeLeft;
      pomodoroActions.adjustMinutes(-1);
      expect(getPomodoroState().timeLeft).toBe(initialTime - 60);
    });

    it("does nothing when decrementing if timeLeft is less than 1 minute (60s)", () => {
      // Manually adjust timeLeft to 60 seconds while running
      pomodoroActions.start();
      pomodoroActions.adjustMinutes(-24); // 25m - 24m = 1m = 60s
      expect(getPomodoroState().timeLeft).toBe(60);

      // Decrement 1 more minute down to 0s
      pomodoroActions.adjustMinutes(-1);
      expect(getPomodoroState().timeLeft).toBe(0);

      // Now timeLeft is 0 (< 60s), decrementing must not do anything
      pomodoroActions.adjustMinutes(-1);
      expect(getPomodoroState().timeLeft).toBe(0);
    });

    it("does not decrement if timeLeft is 45 seconds", () => {
      vi.useFakeTimers();
      pomodoroActions.start();
      pomodoroActions.adjustMinutes(-24);
      expect(getPomodoroState().timeLeft).toBe(60);
      vi.advanceTimersByTime(15000);
      expect(getPomodoroState().timeLeft).toBe(45);

      // Try decrementing while at 45s (< 60s)
      pomodoroActions.adjustMinutes(-1);
      expect(getPomodoroState().timeLeft).toBe(45); // Unchanged!
    });
  });

  describe("focus time tracking in seconds", () => {
    it("tracks focus seconds and increments totalFocusMinutes every 60s elapsed", () => {
      vi.useFakeTimers();
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(0);

      pomodoroActions.start();

      // Advance by 30 seconds
      vi.advanceTimersByTime(30000);
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(0);
      expect(getPomodoroState().dailyStats.focusSecondsElapsed).toBe(30);

      // Advance by another 30 seconds (total 60s)
      vi.advanceTimersByTime(30000);
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(1);
      expect(getPomodoroState().dailyStats.focusSecondsElapsed).toBe(0);

      // Advance another 60 seconds (total 120s)
      vi.advanceTimersByTime(60000);
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(2);
      expect(getPomodoroState().dailyStats.focusSecondsElapsed).toBe(0);
    });

    it("does not increment focus minutes while in break mode", () => {
      vi.useFakeTimers();
      pomodoroActions.switchMode("short_break");
      pomodoroActions.start();

      vi.advanceTimersByTime(60000);
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(0);
      expect(getPomodoroState().dailyStats.focusSecondsElapsed).toBe(0);
    });
  });

  describe("Cross-window Pomodoro synchronization", () => {
    it("broadcasts sync payload to localStorage on start, pause, and adjust", () => {
      pomodoroActions.start();
      const rawStart = localStorage.getItem("focushud_last_pomodoro_sync");
      expect(rawStart).toBeTruthy();
      const parsedStart = JSON.parse(rawStart!);
      expect(parsedStart.type).toBe("START");
      expect(parsedStart.state.isRunning).toBe(true);

      pomodoroActions.adjustMinutes(2);
      const rawAdjust = localStorage.getItem("focushud_last_pomodoro_sync");
      const parsedAdjust = JSON.parse(rawAdjust!);
      expect(parsedAdjust.type).toBe("ADJUST");

      pomodoroActions.pause();
      const rawPause = localStorage.getItem("focushud_last_pomodoro_sync");
      const parsedPause = JSON.parse(rawPause!);
      expect(parsedPause.type).toBe("PAUSE");
      expect(parsedPause.state.isRunning).toBe(false);
    });

    it("synchronizes timer state from remote window without starting duplicate local ticker", () => {
      const listener = vi.fn();
      const unsub = subscribePomodoro(listener);

      const remoteState: PomodoroState = {
        ...getPomodoroState(),
        isRunning: true,
        timeLeft: 1350,
      };

      _handleIncomingSyncForTesting({
        type: "START",
        state: remoteState,
        senderId: "remote_window_abc",
        timestamp: Date.now(),
      });

      expect(getPomodoroState().isRunning).toBe(true);
      expect(getPomodoroState().timeLeft).toBe(1350);
      expect(_getIsLocalTicker()).toBe(false); // Does not tick locally to prevent double tick
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it("smoothly adopts remote ticks", () => {
      const remoteState: PomodoroState = {
        ...getPomodoroState(),
        isRunning: true,
        timeLeft: 1100,
        dailyStats: {
          date: new Date().toISOString().split("T")[0],
          completedPomodoros: 2,
          totalFocusMinutes: 50,
          focusSecondsElapsed: 25,
        },
      };

      _handleIncomingSyncForTesting({
        type: "TICK",
        state: remoteState,
        senderId: "remote_window_abc",
        timestamp: Date.now(),
      });

      expect(getPomodoroState().timeLeft).toBe(1100);
      expect(getPomodoroState().dailyStats.completedPomodoros).toBe(2);
      expect(getPomodoroState().dailyStats.totalFocusMinutes).toBe(50);
    });

    it("synchronizes pause, stop, and mode changes from remote window", () => {
      // First start remotely
      _handleIncomingSyncForTesting({
        type: "START",
        state: { ...getPomodoroState(), isRunning: true, timeLeft: 1200 },
        senderId: "remote_window_abc",
        timestamp: Date.now(),
      });
      expect(getPomodoroState().isRunning).toBe(true);

      // Remote pause
      _handleIncomingSyncForTesting({
        type: "PAUSE",
        state: { ...getPomodoroState(), isRunning: false, timeLeft: 1200 },
        senderId: "remote_window_abc",
        timestamp: Date.now(),
      });
      expect(getPomodoroState().isRunning).toBe(false);

      // Remote mode change
      _handleIncomingSyncForTesting({
        type: "SWITCH_MODE",
        state: {
          ...getPomodoroState(),
          mode: "short_break",
          timeLeft: 300,
          totalSeconds: 300,
          isRunning: false,
        },
        senderId: "remote_window_abc",
        timestamp: Date.now(),
      });
      expect(getPomodoroState().mode).toBe("short_break");
      expect(getPomodoroState().timeLeft).toBe(300);
    });
  });
});
