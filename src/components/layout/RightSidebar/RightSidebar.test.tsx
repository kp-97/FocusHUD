import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { RightSidebar } from "./RightSidebar";
import { pomodoroActions } from "../../../stores/pomodoroStore";
import * as tauriBridge from "../../../services/tauriBridge";

vi.mock("../../../services/tauriBridge", () => ({
  exitApp: vi.fn(),
  minimizeToTray: vi.fn(),
  restoreWorkArea: vi.fn(),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
  setDockPopoutMode: vi.fn(),
}));

describe("RightSidebar component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    pomodoroActions.pause();
    pomodoroActions.reset();
  });

  afterEach(() => {
    cleanup();
    pomodoroActions.pause();
    pomodoroActions.reset();
    vi.useRealTimers();
  });

  it("renders standard view when expanded (width >= 120) with AI Chat on right rail by default", () => {
    render(<RightSidebar width={280} activeNav="home" />);
    expect(screen.getByLabelText(/Close FocusHUD/i)).toBeInTheDocument();
    expect(screen.getByTestId("right-rail-nav-chat")).toBeInTheDocument();
    expect(screen.getByText(/AI AGENT CHAT/i)).toBeInTheDocument();
  });

  it("renders window controls in expanded header and triggers actions", () => {
    const handleMaximize = vi.fn();
    const handleToggleMaximizeApp = vi.fn();

    render(
      <RightSidebar
        width={280}
        activeNav="home"
        onMaximizePanes={handleMaximize}
        onToggleMaximizeApp={handleToggleMaximizeApp}
      />
    );

    // 1. Minimize to tray button
    const minBtn = screen.getByLabelText(/Minimize FocusHUD to Tray/i);
    fireEvent.click(minBtn);
    expect(tauriBridge.minimizeToTray).toHaveBeenCalledTimes(1);

    // 2. Maximize app button
    const maxBtn = screen.getByLabelText(/Maximize FocusHUD/i);
    fireEvent.click(maxBtn);
    expect(handleToggleMaximizeApp).toHaveBeenCalledTimes(1);

    // 3. Exit button
    const exitBtn = screen.getByLabelText(/Close FocusHUD/i);
    fireEvent.click(exitBtn);
    expect(tauriBridge.exitApp).toHaveBeenCalledTimes(1);
  });

  it("renders compact mini HUD rail when snapped (width < 120)", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    // In compact mode, the full header is hidden and the mini rail is rendered
    expect(screen.queryByText(/VIEW: CHAT/i)).not.toBeInTheDocument();
    expect(screen.getByText(/CYCLES/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
  });

  it("renders compact controls in compact mini HUD rail with window controls, AI Chat view button, and stats (no right pane toggle)", () => {
    render(<RightSidebar width={68} activeNav="home" />);

    // Minimize, Restore/Maximize, and Exit buttons ARE rendered vertically in compact rail
    const exitBtn = screen.getByLabelText(/Close FocusHUD/i);
    const maxBtn = screen.getByLabelText(/Maximize FocusHUD/i);
    const minBtn = screen.getByLabelText(/Minimize FocusHUD to Tray/i);
    const chatBtn = screen.getByTestId("right-rail-nav-chat");
    expect(exitBtn).toBeInTheDocument();
    expect(maxBtn).toBeInTheDocument();
    expect(minBtn).toBeInTheDocument();
    expect(chatBtn).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-toggle-right")).not.toBeInTheDocument();

    // Verify vertical order in DOM: Exit is before Maximize, Maximize before Minimize, and Minimize before Right Rail Nav
    expect(exitBtn.compareDocumentPosition(maxBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(maxBtn.compareDocumentPosition(minBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(minBtn.compareDocumentPosition(chatBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // System stats section is rendered
    expect(screen.getByText("STATS")).toBeInTheDocument();
    expect(screen.getByTestId("configure-system-stats-button")).toBeInTheDocument();
  });

  it("allows configuring system stats metrics on the right rail", () => {
    render(<RightSidebar width={68} activeNav="home" />);

    // Open stats configuration dialog
    const configBtn = screen.getByTestId("configure-system-stats-button");
    fireEvent.click(configBtn);

    const dialog = screen.getByTestId("stats-config-dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("CONFIG STATS")).toBeInTheDocument();

    // Toggle CPU stat checkbox
    const cpuCheckbox = screen.getByLabelText("Toggle CPU Stat");
    expect(cpuCheckbox).toBeChecked();
    fireEvent.click(cpuCheckbox);
    expect(cpuCheckbox).not.toBeChecked();

    // Toggle Temp stat checkbox
    const tempCheckbox = screen.getByLabelText("Toggle Temp Stat");
    expect(tempCheckbox).not.toBeChecked();
    fireEvent.click(tempCheckbox);
    expect(tempCheckbox).toBeChecked();
  });

  it("toggles timer directly from compact rail", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    const playBtn = screen.getByTitle(/Start Focus Timer/i);
    act(() => {
      fireEvent.click(playBtn);
    });
    expect(screen.getByTitle(/Pause Timer/i)).toBeInTheDocument();

    const pauseBtn = screen.getByTitle(/Pause Timer/i);
    act(() => {
      fireEvent.click(pauseBtn);
    });
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
  });

  it("does not render the expand right panel button in compact rail", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    expect(screen.queryByTitle(/Expand Right Panel/i)).not.toBeInTheDocument();
  });

  it("stacks the pause and cancel buttons vertically when running in compact rail", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    const playBtn = screen.getByTitle(/Start Focus Timer/i);
    act(() => {
      fireEvent.click(playBtn);
    });

    const pauseBtn = screen.getByTitle(/Pause Timer/i);
    const cancelBtn = screen.getByTitle(/Cancel Timer/i);

    expect(pauseBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    // Verify DOM ordering: Pause button precedes Cancel button vertically
    expect(pauseBtn.compareDocumentPosition(cancelBtn)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    // Clicking Cancel resets the timer and restores Start Focus Timer
    act(() => {
      fireEvent.click(cancelBtn);
    });
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Cancel Timer/i)).not.toBeInTheDocument();
  });

  it("allows selecting a view from the right pane dropdown independently of the left pane", () => {
    render(<RightSidebar width={280} activeNav="home" />);

    // Initially displays AI Chat view by default (VIEW: CHAT)
    const dropdownBtn = screen.getByTestId("right-pane-view-dropdown-button");
    expect(dropdownBtn).toBeInTheDocument();
    expect(dropdownBtn).toHaveTextContent(/VIEW: CHAT/i);

    // Open dropdown
    fireEvent.click(dropdownBtn);
    const menu = screen.getByRole("menu", { name: /Right Pane Views/i });
    expect(menu).toBeInTheDocument();

    // Select CALENDAR from dropdown
    const calOption = within(menu).getByRole("menuitem", { name: /CALENDAR/i });
    fireEvent.click(calOption);

    // Dropdown closes and right pane updates to CALENDAR
    expect(screen.queryByRole("menu", { name: /Right Pane Views/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("right-pane-view-dropdown-button")).toHaveTextContent(/VIEW: CALENDAR/i);
  });

  it("opens view on first click and closes (collapses) right pane on clicking the same active view button in Split mode", () => {
    const handleToggleRightPane = vi.fn();
    const { rerender } = render(
      <RightSidebar
        width={68}
        activeNav="home"
        windowState="split"
        isJoinedMode={false}
        onToggleRightPane={handleToggleRightPane}
      />
    );

    // When collapsed (width=68), clicking AI Chat button opens the right pane
    fireEvent.click(screen.getByTestId("right-rail-nav-chat"));
    expect(handleToggleRightPane).toHaveBeenCalledTimes(1);

    // When expanded (width=280) with AI Chat active, clicking AI Chat button again closes the right pane
    handleToggleRightPane.mockClear();
    rerender(
      <RightSidebar
        width={280}
        activeNav="home"
        windowState="split"
        isJoinedMode={false}
        onToggleRightPane={handleToggleRightPane}
      />
    );
    fireEvent.click(screen.getByTestId("right-rail-nav-chat"));
    expect(handleToggleRightPane).toHaveBeenCalledTimes(1);
  });

  it("always displays window controls vertically (Exit -> Maximise/Restore -> Minimize) in both expanded and compact states", () => {
    // 1. Expanded mode (width = 280)
    const { unmount } = render(
      <RightSidebar
        width={280}
        activeNav="home"
      />
    );

    const exitBtnExpanded = screen.getByLabelText(/Close FocusHUD/i);
    const maxBtnExpanded = screen.getByLabelText(/Maximize FocusHUD/i);
    const minBtnExpanded = screen.getByLabelText(/Minimize FocusHUD to Tray/i);

    // Verify vertical order in expanded mode
    expect(exitBtnExpanded.compareDocumentPosition(maxBtnExpanded)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(maxBtnExpanded.compareDocumentPosition(minBtnExpanded)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    unmount();

    // 2. Compact mode (width = 68)
    render(
      <RightSidebar
        width={68}
        activeNav="home"
      />
    );

    const exitBtnCompact = screen.getByLabelText(/Close FocusHUD/i);
    const maxBtnCompact = screen.getByLabelText(/Maximize FocusHUD/i);
    const minBtnCompact = screen.getByLabelText(/Minimize FocusHUD to Tray/i);

    // Verify vertical order in compact mode
    expect(exitBtnCompact.compareDocumentPosition(maxBtnCompact)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(maxBtnCompact.compareDocumentPosition(minBtnCompact)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("toggles between maximize and restore state when isAppMaximized is toggled", () => {
    const handleToggleMaximizeApp = vi.fn();
    const { rerender } = render(
      <RightSidebar
        width={68}
        activeNav="home"
        isAppMaximized={false}
        onToggleMaximizeApp={handleToggleMaximizeApp}
      />
    );

    // In normal state, button says Maximize FocusHUD
    const maxBtn = screen.getByLabelText(/Maximize FocusHUD/i);
    expect(maxBtn).toBeInTheDocument();
    fireEvent.click(maxBtn);
    expect(handleToggleMaximizeApp).toHaveBeenCalledTimes(1);

    // When maximized, button switches to Restore FocusHUD
    rerender(
      <RightSidebar
        width={68}
        activeNav="home"
        isAppMaximized={true}
        onToggleMaximizeApp={handleToggleMaximizeApp}
      />
    );

    const restoreBtn = screen.getByLabelText(/Restore FocusHUD/i);
    expect(restoreBtn).toBeInTheDocument();
    fireEvent.click(restoreBtn);
    expect(handleToggleMaximizeApp).toHaveBeenCalledTimes(2);

    // When in fullscreen immersive state, Restore FocusHUD button is ALSO present
    const handleRestoreDown = vi.fn();
    rerender(
      <RightSidebar
        width={68}
        activeNav="home"
        windowState="fullscreen"
        isJoinedMode={true}
        onClickRestoreDown={handleRestoreDown}
      />
    );
    const restoreInFullscreenBtn = screen.getByTestId("window-btn-restore-down");
    expect(restoreInFullscreenBtn).toBeInTheDocument();
    fireEvent.click(restoreInFullscreenBtn);
    expect(handleRestoreDown).toHaveBeenCalledTimes(1);
  });

  it("places timer components closer together on right rail and allows adjusting vertical position without swapping", () => {
    render(<RightSidebar width={68} activeNav="home" />);

    const timerSection = screen.getByTestId("right-rail-timer-wrapper");
    const statsSection = screen.getByTestId("right-rail-stats-wrapper");
    const timerLine = screen.getByTestId("timer-drag-handle");
    const statsLine = screen.getByTestId("stats-drag-handle");

    expect(timerSection).toBeInTheDocument();
    expect(statsSection).toBeInTheDocument();

    // Fixed order: Timer section is always above the Stats section
    expect(timerSection.compareDocumentPosition(statsSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Drag timer dividing line vertically by 30px
    act(() => {
      fireEvent.pointerDown(timerLine, { clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(timerLine, { clientY: 130, pointerId: 1 });
      fireEvent.pointerUp(timerLine, { clientY: 130, pointerId: 1 });
    });

    expect(timerSection).toHaveStyle({ marginTop: "30px" });
    expect(localStorage.getItem("focushud_right_rail_timer_offset")).toBe("30");

    // Drag stats dividing line vertically by 45px
    act(() => {
      fireEvent.pointerDown(statsLine, { clientY: 200, pointerId: 1 });
      fireEvent.pointerMove(statsLine, { clientY: 245, pointerId: 1 });
      fireEvent.pointerUp(statsLine, { clientY: 245, pointerId: 1 });
    });

    expect(statsSection).toHaveStyle({ marginTop: "45px" });
    expect(localStorage.getItem("focushud_right_rail_stats_offset")).toBe("45");

    // Timer section remains above Stats section (never swap places)
    expect(timerSection.compareDocumentPosition(statsSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("displays detailed system diagnostics when clicking the stats", async () => {
    vi.mocked(tauriBridge.getSystemDiagnostics).mockResolvedValue({
      cpu_usage: 42.5,
      cpu_name: "AMD Ryzen 9 5900X 12-Core Processor",
      cpu_cores: 12,
      ram_used_bytes: 16 * 1024 * 1024 * 1024,
      ram_total_bytes: 32 * 1024 * 1024 * 1024,
      ram_usage: 50.0,
      gpu_name: "NVIDIA GeForce RTX 4080",
      gpu_usage: 65.0,
      gpu_temp: 58,
      vram_used_bytes: 8 * 1024 * 1024 * 1024,
      vram_total_bytes: 16 * 1024 * 1024 * 1024,
      vram_usage: 50.0,
    });

    render(<RightSidebar width={68} activeNav="home" />);

    // Flush pending async state updates from getSystemDiagnostics
    await act(async () => {
      await Promise.resolve();
    });

    // Initially details dialog is not open
    expect(screen.queryByTestId("system-details-dialog")).not.toBeInTheDocument();

    // Click stats trigger / metrics area
    const clickableStats = screen.getByTestId("stats-metrics-clickable");
    act(() => {
      fireEvent.click(clickableStats);
    });

    // Detailed dialog is displayed
    const detailsDialog = screen.getByTestId("system-details-dialog");
    expect(detailsDialog).toBeInTheDocument();
    expect(screen.getByText("SYSTEM DIAGNOSTICS")).toBeInTheDocument();
    expect(screen.getByText("PROCESSOR (CPU)")).toBeInTheDocument();
    expect(screen.getByText("AMD Ryzen 9 5900X 12-Core Processor")).toBeInTheDocument();
    expect(screen.getByText("MEMORY (RAM)")).toBeInTheDocument();
    expect(screen.getByText("GRAPHICS (GPU)")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA GeForce RTX 4080")).toBeInTheDocument();

    // Close button dismisses dialog
    const closeBtn = screen.getByLabelText("Close system details");
    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(screen.queryByTestId("system-details-dialog")).not.toBeInTheDocument();
  });

  it("renders draggable lines above timer and stats, and has no overflowing icons to the right of system stats", async () => {
    let container!: HTMLElement;
    await act(async () => {
      const res = render(<RightSidebar width={68} activeNav="home" />);
      container = res.container;
      await Promise.resolve();
    });

    // 1. Draggable lines above timer and stats
    const timerLine = screen.getByTestId("timer-drag-handle");
    const statsLine = screen.getByTestId("stats-drag-handle");
    expect(timerLine).toBeInTheDocument();
    expect(statsLine).toBeInTheDocument();
    expect(timerLine).toHaveAttribute("draggable", "true");
    expect(statsLine).toHaveAttribute("draggable", "true");

    // 2. Dragging the line above timer vertically adjusts its offset
    act(() => {
      fireEvent.pointerDown(timerLine, { clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(timerLine, { clientY: 135, pointerId: 1 });
      fireEvent.pointerUp(timerLine, { clientY: 135, pointerId: 1 });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(localStorage.getItem("focushud_right_rail_timer_offset")).toBe("35");

    // 3. Header has clean STATS title with no overflowing icons to its right
    const statsTrigger = screen.getByTestId("stats-details-trigger");
    expect(statsTrigger).toBeInTheDocument();
    const statsHeader = statsTrigger.parentElement!;
    // Only the trigger button exists in this header row
    expect(statsHeader.querySelectorAll("button").length).toBe(1);

    // 4. Corner dots on the right rail: top-left and bottom-right blue dots are present
    const dots = container.querySelectorAll(".bg-cyan-400\\/80");
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });

  it("drags the dividing lines vertically using pointer events to adjust vertical position along the rail", async () => {
    localStorage.removeItem("focushud_right_rail_timer_offset");
    localStorage.removeItem("focushud_right_rail_stats_offset");
    act(() => {
      render(<RightSidebar width={68} activeNav="home" />);
    });

    const timerLine = screen.getByTestId("timer-drag-handle");
    const statsLine = screen.getByTestId("stats-drag-handle");
    expect(timerLine).toBeInTheDocument();
    expect(statsLine).toBeInTheDocument();

    // Drag timer line vertically down by 50px
    act(() => {
      fireEvent.pointerDown(timerLine, { clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(timerLine, { clientY: 150, pointerId: 1 });
      fireEvent.pointerUp(timerLine, { clientY: 150, pointerId: 1 });
    });

    expect(localStorage.getItem("focushud_right_rail_timer_offset")).toBe("50");

    // Drag stats line vertically down by 60px
    act(() => {
      fireEvent.pointerDown(statsLine, { clientY: 200, pointerId: 1 });
      fireEvent.pointerMove(statsLine, { clientY: 260, pointerId: 1 });
      fireEvent.pointerUp(statsLine, { clientY: 260, pointerId: 1 });
    });

    expect(localStorage.getItem("focushud_right_rail_stats_offset")).toBe("60");

    // Ensure timer and stats never swap places
    const timerSection = screen.getByTestId("right-rail-timer-wrapper");
    const statsSection = screen.getByTestId("right-rail-stats-wrapper");
    expect(timerSection.compareDocumentPosition(statsSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the right rail fixed to the right edge when expanding from a collapsed state below 120px", () => {
    // Render at an intermediate width between collapsed (68px) and expanded (120px), e.g. 100px
    let container: HTMLElement;
    act(() => {
      const res = render(<RightSidebar width={100} activeNav="home" />);
      container = res.container;
    });
    const aside = container!.querySelector("aside");
    expect(aside).toHaveClass("justify-end");

    const rail = container!.querySelector(".hud-panel.w-\\[52px\\]");
    expect(rail).toHaveClass("ml-auto");
  });
});
