import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DayView } from "./DayView";
import { CalendarItemDisplay } from "../types";

describe("DayView Component", () => {
  const dummyDate = new Date(2026, 10, 1); // Nov 1, 2026 (Sunday)
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Team Standup",
      date: "2026-11-01",
      startTime: "10:00",
      endTime: "11:00",
      color: "#00e5ff",
      isTask: false,
      originalEvent: {
        id: "ev1",
        title: "Team Standup",
        date: "2026-11-01",
        startTime: "10:00",
        endTime: "11:00",
      },
    },
  ];

  it("renders 24 hour slots and event items", () => {
    const scrollRef = React.createRef<HTMLDivElement>();
    const onSlotClick = vi.fn();
    const onEventClick = vi.fn();

    render(
      <DayView
        date={dummyDate}
        items={dummyItems}
        hourHeight={52}
        scrollRef={scrollRef}
        timeIndicatorTop={200}
        todayISO="2026-11-01"
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
      />
    );

    expect(screen.getByText("Team Standup")).toBeDefined();
    expect(screen.getByTestId("day-slot-10")).toBeDefined();

    // Click slot quarter
    fireEvent.click(screen.getByTestId("day-quarter-10-0"));
    expect(onSlotClick).toHaveBeenCalledWith("2026-11-01", 10, 0);

    // Click event item
    fireEvent.click(screen.getByTestId("event-item-ev1"));
    expect(onEventClick).toHaveBeenCalledWith(dummyItems[0]);
  });
});

