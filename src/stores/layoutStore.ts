/**
 * Layout Store for FocusHUD
 * Manages dual-pane HUD layout widths, constraints, snapping, and cross-window commands.
 */

import {
  NavItemConfig,
  NavViewId,
  NavRailSide,
  WindowModeState,
} from "../types/hud";

// Re-export entity store for full backwards compatibility
export * from "./entityStore";

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

export const getNavItemRail = (item: NavItemConfig): NavRailSide => {
  if (item.rail === "left" || item.rail === "right") {
    return item.rail;
  }
  return item.id === "chat" ? "right" : "left";
};

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
        const entry: NavItemConfig = {
          id: item.id,
          label: item.label || defaultMatch?.label || item.id.toUpperCase(),
          visible: typeof item.visible === "boolean" ? item.visible : true,
        };
        if (item.rail === "left" || item.rail === "right") {
          entry.rail = item.rail;
        }
        result.push(entry);
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

export const getInitialNav = (): NavViewId => {
  const saved = localStorage.getItem("focushud_active_nav");
  return (saved as NavViewId) || "home";
};

export const getInitialRightNav = (): NavViewId => {
  const saved = localStorage.getItem("focushud_active_right_nav");
  return (saved as NavViewId) || "chat";
};

export const DEFAULT_LEFT_WIDTH = 360;
export const DEFAULT_RIGHT_WIDTH = 280;

export const getRememberPaneWidths = (): boolean => {
  const saved = localStorage.getItem("hud_remember_pane_widths");
  return saved !== null ? saved === "true" : true;
};

export const setRememberPaneWidths = (remember: boolean) => {
  localStorage.setItem("hud_remember_pane_widths", String(remember));
};

export const getCustomDefaultLeftWidth = (): number => {
  const saved = localStorage.getItem("hud_custom_default_left_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= 120) return val;
  }
  return DEFAULT_LEFT_WIDTH;
};

export const setCustomDefaultLeftWidth = (width: number) => {
  localStorage.setItem("hud_custom_default_left_width", String(Math.round(width)));
};

export const getCustomDefaultRightWidth = (): number => {
  const saved = localStorage.getItem("hud_custom_default_right_width");
  if (saved) {
    const val = Math.round(Number(saved));
    if (!isNaN(val) && val >= 120) return val;
  }
  return DEFAULT_RIGHT_WIDTH;
};

export const setCustomDefaultRightWidth = (width: number) => {
  localStorage.setItem("hud_custom_default_right_width", String(Math.round(width)));
};

export const getPanesReserveZones = (): boolean => {
  const saved = localStorage.getItem("hud_panes_reserve_zones");
  return saved !== null ? saved === "true" : true;
};

export const setPanesReserveZones = (reserve: boolean) => {
  localStorage.setItem("hud_panes_reserve_zones", String(reserve));
  broadcastLayoutAction({ type: "SET_PANES_RESERVE_ZONES", reserve });
};

export const getRememberedLeftWidth = (): number => {
  if (!getRememberPaneWidths()) {
    return getCustomDefaultLeftWidth();
  }
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
  if (!getRememberPaneWidths()) {
    return getCustomDefaultRightWidth();
  }
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
  | { type: "MAXIMIZE_APP" }
  | { type: "RESTORE_APP"; leftWidth: number; rightWidth: number }
  | {
      type: "SET_WINDOW_STATE";
      state: WindowModeState;
      priorFullscreenState?: WindowModeState;
      leftWidth?: number;
      rightWidth?: number;
    }
  | { type: "SET_PANES_WIDTH"; leftWidth: number; rightWidth: number }
  | { type: "SET_LEFT_WIDTH"; width: number }
  | { type: "SET_RIGHT_WIDTH"; width: number }
  | { type: "NAV_CONFIG_CHANGE"; config: NavItemConfig[] }
  | { type: "SET_MAX_WIDTHS"; maxLeftWidth: number; maxRightWidth: number }
  | { type: "SET_PANES_RESERVE_ZONES"; reserve: boolean }
  | { type: "SET_ACTIVE_NAV"; nav: string }
  | { type: "SET_ACTIVE_RIGHT_NAV"; nav: string }
) & { sender?: string };

export const broadcastLayoutAction = (action: LayoutAction) => {
  if (layoutChannel) {
    layoutChannel.postMessage(action);
  }
  try {
    localStorage.setItem("focushud_last_layout_action", JSON.stringify({ action, timestamp: Date.now() }));
  } catch {}
};

export const saveNavConfig = (config: NavItemConfig[]) => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(config));
  broadcastLayoutAction({ type: "NAV_CONFIG_CHANGE", config });
};

export const reorderNavConfig = (
  config: NavItemConfig[],
  sourceId: NavViewId,
  targetId?: NavViewId | null,
  targetRail?: NavRailSide
): NavItemConfig[] => {
  const sourceIndex = config.findIndex((item) => item.id === sourceId);
  if (sourceIndex === -1) return config;

  const next = [...config];
  const [moved] = next.splice(sourceIndex, 1);
  const updatedItem: NavItemConfig = targetRail ? { ...moved, rail: targetRail } : { ...moved };

  if (targetId && targetId !== sourceId) {
    const targetIndex = next.findIndex((item) => item.id === targetId);
    if (targetIndex !== -1) {
      next.splice(targetIndex, 0, updatedItem);
    } else {
      next.push(updatedItem);
    }
  } else {
    next.push(updatedItem);
  }

  saveNavConfig(next);
  return next;
};

export const resetNavConfig = (): NavItemConfig[] => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(DEFAULT_NAV_CONFIG));
  broadcastLayoutAction({ type: "NAV_CONFIG_CHANGE", config: DEFAULT_NAV_CONFIG });
  return DEFAULT_NAV_CONFIG;
};

export const broadcastNavChange = (nav: NavViewId) => {
  localStorage.setItem("focushud_active_nav", nav);
  broadcastLayoutAction({ type: "SET_ACTIVE_NAV", nav });
};

export const subscribeNavChange = (callback: (nav: NavViewId) => void): (() => void) => {
  return subscribeLayoutAction((action) => {
    if (action.type === "SET_ACTIVE_NAV" && action.nav) {
      callback(action.nav as NavViewId);
    }
  });
};

export const broadcastRightNavChange = (nav: NavViewId) => {
  localStorage.setItem("focushud_active_right_nav", nav);
  broadcastLayoutAction({ type: "SET_ACTIVE_RIGHT_NAV", nav });
};

export const subscribeRightNavChange = (callback: (nav: NavViewId) => void): (() => void) => {
  return subscribeLayoutAction((action) => {
    if (action.type === "SET_ACTIVE_RIGHT_NAV" && action.nav) {
      callback(action.nav as NavViewId);
    }
  });
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

export const applyMaxPaneWidths = (maxLeft: number, maxRight: number) => {
  setMaxLeftWidth(maxLeft);
  setMaxRightWidth(maxRight);
  broadcastLayoutAction({
    type: "SET_MAX_WIDTHS",
    maxLeftWidth: getMaxLeftWidth(),
    maxRightWidth: getMaxRightWidth(),
  });
};
