/**
 * Tauri Bridge for Windows Desktop Work Area Docking
 * Communicates with the Rust backend to reserve screen space
 * and snap open desktop programs into the middle column.
 */

export async function setDockDragMode(side: "left" | "right", active: boolean) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_dock_drag_mode", { side, active });
    return true;
  } catch (err) {
    return false;
  }
}

export async function setDockPopoutMode(side: "left" | "right", active: boolean) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_dock_popout_mode", { side, active });
    return true;
  } catch (err) {
    return false;
  }
}

export async function updateDockSizes(
  leftWidth?: number | null,
  rightWidth?: number | null,
  commit: boolean = false
) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("update_dock_sizes", {
      leftWidth: leftWidth ?? null,
      rightWidth: rightWidth ?? null,
      commit,
    });
    return true;
  } catch (err) {
    // In web preview mode, invoke is simulated gracefully
    return false;
  }
}

export async function restoreWorkArea() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("restore_work_area");
    return true;
  } catch (err) {
    return false;
  }
}

export async function minimizeToTray() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("minimize_to_tray");
    return true;
  } catch (err) {
    return false;
  }
}

export async function getScreenMetrics() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const metrics = await invoke<{
      screen_width: number;
      screen_height: number;
      original_left: number;
      original_top: number;
      original_right: number;
      original_bottom: number;
    }>("get_screen_metrics");
    return metrics;
  } catch (err) {
    return null;
  }
}

export async function exitApp() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("exit_app");
    return true;
  } catch (err) {
    return false;
  }
}

export interface SystemDiagnostics {
  cpu_usage: number;
  cpu_name: string;
  cpu_cores: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  ram_usage: number;
  gpu_name?: string | null;
  gpu_usage?: number | null;
  vram_used_bytes?: number | null;
  vram_total_bytes?: number | null;
  vram_usage?: number | null;
  gpu_temp?: number | null;
}

export async function getSystemDiagnostics(): Promise<SystemDiagnostics | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<SystemDiagnostics>("get_system_diagnostics");
  } catch (err) {
    return null;
  }
}

