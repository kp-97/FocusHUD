import { Calendar } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { CalendarView } from "./CalendarView";

export { CalendarView };
export * from "./CalendarView/types";
export * from "./CalendarView/constants";
export { CalendarHeader } from "./CalendarView/CalendarHeader";

export const calendarViewDefinition: ViewDefinition = {
  id: "calendar",
  title: "CALENDAR",
  icon: Calendar,
  component: CalendarView,
  defaultDock: "left",
  minWidth: 280,
};
