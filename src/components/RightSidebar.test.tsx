import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RightSidebar } from "./RightSidebar";
import { pomodoroActions } from "../utils/pomodoroStore";

describe("RightSidebar component", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("renders compact mini HUD rail when snapped (width < 120)", () => {
    render(<RightSidebar width={68} activeNav="home" />);
    // In compact mode, the full header is hidden and the mini rail is rendered
    expect(screen.queryByText(/VIEW: HOME/i)).not.toBeInTheDocument();
    expect(screen.getByText(/FOCUS/i)).toBeInTheDocument();
    expect(screen.getByText(/CYCLES/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Focus Timer/i)).toBeInTheDocument();
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

