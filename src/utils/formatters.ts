/**
 * Pure date & time formatting helper utilities for FocusHUD
 */

/**
 * Formats a Date into standard local YYYY-MM-DD date string
 */
export const formatDateToISO = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Returns today's date formatted as YYYY-MM-DD (alias for formatDateToISO)
 */
export const getTodayDateString = (): string => {
  return formatDateToISO();
};

/**
 * Formats total seconds into MM:SS display format (e.g. 1500 -> "25:00", 65 -> "01:05")
 */
export const formatMinutesSeconds = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Backwards-compatible alias for formatMinutesSeconds
 */
export const formatMinutesAndSeconds = formatMinutesSeconds;

/**
 * Formats minutes into human-readable hours and minutes (e.g. 135 -> "2H 15M")
 */
export const formatDurationHM = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}H ${m}M`;
};

/**
 * Formats milliseconds into a clean, human-friendly tactical duration string:
 * - < 1000ms: e.g. "45ms", "320ms"
 * - 1000ms - 60000ms: e.g. "1.2s", "14.5s"
 * - >= 60000ms: e.g. "1m 15s"
 */
export const formatDurationMs = (ms?: number): string => {
  if (ms === undefined || ms === null || isNaN(ms) || ms <= 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}m ${s}s`;
};
