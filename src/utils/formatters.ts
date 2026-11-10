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
