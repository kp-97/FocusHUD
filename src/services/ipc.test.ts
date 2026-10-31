import { describe, it, expect, beforeEach, vi } from "vitest";
import { isTauriEnvironment, invokeTauri, invokeTauriBool, _resetIpcCacheForTesting } from "./ipc";

describe("IPC Service", () => {
  beforeEach(() => {
    _resetIpcCacheForTesting();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("correctly identifies non-Tauri web environment", () => {
    expect(isTauriEnvironment()).toBe(false);
  });

  it("correctly identifies Tauri environment when internal object is present", () => {
    (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__ = {};
    expect(isTauriEnvironment()).toBe(true);
  });

  it("returns fallback value when not in Tauri environment", async () => {
    const res = await invokeTauri("get_goals", undefined, []);
    expect(res).toEqual([]);
  });

  it("returns false for invokeTauriBool when not in Tauri environment", async () => {
    const res = await invokeTauriBool("set_dock_drag_mode", { side: "left", active: true });
    expect(res).toBe(false);
  });
});

