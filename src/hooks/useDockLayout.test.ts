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
  minimizeToTray: vi.fn().mockResolvedValue(true),
  setFullscreenMode: vi.fn().mockResolvedValue(true),
  setWindowState: vi.fn().mockResolvedValue(true),
  getWindowState: vi.fn().mockResolvedValue(null),
  startDraggingWindow: vi.fn().mockResolvedValue(true),
  moveWindowByDelta: vi.fn().mockResolvedValue(true),
  startResizeWindow: vi.fn().mockResolvedValue(true),
  resizeWindowByDelta: vi.fn().mockResolvedValue(true),
  setPanesReserveZonesMode: vi.fn().mockResolvedValue(true),
}));

describe("useDockLayout hook", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  it("maximizes app freeing screen zones and restores back to docked state", async () => {
    sessionStorage.setItem("focushud_booted", "true");
    localStorage.setItem("focushud_window_state", "split");
    const { result } = renderHook(() => useDockLayout("full"));

    expect(result.current.isAppMaximized).toBe(false);

    await act(async () => {
      await result.current.handleToggleMaximizeApp();
    });

    expect(result.current.isAppMaximized).toBe(true);

    await act(async () => {
      await result.current.handleToggleMaximizeApp();
    });

    expect(result.current.isAppMaximized).toBe(false);
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

  it("toggles maximize and calls setWindowState directly without flashing split mode", async () => {
    const { result } = renderHook(() => useDockLayout("right"));
    expect(result.current.isAppMaximized).toBe(false);

    // Maximize to full screen
    await act(async () => {
      await result.current.handleToggleMaximizeApp();
    });
    expect(result.current.isAppMaximized).toBe(true);
    expect(tauriBridge.setWindowState).toHaveBeenCalledWith("maximised");
    expect(localStorage.getItem("focushud_is_app_maximized")).toBe("true");

    // Restore Down to windowed mode (must NOT call setFullscreenMode(false) which would enter split mode)
    await act(async () => {
      await result.current.handleToggleMaximizeApp();
    });
    expect(result.current.isAppMaximized).toBe(false);
    expect(result.current.windowState).toBe("windowed");
    expect(tauriBridge.setWindowState).toHaveBeenCalledWith("windowed");
    expect(tauriBridge.setFullscreenMode).not.toHaveBeenCalled();
    expect(localStorage.getItem("focushud_is_app_maximized")).toBe("false");
  });

  it("synchronizes active navigation item across windows and local storage", () => {
    const { result } = renderHook(() => useDockLayout("left"));
    expect(result.current.activeNav).toBe("home");

    act(() => {
      result.current.setActiveNav("calendar");
    });
    expect(result.current.activeNav).toBe("calendar");
    expect(localStorage.getItem("focushud_active_nav")).toBe("calendar");

    // Receives SET_ACTIVE_NAV broadcast
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "focushud_last_layout_action",
          newValue: JSON.stringify({
            action: {
              type: "SET_ACTIVE_NAV",
              nav: "kanban",
              sender: "remote_window",
            },
          }),
        })
      );
    });
    expect(result.current.activeNav).toBe("kanban");
  });

  it("implements the full window/layout state machine including Fullscreen prior-state guards and F11", async () => {
    const { result } = renderHook(() => useDockLayout("full"));

    // 1. Default boot on standard screen is Maximised State inside Joined
    expect(result.current.windowState).toBe("maximised");
    expect(result.current.isJoinedMode).toBe(true);

    // Click Restore Down -> Windowed
    await act(async () => {
      await result.current.handleClickRestoreDown();
    });
    expect(result.current.windowState).toBe("windowed");

    // 2. Enter Fullscreen from Windowed -> exiting Fullscreen returns to Windowed [if prior state = Windowed]
    await act(async () => {
      await result.current.handleClickFullscreen();
    });
    expect(result.current.windowState).toBe("fullscreen");
    expect(result.current.priorFullscreenState).toBe("windowed");

    await act(async () => {
      await result.current.handleClickExitFullscreen();
    });
    expect(result.current.windowState).toBe("windowed");

    // 3. Enter Maximised, then press F11 to enter Fullscreen -> press F11 to exit returns to Maximised [if prior state = Maximised]
    await act(async () => {
      await result.current.handleClickMaximise();
    });
    expect(result.current.windowState).toBe("maximised");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F11" }));
    });
    expect(result.current.windowState).toBe("fullscreen");
    expect(result.current.priorFullscreenState).toBe("maximised");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F11" }));
    });
    expect(result.current.windowState).toBe("maximised");

    // 4. Minimise -> Open in Fullscreen from tray -> exiting Fullscreen returns to Minimised [if prior state = Minimised]
    await act(async () => {
      await result.current.handleClickMinimise();
    });
    expect(result.current.windowState).toBe("minimised");

    await act(async () => {
      await result.current.handleTrayOpenFullscreen();
    });
    expect(result.current.windowState).toBe("fullscreen");
    expect(result.current.priorFullscreenState).toBe("minimised");

    await act(async () => {
      await result.current.handleClickExitFullscreen();
    });
    expect(result.current.windowState).toBe("minimised");

    // 5. Tray Open -> Windowed; Tray Open Maximised -> Maximised
    await act(async () => {
      await result.current.handleTrayOpenWindowed();
    });
    expect(result.current.windowState).toBe("windowed");

    await act(async () => {
      await result.current.handleTrayOpenMaximised();
    });
    expect(result.current.windowState).toBe("maximised");

    // 6. Click Split -> Split mode; enter Fullscreen from Split mode -> exit Fullscreen back to Split mode; Click Join / Maximise in Split -> Maximised State (Full Screen)
    await act(async () => {
      await result.current.handleClickSplit();
    });
    expect(result.current.windowState).toBe("split");
    expect(result.current.isJoinedMode).toBe(false);

    await act(async () => {
      await result.current.handleClickFullscreen();
    });
    expect(result.current.windowState).toBe("fullscreen");
    expect(result.current.priorFullscreenState).toBe("split");

    await act(async () => {
      await result.current.handleClickExitFullscreen();
    });
    expect(result.current.windowState).toBe("split");

    await act(async () => {
      await result.current.handleClickJoin();
    });
    expect(result.current.windowState).toBe("maximised");
    expect(result.current.isJoinedMode).toBe(true);
  });

  it("boots into split mode when screen is wider than widescreen (ultrawide)", () => {
    Object.defineProperty(window.screen, "width", { value: 3440, configurable: true });
    Object.defineProperty(window.screen, "height", { value: 1440, configurable: true });

    const { result } = renderHook(() => useDockLayout("full"));
    expect(result.current.windowState).toBe("split");
    expect(result.current.isJoinedMode).toBe(false);
  });
});
