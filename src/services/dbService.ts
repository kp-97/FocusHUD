/**
 * SQLite Database Service for FocusHUD
 * Connects to the Rust SQLite backend via Tauri IPC.
 * Supports real-time dual-window cache updates via Tauri events.
 */

import { isTauriEnvironment, invokeTauri, invokeTauriBool } from "./ipc";

export { isTauriEnvironment };

export interface DbGoal {
  id: string;
  parentId?: string | null;
  title: string;
  description?: string;
  status: "active" | "completed" | "paused" | "archived" | string;
  targetDate?: string | null;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface DbTask {
  id: string;
  parentId?: string | null;
  goalId?: string | null;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "blocked" | string;
  priority?: number;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface DbActionPlan {
  id: string;
  parentId?: string | null;
  goalId?: string | null;
  taskId?: string | null;
  title: string;
  content?: string;
  status: "draft" | "in_progress" | "completed" | string;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface DbNote {
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

export interface DbCalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  recurrence?: string;
  color?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface DbChangePayload {
  entity: "goals" | "tasks" | "action_plans" | "notes" | "calendar_events" | "all" | string;
  action: "save" | "delete" | "migrate" | string;
  id?: string | null;
}

export interface LegacyGoalNode {
  id: string;
  title: string;
  completed?: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: LegacyGoalNode[];
}

export interface LegacyTaskItem {
  id: string;
  title: string;
  completed?: boolean;
  completedAt?: string;
  goalId?: string | null;
  parentId?: string | null;
  status?: string;
  subtasks?: LegacyTaskItem[];
}

export interface LegacyActionPlanNode {
  id: string;
  title: string;
  completed?: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: LegacyActionPlanNode[];
}

export interface LegacyStorageData {
  goals?: LegacyGoalNode[];
  tasks?: LegacyTaskItem[];
  actionPlans?: LegacyActionPlanNode[];
}

// ========================================================
// Goals
// ========================================================

export async function fetchGoals(): Promise<DbGoal[]> {
  const res = await invokeTauri<DbGoal[]>("get_goals");
  return res ?? [];
}

export async function persistGoal(goal: DbGoal): Promise<DbGoal | null> {
  return invokeTauri<DbGoal>("save_goal", { goal });
}

export async function removeGoal(id: string): Promise<boolean> {
  return invokeTauriBool("delete_goal", { id });
}

export async function syncGoals(goals: DbGoal[]): Promise<boolean> {
  return invokeTauriBool("sync_goals", { goals });
}

// ========================================================
// Tasks
// ========================================================

export async function fetchTasks(): Promise<DbTask[]> {
  const res = await invokeTauri<DbTask[]>("get_tasks");
  return res ?? [];
}

export async function persistTask(task: DbTask): Promise<DbTask | null> {
  return invokeTauri<DbTask>("save_task", { task });
}

export async function removeTask(id: string): Promise<boolean> {
  return invokeTauriBool("delete_task", { id });
}

export async function syncTasks(tasks: DbTask[]): Promise<boolean> {
  return invokeTauriBool("sync_tasks", { tasks });
}

// ========================================================
// Action Plans
// ========================================================

export async function fetchActionPlans(): Promise<DbActionPlan[]> {
  const res = await invokeTauri<DbActionPlan[]>("get_action_plans");
  return res ?? [];
}

export async function persistActionPlan(plan: DbActionPlan): Promise<DbActionPlan | null> {
  return invokeTauri<DbActionPlan>("save_action_plan", { plan });
}

export async function removeActionPlan(id: string): Promise<boolean> {
  return invokeTauriBool("delete_action_plan", { id });
}

export async function syncActionPlans(plans: DbActionPlan[]): Promise<boolean> {
  return invokeTauriBool("sync_action_plans", { plans });
}

// ========================================================
// Notes
// ========================================================

export async function fetchNotes(): Promise<DbNote[]> {
  const res = await invokeTauri<DbNote[]>("get_notes");
  return res ?? [];
}

export async function persistNote(note: DbNote): Promise<DbNote | null> {
  return invokeTauri<DbNote>("save_note", { note });
}

export async function removeNote(id: string): Promise<boolean> {
  return invokeTauriBool("delete_note", { id });
}

export async function syncNotes(notes: DbNote[]): Promise<boolean> {
  return invokeTauriBool("sync_notes", { notes });
}

// ========================================================
// Calendar Events API
// ========================================================

export async function fetchCalendarEvents(): Promise<DbCalendarEvent[]> {
  const res = await invokeTauri<DbCalendarEvent[]>("get_calendar_events");
  return res ?? [];
}

export async function saveCalendarEvent(event: DbCalendarEvent): Promise<boolean> {
  return invokeTauriBool("save_calendar_event", { event });
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  return invokeTauriBool("delete_calendar_event", { id });
}

export async function syncCalendarEvents(events: DbCalendarEvent[]): Promise<boolean> {
  return invokeTauriBool("sync_calendar_events", { events });
}

// ========================================================
// State & Migration
// ========================================================

export async function checkDbIsEmpty(): Promise<boolean> {
  const res = await invokeTauri<boolean>("check_db_is_empty");
  return res ?? false;
}

export async function migrateLegacyStorage(data: LegacyStorageData): Promise<boolean> {
  return invokeTauriBool("migrate_legacy_data", { data });
}

// ========================================================
// Real-Time Cross-Window Synchronization Listener
// ========================================================

export async function onDbChange(
  callback: (payload: DbChangePayload) => void
): Promise<(() => void) | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<DbChangePayload>("db-change", (event) => {
      callback(event.payload);
    });
  } catch {
    return null;
  }
}
