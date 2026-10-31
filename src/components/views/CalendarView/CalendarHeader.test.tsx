import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarHeader } from "./CalendarHeader";

describe("CalendarHeader Component", () => {
  it("renders header controls and responds to navigation clicks", () => {
    const onToday = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const setMode = vi.fn();
    const setShowEvents = vi.fn();
    const setShowTasks = vi.fn();

    render(
      <CalendarHeader
        mode="week"
        setMode={setMode}
        headerTitle="November 2026"
        onToday={onToday}
        onPrev={onPrev}
        onNext={onNext}
        showEvents={true}
        setShowEvents={setShowEvents}
        showTasks={true}
        setShowTasks={setShowTasks}
      />
    );

    expect(screen.getByTestId("calendar-header-title")).toHaveTextContent("November 2026");

    fireEvent.click(screen.getByTestId("today-button"));
    expect(onToday).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("prev-button"));
    expect(onPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("next-button"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("opens mode dropdown and selects mode", () => {
    const setMode = vi.fn();

    render(
      <CalendarHeader
        mode="week"
        setMode={setMode}
        headerTitle="November 2026"
        onToday={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        showEvents={true}
        setShowEvents={vi.fn()}
        showTasks={true}
        setShowTasks={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("mode-dropdown-button"));
    expect(screen.getByTestId("mode-dropdown-menu")).toBeDefined();

    fireEvent.click(screen.getByTestId("mode-option-month"));
    expect(setMode).toHaveBeenCalledWith("month");
  });

  it("handles toggles for events and tasks", () => {
    const setShowEvents = vi.fn();
    const setShowTasks = vi.fn();

    render(
      <CalendarHeader
        mode="week"
        setMode={vi.fn()}
        headerTitle="November 2026"
        onToday={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        showEvents={true}
        setShowEvents={setShowEvents}
        showTasks={true}
        setShowTasks={setShowTasks}
      />
    );

    fireEvent.click(screen.getByTestId("toggle-events-button"));
    expect(setShowEvents).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("toggle-tasks-button"));
    expect(setShowTasks).toHaveBeenCalled();
  });
});

