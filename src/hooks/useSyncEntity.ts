import { useState, useEffect, useCallback } from "react";
import {
  onDbChange,
  isTauriEnvironment,
  fetchGoals,
  fetchTasks,
  fetchActionPlans,
  fetchCalendarEvents,
  fetchNotes,
  DbGoal,
  DbTask,
  DbActionPlan,
  DbCalendarEvent,
  DbNote,
} from "../services/dbService";
import { GoalNode, TaskItem, ActionPlanNode, CalendarEvent, NoteItem } from "../types/hud";
import {
  loadGoals,
  saveGoals,
  loadTasks,
  saveTasks,
  loadActionPlans,
  saveActionPlans,
  loadEvents,
  saveEvents,
  loadNotes,
  saveNotes,
} from "../stores/entityStore";
import {
  dbGoalsToTree,
  dbTasksToTree,
  dbActionPlansToTree,
  dbEventsToApp,
  dbNotesToApp,
} from "../services/dbAdapters";

export interface SyncEntityOptions<TApp, TDb> {
  entity: "goals" | "tasks" | "action_plans" | "notes" | "calendar_events";
  loadInitial: () => TApp;
  fetchDb: () => Promise<TDb[]>;
  adapter: (db: TDb[]) => TApp;
  saveFn?: (items: TApp) => void;
}

export function useSyncEntity<TApp, TDb>({
  entity,
  loadInitial,
  fetchDb,
  adapter,
  saveFn,
}: SyncEntityOptions<TApp, TDb>): [
  TApp,
  (next: TApp) => void,
  React.Dispatch<React.SetStateAction<TApp>>
] {
  const [data, setData] = useState<TApp>(loadInitial);

  useEffect(() => {
    let active = true;

    if (isTauriEnvironment()) {
      fetchDb().then((dbItems) => {
        if (active && dbItems && (!Array.isArray(dbItems) || dbItems.length > 0)) {
          setData(adapter(dbItems));
        }
      });
    }

    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === entity || payload.entity === "all") {
        fetchDb().then((dbItems) => {
          if (active && dbItems) {
            setData(adapter(dbItems));
          }
        });
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten && unlisten());
    };
  }, [entity, fetchDb, adapter]);

  const saveAndSet = useCallback(
    (next: TApp) => {
      setData(next);
      if (saveFn) {
        saveFn(next);
      }
    },
    [saveFn]
  );

  return [data, saveAndSet, setData];
}

/**
 * Hook for Goals state synchronized with SQLite and cross-window events.
 */
export function useSyncGoals(): [
  GoalNode[],
  (next: GoalNode[]) => void,
  React.Dispatch<React.SetStateAction<GoalNode[]>>
] {
  return useSyncEntity<GoalNode[], DbGoal>({
    entity: "goals",
    loadInitial: loadGoals,
    fetchDb: fetchGoals,
    adapter: dbGoalsToTree,
    saveFn: saveGoals,
  });
}

/**
 * Hook for Tasks state synchronized with SQLite and cross-window events.
 */
export function useSyncTasks(): [
  TaskItem[],
  (next: TaskItem[]) => void,
  React.Dispatch<React.SetStateAction<TaskItem[]>>
] {
  return useSyncEntity<TaskItem[], DbTask>({
    entity: "tasks",
    loadInitial: loadTasks,
    fetchDb: fetchTasks,
    adapter: dbTasksToTree,
    saveFn: saveTasks,
  });
}

/**
 * Hook for Action Plans state synchronized with SQLite and cross-window events.
 */
export function useSyncActionPlans(): [
  ActionPlanNode[],
  (next: ActionPlanNode[]) => void,
  React.Dispatch<React.SetStateAction<ActionPlanNode[]>>
] {
  return useSyncEntity<ActionPlanNode[], DbActionPlan>({
    entity: "action_plans",
    loadInitial: loadActionPlans,
    fetchDb: fetchActionPlans,
    adapter: dbActionPlansToTree,
    saveFn: saveActionPlans,
  });
}

/**
 * Hook for Calendar Events state synchronized with SQLite and cross-window events.
 */
export function useSyncCalendarEvents(): [
  CalendarEvent[],
  (next: CalendarEvent[]) => void,
  React.Dispatch<React.SetStateAction<CalendarEvent[]>>
] {
  return useSyncEntity<CalendarEvent[], DbCalendarEvent>({
    entity: "calendar_events",
    loadInitial: loadEvents,
    fetchDb: fetchCalendarEvents,
    adapter: dbEventsToApp,
    saveFn: saveEvents,
  });
}

/**
 * Hook for Notes state synchronized with SQLite and cross-window events.
 */
export function useSyncNotes(): [
  NoteItem[],
  (next: NoteItem[]) => void,
  React.Dispatch<React.SetStateAction<NoteItem[]>>
] {
  return useSyncEntity<NoteItem[], DbNote>({
    entity: "notes",
    loadInitial: loadNotes,
    fetchDb: fetchNotes,
    adapter: dbNotesToApp,
    saveFn: saveNotes,
  });
}

