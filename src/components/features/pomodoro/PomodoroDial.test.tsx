import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PomodoroDial } from "./PomodoroDial";
import { pomodoroActions, getPomodoroState } from "../../../stores/pomodoroStore";

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
    cleanup();
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
    act(() => {
      render(<PomodoroDial isCompact={false} />);
    });

    // Adjust down to 60s
    act(() => {
      pomodoroActions.adjustMinutes(-24);
    });
    expect(getPomodoroState().timeLeft).toBe(60);

    // Decrement 1 more minute down to 0s
    const minusBtn = screen.getByTitle(/Decrease 1m/i);
    act(() => {
      fireEvent.click(minusBtn);
    });
    expect(getPomodoroState().timeLeft).toBe(0);

    // Button should now be disabled
    expect(minusBtn).toBeDisabled();
    expect(minusBtn).toHaveAttribute("title", "Cannot decrease below 1 minute");

    // Clicking when disabled should not decrement further
    act(() => {
      fireEvent.click(minusBtn);
    });
    expect(getPomodoroState().timeLeft).toBe(0);
  });

  it("displays total focus time in hours and minutes", () => {
    act(() => {
      pomodoroActions.setDailyStats({
        completedPomodoros: 3,
        totalFocusMinutes: 125, // 2H 5M
      });
      render(<PomodoroDial isCompact={false} />);
    });

    expect(screen.getByText(/3 POMOS/i)).toBeInTheDocument();
    expect(screen.getByText(/2H 5M/i)).toBeInTheDocument();
  });
});
