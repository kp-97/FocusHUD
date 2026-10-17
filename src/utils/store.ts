import { GoalNode, TaskItem, ActionPlanNode, CalendarEvent, NavViewId } from "../types/hud";

export const getTodayString = (): string => {
  return new Date().toISOString().split("T")[0];
};

const NAV_CHANNEL_NAME = "focushud_nav_channel";
const navChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(NAV_CHANNEL_NAME) : null;

// Synchronize active navigation across windows
export const broadcastNavChange = (nav: NavViewId) => {
  localStorage.setItem("focushud_active_nav", nav);
  if (navChannel) {
    navChannel.postMessage({ type: "NAV_CHANGE", nav });
  }
};

export const subscribeNavChange = (callback: (nav: NavViewId) => void): (() => void) => {
  const handler = (e: MessageEvent) => {
    if (e.data && e.data.type === "NAV_CHANGE" && e.data.nav) {
      callback(e.data.nav);
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === "focushud_active_nav" && e.newValue) {
      callback(e.newValue as NavViewId);
    }
  };

  if (navChannel) {
    navChannel.addEventListener("message", handler);
  }
  window.addEventListener("storage", storageHandler);

  return () => {
    if (navChannel) {
      navChannel.removeEventListener("message", handler);
    }
    window.removeEventListener("storage", storageHandler);
  };
};

export const getInitialNav = (): NavViewId => {
  const saved = localStorage.getItem("focushud_active_nav");
  return (saved as NavViewId) || "home";
};

// Initial Goals
const DEFAULT_GOALS: GoalNode[] = [
  {
    id: "g1",
    title: "LAUNCH FOCUS-HUD V2",
    completed: false,
    children: [
      {
        id: "g1-1",
        title: "MULTI-DOCK WINDOW CLIPPING",
        completed: true,
        completedAt: getTodayString(),
        children: [
          { id: "g1-1-1", title: "STATIONARY CANVAS HWND", completed: true, completedAt: getTodayString() },
          { id: "g1-1-2", title: "SETWINDOWRGN BLIT ENGINE", completed: true, completedAt: getTodayString() },
        ],
      },
      {
        id: "g1-2",
        title: "SCI-FI HUD INTERACTIVE VIEWS",
        completed: false,
        children: [
          { id: "g1-2-1", title: "3D TREE HIERARCHY ENGINE", completed: true, completedAt: getTodayString() },
          { id: "g1-2-2", title: "DUAL-SPLIT HOME VIEW", completed: false },
        ],
      },
    ],
  },
  {
    id: "g2",
    title: "INTEGRATE LOCAL LLM AGENT",
    completed: false,
    children: [
      { id: "g2-1", title: "STREAMING BUFFER PROTOCOL", completed: true, completedAt: getTodayString() },
      { id: "g2-2", title: "VOICE AGENT JARVIS INTEGRATION", completed: false },
    ],
  },
];

export const loadGoals = (): GoalNode[] => {
  const raw = localStorage.getItem("focushud_goals");
  if (!raw) return DEFAULT_GOALS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_GOALS;
  }
};

export const saveGoals = (goals: GoalNode[]) => {
  localStorage.setItem("focushud_goals", JSON.stringify(goals));
};

// Initial Tasks
const DEFAULT_TASKS: TaskItem[] = [
  {
    id: "t1",
    title: "VERIFY 120FPS DOCK RESIZE DRAG",
    completed: true,
    completedAt: getTodayString(),
    goalId: "g1",
    status: "done",
    subtasks: [
      { id: "t1-1", title: "TEST ZERO-HWND-RESIZE PIPELINE", completed: true, completedAt: getTodayString(), status: "done" },
    ],
  },
  {
    id: "t2",
    title: "IMPLEMENT 3D GOALS PROJECTION",
    completed: true,
    completedAt: getTodayString(),
    goalId: "g1",
    status: "done",
    subtasks: [
      { id: "t2-1", title: "3D CANVAS MATRIX ENGINE", completed: true, completedAt: getTodayString(), status: "done" },
      { id: "t2-2", title: "CYBERPUNK WIREFRAME GLOW", completed: true, completedAt: getTodayString(), status: "done" },
    ],
  },
  {
    id: "t3",
    title: "SPLIT HOME VIEW DUAL SLOTS",
    completed: false,
    goalId: "g1",
    status: "in_progress",
    subtasks: [
      { id: "t3-1", title: "TOP SLOT CUSTOM SELECTOR", completed: false, status: "todo" },
      { id: "t3-2", title: "BOTTOM SLOT CUSTOM SELECTOR", completed: false, status: "todo" },
    ],
  },
  {
    id: "t4",
    title: "CONFIGURE CALENDAR HORIZONTAL WEEK SCROLL",
    completed: false,
    goalId: null,
    status: "todo",
  },
  {
    id: "t5",
    title: "AUDIT NVML TELEMETRY EFFICIENCY",
    completed: false,
    goalId: null,
    status: "todo",
  },
];

export const loadTasks = (): TaskItem[] => {
  const raw = localStorage.getItem("focushud_tasks");
  if (!raw) return DEFAULT_TASKS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TASKS;
  }
};

export const saveTasks = (tasks: TaskItem[]) => {
  localStorage.setItem("focushud_tasks", JSON.stringify(tasks));
};

// Initial Action Plans
const DEFAULT_ACTION_PLANS: ActionPlanNode[] = [
  {
    id: "ap1",
    title: "PRODUCTIVITY WORKSPACE PIPELINE",
    completed: false,
    children: [
      {
        id: "ap1-1",
        title: "PHASE 1: DESKTOP WORK AREA SNAP",
        completed: true,
        completedAt: getTodayString(),
        children: [
          { id: "ap1-1-1", title: "SYSTEMPARAMETERSINFO HOOK", completed: true, completedAt: getTodayString() },
          { id: "ap1-1-2", title: "ZERO-GUTTER BOUNDARY CLIPPING", completed: true, completedAt: getTodayString() },
        ],
      },
      {
        id: "ap1-2",
        title: "PHASE 2: DUAL HUD TELEMETRY EXPANSION",
        completed: false,
        children: [
          { id: "ap1-2-1", title: "DIAGNOSTICS PINNED FOOTER", completed: true, completedAt: getTodayString() },
          { id: "ap1-2-2", title: "3D TREE HIERARCHY CANVAS", completed: false },
        ],
      },
      {
        id: "ap1-3",
        title: "PHASE 3: LOCAL LLM STREAMING DISPATCH",
        completed: false,
      },
    ],
  },
];

export const loadActionPlans = (): ActionPlanNode[] => {
  const raw = localStorage.getItem("focushud_action_plans");
  if (!raw) return DEFAULT_ACTION_PLANS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ACTION_PLANS;
  }
};

export const saveActionPlans = (plans: ActionPlanNode[]) => {
  localStorage.setItem("focushud_action_plans", JSON.stringify(plans));
};

// Initial Calendar Events
const DEFAULT_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "DEEP FOCUS BLOCK", date: getTodayString(), startTime: "09:00", endTime: "11:30", color: "#00e5ff" },
  { id: "e2", title: "SYSTEM ARCHITECTURE REVIEW", date: getTodayString(), startTime: "13:00", endTime: "14:00", color: "#ff9100" },
  { id: "e3", title: "AI MODEL BENCHMARKING", date: getTodayString(), startTime: "15:30", endTime: "17:00", color: "#00e676" },
];

export const loadEvents = (): CalendarEvent[] => {
  const raw = localStorage.getItem("focushud_events");
  if (!raw) return DEFAULT_EVENTS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EVENTS;
  }
};

export const saveEvents = (events: CalendarEvent[]) => {
  localStorage.setItem("focushud_events", JSON.stringify(events));
};
