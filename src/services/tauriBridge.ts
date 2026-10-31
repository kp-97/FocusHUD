/**
 * Tauri Bridge Service for Windows Desktop Work Area Docking
 * Communicates with the Rust backend to reserve screen space
 * and snap open desktop programs into the middle column.
 */

import type { SystemDiagnostics } from "../types/diagnostics";
import { invokeTauri, invokeTauriBool } from "./ipc";

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
