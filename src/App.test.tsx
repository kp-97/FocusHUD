import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import App from "./App";

vi.mock("./services/tauriBridge", () => ({
  updateDockSizes: vi.fn(),
  restoreWorkArea: vi.fn(),
  openSettingsWindow: vi.fn().mockResolvedValue(true),
  closeSettingsWindow: vi.fn(),
  getScreenMetrics: vi.fn().mockResolvedValue({ primary: { width: 1920, height: 1080 } }),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
  setDockPopoutMode: vi.fn(),
  exitApp: vi.fn(),
  minimizeToTray: vi.fn().mockResolvedValue(true),
  setFullscreenMode: vi.fn().mockResolvedValue(true),
  setWindowState: vi.fn().mockResolvedValue(true),
  getWindowState: vi.fn().mockResolvedValue(null),
  startDraggingWindow: vi.fn().mockResolvedValue(true),
  moveWindowByDelta: vi.fn().mockResolvedValue(true),
  startResizeWindow: vi.fn().mockResolvedValue(true),
  resizeWindowByDelta: vi.fn().mockResolvedValue(true),
  setPanesReserveZonesMode: vi.fn().mockResolvedValue(true),
  getSnapOverlayState: vi.fn().mockResolvedValue(null),
  selectSnapAssistWindow: vi.fn().mockResolvedValue(null),
  skipSnapAssistZone: vi.fn().mockResolvedValue(null),
  dismissSnapAssist: vi.fn().mockResolvedValue(true),
}));

vi.mock("./components/features/settings/UpdatesTab", () => ({
  UpdatesTab: () => <div data-testid="updates-tab-mock" />,
}));

vi.mock("./services/updaterService", () => ({
  checkForUpdates: vi.fn().mockResolvedValue(null),
  getAppCurrentVersion: vi.fn().mockResolvedValue("0.2.10"),
  APP_VERSION: "0.2.10",
}));

describe("App root window dispatcher", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  const setLocationSearch = (search: string) => {
    window.history.replaceState({}, "", search ? search : "/");
  };

  it("renders FullLayoutApp when no dock query parameter is present", () => {
    setLocationSearch("");
    render(<App />);
    expect(screen.getByTestId("full-layout-app")).toBeInTheDocument();
  });

  it("renders LeftDockApp when ?dock=left is present", () => {
    setLocationSearch("?dock=left");
    render(<App />);
    expect(screen.getByTestId("left-dock-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders RightDockApp when ?dock=right is present", () => {
    setLocationSearch("?dock=right");
    render(<App />);
    expect(screen.getByTestId("right-dock-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders SettingsModalApp when ?dock=settings is present", () => {
    setLocationSearch("?dock=settings");
    render(<App />);
    expect(screen.getByTestId("settings-modal-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders SettingsModalApp when ?view=settings is present", () => {
    setLocationSearch("?view=settings");
    render(<App />);
    expect(screen.getByTestId("settings-modal-app")).toBeInTheDocument();
  });

  it("renders SnapOverlayApp when ?dock=snap-overlay is present", () => {
    setLocationSearch("?dock=snap-overlay");
    render(<App />);
    expect(screen.getByTestId("snap-overlay-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("boots into Maximised Windowed mode on standard screens and allows dragging top and resizing when Restored Down", async () => {
    setLocationSearch("");
    render(<App />);

    // On standard (non-ultrawide) screens, boots into Maximised mode inside Joined:
    // Whole canvas view container is rendered; left and right pane toggles are removed
    expect(screen.getByTestId("full-screen-view-container")).toBeInTheDocument();
    expect(screen.getByTestId("full-screen-view-container")).toHaveAttribute(
      "data-window-state",
      "maximised"
    );
    expect(screen.queryByTestId("center-preview-container")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-toggle-left")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-toggle-right")).not.toBeInTheDocument();
    // Top drag bar is hidden in Maximised
    expect(screen.queryByTestId("windowed-top-drag-bar")).not.toBeInTheDocument();

    // AI Chat button is on the right rail by default
    expect(screen.getByTestId("right-rail-nav-chat")).toBeInTheDocument();
    expect(screen.queryByTestId("left-rail-nav-chat")).not.toBeInTheDocument();

    // Clicking a view button in Joined mode renders the whole canvas
    const calendarBtn = screen.getByTestId("left-rail-nav-calendar");
    await act(async () => {
      calendarBtn.click();
    });
    expect(screen.getByText("CALENDAR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();

    // Clicking AI Chat on the right rail in Joined mode renders AI Chat across the whole canvas
    const chatBtn = screen.getByTestId("right-rail-nav-chat");
    await act(async () => {
      chatBtn.click();
    });
    expect(screen.getByText(/AI AGENT CHAT/i)).toBeInTheDocument();

    // Click Restore Down -> transitions to Windowed State (restored down)
    const restoreBtn = screen.getByTestId("window-btn-restore-down");
    await act(async () => {
      restoreBtn.click();
    });
    expect(screen.getByTestId("full-screen-view-container")).toHaveAttribute(
      "data-window-state",
      "windowed"
    );

    // In Windowed State (restored down), draggable top bar and edge resize handles are rendered
    const topBar = screen.getByTestId("windowed-top-drag-bar");
    expect(topBar).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-top")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-left")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-right")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-top-left")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-top-right")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-bottom-left")).toBeInTheDocument();
    expect(screen.getByTestId("window-resize-bottom-right")).toBeInTheDocument();

    // User can drag top bar to move window
    act(() => {
      topBar.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 100, clientY: 10 }));
    });

    // User can drag resize handles
    act(() => {
      screen.getByTestId("window-resize-right").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 500, clientY: 200 }));
    });

    // Click Maximise -> transitions back to Maximised State
    const maxBtn = screen.getByTestId("window-btn-maximise");
    await act(async () => {
      maxBtn.click();
    });
    expect(screen.getByTestId("full-screen-view-container")).toHaveAttribute(
      "data-window-state",
      "maximised"
    );
    expect(screen.queryByTestId("windowed-top-drag-bar")).not.toBeInTheDocument();

    // Click Split -> transitions out of Joined into Split mode
    const splitBtn = screen.getByTestId("window-btn-split");
    await act(async () => {
      splitBtn.click();
    });
    expect(screen.queryByTestId("full-screen-view-container")).not.toBeInTheDocument();
    expect(screen.getByTestId("center-preview-container")).toBeInTheDocument();

    // In Split mode, user can enter Fullscreen directly from the left rail Fullscreen button
    const fsBtn = screen.getByTestId("window-btn-fullscreen");
    await act(async () => {
      fsBtn.click();
    });
    expect(screen.getByTestId("full-screen-view-container")).toHaveAttribute(
      "data-window-state",
      "fullscreen"
    );
    // In Fullscreen Immersive state, the Restore Down button is present on the right rail
    expect(screen.getByTestId("window-btn-restore-down")).toBeInTheDocument();

    // Exiting Fullscreen returns to Split mode (its prior state)
    const exitFsBtn = screen.getByTestId("window-btn-exit-fullscreen");
    await act(async () => {
      exitFsBtn.click();
    });
    expect(screen.getByTestId("center-preview-container")).toBeInTheDocument();

    // In Split mode, clicking Join (or Maximise) transitions to Maximised State (Full Screen) inside Joined
    await act(async () => {
      screen.getByTestId("window-btn-join").click();
    });
    expect(screen.getByTestId("full-screen-view-container")).toHaveAttribute(
      "data-window-state",
      "maximised"
    );
    expect(screen.queryByTestId("center-preview-container")).not.toBeInTheDocument();
  });

  it("boots into Split mode when the display is wider than widescreen (ultrawide)", () => {
    // Ultrawide 3440 x 1440 (aspect ratio ~2.39 > 16/9)
    Object.defineProperty(window.screen, "width", { value: 3440, configurable: true });
    Object.defineProperty(window.screen, "height", { value: 1440, configurable: true });

    render(<App />);
    expect(screen.getByTestId("center-preview-container")).toBeInTheDocument();
    expect(screen.queryByTestId("full-screen-view-container")).not.toBeInTheDocument();
  });
});
