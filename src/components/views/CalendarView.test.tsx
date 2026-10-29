import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CalendarView } from "./CalendarView";

describe("CalendarView Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders header with Today button, navigation chevrons, and active mode dropdown", () => {
    render(<CalendarView />);

    expect(screen.getByTestId("today-button")).toBeDefined();
    expect(screen.getByTestId("prev-button")).toBeDefined();
    expect(screen.getByTestId("next-button")).toBeDefined();
    expect(screen.getByTestId("calendar-header-title")).toBeDefined();
    expect(screen.getByTestId("mode-dropdown-button")).toBeDefined();
    expect(screen.getByTestId("data-type-toggle")).toBeDefined();
  });

  it("opens mode switcher dropdown and shows all 6 modes with hotkeys", () => {
    render(<CalendarView />);

    const dropdownBtn = screen.getByTestId("mode-dropdown-button");
    fireEvent.click(dropdownBtn);

    const menu = screen.getByTestId("mode-dropdown-menu");
    expect(menu).toBeDefined();

    expect(screen.getByTestId("mode-option-day")).toHaveTextContent("Day");
    expect(screen.getByTestId("mode-option-day")).toHaveTextContent("D");

    expect(screen.getByTestId("mode-option-week")).toHaveTextContent("Week");
    expect(screen.getByTestId("mode-option-week")).toHaveTextContent("W");

    expect(screen.getByTestId("mode-option-month")).toHaveTextContent("Month");
    expect(screen.getByTestId("mode-option-month")).toHaveTextContent("M");

    expect(screen.getByTestId("mode-option-year")).toHaveTextContent("Year");
    expect(screen.getByTestId("mode-option-year")).toHaveTextContent("Y");

    expect(screen.getByTestId("mode-option-schedule")).toHaveTextContent("Schedule");
    expect(screen.getByTestId("mode-option-schedule")).toHaveTextContent("A");

    expect(screen.getByTestId("mode-option-4days")).toHaveTextContent("4 days");
    expect(screen.getByTestId("mode-option-4days")).toHaveTextContent("X");
  });

  it("switches mode when clicking an option in the dropdown and closes menu", () => {
    render(<CalendarView />);

    const dropdownBtn = screen.getByTestId("mode-dropdown-button");
    fireEvent.click(dropdownBtn);

    const monthOption = screen.getByTestId("mode-option-month");
    fireEvent.click(monthOption);

    // Dropdown should be closed
    expect(screen.queryByTestId("mode-dropdown-menu")).toBeNull();
    // Dropdown button should now display Month
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Month");
    // Saved in localStorage
    expect(localStorage.getItem("focushud_calendar_mode")).toBe("month");
  });

  it("switches modes using keyboard shortcuts (Alt + D, W, M, Y, A, X)", () => {
    render(<CalendarView />);

    // Alt + M -> Month
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Month");

    // Alt + D -> Day
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Day");

    // Alt + Y -> Year
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "y", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Year");

    // Alt + A -> Schedule
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Schedule");

    // Alt + X -> 4 days
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("4 days");

    // Alt + W -> Week
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Week");
  });

  it("does not trigger mode switch shortcuts when user is typing in an input", () => {
    render(
      <div>
        <input data-testid="test-input" />
        <CalendarView />
      </div>
    );

    const input = screen.getByTestId("test-input");
    input.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });

    // Should remain on default week mode because input has focus
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Week");
  });

  it("toggles between Events and Tasks without changing mode", () => {
    render(<CalendarView />);

    const tasksBtn = screen.getByTestId("toggle-tasks-button");
    const eventsBtn = screen.getByTestId("toggle-events-button");

    // Switch to tasks
    fireEvent.click(tasksBtn);
    expect(localStorage.getItem("focushud_calendar_data_type")).toBe("tasks");
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Week");

    // Switch back to events
    fireEvent.click(eventsBtn);
    expect(localStorage.getItem("focushud_calendar_data_type")).toBe("events");
  });

  it("navigates forward and backward with Next and Prev buttons", () => {
    render(<CalendarView />);

    const initialTitle = screen.getByTestId("calendar-header-title").textContent;
    const nextBtn = screen.getByTestId("next-button");
    const prevBtn = screen.getByTestId("prev-button");

    fireEvent.click(nextBtn);
    expect(screen.getByTestId("calendar-header-title").textContent).toBeDefined();

    fireEvent.click(prevBtn);
    const backTitle = screen.getByTestId("calendar-header-title").textContent;

    expect(backTitle).toBe(initialTitle);
  });

  it("resets date to today when clicking Today button", () => {
    render(<CalendarView />);

    const initialTitle = screen.getByTestId("calendar-header-title").textContent;
    const nextBtn = screen.getByTestId("next-button");
    const todayBtn = screen.getByTestId("today-button");

    // Move ahead several weeks
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);

    // Reset to today
    fireEvent.click(todayBtn);
    expect(screen.getByTestId("calendar-header-title").textContent).toBe(initialTitle);
  });

  it("switches to Day mode when clicking a date in Month view", () => {
    render(<CalendarView />);

    // Switch to Month view
    fireEvent.click(screen.getByTestId("mode-dropdown-button"));
    fireEvent.click(screen.getByTestId("mode-option-month"));
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Month");

    // Find a day cell in Month view and click it
    const dayCells = screen.getAllByText("15");
    fireEvent.click(dayCells[0]);

    // Should switch to Day view
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Day");
  });
});
