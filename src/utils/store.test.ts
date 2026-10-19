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
  getRememberedLeftWidth,
  setRememberedLeftWidth,
  getRememberedRightWidth,
  setRememberedRightWidth,
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  broadcastLayoutAction,
  subscribeLayoutAction,
  LayoutAction,
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

  describe("pane width memory", () => {
    it("returns default widths when no previous width is stored", () => {
      expect(getRememberedLeftWidth()).toBe(DEFAULT_LEFT_WIDTH);
      expect(getRememberedRightWidth()).toBe(DEFAULT_RIGHT_WIDTH);
    });

    it("saves and retrieves remembered left and right widths", () => {
      setRememberedLeftWidth(420);
      setRememberedRightWidth(340);
      expect(getRememberedLeftWidth()).toBe(420);
      expect(getRememberedRightWidth()).toBe(340);
    });

    it("ignores width values below collapsed threshold (<120)", () => {
      setRememberedLeftWidth(450);
      setRememberedLeftWidth(68);
      // Still remembers 450
      expect(getRememberedLeftWidth()).toBe(450);
    });

    it("falls back to hud_left_width if it was an expanded width", () => {
      localStorage.setItem("hud_left_width", "380");
      expect(getRememberedLeftWidth()).toBe(380);
    });
  });

  describe("layout action synchronization", () => {
    it("persists broadcast layout action to localStorage", () => {
      broadcastLayoutAction({
        type: "SET_PANES_WIDTH",
        leftWidth: 68,
        rightWidth: 68,
      });

      const raw = localStorage.getItem("focushud_last_layout_action");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.action).toEqual({
        type: "SET_PANES_WIDTH",
        leftWidth: 68,
        rightWidth: 68,
      });
    });

    it("triggers subscribeLayoutAction callback on storage event", () => {
      const received: LayoutAction[] = [];
      const unsubscribe = subscribeLayoutAction((action) => {
        received.push(action);
      });

      const actionData = {
        action: { type: "SET_PANES_WIDTH", leftWidth: 68, rightWidth: 68 } as LayoutAction,
        timestamp: Date.now(),
      };

      // Simulate a storage event from another window
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "focushud_last_layout_action",
          newValue: JSON.stringify(actionData),
        })
      );

      expect(received).toEqual([
        { type: "SET_PANES_WIDTH", leftWidth: 68, rightWidth: 68 },
      ]);

      unsubscribe();
    });
  });
});
