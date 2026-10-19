import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPomodoroState,
  pomodoroActions,
  subscribePomodoro,
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

  describe("stop action", () => {
    it("stops focus timer early and shifts to short_break", () => {
      pomodoroActions.start();
      expect(getPomodoroState().isRunning).toBe(true);
      expect(getPomodoroState().mode).toBe("focus");

      pomodoroActions.stop();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("short_break");
      expect(state.cycle).toBe(2);
      expect(state.timeLeft).toBe(state.shortBreakMinutes * 60);
    });

    it("stops focus timer early at totalCycles and shifts to long_break", () => {
      pomodoroActions.setTotalCycles(4);
      // Advance to cycle 4
      pomodoroActions.stop(); // 1 -> short_break (cycle 2)
      pomodoroActions.stop(); // break -> focus (cycle 2)
      pomodoroActions.stop(); // 2 -> short_break (cycle 3)
      pomodoroActions.stop(); // break -> focus (cycle 3)
      pomodoroActions.stop(); // 3 -> short_break (cycle 4)
      pomodoroActions.stop(); // break -> focus (cycle 4)

      expect(getPomodoroState().cycle).toBe(4);
      expect(getPomodoroState().mode).toBe("focus");

      pomodoroActions.start();
      pomodoroActions.stop();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("long_break");
      expect(state.cycle).toBe(1);
      expect(state.timeLeft).toBe(state.longBreakMinutes * 60);
    });

    it("stops break timer early and shifts back to focus", () => {
      pomodoroActions.switchMode("short_break");
      pomodoroActions.start();

      pomodoroActions.stop();

      const state = getPomodoroState();
      expect(state.isRunning).toBe(false);
      expect(state.mode).toBe("focus");
      expect(state.timeLeft).toBe(state.focusMinutes * 60);
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
});
