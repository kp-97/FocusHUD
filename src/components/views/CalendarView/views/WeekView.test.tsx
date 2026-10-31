import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WeekView } from "./WeekView";
import { CalendarItemDisplay } from "../types";

describe("WeekView Component", () => {
  const dummyDate = new Date(2026, 10, 1);
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Sprint Retrospective",
      date: "2026-11-01",
      startTime: "14:00",
      endTime: "15:00",
      color: "#00e5ff",
      isTask: false,
      originalEvent: {
        id: "ev1",
        title: "Sprint Retrospective",
        date: "2026-11-01",
        startTime: "14:00",
        endTime: "15:00",
      },
    },
  ];

  it("renders 7-day header and triggers day selection", () => {
    const scrollRef = React.createRef<HTMLDivElement>();
    const onSelectDay = vi.fn();
    const onSlotClick = vi.fn();
    const onEventClick = vi.fn();

    render(
      <WeekView
        date={dummyDate}
        items={dummyItems}
        hourHeight={52}
        scrollRef={scrollRef}
        timeIndicatorTop={200}
        todayISO="2026-11-01"
        onSelectDay={onSelectDay}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
      />
    );

    expect(screen.getByTestId("week-days-header")).toBeDefined();
    expect(screen.getByText("Sprint Retrospective")).toBeDefined();

    // Click event
    fireEvent.click(screen.getByTestId("event-item-ev1"));
    expect(onEventClick).toHaveBeenCalledWith(dummyItems[0]);
  });
});
