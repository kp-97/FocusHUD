export type NavViewId =
  | "home"
  | "chat"
  | "calendar"
  | "goals"
  | "tasks"
  | "notes"
  | "kanban"
  | "action_plans"
  | "timer";

export interface NavItemConfig {
  id: NavViewId;
  label: string;
  visible: boolean;
}

export interface NoteItem {
  id: string;
  parentId?: string | null;
  goalId?: string | null;
  taskId?: string | null;
  actionPlanId?: string | null;
  calendarEventId?: string | null;
  title: string;
  content: string;
  isPinned?: boolean;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface GoalNode {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: GoalNode[];
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string | null;
  goalId?: string | null;
  parentId?: string | null;
  status: "todo" | "in_progress" | "done";
  subtasks?: TaskItem[];
}

export interface ActionPlanNode {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: ActionPlanNode[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24H internally)
  endTime: string; // HH:mm (24H internally)
  isAllDay?: boolean;
  recurrence?: string; // "none" | "daily" | "weekly" | "monthly" | "annually" | "weekday" | custom JSON
  color?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type { SystemDiagnostics } from "./diagnostics";
