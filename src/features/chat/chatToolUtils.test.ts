import { describe, it, expect } from "vitest";
import { formatToolFallbackResponse } from "./chatToolUtils";
import type { ToolCallItem } from "../../types/ai";

describe("chatToolUtils - formatToolFallbackResponse", () => {
  it("returns empty string when toolCalls is undefined or empty", () => {
    expect(formatToolFallbackResponse(undefined)).toBe("");
    expect(formatToolFallbackResponse([])).toBe("");
  });

  it("extracts message field from tool execution result", () => {
    const items: ToolCallItem[] = [
      {
        id: "tc_1",
        name: "create_calendar_event",
        arguments: "{}",
        status: "success",
        result: JSON.stringify({ message: "Event 'Team Sync' scheduled for 2026-11-25 at 14:00" }),
      },
    ];
    expect(formatToolFallbackResponse(items)).toBe(
      "✓ **Event 'Team Sync' scheduled for 2026-11-25 at 14:00**"
    );
  });

  it("formats date and time tool results", () => {
    const items: ToolCallItem[] = [
      {
        id: "tc_2",
        name: "get_current_time",
        arguments: "{}",
        status: "success",
        result: JSON.stringify({
          formatted: "Tuesday, November 24, 2026 11:00 PM",
          timezone: "ACDT",
        }),
      },
    ];
    expect(formatToolFallbackResponse(items)).toContain("Tuesday, November 24, 2026 11:00 PM");
  });

  it("formats scheduled events list when count > 0", () => {
    const items: ToolCallItem[] = [
      {
        id: "tc_3",
        name: "get_calendar_events",
        arguments: "{}",
        status: "success",
        result: JSON.stringify({
          events: [
            { title: "Design Review", date: "2026-11-25", startTime: "10:00", endTime: "11:00" },
          ],
        }),
      },
    ];
    const res = formatToolFallbackResponse(items);
    expect(res).toContain("Scheduled events (1)");
    expect(res).toContain("Design Review");
  });

  it("formats empty scheduled events message when events list is empty", () => {
    const items: ToolCallItem[] = [
      {
        id: "tc_4",
        name: "get_calendar_events",
        arguments: "{}",
        status: "success",
        result: JSON.stringify({ events: [] }),
      },
    ];
    expect(formatToolFallbackResponse(items)).toBe("No scheduled events found.");
  });

  it("formats both scheduled events and calendar tasks", () => {
    const items: ToolCallItem[] = [
      {
        id: "tc_5",
        name: "get_calendar_events",
        arguments: "{}",
        status: "success",
        result: JSON.stringify({
          events: [
            { title: "Class Lecture", date: "2026-11-26", startTime: "16:15", endTime: "19:15" },
          ],
          tasks: [
            { title: "Review PR", status: "pending", startTime: "09:00", endTime: "10:00" },
          ],
        }),
      },
    ];
    const res = formatToolFallbackResponse(items);
    expect(res).toContain("Scheduled events (1)");
    expect(res).toContain("Class Lecture");
    expect(res).toContain("Calendar tasks (1)");
    expect(res).toContain("Review PR");
  });
});
