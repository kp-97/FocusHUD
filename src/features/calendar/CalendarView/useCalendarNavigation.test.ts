import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCalendarNavigation } from "./useCalendarNavigation";

describe("useCalendarNavigation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("initializes with default mode 'week' and persists mode changes", () => {
    const { result } = renderHook(() => useCalendarNavigation());

    expect(result.current.mode).toBe("week");

    act(() => {
      result.current.setMode("day");
    });

    expect(result.current.mode).toBe("day");
    expect(localStorage.getItem("focushud_calendar_mode")).toBe("day");
  });

  it("initializes with mode from localStorage if present", () => {
    localStorage.setItem("focushud_calendar_mode", "month");
    const { result } = renderHook(() => useCalendarNavigation());
    expect(result.current.mode).toBe("month");
  });

  it("handles navigation functions (handleNext, handlePrev, handleToday, jumpToDay)", () => {
    const { result } = renderHook(() => useCalendarNavigation());

    const initialDate = result.current.currentDate.getTime();

    act(() => {
      result.current.handleNext();
    });
    expect(result.current.currentDate.getTime()).not.toBe(initialDate);

    act(() => {
      result.current.handlePrev();
    });
    expect(result.current.currentDate.getDate()).toBe(new Date(initialDate).getDate());

    const targetDate = new Date(2026, 5, 15);
    act(() => {
      result.current.jumpToDay(targetDate);
    });
    expect(result.current.mode).toBe("day");
    expect(result.current.currentDate.getFullYear()).toBe(2026);
    expect(result.current.currentDate.getMonth()).toBe(5);
    expect(result.current.currentDate.getDate()).toBe(15);
  });

  it("switches modes via Alt+hotkeys and navigates with single keys (T, J, K)", () => {
    const { result } = renderHook(() => useCalendarNavigation());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });
    expect(result.current.mode).toBe("day");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", altKey: true }));
    });
    expect(result.current.mode).toBe("month");

    // Single keys
    const beforeDate = result.current.currentDate.getTime();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    });
    expect(result.current.currentDate.getTime()).not.toBe(beforeDate);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    });
    expect(result.current.currentDate.getDate()).toBe(new Date().getDate());
  });

  it("does not trigger keyboard shortcuts when modal is open", () => {
    const { result } = renderHook(() => useCalendarNavigation({ isModalOpen: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });
    expect(result.current.mode).toBe("week");
  });
});

