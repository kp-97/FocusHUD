import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PomodoroDial } from "./PomodoroDial";
import { pomodoroActions, getPomodoroState } from "../utils/pomodoroStore";

describe("PomodoroDial component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    pomodoroActions.pause();
    pomodoroActions.resetDailyStats();
    pomodoroActions.setCycle(1);
    pomodoroActions.switchMode("focus");
    pomodoroActions.reset();
  });

  afterEach(() => {
    pomodoroActions.pause();
    pomodoroActions.reset();
    vi.useRealTimers();
  });

  it("renders the Start button when not running, and does not show Stop button", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });

    expect(screen.getByRole("button", { name: /START/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /STOP/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PAUSE/i })).not.toBeInTheDocument();
  });

  it("replaces the Start button with Stop and Pause buttons when running", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });

    const startBtn = screen.getByRole("button", { name: /START/i });
    act(() => {
      fireEvent.click(startBtn);
    });

    expect(screen.queryByRole("button", { name: /START/i })).not.toBeInTheDocument();

    const stopBtn = screen.getByRole("button", { name: /(CANCEL|STOP)/i });
    const pauseBtn = screen.getByRole("button", { name: /PAUSE/i });

    expect(stopBtn).toBeInTheDocument();
    expect(pauseBtn).toBeInTheDocument();

    // Verify DOM ordering: Stop button precedes Pause button
    expect(stopBtn.compareDocumentPosition(pauseBtn)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("cancels timer and resets countdown when Cancel button is clicked", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });

    // Start timer
    const startBtn = screen.getByRole("button", { name: /START/i });
    act(() => {
      fireEvent.click(startBtn);
    });
    expect(getPomodoroState().isRunning).toBe(true);

    // Simulate elapsed time
    act(() => {
      pomodoroActions.adjustMinutes(-5);
    });
    expect(getPomodoroState().timeLeft).toBe(20 * 60);

    // Click Cancel button (which replaced Start button)
    const cancelBtn = screen.getByRole("button", { name: /(CANCEL|STOP)/i });
    act(() => {
      fireEvent.click(cancelBtn);
    });

    const state = getPomodoroState();
    expect(state.isRunning).toBe(false);
    expect(state.mode).toBe("focus");
    expect(state.cycle).toBe(1);
    expect(state.timeLeft).toBe(state.focusMinutes * 60);
    // After cancelling, Start button is restored and Cancel/Stop is hidden
    expect(screen.getByRole("button", { name: /START/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(CANCEL|STOP)/i })).not.toBeInTheDocument();
  });

  it("increments remaining time by 1 minute on plus button click", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });
    const plusBtn = screen.getByTitle(/Increase 1m/i);

    const initialTimeLeft = getPomodoroState().timeLeft;
    act(() => {
      fireEvent.click(plusBtn);
    });

    expect(getPomodoroState().timeLeft).toBe(initialTimeLeft + 60);
  });

  it("decrements remaining time by 1 minute on minus button click when time >= 1m", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });
    const minusBtn = screen.getByTitle(/Decrease 1m/i);

    const initialTimeLeft = getPomodoroState().timeLeft;
    act(() => {
      fireEvent.click(minusBtn);
    });

    expect(getPomodoroState().timeLeft).toBe(initialTimeLeft - 60);
  });

  it("disables minus button and does not decrement when time left is less than 1 minute", () => {
    vi.useFakeTimers();
    act(() => {
      pomodoroActions.start();
      pomodoroActions.adjustMinutes(-24); // down to 60s
    });
    expect(getPomodoroState().timeLeft).toBe(60);

    // Tick 15 seconds down to 45s
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(getPomodoroState().timeLeft).toBe(45);

    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });
    const minusBtn = screen.getByTitle(/Cannot decrease below 1 minute/i);
    expect(minusBtn).toBeDisabled();

    act(() => {
      fireEvent.click(minusBtn);
    });

    expect(getPomodoroState().timeLeft).toBe(45);
  });

  it("displays total focus time in hours and minutes", () => {
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });

    // Initially 0H 0M
    expect(screen.getByText(/0H 0M/i)).toBeInTheDocument();

    // Advance 60 seconds of focus
    vi.useFakeTimers();
    act(() => {
      pomodoroActions.start();
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByText(/0H 1M/i)).toBeInTheDocument();
  });
});
