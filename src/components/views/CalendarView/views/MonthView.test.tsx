import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthView } from "./MonthView";
import { CalendarItemDisplay } from "../types";

describe("MonthView Component", () => {
  const dummyDate = new Date(2026, 10, 1);
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Monthly All-Hands",
      date: "2026-11-01",
      startTime: "09:00",
      endTime: "10:00",
      color: "#00e5ff",
      isTask: false,
      originalEvent: {
        id: "ev1",
        title: "Monthly All-Hands",
        date: "2026-11-01",
        startTime: "09:00",
        endTime: "10:00",
      },
    },
  ];

  it("renders month grid and events", () => {
    const onSelectDay = vi.fn();
    const onEventClick = vi.fn();

    render(
      <MonthView
        date={dummyDate}
        items={dummyItems}
        todayISO="2026-11-01"
        onSelectDay={onSelectDay}
        onEventClick={onEventClick}
      />
    );

    expect(screen.getByText("Monthly All-Hands")).toBeDefined();

    fireEvent.click(screen.getByText("Monthly All-Hands"));
    expect(onEventClick).toHaveBeenCalledWith(dummyItems[0]);
  });
});
