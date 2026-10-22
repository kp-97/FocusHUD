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
  DEFAULT_NAV_CONFIG,
  loadNavConfig,
  saveNavConfig,
  resetNavConfig,
  DEFAULT_MAX_LEFT_WIDTH,
  DEFAULT_MAX_RIGHT_WIDTH,
  MIN_PANE_MAX_WIDTH,
  MAX_PANE_MAX_WIDTH,
  getMaxLeftWidth,
  setMaxLeftWidth,
  getMaxRightWidth,
  setMaxRightWidth,
  applyMaxPaneWidths,
  DEFAULT_NOTES,
  loadNotes,
  saveNotes,
} from "./layoutStore";
import { TaskItem, GoalNode, CalendarEvent, ActionPlanNode, NavItemConfig } from "../types/hud";

describe("layoutStore module", () => {
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
        action: { type: "SET_PANES_WIDTH", leftWidth: 68, rightWidth: 68, sender: "right" } as LayoutAction,
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
        { type: "SET_PANES_WIDTH", leftWidth: 68, rightWidth: 68, sender: "right" },
      ]);

      unsubscribe();
    });

    it("persists and broadcasts layout action with sender", () => {
      broadcastLayoutAction({
        type: "SET_RIGHT_WIDTH",
        width: 360,
        sender: "right",
      });

      const raw = localStorage.getItem("focushud_last_layout_action");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.action).toEqual({
        type: "SET_RIGHT_WIDTH",
        width: 360,
        sender: "right",
      });
    });
  });

  describe("navigation configuration", () => {
    it("has expected default order: Home -> Chat -> Calendar -> Goals -> Tasks -> Notes -> Action Plans -> Timer -> Kanban", () => {
      const ids = DEFAULT_NAV_CONFIG.map((item) => item.id);
      expect(ids).toEqual([
        "home",
        "chat",
        "calendar",
        "goals",
        "tasks",
        "notes",
        "action_plans",
        "timer",
        "kanban",
      ]);
      expect(DEFAULT_NAV_CONFIG.every((item) => item.visible)).toBe(true);
    });

    it("loads default nav config when localStorage is empty", () => {
      const config = loadNavConfig();
      expect(config).toEqual(DEFAULT_NAV_CONFIG);
    });

    it("saves and reloads custom nav order and visibility", () => {
      const custom: NavItemConfig[] = [
        { id: "timer", label: "TIMER", visible: true },
        { id: "tasks", label: "TASKS", visible: false },
        { id: "home", label: "HOME", visible: true },
        { id: "chat", label: "AI CHAT", visible: true },
        { id: "calendar", label: "CALENDAR", visible: true },
        { id: "goals", label: "GOALS", visible: true },
        { id: "notes", label: "NOTES", visible: true },
        { id: "action_plans", label: "ACTION PLANS", visible: true },
        { id: "kanban", label: "KANBAN", visible: true },
      ];

      saveNavConfig(custom);
      const loaded = loadNavConfig();
      expect(loaded).toEqual(custom);
    });

    it("fills missing items and handles corrupted localStorage", () => {
      // Partial list saved
      localStorage.setItem(
        "focushud_nav_config",
        JSON.stringify([{ id: "kanban", label: "KANBAN", visible: false }])
      );
      const loaded = loadNavConfig();
      expect(loaded[0]).toEqual({ id: "kanban", label: "KANBAN", visible: false });
      expect(loaded.length).toBe(DEFAULT_NAV_CONFIG.length);

      // Corrupted JSON
      localStorage.setItem("focushud_nav_config", "{CORRUPT_JSON");
      expect(loadNavConfig()).toEqual(DEFAULT_NAV_CONFIG);
    });

    it("resets nav config to defaults", () => {
      const custom: NavItemConfig[] = [
        { id: "kanban", label: "KANBAN", visible: false },
        { id: "home", label: "HOME", visible: true },
        { id: "chat", label: "AI CHAT", visible: true },
        { id: "calendar", label: "CALENDAR", visible: true },
        { id: "goals", label: "GOALS", visible: true },
        { id: "tasks", label: "TASKS", visible: true },
        { id: "action_plans", label: "ACTION PLANS", visible: true },
        { id: "timer", label: "TIMER", visible: true },
      ];
      saveNavConfig(custom);

      const reset = resetNavConfig();
      expect(reset).toEqual(DEFAULT_NAV_CONFIG);
      expect(loadNavConfig()).toEqual(DEFAULT_NAV_CONFIG);
    });
  });

  describe("max pane width limits", () => {
    it("returns default max widths when nothing is stored", () => {
      expect(getMaxLeftWidth()).toBe(DEFAULT_MAX_LEFT_WIDTH);
      expect(getMaxRightWidth()).toBe(DEFAULT_MAX_RIGHT_WIDTH);
    });

    it("sets and gets custom max widths clamped within bounds [280, 800]", () => {
      setMaxLeftWidth(600);
      setMaxRightWidth(750);
      expect(getMaxLeftWidth()).toBe(600);
      expect(getMaxRightWidth()).toBe(750);

      // Below lower bound
      setMaxLeftWidth(150);
      expect(getMaxLeftWidth()).toBe(MIN_PANE_MAX_WIDTH);

      // Above upper bound
      setMaxRightWidth(1200);
      expect(getMaxRightWidth()).toBe(MAX_PANE_MAX_WIDTH);
    });

    it("applies max pane widths and broadcasts action", () => {
      applyMaxPaneWidths(550, 650);

      expect(getMaxLeftWidth()).toBe(550);
      expect(getMaxRightWidth()).toBe(650);

      const raw = localStorage.getItem("focushud_last_layout_action");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.action).toEqual({
        type: "SET_MAX_WIDTHS",
        maxLeftWidth: 550,
        maxRightWidth: 650,
      });
    });
  });

  describe("notes storage", () => {
    it("returns default notes when localStorage is empty", () => {
      const notes = loadNotes();
      expect(notes).toEqual(DEFAULT_NOTES);
    });

    it("saves and reloads custom notes from localStorage", () => {
      const customNotes = [
        {
          id: "n_custom_1",
          title: "Test Note",
          content: "Test Content",
          isPinned: true,
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];
      saveNotes(customNotes);
      const loaded = loadNotes();
      expect(loaded).toEqual(customNotes);
    });
  });
});
