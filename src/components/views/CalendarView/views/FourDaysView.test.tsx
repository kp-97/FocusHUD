import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FourDaysView } from "./FourDaysView";
import { CalendarItemDisplay } from "../types";

describe("FourDaysView Component", () => {
  const dummyDate = new Date(2026, 10, 1);
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Design Sync",
      date: "2026-11-01",
      startTime: "11:00",
      endTime: "12:00",
      color: "#00e5ff",
      isTask: false,
      originalEvent: {
        id: "ev1",
        title: "Design Sync",
        date: "2026-11-01",
        startTime: "11:00",
        endTime: "12:00",
      },
    },
  ];

  it("renders 4 days header and slots", () => {
    const scrollRef = React.createRef<HTMLDivElement>();
    const onSelectDay = vi.fn();
    const onSlotClick = vi.fn();
    const onEventClick = vi.fn();

    render(
      <FourDaysView
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

    expect(screen.getByTestId("four-days-header")).toBeDefined();
    expect(screen.getByText("Design Sync")).toBeDefined();

    fireEvent.click(screen.getByTestId("event-item-ev1"));
    expect(onEventClick).toHaveBeenCalledWith(dummyItems[0]);
  });
});

