import { describe, it, expect } from "vitest";
import {
  dbGoalsToTree,
  treeToGoalsFlat,
  dbTasksToTree,
  treeToTasksFlat,
  dbPlansToTree,
  treeToPlansFlat,
} from "./dbAdapters";
import type { DbGoal, DbTask, DbActionPlan } from "./dbService";

describe("dbAdapters", () => {
  it("converts flat goals with parentId into nested GoalNode tree and back", () => {
    const flatGoals: DbGoal[] = [
      { id: "g1", parentId: null, title: "Parent Goal", status: "active" },
      { id: "g1-1", parentId: "g1", title: "Child Goal", status: "completed" },
    ];

    const tree = dbGoalsToTree(flatGoals);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("g1");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].id).toBe("g1-1");
    expect(tree[0].children![0].completed).toBe(true);

    const backToFlat = treeToGoalsFlat(tree);
    expect(backToFlat).toHaveLength(2);
    expect(backToFlat[0].id).toBe("g1");
    expect(backToFlat[1].id).toBe("g1-1");
    expect(backToFlat[1].parentId).toBe("g1");
  });

  it("converts flat tasks with goalId and parentId into nested TaskItem tree and back", () => {
    const flatTasks: DbTask[] = [
      { id: "t1", parentId: null, goalId: "g1", title: "Root Task", status: "in_progress" },
      { id: "t1-1", parentId: "t1", goalId: "g1", title: "Sub Task", status: "done" },
    ];

    const tree = dbTasksToTree(flatTasks);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("t1");
    expect(tree[0].goalId).toBe("g1");
    expect(tree[0].status).toBe("in_progress");
    expect(tree[0].subtasks).toHaveLength(1);
    expect(tree[0].subtasks![0].id).toBe("t1-1");
    expect(tree[0].subtasks![0].completed).toBe(true);

    const backToFlat = treeToTasksFlat(tree);
    expect(backToFlat).toHaveLength(2);
    expect(backToFlat[0].id).toBe("t1");
    expect(backToFlat[1].parentId).toBe("t1");
  });

  it("converts flat action plans into ActionPlanNode tree and back", () => {
    const flatPlans: DbActionPlan[] = [
      { id: "p1", parentId: null, title: "Launch Plan", status: "draft" },
      { id: "p1-1", parentId: "p1", title: "Step 1", status: "completed" },
    ];

    const tree = dbPlansToTree(flatPlans);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].completed).toBe(true);

    const backToFlat = treeToPlansFlat(tree);
    expect(backToFlat).toHaveLength(2);
    expect(backToFlat[1].parentId).toBe("p1");
  });
});
