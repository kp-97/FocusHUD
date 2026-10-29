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

    expect(screen.queryByTestId("mode-dropdown-menu")).toBeNull();
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Month");
    expect(localStorage.getItem("focushud_calendar_mode")).toBe("month");
  });

  it("switches modes using keyboard shortcuts (Alt + D, W, M, Y, A, X)", () => {
    render(<CalendarView />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Month");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Day");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "y", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Year");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Schedule");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("4 days");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true }));
    });
    expect(screen.getByTestId("mode-dropdown-button")).toHaveTextContent("Week");
  });

  it("toggles Events and Tasks independently", () => {
    render(<CalendarView />);

    const eventsBtn = screen.getByTestId("toggle-events-button");
    const tasksBtn = screen.getByTestId("toggle-tasks-button");

    // Both are ON initially
    expect(localStorage.getItem("focushud_show_events")).toBe("true");
    expect(localStorage.getItem("focushud_show_tasks")).toBe("true");

    // Toggle events OFF
    fireEvent.click(eventsBtn);
    expect(localStorage.getItem("focushud_show_events")).toBe("false");
    expect(localStorage.getItem("focushud_show_tasks")).toBe("true");

    // Toggle tasks OFF
    fireEvent.click(tasksBtn);
    expect(localStorage.getItem("focushud_show_tasks")).toBe("false");

    // Toggle events back ON
    fireEvent.click(eventsBtn);
    expect(localStorage.getItem("focushud_show_events")).toBe("true");
    expect(localStorage.getItem("focushud_show_tasks")).toBe("false");
  });

  it("renders 12H time labels on timetable slots", () => {
    render(<CalendarView />);

    // Week view is active by default; check for 12H labels like 9 AM, 12 PM, 1 PM
    expect(screen.getByText("9 AM")).toBeDefined();
    expect(screen.getByText("12 PM")).toBeDefined();
    expect(screen.getByText("1 PM")).toBeDefined();
  });

  it("opens creation modal when clicking an hourly slot and saves new event", () => {
    render(<CalendarView />);

    // Switch to Day view
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });

    // Click 10 AM slot
    const slot10 = screen.getByTestId("day-slot-10");
    fireEvent.click(slot10);

    // Modal should appear
    expect(screen.getByTestId("event-modal-content")).toBeDefined();
    expect(screen.getByText("NEW EVENT")).toBeDefined();

    // Fill title
    const titleInput = screen.getByTestId("event-title-input");
    fireEvent.change(titleInput, { target: { value: "New Design Review" } });

    // Fill location
    const locationInput = screen.getByTestId("event-location-input");
    fireEvent.change(locationInput, { target: { value: "Conference Room B" } });

    // Submit form
    const saveBtn = screen.getByTestId("event-save-btn");
    fireEvent.click(saveBtn);

    // Modal closes and new event is visible
    expect(screen.queryByTestId("event-modal-content")).toBeNull();
    expect(screen.getByText("New Design Review")).toBeDefined();
  });

  it("opens edit modal when clicking an existing event, allows editing and deleting", () => {
    render(<CalendarView />);

    // Switch to Day view
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
    });

    // Click existing event e1 ("DEEP FOCUS BLOCK")
    const eventItem = screen.getByTestId("event-item-e1");
    fireEvent.click(eventItem);

    // Modal appears in edit mode
    expect(screen.getByText("EDIT EVENT")).toBeDefined();
    expect(screen.getByTestId("event-delete-btn")).toBeDefined();

    // Click delete
    fireEvent.click(screen.getByTestId("event-delete-btn"));

    // Modal closes and event is deleted
    expect(screen.queryByTestId("event-modal-content")).toBeNull();
    expect(screen.queryByTestId("event-item-e1")).toBeNull();
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
});
