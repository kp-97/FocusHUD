import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JointDualViewContainer } from "./JointDualViewContainer";

describe("JointDualViewContainer component", () => {
  const defaultProps = {
    isDualView: false,
    jointLeftWidth: 400,
    activeNav: "home",
    currentRightNav: "chat",
    containerWidth: 1200,
    onSelectRightNav: vi.fn(),
    onToggleDualView: vi.fn(),
    onDividerChange: vi.fn(),
    onDividerEnd: vi.fn(),
    renderView: (nav: string) => <div data-testid={`view-content-${nav}`}>{nav.toUpperCase()} CONTENT</div>,
  };

  it("renders single view mode with view content and split view button", () => {
    render(<JointDualViewContainer {...defaultProps} isDualView={false} />);

    expect(screen.getByTestId("view-content-home")).toBeInTheDocument();
    expect(screen.queryByTestId("view-content-chat")).not.toBeInTheDocument();

    const splitBtn = screen.getByTestId("toggle-dual-view-button");
    expect(splitBtn).toBeInTheDocument();
    fireEvent.click(splitBtn);
    expect(defaultProps.onToggleDualView).toHaveBeenCalledWith(true);
  });

  it("renders dual view mode with both View 1 and View 2 side-by-side", () => {
    render(<JointDualViewContainer {...defaultProps} isDualView={true} />);

    expect(screen.getByTestId("dual-view-container")).toBeInTheDocument();
    expect(screen.getByTestId("dual-view-left-pane")).toBeInTheDocument();
    expect(screen.getByTestId("dual-view-right-pane")).toBeInTheDocument();

    expect(screen.getByTestId("view-content-home")).toBeInTheDocument();
    expect(screen.getByTestId("view-content-chat")).toBeInTheDocument();
  });

  it("allows selecting a different right view via dropdown menu", () => {
    render(<JointDualViewContainer {...defaultProps} isDualView={true} />);

    const dropdownBtn = screen.getByTestId("dual-view-right-selector-button");
    fireEvent.click(dropdownBtn);

    const notesOption = screen.getByRole("menuitem", { name: /notes/i });
    expect(notesOption).toBeInTheDocument();
    fireEvent.click(notesOption);

    expect(defaultProps.onSelectRightNav).toHaveBeenCalledWith("notes");
  });

  it("allows closing dual view back to single view", () => {
    render(<JointDualViewContainer {...defaultProps} isDualView={true} />);

    const closeBtn = screen.getByTestId("close-dual-view-button");
    fireEvent.click(closeBtn);

    expect(defaultProps.onToggleDualView).toHaveBeenCalledWith(false);
  });
});
