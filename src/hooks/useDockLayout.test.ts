import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDockLayout } from "./useDockLayout";
import * as layoutStore from "../stores/layoutStore";
import * as tauriBridge from "../services/tauriBridge";

vi.mock("../services/tauriBridge", () => ({
  updateDockSizes: vi.fn(),
  restoreWorkArea: vi.fn(),
  openSettingsWindow: vi.fn().mockResolvedValue(true),
  closeSettingsWindow: vi.fn(),
}));

describe("useDockLayout hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("initializes with default widths and full window mode", () => {
    const { result } = renderHook(() => useDockLayout("full"));
    expect(result.current.dockWindowType).toBe("full");
    expect(result.current.leftWidth).toBe(280);
    expect(result.current.rightWidth).toBe(280);
    expect(result.current.magneticSnap).toBe(true);
    expect(result.current.desktopDockActive).toBe(false);
  });

  it("handles left pane resize and double-click collapse/expand", () => {
    const { result } = renderHook(() => useDockLayout("full"));

    act(() => {
      result.current.handleLeftDragEnd(320);
    });
    expect(result.current.leftWidth).toBe(320);
    expect(layoutStore.getRememberedLeftWidth()).toBe(320);

    // Double click to collapse to 68px
    act(() => {
      result.current.handleLeftDoubleClick();
    });
    expect(result.current.leftWidth).toBe(68);

    // Double click to restore remembered width
    act(() => {
      result.current.handleLeftDoubleClick();
    });
    expect(result.current.leftWidth).toBe(320);
  });

  it("handles right pane resize and double-click collapse/expand", () => {
    const { result } = renderHook(() => useDockLayout("full"));

    act(() => {
      result.current.handleRightDragEnd(350);
    });
    expect(result.current.rightWidth).toBe(350);
    expect(layoutStore.getRememberedRightWidth()).toBe(350);

    // Double click to collapse
    act(() => {
      result.current.handleRightDoubleClick();
    });
    expect(result.current.rightWidth).toBe(68);

    // Double click to expand
    act(() => {
      result.current.handleRightDoubleClick();
    });
    expect(result.current.rightWidth).toBe(350);
  });

  it("toggles both panes collapse and expand simultaneously", () => {
    const { result } = renderHook(() => useDockLayout("full"));

    // Both currently 280 -> collapse both to 68
    act(() => {
      result.current.handleToggleBothPanes();
    });
    expect(result.current.leftWidth).toBe(68);
    expect(result.current.rightWidth).toBe(68);

    // Both collapsed -> expand both back to remembered widths
    act(() => {
      result.current.handleToggleBothPanes();
    });
    expect(result.current.leftWidth).toBe(280);
    expect(result.current.rightWidth).toBe(280);
  });

  it("maximizes both panes to remembered widths", () => {
    const { result } = renderHook(() => useDockLayout("full"));

    act(() => {
      result.current.handleLeftDragEnd(360);
      result.current.handleRightDragEnd(340);
    });
    act(() => {
      result.current.handleLeftDoubleClick(); // collapse left
    });
    expect(result.current.leftWidth).toBe(68);

    act(() => {
      result.current.handleMaximizePanes();
    });
    expect(result.current.leftWidth).toBe(360);
    expect(result.current.rightWidth).toBe(340);
  });

  it("applies presets and resets widths", () => {
    const { result } = renderHook(() => useDockLayout("full"));

    act(() => {
      result.current.handleApplyPreset(220, 220);
    });
    expect(result.current.leftWidth).toBe(220);
    expect(result.current.rightWidth).toBe(220);

    act(() => {
      result.current.handleResetWidths();
    });
    expect(result.current.leftWidth).toBe(layoutStore.DEFAULT_LEFT_WIDTH);
    expect(result.current.rightWidth).toBe(layoutStore.DEFAULT_RIGHT_WIDTH);
  });

  it("responds to incoming broadcast layout actions", () => {
    const { result } = renderHook(() => useDockLayout("left"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "focushud_last_layout_action",
          newValue: JSON.stringify({
            action: {
              type: "SET_LEFT_WIDTH",
              width: 310,
              sender: "remote_window",
            },
          }),
        })
      );
    });
    expect(result.current.leftWidth).toBe(310);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "focushud_last_layout_action",
          newValue: JSON.stringify({
            action: {
              type: "SET_PANES_WIDTH",
              leftWidth: 250,
              rightWidth: 260,
              sender: "remote_window",
            },
          }),
        })
      );
    });
    expect(result.current.leftWidth).toBe(250);
    expect(result.current.rightWidth).toBe(260);
  });

  it("calls updateDockSizes on startup when in left dock mode", () => {
    renderHook(() => useDockLayout("left"));
    expect(tauriBridge.updateDockSizes).toHaveBeenCalledWith(280, null, true);
  });

  it("calls updateDockSizes on startup when in right dock mode", () => {
    renderHook(() => useDockLayout("right"));
    expect(tauriBridge.updateDockSizes).toHaveBeenCalledWith(null, 280, true);
  });
});
