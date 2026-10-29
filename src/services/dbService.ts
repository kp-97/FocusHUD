/**
 * SQLite Database Service for FocusHUD
 * Connects to the Rust SQLite backend via Tauri IPC.
 * Supports real-time dual-window cache updates via Tauri events.
 */

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

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// ========================================================
// Goals
// ========================================================

export async function fetchGoals(): Promise<DbGoal[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbGoal[]>("get_goals");
  } catch {
    return [];
  }
}

export async function persistGoal(goal: DbGoal): Promise<DbGoal | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbGoal>("save_goal", { goal });
  } catch {
    return null;
  }
}

export async function removeGoal(id: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_goal", { id });
    return true;
  } catch {
    return false;
  }
}

export async function syncGoals(goals: DbGoal[]): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_goals", { goals });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// Tasks
// ========================================================

export async function fetchTasks(): Promise<DbTask[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbTask[]>("get_tasks");
  } catch {
    return [];
  }
}

export async function persistTask(task: DbTask): Promise<DbTask | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbTask>("save_task", { task });
  } catch {
    return null;
  }
}

export async function removeTask(id: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_task", { id });
    return true;
  } catch {
    return false;
  }
}

export async function syncTasks(tasks: DbTask[]): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_tasks", { tasks });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// Action Plans
// ========================================================

export async function fetchActionPlans(): Promise<DbActionPlan[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbActionPlan[]>("get_action_plans");
  } catch {
    return [];
  }
}

export async function persistActionPlan(plan: DbActionPlan): Promise<DbActionPlan | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbActionPlan>("save_action_plan", { plan });
  } catch {
    return null;
  }
}

export async function removeActionPlan(id: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_action_plan", { id });
    return true;
  } catch {
    return false;
  }
}

export async function syncActionPlans(plans: DbActionPlan[]): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_action_plans", { plans });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// Notes
// ========================================================

export async function fetchNotes(): Promise<DbNote[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbNote[]>("get_notes");
  } catch {
    return [];
  }
}

export async function persistNote(note: DbNote): Promise<DbNote | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbNote>("save_note", { note });
  } catch {
    return null;
  }
}

export async function removeNote(id: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_note", { id });
    return true;
  } catch {
    return false;
  }
}

export async function syncNotes(notes: DbNote[]): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_notes", { notes });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// Calendar Events API
// ========================================================

export async function fetchCalendarEvents(): Promise<DbCalendarEvent[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DbCalendarEvent[]>("get_calendar_events");
  } catch {
    return [];
  }
}

export async function saveCalendarEvent(event: DbCalendarEvent): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_calendar_event", { event });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_calendar_event", { id });
    return true;
  } catch {
    return false;
  }
}

export async function syncCalendarEvents(events: DbCalendarEvent[]): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_calendar_events", { events });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// State & Migration
// ========================================================

export async function checkDbIsEmpty(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("check_db_is_empty");
  } catch {
    return false;
  }
}

export async function migrateLegacyStorage(data: LegacyStorageData): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("migrate_legacy_data", { data });
    return true;
  } catch {
    return false;
  }
}

// ========================================================
// Real-Time Cross-Window Synchronization Listener
// ========================================================

export async function onDbChange(
  callback: (payload: DbChangePayload) => void
): Promise<(() => void) | null> {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<DbChangePayload>("db-change", (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    return null;
  }
}
