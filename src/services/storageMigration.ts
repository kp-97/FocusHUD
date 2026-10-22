/**
 * Legacy Storage Migration Handler
 * Safely migrates user goals, tasks, and action plans from v0.1.x localStorage
 * into SQLite on first v0.2.0 launch, ensuring zero data loss.
 */

import {
  checkDbIsEmpty,
  migrateLegacyStorage,
  type LegacyActionPlanNode,
  type LegacyGoalNode,
  type LegacyStorageData,
  type LegacyTaskItem,
} from "./dbService";

export const MIGRATION_KEY = "focushud_migrated_to_sqlite";

export async function runLegacyStorageMigrationIfNeeded(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated === "true") {
    return false;
  }

  try {
    const isEmpty = await checkDbIsEmpty();
    if (!isEmpty) {
      // Database already has records, flag as migrated
      localStorage.setItem(MIGRATION_KEY, "true");
      return false;
    }

    const rawGoals = localStorage.getItem("focushud_goals");
    const rawTasks = localStorage.getItem("focushud_tasks");
    const rawPlans = localStorage.getItem("focushud_action_plans");

    let goals: LegacyGoalNode[] | undefined;
    let tasks: LegacyTaskItem[] | undefined;
    let actionPlans: LegacyActionPlanNode[] | undefined;

    if (rawGoals) {
      try {
        goals = JSON.parse(rawGoals);
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (rawTasks) {
      try {
        tasks = JSON.parse(rawTasks);
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (rawPlans) {
      try {
        actionPlans = JSON.parse(rawPlans);
      } catch {
        // Ignore JSON parse errors
      }
    }

    const payload: LegacyStorageData = {
      goals,
      tasks,
      actionPlans,
    };

    if (
      (goals && goals.length > 0) ||
      (tasks && tasks.length > 0) ||
      (actionPlans && actionPlans.length > 0)
    ) {
      await migrateLegacyStorage(payload);
    }

    localStorage.setItem(MIGRATION_KEY, "true");
    return true;
  } catch (err) {
    console.error("Failed to run legacy storage migration:", err);
    return false;
  }
}
