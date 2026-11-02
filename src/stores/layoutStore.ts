/**
 * Layout Store for FocusHUD
 * Manages dual-pane HUD layout widths, constraints, snapping, and cross-window commands.
 */

import { NavItemConfig } from "../types/hud";
import { setNavBroadcastDelegate } from "./navStore";

// Re-export navigation and entity stores for full backwards compatibility
export * from "./navStore";
export * from "./entityStore";

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
  | { type: "SET_PANES_WIDTH"; leftWidth: number; rightWidth: number }
  | { type: "SET_LEFT_WIDTH"; width: number }
  | { type: "SET_RIGHT_WIDTH"; width: number }
  | { type: "NAV_CONFIG_CHANGE"; config: NavItemConfig[] }
  | { type: "SET_MAX_WIDTHS"; maxLeftWidth: number; maxRightWidth: number }
  | { type: "SET_ACTIVE_NAV"; nav: string }
) & { sender?: string };

export const broadcastLayoutAction = (action: LayoutAction) => {
  if (layoutChannel) {
    layoutChannel.postMessage(action);
  }
  try {
    localStorage.setItem("focushud_last_layout_action", JSON.stringify({ action, timestamp: Date.now() }));
  } catch {}
};

// Connect navigation store changes to broadcast layout channel
setNavBroadcastDelegate((action) => {
  broadcastLayoutAction(action);
});

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
