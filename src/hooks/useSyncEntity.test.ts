import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSyncEntity, useSyncGoals, useSyncTasks } from "./useSyncEntity";
import * as dbService from "../services/dbService";

describe("useSyncEntity hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with data from loadInitial", () => {
    const { result } = renderHook(() =>
      useSyncEntity({
        entity: "goals",
        loadInitial: () => [{ id: "g1", title: "Test Goal", completed: false }],
        fetchDb: async () => [],
        adapter: (db) => db as any,
        saveFn: vi.fn(),
      })
    );

    const [data] = result.current;
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Test Goal");
  });

  it("updates state and calls saveFn when saveAndSet is invoked", () => {
    const saveMock = vi.fn();
    const { result } = renderHook(() =>
      useSyncEntity({
        entity: "goals",
        loadInitial: () => [{ id: "g1", title: "Test Goal", completed: false }],
        fetchDb: async () => [],
        adapter: (db) => db as any,
        saveFn: saveMock,
      })
    );

    act(() => {
      const [, saveAndSet] = result.current;
      saveAndSet([{ id: "g1", title: "Updated Goal", completed: true }]);
    });

    const [updatedData] = result.current;
    expect(updatedData[0].title).toBe("Updated Goal");
    expect(saveMock).toHaveBeenCalledWith([
      { id: "g1", title: "Updated Goal", completed: true },
    ]);
  });

  it("fetches from db in Tauri environment", async () => {
    vi.spyOn(dbService, "isTauriEnvironment").mockReturnValue(true);
    vi.spyOn(dbService, "onDbChange").mockResolvedValue(() => {});
    const mockDbFetch = vi.fn().mockResolvedValue([
      { id: "db_task_1", title: "Database Task", status: "todo" },
    ]);

    const { result } = renderHook(() =>
      useSyncEntity({
        entity: "tasks",
        loadInitial: () => [],
        fetchDb: mockDbFetch,
        adapter: (db: any[]) =>
          db.map((d) => ({
            id: d.id,
            title: d.title,
            completed: false,
            status: d.status,
          })),
      })
    );

    // Initial state before promise resolves
    expect(result.current[0]).toEqual([]);

    await waitFor(() => {
      expect(result.current[0]).toHaveLength(1);
    });

    expect(mockDbFetch).toHaveBeenCalled();
    expect(result.current[0][0].title).toBe("Database Task");
  });

  it("provides typed useSyncGoals and useSyncTasks hooks", () => {
    const { result: goalsResult } = renderHook(() => useSyncGoals());
    expect(goalsResult.current[0].length).toBeGreaterThan(0);

    const { result: tasksResult } = renderHook(() => useSyncTasks());
    expect(tasksResult.current[0].length).toBeGreaterThan(0);
  });
});
