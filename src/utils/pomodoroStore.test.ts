import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPomodoroState,
  pomodoroActions,
  subscribePomodoro,
} from "./pomodoroStore";

describe("pomodoroStore", () => {
  beforeEach(() => {
    localStorage.clear();
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
});
