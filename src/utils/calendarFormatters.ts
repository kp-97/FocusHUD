/**
 * Calendar formatting and date math utility functions
 * Following Google Calendar header and date specification
 */

export type CalendarMode = "day" | "week" | "month" | "year" | "schedule" | "4days";
export type CalendarDataType = "events" | "tasks";

export interface CalendarModeOption {
  id: CalendarMode;
  label: string;
  shortcutKey: string;
}

export const CALENDAR_MODES: CalendarModeOption[] = [
  { id: "day", label: "Day", shortcutKey: "D" },
  { id: "week", label: "Week", shortcutKey: "W" },
  { id: "month", label: "Month", shortcutKey: "M" },
  { id: "year", label: "Year", shortcutKey: "Y" },
  { id: "schedule", label: "Schedule", shortcutKey: "A" },
  { id: "4days", label: "4 days", shortcutKey: "X" },
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const DAYS_OF_WEEK_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Formats a 24-hour hour number (0..23) into 12-hour AM/PM label (e.g. 12 AM, 9 AM, 12 PM, 2 PM)
 */
export const formatHour12 = (hour24: number): string => {
  const normalized = Math.max(0, Math.min(23, hour24));
  const period = normalized >= 12 ? "PM" : "AM";
  const h12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${h12} ${period}`;
};

/**
 * Formats a 24-hour time string "HH:mm" into 12-hour "h:mm AM/PM" (e.g. "9:00 AM", "2:30 PM")
 */
export const formatTime12 = (time24?: string): string => {
  if (!time24) return "";
  const parts = time24.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  if (isNaN(h)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
};

/**
 * Converts a 12-hour string (e.g. "2:30 PM", "9:00 AM") or components to 24-hour "HH:mm"
 */
export const parse12To24 = (h12: number, minutes: number, period: "AM" | "PM"): string => {
  let h24 = h12 % 12;
  if (period === "PM") {
    h24 += 12;
  }
  return `${String(h24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/**
 * Returns ISO string YYYY-MM-DD using local year/month/date
 */
export const formatDateISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Finds the Monday date for the week containing `d`
 */
export const getMondayOfWeek = (d: Date): Date => {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = result.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
};

/**
 * Formats Day view header: `29 October 2026`
 */
export const formatDayHeader = (date: Date): string => {
  const day = date.getDate();
  const monthName = FULL_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${monthName} ${year}`;
};

/**
 * Formats Month view header: `October 2026`
 */
export const formatMonthHeader = (date: Date): string => {
  const monthName = FULL_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${monthName} ${year}`;
};

/**
 * Formats a multi-day span header (used for Week, 4 days, Schedule):
 * - If single month: `October 2026`
 * - If cross-month in same year: `Oct – Nov 2026` or `Sept – Oct 2026`
 * - If cross-year: `Dec 2026 – Jan 2027`
 */
export const formatMultiDayHeader = (startDate: Date, endDate: Date): string => {
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${FULL_MONTHS[startMonth]} ${startYear}`;
    }
    return `${SHORT_MONTHS[startMonth]} – ${SHORT_MONTHS[endMonth]} ${startYear}`;
  }

  return `${SHORT_MONTHS[startMonth]} ${startYear} – ${SHORT_MONTHS[endMonth]} ${endYear}`;
};

/**
 * Formats Week header for the 7-day span containing the Monday
 */
export const formatWeekHeader = (currentDate: Date): string => {
  const monday = getMondayOfWeek(currentDate);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return formatMultiDayHeader(monday, sunday);
};

/**
 * Formats 4 days header for the 4-day span starting at `currentDate`
 */
export const format4DaysHeader = (currentDate: Date): string => {
  const endDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 3);
  return formatMultiDayHeader(currentDate, endDay);
};

/**
 * Formats Schedule view header (matches Week behavior)
 */
export const formatScheduleHeader = (currentDate: Date): string => {
  return formatWeekHeader(currentDate);
};

/**
 * Formats Year header: `2026`
 */
export const formatYearHeader = (date: Date): string => {
  return `${date.getFullYear()}`;
};

/**
 * Master header title helper
 */
export const getCalendarHeaderTitle = (mode: CalendarMode, currentDate: Date): string => {
  switch (mode) {
    case "day":
      return formatDayHeader(currentDate);
    case "week":
      return formatWeekHeader(currentDate);
    case "month":
      return formatMonthHeader(currentDate);
    case "year":
      return formatYearHeader(currentDate);
    case "schedule":
      return formatScheduleHeader(currentDate);
    case "4days":
      return format4DaysHeader(currentDate);
    default:
      return formatMonthHeader(currentDate);
  }
};

/**
 * Navigate date forward (+1) or backward (-1) depending on mode
 */
export const navigateDate = (currentDate: Date, mode: CalendarMode, direction: -1 | 1): Date => {
  const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  switch (mode) {
    case "day":
      d.setDate(d.getDate() + direction);
      return d;
    case "4days":
      d.setDate(d.getDate() + direction * 4);
      return d;
    case "week":
    case "schedule":
      d.setDate(d.getDate() + direction * 7);
      return d;
    case "month":
      return new Date(d.getFullYear(), d.getMonth() + direction, 1);
    case "year":
      return new Date(d.getFullYear() + direction, d.getMonth(), 1);
    default:
      return d;
  }
};

