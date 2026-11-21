import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YearView } from "./YearView";
import { CalendarItemDisplay } from "../types";

describe("YearView Component", () => {
  const dummyDate = new Date(2026, 10, 1);
  const dummyItems: CalendarItemDisplay[] = [
    {
      id: "ev1",
      title: "Annual Review",
      date: "2026-11-01",
      isTask: false,
    },
  ];

  it("renders 12 months and responds to day selection", () => {
    const onSelectDay = vi.fn();

    render(
      <YearView
        date={dummyDate}
        items={dummyItems}
        todayISO="2026-11-01"
        onSelectDay={onSelectDay}
      />
    );

    expect(screen.getByText("Jan")).toBeDefined();
    expect(screen.getByText("Nov")).toBeDefined();
    expect(screen.getByText("Dec")).toBeDefined();

    const novDay1 = screen.getAllByText("1")[10]; // November's 1st day button
    if (novDay1) {
      fireEvent.click(novDay1);
      expect(onSelectDay).toHaveBeenCalled();
    }
  });
});
