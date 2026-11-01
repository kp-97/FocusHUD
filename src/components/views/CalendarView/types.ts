import { CalendarEvent } from "../../../types/hud";

export interface CalendarItemDisplay {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  color?: string;
  isTask?: boolean;
  completed?: boolean;
  originalEvent?: CalendarEvent;
}

