import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RightSidebar } from "./RightSidebar";
import { pomodoroActions } from "../utils/pomodoroStore";
import * as tauriBridge from "../utils/tauriBridge";

vi.mock("../utils/tauriBridge", () => ({
  exitApp: vi.fn(),
  minimizeToTray: vi.fn(),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
}));

describe("RightSidebar component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    pomodoroActions.pause();
    pomodoroActions.reset();
  });

  afterEach(() => {
    pomodoroActions.pause();
    pomodoroActions.reset();
  });

  it("renders standard view when expanded (width >= 120)", () => {
    render(<RightSidebar width={280} activeNav="home" />);
    expect(screen.getByText(/VIEW: HOME/i)).toBeInTheDocument();
  });

  it("renders window controls in expanded header and triggers actions", () => {
    const handleCollapse = vi.fn();
    const handleMaximize = vi.fn();

    render(
      <RightSidebar
        width={280}
        activeNav="home"
        onCollapse={handleCollapse}
        onMaximizePanes={handleMaximize}
      />
    );

    // 1. Right toggle button calls onCollapse
    const toggleBtn = screen.getByTestId("sidebar-toggle-right");
    fireEvent.click(toggleBtn);
    expect(handleCollapse).toHaveBeenCalledTimes(1);

    // 2. Minimize to tray button
    const minBtn = screen.getByLabelText(/Minimize FocusHUD to Tray/i);
    fireEvent.click(minBtn);
    expect(tauriBridge.minimizeToTray).toHaveBeenCalledTimes(1);

    // 3. Maximize panes button
    const maxBtn = screen.getByLabelText(/Maximize Left & Right Panes/i);
    fireEvent.click(maxBtn);
    expect(handleMaximize).toHaveBeenCalledTimes(1);

    // 4. Exit button
    const exitBtn = screen.getByLabelText(/Close FocusHUD/i);
    fireEvent.click(exitBtn);
    expect(tauriBridge.exitApp).toHaveBeenCalledTimes(1);
  });

  it("renders compact mini HUD rail when snapped (width < 120)", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    // In compact mode, the full header is hidden and the mini rail is rendered
    expect(screen.queryByText(/VIEW: HOME/i)).not.toBeInTheDocument();
    expect(screen.getByText(/FOCUS/i)).toBeInTheDocument();
    expect(screen.getByText(/CYCLES/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
  });

  it("renders compact window controls in compact mini HUD rail", () => {
    const handleExpand = vi.fn();
    const handleMaximize = vi.fn();

    render(
      <RightSidebar
        width={68}
        activeNav="home"
        onExpand={handleExpand}
        onMaximizePanes={handleMaximize}
      />
    );

    // Toggle button in compact rail triggers onExpand
    const toggleBtn = screen.getByTestId("sidebar-toggle-right");
    fireEvent.click(toggleBtn);
    expect(handleExpand).toHaveBeenCalledTimes(1);

    // Minimize in compact rail
    const minBtn = screen.getByLabelText(/Minimize to Tray/i);
    fireEvent.click(minBtn);
    expect(tauriBridge.minimizeToTray).toHaveBeenCalledTimes(1);

    // Maximize in compact rail
    const maxBtn = screen.getByLabelText(/Maximize Panes/i);
    fireEvent.click(maxBtn);
    expect(handleMaximize).toHaveBeenCalledTimes(1);

    // Exit in compact rail
    const exitBtn = screen.getByLabelText(/Close FocusHUD/i);
    fireEvent.click(exitBtn);
    expect(tauriBridge.exitApp).toHaveBeenCalledTimes(1);
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

  it("triggers onExpand when clicking the expand button in compact rail", () => {
    const handleExpand = vi.fn();
    render(<RightSidebar width={68} activeNav="home" onExpand={handleExpand} />);

    const expandBtn = screen.getByTitle(/Expand Right Panel/i);
    act(() => {
      fireEvent.click(expandBtn);
    });
    expect(handleExpand).toHaveBeenCalledTimes(1);
  });
});
