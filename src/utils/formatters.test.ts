import { describe, it, expect } from "vitest";
import {
  formatDateToISO,
  getTodayDateString,
  formatMinutesSeconds,
  formatMinutesAndSeconds,
  formatDurationHM,
  formatDurationMs,
} from "./formatters";

describe("formatters", () => {
  it("formats dates into YYYY-MM-DD", () => {
    const specificDate = new Date("2026-11-10T00:00:00Z");
    expect(formatDateToISO(specificDate)).toBe("2026-11-10");
    expect(getTodayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats minutes and seconds with padding", () => {
    expect(formatMinutesSeconds(1500)).toBe("25:00");
    expect(formatMinutesSeconds(65)).toBe("01:05");
    expect(formatMinutesSeconds(0)).toBe("00:00");
    expect(formatMinutesSeconds(-5)).toBe("00:00");
    expect(formatMinutesAndSeconds(65)).toBe("01:05");
  });

  it("formats duration in H and M", () => {
    expect(formatDurationHM(135)).toBe("2H 15M");
    expect(formatDurationHM(60)).toBe("1H 0M");
    expect(formatDurationHM(45)).toBe("0H 45M");
    expect(formatDurationHM(-10)).toBe("0H 0M");
  });

  it("formats duration in milliseconds (formatDurationMs)", () => {
    expect(formatDurationMs(45)).toBe("45ms");
    expect(formatDurationMs(950)).toBe("950ms");
    expect(formatDurationMs(1200)).toBe("1.2s");
    expect(formatDurationMs(15400)).toBe("15.4s");
    expect(formatDurationMs(75000)).toBe("1m 15s");
    expect(formatDurationMs(0)).toBe("0ms");
    expect(formatDurationMs(undefined)).toBe("0ms");
  });
});

