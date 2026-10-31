import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RightSidebar } from "./RightSidebar";
import { pomodoroActions } from "../../../stores/pomodoroStore";
import * as tauriBridge from "../../../services/tauriBridge";

vi.mock("../../../services/tauriBridge", () => ({
  exitApp: vi.fn(),
  minimizeToTray: vi.fn(),
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
    pomodoroActions.pause();
    pomodoroActions.reset();
    vi.useRealTimers();
  });

  it("renders standard view when expanded (width >= 120)", () => {
    render(<RightSidebar width={280} activeNav="home" />);
    expect(screen.getByLabelText(/Close FocusHUD/i)).toBeInTheDocument();
    expect(screen.getAllByText(/POMODORO TIMER/i).length).toBeGreaterThan(0);
  });

  it("renders window controls in expanded header and triggers actions", () => {
    const handleMaximize = vi.fn();

    render(
      <RightSidebar
        width={280}
        activeNav="home"
        onMaximizePanes={handleMaximize}
      />
    );

    // 1. Minimize to tray button
    const minBtn = screen.getByLabelText(/Minimize FocusHUD to Tray/i);
    fireEvent.click(minBtn);
    expect(tauriBridge.minimizeToTray).toHaveBeenCalledTimes(1);

    // 2. Maximize panes button
    const maxBtn = screen.getByLabelText(/Maximize Left & Right Panes/i);
    fireEvent.click(maxBtn);
    expect(handleMaximize).toHaveBeenCalledTimes(1);

    // 3. Exit button
    const exitBtn = screen.getByLabelText(/Close FocusHUD/i);
    fireEvent.click(exitBtn);
    expect(tauriBridge.exitApp).toHaveBeenCalledTimes(1);
  });

  it("renders compact mini HUD rail when snapped (width < 120)", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    // In compact mode, the full header is hidden and the mini rail is rendered
    expect(screen.queryByText(/VIEW: HOME/i)).not.toBeInTheDocument();
    expect(screen.getByText(/CYCLES/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
  });

  it("renders compact controls in compact mini HUD rail", () => {
    const handleSettings = vi.fn();

    render(
      <RightSidebar
        width={68}
        activeNav="home"
        onOpenSettings={handleSettings}
      />
    );

    // Hamburger menu button in compact rail
    const menuBtn = screen.getByLabelText(/System Menu/i);
    expect(menuBtn).toBeInTheDocument();
    act(() => {
      fireEvent.click(menuBtn);
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM MENU")).toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("right", true);

    // Minimize and Exit buttons should NOT exist in compact rail
    expect(screen.queryByLabelText(/Minimize to Tray/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Close FocusHUD/i)).not.toBeInTheDocument();
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

  it("ignores premature blur events on compact rail hamburger menu during focus shifts and closes on legitimate outside-click", () => {
    vi.useFakeTimers();
    try {
      render(<RightSidebar width={68} activeNav="home" />);
      const menuBtn = screen.getByLabelText(/System Menu/i);
      act(() => {
        fireEvent.click(menuBtn);
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Premature blur (< 250ms) ignored (Issue #42)
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Outside click after immunity closes menu
      act(() => {
        vi.advanceTimersByTime(150);
        fireEvent.mouseDown(document.body);
      });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("right", false);
    } finally {
      vi.useRealTimers();
    }
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
});
