import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleView } from "./ScheduleView";
import { CalendarItemDisplay } from "../types";

describe("ScheduleView Component", () => {
  const dummyDate = new Date(2026, 10, 1);
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Product Launch Roadmap",
      date: "2026-11-01",
      startTime: "10:00",
      endTime: "11:00",
      isTask: false,
      originalEvent: {
        id: "ev1",
        title: "Product Launch Roadmap",
        date: "2026-11-01",
        startTime: "10:00",
        endTime: "11:00",
      },
    },
  ];

  it("renders scheduled days feed and triggers event click", () => {
    const onEventClick = vi.fn();

    render(
      <ScheduleView
        date={dummyDate}
        items={dummyItems}
        todayISO="2026-11-01"
        onEventClick={onEventClick}
      />
    );

    expect(screen.getByText("Product Launch Roadmap")).toBeDefined();

    fireEvent.click(screen.getByText("Product Launch Roadmap"));
    expect(onEventClick).toHaveBeenCalledWith(dummyItems[0]);
  });
});
