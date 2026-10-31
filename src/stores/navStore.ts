/**
 * Navigation Store for FocusHUD
 * Manages active navigation tabs, custom tab order/visibility, and cross-window sync.
 */

import { NavViewId, NavItemConfig } from "../types/hud";

export const NAV_CHANNEL_NAME = "focushud_nav_channel";
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

type BroadcastLayoutActionFn = (action: { type: "NAV_CONFIG_CHANGE"; config: NavItemConfig[] }) => void;
let broadcastLayoutActionDelegate: BroadcastLayoutActionFn | null = null;

export const setNavBroadcastDelegate = (fn: BroadcastLayoutActionFn) => {
  broadcastLayoutActionDelegate = fn;
};

export const saveNavConfig = (config: NavItemConfig[]) => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(config));
  if (broadcastLayoutActionDelegate) {
    broadcastLayoutActionDelegate({ type: "NAV_CONFIG_CHANGE", config });
  }
};

export const resetNavConfig = (): NavItemConfig[] => {
  localStorage.setItem("focushud_nav_config", JSON.stringify(DEFAULT_NAV_CONFIG));
  if (broadcastLayoutActionDelegate) {
    broadcastLayoutActionDelegate({ type: "NAV_CONFIG_CHANGE", config: DEFAULT_NAV_CONFIG });
  }
  return DEFAULT_NAV_CONFIG;
};

