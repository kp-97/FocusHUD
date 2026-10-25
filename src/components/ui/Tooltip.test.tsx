import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip, resetTooltipWarmup } from "./Tooltip";

describe("Tooltip Component", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetTooltipWarmup();
  });

  it("renders trigger and strips native title attribute while setting aria-label", () => {
    render(
      <Tooltip content="Home Dashboard">
        <button title="Original Native Title">Icon</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Home Dashboard" });
    expect(button).toBeInTheDocument();
    // Native title should be stripped to prevent slow OS tooltip delay
    expect(button).not.toHaveAttribute("title");
  });

  it("shows tooltip instantly on hover when delay is 0", () => {
    render(
      <Tooltip content="Tasks View" side="right">
        <button>Tasks</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Tasks View" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(button);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Tasks View");
  });

  it("hides tooltip on mouse leave", () => {
    render(
      <Tooltip content="Calendar View">
        <button>Calendar</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Calendar View" });
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows on keyboard focus and hides on blur", () => {
    render(
      <Tooltip content="Settings Modal">
        <button>Settings</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Settings Modal" });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on click", () => {
    render(
      <Tooltip content="Clickable Action">
        <button>Action</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Clickable Action" });
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not render tooltip when disabled", () => {
    render(
      <Tooltip content="Disabled Tooltip" disabled={true}>
        <button>Disabled</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Disabled" });
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders shortcut tag when provided", () => {
    render(
      <Tooltip content="AI Chat" shortcut="Ctrl+K">
        <button>Chat</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "AI Chat" });
    fireEvent.mouseEnter(button);

    expect(screen.getByRole("tooltip")).toHaveTextContent("AI Chat");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Ctrl+K");
  });

  it("supports delayed show when specified", () => {
    vi.useFakeTimers();

    render(
      <Tooltip content="Delayed Info" delay={200}>
        <button>Delayed</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Delayed Info" });
    fireEvent.mouseEnter(button);

    // Not visible immediately
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Advance timer past delay
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
