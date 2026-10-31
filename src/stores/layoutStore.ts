import { GoalNode, TaskItem, ActionPlanNode, CalendarEvent, NavViewId, NavItemConfig, NoteItem } from "../types/hud";
import { isTauriEnvironment, syncGoals, syncTasks, syncActionPlans, syncNotes, syncCalendarEvents } from "../services/dbService";
import { treeToGoalsFlat, treeToTasksFlat, treeToActionPlansFlat, appEventsToDb } from "../services/dbAdapters";

export const getTodayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
export const DEFAULT_GOALS: GoalNode[] = [
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
  if (isTauriEnvironment()) {
    syncGoals(treeToGoalsFlat(goals)).catch(() => {});
  }
};

// Initial Tasks
export const DEFAULT_TASKS: TaskItem[] = [
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
    dueDate: getTodayString(),
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
    dueDate: getTodayString(),
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
  if (isTauriEnvironment()) {
    syncTasks(treeToTasksFlat(tasks)).catch(() => {});
  }
};

// Initial Action Plans
export const DEFAULT_ACTION_PLANS: ActionPlanNode[] = [
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
  if (isTauriEnvironment()) {
    syncActionPlans(treeToActionPlansFlat(plans)).catch(() => {});
  }
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
  if (isTauriEnvironment()) {
    syncCalendarEvents(appEventsToDb(events)).catch(() => {});
  }
};

// Remembered expanded widths for left and right panes (used when expanding from collapsed mode)
// Initial Notes
export const DEFAULT_NOTES: NoteItem[] = [
  {
    id: "note_scratchpad_welcome",
    title: "SCRATCHPAD & QUICK NOTES",
    content: "# Welcome to FocusHUD Notes\n\nFast, accessible notepad directly within your HUD overlay.\n\n- [ ] Review daily priorities\n- [ ] Capture thoughts without switching context\n\n### Keyboard Shortcuts\n- **Ctrl+N**: Create a new note\n- **Ctrl+F**: Search notes\n- **Ctrl+Delete**: Delete selected note\n\nNotes auto-save as you type and synchronize seamlessly across docks.",
    isPinned: true,
    sortOrder: 0,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
];

export const loadNotes = (): NoteItem[] => {
  const raw = localStorage.getItem("focushud_notes");
  if (!raw) return DEFAULT_NOTES;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NOTES;
  }
};

export const saveNotes = (notes: NoteItem[]) => {
  localStorage.setItem("focushud_notes", JSON.stringify(notes));
  if (isTauriEnvironment()) {
    try {
      const res = syncNotes(notes);
      if (res && typeof (res as Promise<boolean>).catch === "function") {
        (res as Promise<boolean>).catch(() => {});
      }
    } catch {}
  }
};

export const DEFAULT_LEFT_WIDTH = 360;
export const DEFAULT_RIGHT_WIDTH = 280;

export const getRememberedLeftWidth = (): number => {
  const saved = localStorage.getItem("hud_left_remembered_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= 120) return val;
  }
  const current = localStorage.getItem("hud_left_width");
  if (current) {
    const val = Math.round(Number(current));
    if (!isNaN(val) && val >= 120) return val;
  }
  return DEFAULT_LEFT_WIDTH;
};

export const setRememberedLeftWidth = (width: number) => {
  if (width >= 120) {
    localStorage.setItem("hud_left_remembered_width", String(Math.round(width)));
  }
};

export const getRememberedRightWidth = (): number => {
  const saved = localStorage.getItem("hud_right_remembered_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= 120) return val;
  }
  const current = localStorage.getItem("hud_right_width");
  if (current) {
    const val = Math.round(Number(current));
    if (!isNaN(val) && val >= 120) return val;
  }
  return DEFAULT_RIGHT_WIDTH;
};

export const setRememberedRightWidth = (width: number) => {
  if (width >= 120) {
    localStorage.setItem("hud_right_remembered_width", String(Math.round(width)));
  }
};

// Max Draggable Width Limits (Configurable in Settings)
export const MIN_PANE_MAX_WIDTH = 280;
export const MAX_PANE_MAX_WIDTH = 800;
export const DEFAULT_MAX_LEFT_WIDTH = 500;
export const DEFAULT_MAX_RIGHT_WIDTH = 500;

export const getMaxLeftWidth = (): number => {
  const saved = localStorage.getItem("hud_left_max_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= MIN_PANE_MAX_WIDTH && val <= MAX_PANE_MAX_WIDTH) return val;
  }
  return DEFAULT_MAX_LEFT_WIDTH;
};

export const setMaxLeftWidth = (width: number) => {
  const clamped = Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, Math.round(width)));
  localStorage.setItem("hud_left_max_width", String(clamped));
};

export const getMaxRightWidth = (): number => {
  const saved = localStorage.getItem("hud_right_max_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= MIN_PANE_MAX_WIDTH && val <= MAX_PANE_MAX_WIDTH) return val;
  }
  return DEFAULT_MAX_RIGHT_WIDTH;
};

export const setMaxRightWidth = (width: number) => {
  const clamped = Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, Math.round(width)));
  localStorage.setItem("hud_right_max_width", String(clamped));
};

// Cross-window layout command synchronization
const LAYOUT_CHANNEL_NAME = "focushud_layout_channel";
const layoutChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(LAYOUT_CHANNEL_NAME) : null;

export type LayoutAction = (
  | { type: "MAXIMIZE_PANES" }
  | { type: "SET_PANES_WIDTH"; leftWidth: number; rightWidth: number }
  | { type: "SET_LEFT_WIDTH"; width: number }
  | { type: "SET_RIGHT_WIDTH"; width: number }
  | { type: "NAV_CONFIG_CHANGE"; config: NavItemConfig[] }
  | { type: "SET_MAX_WIDTHS"; maxLeftWidth: number; maxRightWidth: number }
) & { sender?: string };

export const broadcastLayoutAction = (action: LayoutAction) => {
  if (layoutChannel) {
    layoutChannel.postMessage(action);
  }
  try {
    localStorage.setItem("focushud_last_layout_action", JSON.stringify({ action, timestamp: Date.now() }));
  } catch {}
};

export const subscribeLayoutAction = (callback: (action: LayoutAction) => void): (() => void) => {
  const handler = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      callback(e.data as LayoutAction);
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === "focushud_last_layout_action" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.action) callback(parsed.action);
      } catch {}
    }
  };

  if (layoutChannel) {
    layoutChannel.addEventListener("message", handler);
  }
  window.addEventListener("storage", storageHandler);

  return () => {
    if (layoutChannel) {
      layoutChannel.removeEventListener("message", handler);
    }
    window.removeEventListener("storage", storageHandler);
  };
};

// Default Navigation Configuration & Views
export const DEFAULT_NAV_CONFIG: NavItemConfig[] = [
  { id: "home", label: "HOME", visible: true },
  { id: "chat", label: "AI CHAT", visible: true },
  { id: "calendar", label: "CALENDAR", visible: true },
  { id: "goals", label: "GOALS", visible: true },
  { id: "tasks", label: "TASKS", visible: true },
  { id: "notes", label: "NOTES", visible: true },
  { id: "action_plans", label: "ACTION PLANS", visible: true },
  { id: "timer", label: "TIMER", visible: true },
  { id: "kanban", label: "KANBAN", visible: true },
];

export const loadNavConfig = (): NavItemConfig[] => {
  const raw = localStorage.getItem("focushud_nav_config");
  if (!raw) return DEFAULT_NAV_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_NAV_CONFIG;

    const validIds = new Set(DEFAULT_NAV_CONFIG.map((d) => d.id));
    const result: NavItemConfig[] = [];
    const seen = new Set<string>();

    for (const item of parsed) {
      if (item && validIds.has(item.id) && !seen.has(item.id)) {
        seen.add(item.id);
        const defaultMatch = DEFAULT_NAV_CONFIG.find((d) => d.id === item.id);
        result.push({
          id: item.id,
          label: item.label || defaultMatch?.label || item.id.toUpperCase(),
          visible: typeof item.visible === "boolean" ? item.visible : true,
        });
      }
    }

    for (const def of DEFAULT_NAV_CONFIG) {
      if (!seen.has(def.id)) {
        result.push({ ...def });
      }
    }

    return result;
  } catch {
    return DEFAULT_NAV_CONFIG;
  }
};

export const saveNavConfig = (config: NavItemConfig[]) => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(config));
  broadcastLayoutAction({ type: "NAV_CONFIG_CHANGE", config });
};

export const resetNavConfig = (): NavItemConfig[] => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(DEFAULT_NAV_CONFIG));
  broadcastLayoutAction({ type: "NAV_CONFIG_CHANGE", config: DEFAULT_NAV_CONFIG });
  return DEFAULT_NAV_CONFIG;
};

export const applyMaxPaneWidths = (maxLeft: number, maxRight: number) => {
  setMaxLeftWidth(maxLeft);
  setMaxRightWidth(maxRight);
  broadcastLayoutAction({
    type: "SET_MAX_WIDTHS",
    maxLeftWidth: getMaxLeftWidth(),
    maxRightWidth: getMaxRightWidth(),
  });
};
