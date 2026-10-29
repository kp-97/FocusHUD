import { describe, it, expect } from "vitest";
import {
  formatDateISO,
  getMondayOfWeek,
  formatDayHeader,
  formatMonthHeader,
  formatMultiDayHeader,
  formatWeekHeader,
  format4DaysHeader,
  formatScheduleHeader,
  formatYearHeader,
  getCalendarHeaderTitle,
  navigateDate,
  CALENDAR_MODES,
  formatHour12,
  formatTime12,
  parse12To24,
} from "./calendarFormatters";

describe("calendarFormatters", () => {
  it("formats Date into ISO string using local date values", () => {
    const d = new Date(2026, 9, 29); // Month is 0-indexed: 9 = October
    expect(formatDateISO(d)).toBe("2026-10-29");
  });

  it("finds Monday of week correctly", () => {
    // 2026-10-29 is Thursday. Monday is 2026-10-26
    const thursday = new Date(2026, 9, 29);
    const monday = getMondayOfWeek(thursday);
    expect(formatDateISO(monday)).toBe("2026-10-26");

    // Sunday 2026-11-01 should still have Monday 2026-10-26
    const sunday = new Date(2026, 10, 1);
    const mondayFromSun = getMondayOfWeek(sunday);
    expect(formatDateISO(mondayFromSun)).toBe("2026-10-26");
  });

  it("formats Day view header: 29 October 2026", () => {
    const d = new Date(2026, 9, 29);
    expect(formatDayHeader(d)).toBe("29 October 2026");
  });

  it("formats Month view header: October 2026", () => {
    const d = new Date(2026, 9, 29);
    expect(formatMonthHeader(d)).toBe("October 2026");
  });

  describe("formatMultiDayHeader & formatWeekHeader", () => {
    it("returns single month format when week is contained in one month", () => {
      // Monday Oct 12 to Sunday Oct 18, 2026
      const midOct = new Date(2026, 9, 14);
      expect(formatWeekHeader(midOct)).toBe("October 2026");
    });

    it("returns Sept – Oct 2026 when week spans Sept and Oct", () => {
      // 2026-09-30 is Wednesday. Monday is Sep 28, Sunday is Oct 4
      const lateSept = new Date(2026, 8, 30);
      expect(formatWeekHeader(lateSept)).toBe("Sept – Oct 2026");
    });

    it("returns Oct – Nov 2026 when week spans Oct and Nov", () => {
      // 2026-10-29 is Thursday. Monday is Oct 26, Sunday is Nov 1
      const lateOct = new Date(2026, 9, 29);
      expect(formatWeekHeader(lateOct)).toBe("Oct – Nov 2026");
    });

    it("handles year transition e.g. Dec 2026 – Jan 2027", () => {
      const start = new Date(2026, 11, 28);
      const end = new Date(2027, 0, 3);
      expect(formatMultiDayHeader(start, end)).toBe("Dec 2026 – Jan 2027");
    });
  });

  describe("format4DaysHeader", () => {
    it("returns October 2026 when all 4 days are in October", () => {
      const d = new Date(2026, 9, 10);
      expect(format4DaysHeader(d)).toBe("October 2026");
    });

    it("returns Oct – Nov 2026 when 4 days cross month boundary", () => {
      const d = new Date(2026, 9, 30);
      expect(format4DaysHeader(d)).toBe("Oct – Nov 2026");
    });
  });

  describe("formatScheduleHeader and formatYearHeader", () => {
    it("matches week formatting for schedule header", () => {
      const lateOct = new Date(2026, 9, 29);
      expect(formatScheduleHeader(lateOct)).toBe("Oct – Nov 2026");
    });

    it("formats Year header: 2026", () => {
      const d = new Date(2026, 9, 29);
      expect(formatYearHeader(d)).toBe("2026");
    });
  });

  describe("getCalendarHeaderTitle", () => {
    const d = new Date(2026, 9, 29);

    it("returns formatted string for all modes", () => {
      expect(getCalendarHeaderTitle("day", d)).toBe("29 October 2026");
      expect(getCalendarHeaderTitle("week", d)).toBe("Oct – Nov 2026");
      expect(getCalendarHeaderTitle("month", d)).toBe("October 2026");
      expect(getCalendarHeaderTitle("year", d)).toBe("2026");
      expect(getCalendarHeaderTitle("schedule", d)).toBe("Oct – Nov 2026");
      expect(getCalendarHeaderTitle("4days", d)).toBe("Oct – Nov 2026");
    });
  });

  describe("navigateDate", () => {
    const base = new Date(2026, 9, 15);

    it("navigates ±1 day for day mode", () => {
      expect(formatDateISO(navigateDate(base, "day", 1))).toBe("2026-10-16");
      expect(formatDateISO(navigateDate(base, "day", -1))).toBe("2026-10-14");
    });

    it("navigates ±4 days for 4days mode", () => {
      expect(formatDateISO(navigateDate(base, "4days", 1))).toBe("2026-10-19");
      expect(formatDateISO(navigateDate(base, "4days", -1))).toBe("2026-10-11");
    });

    it("navigates ±7 days for week and schedule mode", () => {
      expect(formatDateISO(navigateDate(base, "week", 1))).toBe("2026-10-22");
      expect(formatDateISO(navigateDate(base, "schedule", -1))).toBe("2026-10-08");
    });

    it("navigates ±1 month for month mode", () => {
      const nextMonth = navigateDate(base, "month", 1);
      expect(nextMonth.getMonth()).toBe(10); // November
      const prevMonth = navigateDate(base, "month", -1);
      expect(prevMonth.getMonth()).toBe(8); // September
    });

    it("navigates ±1 year for year mode", () => {
      expect(navigateDate(base, "year", 1).getFullYear()).toBe(2027);
      expect(navigateDate(base, "year", -1).getFullYear()).toBe(2025);
    });
  });

  describe("12-hour time formatters", () => {
    it("formats 24-hour hour numbers to 12-hour AM/PM correctly", () => {
      expect(formatHour12(0)).toBe("12 AM");
      expect(formatHour12(1)).toBe("1 AM");
      expect(formatHour12(11)).toBe("11 AM");
      expect(formatHour12(12)).toBe("12 PM");
      expect(formatHour12(13)).toBe("1 PM");
      expect(formatHour12(23)).toBe("11 PM");
    });

    it("formats HH:mm 24-hour string to 12-hour time format", () => {
      expect(formatTime12("09:00")).toBe("9:00 AM");
      expect(formatTime12("13:30")).toBe("1:30 PM");
      expect(formatTime12("00:15")).toBe("12:15 AM");
      expect(formatTime12("12:00")).toBe("12:00 PM");
      expect(formatTime12("")).toBe("");
    });

    it("converts 12-hour components back to 24-hour HH:mm string", () => {
      expect(parse12To24(12, 0, "AM")).toBe("00:00");
      expect(parse12To24(9, 30, "AM")).toBe("09:30");
      expect(parse12To24(12, 45, "PM")).toBe("12:45");
      expect(parse12To24(2, 15, "PM")).toBe("14:15");
    });
  });

  describe("CALENDAR_MODES", () => {
    it("has all 6 modes with correct shortcuts", () => {
      expect(CALENDAR_MODES.map((m) => m.id)).toEqual([
        "day",
        "week",
        "month",
        "year",
        "schedule",
        "4days",
      ]);
      expect(CALENDAR_MODES.map((m) => m.shortcutKey)).toEqual(["D", "W", "M", "Y", "A", "X"]);
    });
  });
});

