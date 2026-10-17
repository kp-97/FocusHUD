import { describe, it, expect, beforeEach } from "vitest";
import {
  getTodayString,
  loadTasks,
  saveTasks,
  loadGoals,
  saveGoals,
  loadEvents,
  saveEvents,
  loadActionPlans,
  saveActionPlans,
  getInitialNav,
  broadcastNavChange,
} from "./store";
import { TaskItem, GoalNode, CalendarEvent, ActionPlanNode } from "../types/hud";

describe("store utility module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getTodayString", () => {
    it("returns formatted YYYY-MM-DD string", () => {
      const today = getTodayString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("tasks persistence", () => {
    it("returns default tasks when localStorage is empty", () => {
      const tasks = loadTasks();
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0]).toHaveProperty("id");
      expect(tasks[0]).toHaveProperty("title");
    });

    it("saves and loads customized tasks", () => {
      const customTasks: TaskItem[] = [
        {
          id: "test-task-1",
          title: "UNIT TEST SUITE",
          completed: false,
          status: "in_progress",
        },
      ];

      saveTasks(customTasks);
      const loaded = loadTasks();
      expect(loaded).toEqual(customTasks);
    });

    it("gracefully handles corrupted JSON in localStorage", () => {
      localStorage.setItem("focushud_tasks", "INVALID_JSON{");
      const loaded = loadTasks();
      expect(Array.isArray(loaded)).toBe(true);
      expect(loaded.length).toBeGreaterThan(0);
    });
  });

  describe("goals persistence", () => {
    it("saves and reloads goal hierarchy", () => {
      const sampleGoals: GoalNode[] = [
        {
          id: "g-test",
          title: "TEST GOAL",
          completed: false,
          children: [
            {
              id: "g-sub",
              title: "SUBTASK GOAL",
              completed: true,
            },
          ],
        },
      ];

      saveGoals(sampleGoals);
      expect(loadGoals()).toEqual(sampleGoals);
    });
  });

  describe("action plans persistence", () => {
    it("saves and reloads action plans", () => {
      const samplePlans: ActionPlanNode[] = [
        {
          id: "ap-test",
          title: "TEST ACTION PLAN",
          completed: false,
        },
      ];

      saveActionPlans(samplePlans);
      expect(loadActionPlans()).toEqual(samplePlans);
    });
  });

  describe("calendar events persistence", () => {
    it("saves and reloads events", () => {
      const sampleEvents: CalendarEvent[] = [
        {
          id: "e-test",
          title: "STANDUP",
          date: "2026-10-17",
          startTime: "09:00",
          endTime: "09:15",
          color: "#00e5ff",
        },
      ];

      saveEvents(sampleEvents);
      expect(loadEvents()).toEqual(sampleEvents);
    });
  });

  describe("navigation state", () => {
    it("returns 'home' as fallback initial navigation", () => {
      expect(getInitialNav()).toBe("home");
    });

    it("updates navigation and persists to localStorage on broadcast", () => {
      broadcastNavChange("calendar");
      expect(localStorage.getItem("focushud_active_nav")).toBe("calendar");
      expect(getInitialNav()).toBe("calendar");
    });
  });
});
