import { describe, it, expect, beforeEach, vi } from "vitest";
import { runLegacyStorageMigrationIfNeeded, MIGRATION_KEY } from "./storageMigration";
import * as dbService from "./dbService";

vi.mock("./dbService", () => ({
  checkDbIsEmpty: vi.fn(),
  migrateLegacyStorage: vi.fn(),
}));

describe("storageMigration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("skips migration if already marked as migrated in localStorage", async () => {
    localStorage.setItem(MIGRATION_KEY, "true");
    const result = await runLegacyStorageMigrationIfNeeded();
    expect(result).toBe(false);
    expect(dbService.checkDbIsEmpty).not.toHaveBeenCalled();
  });

  it("skips migration and marks complete if database is already non-empty", async () => {
    vi.mocked(dbService.checkDbIsEmpty).mockResolvedValue(false);
    const result = await runLegacyStorageMigrationIfNeeded();
    expect(result).toBe(false);
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("true");
    expect(dbService.migrateLegacyStorage).not.toHaveBeenCalled();
  });

  it("migrates existing localStorage data into SQLite when DB is empty", async () => {
    vi.mocked(dbService.checkDbIsEmpty).mockResolvedValue(true);
    vi.mocked(dbService.migrateLegacyStorage).mockResolvedValue(true);

    const legacyGoals = [{ id: "g1", title: "My Goal", completed: false }];
    const legacyTasks = [{ id: "t1", title: "My Task", completed: true }];

    localStorage.setItem("focushud_goals", JSON.stringify(legacyGoals));
    localStorage.setItem("focushud_tasks", JSON.stringify(legacyTasks));

    const result = await runLegacyStorageMigrationIfNeeded();
    expect(result).toBe(true);
    expect(dbService.migrateLegacyStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        goals: legacyGoals,
        tasks: legacyTasks,
      })
    );
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("true");
  });
});
