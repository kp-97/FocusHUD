/**
 * Pure date & time formatting helper utilities
 */

/**
 * Formats a Date into standard ISO YYYY-MM-DD date string
 */
export const formatDateToISO = (date: Date = new Date()): string => {
  return date.toISOString().split("T")[0];
};

/**
 * Formats total seconds into MM:SS display format
 */
export const formatMinutesAndSeconds = (totalSeconds: number): string => {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Formats minutes into human-readable hours and minutes (e.g. 2H 15M)
 */
export const formatDurationHM = (minutes: number): string => {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.floor(Math.max(0, minutes) % 60);
  return `${h}H ${m}M`;
};
