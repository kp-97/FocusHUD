import type { GoalNode, TaskItem, ActionPlanNode, CalendarEvent } from "../types/hud";
import type { DbGoal, DbTask, DbActionPlan, DbCalendarEvent } from "./dbService";

// ========================================================
// Goals Tree <-> Flat DB Conversion
// ========================================================

export function dbGoalsToTree(flat: DbGoal[]): GoalNode[] {
  const map = new Map<string, GoalNode>();
  const roots: GoalNode[] = [];

  for (const g of flat) {
    map.set(g.id, {
      id: g.id,
      title: g.title,
      completed: g.status === "completed",
      parentId: g.parentId ?? undefined,
      children: [],
    });
  }

  for (const g of flat) {
    const node = map.get(g.id)!;
    if (g.parentId && map.has(g.parentId)) {
      map.get(g.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function treeToGoalsFlat(nodes: GoalNode[], parentId: string | null = null): DbGoal[] {
  const flat: DbGoal[] = [];

  nodes.forEach((node, index) => {
    const pid = node.parentId ?? parentId;
    flat.push({
      id: node.id,
      parentId: pid,
      title: node.title,
      description: "",
      status: node.completed ? "completed" : "active",
      sortOrder: index,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (node.children && node.children.length > 0) {
      flat.push(...treeToGoalsFlat(node.children, node.id));
    }
  });

  return flat;
}

// ========================================================
// Tasks Tree <-> Flat DB Conversion
// ========================================================

export function dbTasksToTree(flat: DbTask[]): TaskItem[] {
  const map = new Map<string, TaskItem>();
  const roots: TaskItem[] = [];

  for (const t of flat) {
    const status =
      t.status === "done" || t.status === "in_progress" || t.status === "todo"
        ? t.status
        : "todo";

    map.set(t.id, {
      id: t.id,
      title: t.title,
      completed: t.status === "done",
      dueDate: t.dueDate ?? null,
      goalId: t.goalId ?? null,
      parentId: t.parentId ?? undefined,
      status,
      subtasks: [],
    });
  }

  for (const t of flat) {
    const item = map.get(t.id)!;
    if (t.parentId && map.has(t.parentId)) {
      map.get(t.parentId)!.subtasks!.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

export function treeToTasksFlat(items: TaskItem[], parentId: string | null = null): DbTask[] {
  const flat: DbTask[] = [];

  items.forEach((item, index) => {
    const pid = item.parentId ?? parentId;
    flat.push({
      id: item.id,
      parentId: pid,
      goalId: item.goalId ?? null,
      title: item.title,
      description: "",
      status: item.completed ? "done" : item.status || "todo",
      priority: 3,
      dueDate: item.dueDate ?? null,
      sortOrder: index,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (item.subtasks && item.subtasks.length > 0) {
      flat.push(...treeToTasksFlat(item.subtasks, item.id));
    }
  });

  return flat;
}

// ========================================================
// Action Plans Tree <-> Flat DB Conversion
// ========================================================

export function dbPlansToTree(flat: DbActionPlan[]): ActionPlanNode[] {
  const map = new Map<string, ActionPlanNode>();
  const roots: ActionPlanNode[] = [];

  for (const p of flat) {
    map.set(p.id, {
      id: p.id,
      title: p.title,
      completed: p.status === "completed",
      parentId: p.parentId ?? undefined,
      children: [],
    });
  }

  for (const p of flat) {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function treeToPlansFlat(nodes: ActionPlanNode[], parentId: string | null = null): DbActionPlan[] {
  const flat: DbActionPlan[] = [];

  nodes.forEach((node, index) => {
    const pid = node.parentId ?? parentId;
    flat.push({
      id: node.id,
      parentId: pid,
      goalId: null,
      taskId: null,
      title: node.title,
      content: "",
      status: node.completed ? "completed" : "draft",
      sortOrder: index,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (node.children && node.children.length > 0) {
      flat.push(...treeToPlansFlat(node.children, node.id));
    }
  });

  return flat;
}

export const dbActionPlansToTree = dbPlansToTree;
export const treeToActionPlansFlat = treeToPlansFlat;

// ========================================================
// Calendar Events DB Conversion
// ========================================================

export function dbEventsToApp(flat: DbCalendarEvent[]): CalendarEvent[] {
  return flat.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description || "",
    location: e.location || "",
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    isAllDay: !!e.isAllDay,
    color: e.color || "#00e5ff",
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

export function appEventsToDb(events: CalendarEvent[]): DbCalendarEvent[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description || "",
    location: e.location || "",
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    isAllDay: !!e.isAllDay,
    color: e.color || "#00e5ff",
    createdAt: e.createdAt || Date.now(),
    updatedAt: e.updatedAt || Date.now(),
  }));
}
