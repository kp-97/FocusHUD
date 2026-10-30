import { isTauriEnvironment } from "./dbService";

export interface AppUpdateInfo {
  available: boolean;
  currentVersion: string;
  version?: string;
  date?: string;
  body?: string;
  rawUpdate?: any;
}

export type DownloadProgressCallback = (
  percent: number,
  downloadedBytes: number,
  totalBytes: number
) => void;

const SNOOZE_KEY_VERSION = "focushud_snoozed_update_version";
const SNOOZE_KEY_UNTIL = "focushud_snoozed_update_until";

/**
 * Checks if a specific version has been snoozed and the snooze window is still active.
 */
export function isUpdateSnoozed(version: string): boolean {
  try {
    const snoozedVersion = localStorage.getItem(SNOOZE_KEY_VERSION);
    const snoozedUntilStr = localStorage.getItem(SNOOZE_KEY_UNTIL);
    if (!snoozedUntilStr || snoozedVersion !== version) return false;

    const snoozedUntil = Number(snoozedUntilStr);
    return Date.now() < snoozedUntil;
  } catch {
    return false;
  }
}

/**
 * Snoozes reminders for a specific version for a given duration (default 48 hours).
 */
export function snoozeUpdate(version: string, hours: number = 48): void {
  try {
    localStorage.setItem(SNOOZE_KEY_VERSION, version);
    localStorage.setItem(
      SNOOZE_KEY_UNTIL,
      String(Date.now() + hours * 60 * 60 * 1000)
    );
  } catch {
    // Graceful fallback
  }
}

/**
 * Checks whether an update is available via the Tauri updater plugin.
 * Respects snoozed versions unless `force` is set to true.
 */
export async function checkForUpdates(force = false): Promise<AppUpdateInfo> {
  if (!isTauriEnvironment()) {
    return {
      available: false,
      currentVersion: "0.2.0 (web preview)",
    };
  }

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (!update || !update.available) {
      return {
        available: false,
        currentVersion: update?.currentVersion || "0.2.0",
      };
    }

    if (!force && isUpdateSnoozed(update.version)) {
      return {
        available: false,
        currentVersion: update.currentVersion,
      };
    }

    return {
      available: true,
      currentVersion: update.currentVersion,
      version: update.version,
      date: update.date,
      body: update.body || "",
      rawUpdate: update,
    };
  } catch (error) {
    console.warn("Failed to check for updates:", error);
    return {
      available: false,
      currentVersion: "0.2.0",
    };
  }
}

/**
 * Downloads and installs the update with optional progress callback.
 */
export async function downloadAndInstallUpdate(
  rawUpdate: any,
  onProgress?: DownloadProgressCallback
): Promise<boolean> {
  if (!rawUpdate || typeof rawUpdate.downloadAndInstall !== "function") {
    throw new Error("Invalid update object supplied");
  }

  let totalBytes = 0;
  let downloadedBytes = 0;

  await rawUpdate.downloadAndInstall((event: any) => {
    if (event.event === "Started") {
      totalBytes = event.data?.contentLength || 0;
      if (onProgress) onProgress(0, 0, totalBytes);
    } else if (event.event === "Progress") {
      downloadedBytes += event.data?.chunkLength || 0;
      const percent =
        totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
      if (onProgress) onProgress(percent, downloadedBytes, totalBytes);
    } else if (event.event === "Finished") {
      if (onProgress) onProgress(100, totalBytes, totalBytes);
    }
  });

  return true;
}

/**
 * Relaunches FocusHUD after an update has finished installing.
 */
export async function relaunchApp(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (error) {
    console.error("Failed to relaunch application:", error);
  }
}

