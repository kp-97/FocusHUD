export type NavViewId =
  | "home"
  | "chat"
  | "calendar"
  | "goals"
  | "tasks"
  | "kanban"
  | "action_plans"
  | "timer";

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
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  color?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
