/**
 * Tauri Bridge Service for Windows Desktop Work Area Docking
 * Communicates with the Rust backend to reserve screen space
 * and snap open desktop programs into the middle column.
 */

import type { SystemDiagnostics } from "../types/diagnostics";
import type { WindowModeState } from "../types/hud";
import { invokeTauri, invokeTauriBool, isTauriEnvironment } from "./ipc";

export type { SystemDiagnostics };

export async function setDockDragMode(side: "left" | "right", active: boolean): Promise<boolean> {
  return invokeTauriBool("set_dock_drag_mode", { side, active });
}

export async function setDockPopoutMode(side: "left" | "right", active: boolean): Promise<boolean> {
  return invokeTauriBool("set_dock_popout_mode", { side, active });
}

export async function updateDockSizes(
  leftWidth?: number | null,
  rightWidth?: number | null,
  commit: boolean = false
): Promise<boolean> {
  return invokeTauriBool("update_dock_sizes", {
    leftWidth: leftWidth ?? null,
    rightWidth: rightWidth ?? null,
    commit,
  });
}

export async function restoreWorkArea(): Promise<boolean> {
  return invokeTauriBool("restore_work_area");
}

export async function minimizeToTray(): Promise<boolean> {
  await restoreWorkArea();
  return invokeTauriBool("minimize_to_tray");
}

export async function getScreenMetrics() {
  return invokeTauri<{
    screen_width: number;
    screen_height: number;
    original_left: number;
    original_top: number;
    original_right: number;
    original_bottom: number;
  }>("get_screen_metrics");
}

export async function exitApp(): Promise<boolean> {
  return invokeTauriBool("exit_app");
}

export async function getSystemDiagnostics(): Promise<SystemDiagnostics | null> {
  return invokeTauri<SystemDiagnostics>("get_system_diagnostics");
}

export async function openSettingsWindow(): Promise<boolean> {
  return invokeTauriBool("open_settings_window");
}

export async function closeSettingsWindow(): Promise<boolean> {
  return invokeTauriBool("close_settings_window");
}

/**
 * Initiates native OS window dragging for the current window.
 * Used for custom titlebars / draggable headers in standalone windows.
 */
export async function startDraggingWindow(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const ok = await invokeTauriBool("start_dragging_window");
    if (ok) return true;

    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
    return true;
  } catch (err) {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
      console.warn("[Tauri Bridge] Failed to start window dragging:", err);
    }
    return false;
  }
}

/**
 * Moves the calling window by the specified physical pixel deltas.
 * Direct Win32 fast path for smooth borderless window dragging on Windows.
 */
export async function moveWindowByDelta(deltaX: number, deltaY: number): Promise<boolean> {
  return invokeTauriBool("move_window_by_delta", { deltaX, deltaY });
}

export async function startResizeWindow(edge: string): Promise<boolean> {
  return invokeTauriBool("start_resize_window", { edge });
}

export async function resizeWindowByDelta(
  edge: string,
  deltaX: number,
  deltaY: number
): Promise<boolean> {
  return invokeTauriBool("resize_window_by_delta", { edge, deltaX, deltaY });
}

export async function setFullscreenMode(fullscreen: boolean): Promise<boolean> {
  return invokeTauriBool("set_fullscreen_mode", { fullscreen });
}

export async function setWindowState(state: WindowModeState): Promise<boolean> {
  return invokeTauriBool("set_window_state", { state });
}

export async function getWindowState(): Promise<WindowModeState | null> {
  return invokeTauri<WindowModeState>("get_window_state");
}

export async function setPanesReserveZonesMode(reserve: boolean): Promise<boolean> {
  return invokeTauriBool("set_panes_reserve_zones", { reserve });
}

export interface LogicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapLayoutTemplate =
  | "single_full"
  | "split50_50"
  | "split65_35"
  | "split35_65"
  | "left1_right2"
  | "grid2x2"
  | "cols3_equal"
  | "cols3_wide_center";

export interface TopBarLayoutGroup {
  template: SnapLayoutTemplate;
  label: string;
  rect: LogicalRect;
  zones: LogicalRect[];
}

export interface TopBarGeometry {
  pill_rect: LogicalRect;
  pill_trigger_rect: LogicalRect;
  bar_rect: LogicalRect;
  groups: TopBarLayoutGroup[];
}

export interface SnapCandidateWindow {
  hwnd: number;
  title: string;
  app_name: string;
  exe_name: string;
}

export type SnapOverlayMode = "hidden" | "pill" | "expanded" | "assist";

export interface SnapOverlayState {
  mode: SnapOverlayMode;
  work_width_logical: number;
  work_height_logical: number;
  top_bar: TopBarGeometry;
  hovered_template: SnapLayoutTemplate | null;
  hovered_zone_index: number | null;
  preview_rect: LogicalRect | null;
  active_template: SnapLayoutTemplate | null;
  assist_zone_index: number | null;
  assist_zone_rect: LogicalRect | null;
  assist_all_zone_rects: LogicalRect[];
  assist_filled_zones: boolean[];
  assist_candidates: SnapCandidateWindow[];
}

export async function getSnapOverlayState(): Promise<SnapOverlayState | null> {
  return invokeTauri<SnapOverlayState>("get_snap_overlay_state");
}

export async function selectSnapAssistWindow(
  hwnd: number,
  zoneIndex: number
): Promise<SnapOverlayState | null> {
  return invokeTauri<SnapOverlayState>("select_snap_assist_window", {
    hwnd,
    zoneIndex,
  });
}

export async function skipSnapAssistZone(
  zoneIndex: number
): Promise<SnapOverlayState | null> {
  return invokeTauri<SnapOverlayState>("skip_snap_assist_zone", {
    zoneIndex,
  });
}

export async function dismissSnapAssist(): Promise<boolean> {
  return invokeTauriBool("dismiss_snap_assist");
}
