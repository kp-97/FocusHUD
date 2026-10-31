import { useMemo } from "react";
import { CalendarEvent, TaskItem } from "../../../types/hud";
import { CalendarItemDisplay } from "./types";
import { getTodayString } from "../../../stores/layoutStore";

// Helper to recursively flatten tasks
export const flattenTasks = (taskList: TaskItem[]): TaskItem[] => {
  const result: TaskItem[] = [];
  const recurse = (list: TaskItem[]) => {
    for (const t of list) {
      result.push(t);
      if (t.subtasks && t.subtasks.length > 0) {
        recurse(t.subtasks);
      }
    }
  };
  recurse(taskList);
  return result;
};

export function useCalendarDisplayItems(
  events: CalendarEvent[],
  tasks: TaskItem[],
  showEvents: boolean,
  showTasks: boolean
): CalendarItemDisplay[] {
  return useMemo<CalendarItemDisplay[]>(() => {
    const list: CalendarItemDisplay[] = [];

    if (showEvents) {
      events.forEach((e) => {
        list.push({
          id: e.id,
          title: e.title,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          location: e.location,
          color: e.color || "#00e5ff",
          isTask: false,
          originalEvent: e,
        });
      });
    }

    if (showTasks) {
      const flat = flattenTasks(tasks);
      flat.forEach((t) => {
        list.push({
          id: t.id,
          title: t.title,
          date: t.dueDate || t.completedAt || getTodayString(),
          startTime: "09:00",
          endTime: "10:00",
          color: t.completed ? "#00e676" : "#ff9100",
          isTask: true,
          completed: t.completed,
        });
      });
    }

    return list;
  }, [showEvents, showTasks, events, tasks]);
}
