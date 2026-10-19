import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarToggleIcon } from "./SidebarToggleIcon";

describe("SidebarToggleIcon", () => {
  it("renders collapsed left toggle icon with thin bar and previews wide bar on hover", () => {
    const handleToggle = vi.fn();
    const { container } = render(
      <SidebarToggleIcon
        side="left"
        isCollapsed={true}
        onToggle={handleToggle}
      />
    );

    const btn = screen.getByTestId("sidebar-toggle-left");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute(
      "title",
      "Left panel collapsed (hover to preview expand)"
    );

    // Initial thin bar rect has width="4"
    const fillRect = container.querySelector("g[clip-path] rect");
    expect(fillRect).toHaveAttribute("width", "4");

    // Hover previews expanded wide bar (width="7")
    fireEvent.mouseEnter(btn);
    expect(btn).toHaveAttribute(
      "title",
      "Click to expand left panel to previous width"
    );
    expect(fillRect).toHaveAttribute("width", "7");

    // Mouse leave restores collapsed thin bar (width="4")
    fireEvent.mouseLeave(btn);
    expect(fillRect).toHaveAttribute("width", "4");

    // Click triggers onToggle
    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("renders expanded left toggle icon with wide bar and previews thin bar on hover", () => {
    const handleToggle = vi.fn();
    const { container } = render(
      <SidebarToggleIcon
        side="left"
        isCollapsed={false}
        onToggle={handleToggle}
      />
    );

    const btn = screen.getByTestId("sidebar-toggle-left");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute(
      "title",
      "Left panel expanded (hover to preview collapse)"
    );

    // Initial wide bar has width="7"
    const fillRect = container.querySelector("g[clip-path] rect");
    expect(fillRect).toHaveAttribute("width", "7");

    // Hover previews collapsed thin bar (width="4")
    fireEvent.mouseEnter(btn);
    expect(btn).toHaveAttribute(
      "title",
      "Click to collapse left panel to 68px"
    );
    expect(fillRect).toHaveAttribute("width", "4");

    // Mouse leave restores expanded wide bar
    fireEvent.mouseLeave(btn);
    expect(fillRect).toHaveAttribute("width", "7");

    // Click triggers onToggle
    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("renders mirrored right toggle icon with right-aligned x coordinates", () => {
    const handleToggle = vi.fn();
    const { container, rerender } = render(
      <SidebarToggleIcon
        side="right"
        isCollapsed={true}
        onToggle={handleToggle}
        theme="amber"
      />
    );

    const btn = screen.getByTestId("sidebar-toggle-right");
    // Right collapsed thin bar: x="13", width="4"
    let fillRect = container.querySelector("g[clip-path] rect");
    expect(fillRect).toHaveAttribute("x", "13");
    expect(fillRect).toHaveAttribute("width", "4");

    // Hover previews right expanded: x="10", width="7"
    fireEvent.mouseEnter(btn);
    expect(fillRect).toHaveAttribute("x", "10");
    expect(fillRect).toHaveAttribute("width", "7");

    // Unhover
    fireEvent.mouseLeave(btn);
    expect(fillRect).toHaveAttribute("x", "13");
    expect(fillRect).toHaveAttribute("width", "4");

    // Rerender as expanded
    rerender(
      <SidebarToggleIcon
        side="right"
        isCollapsed={false}
        onToggle={handleToggle}
        theme="cyan"
      />
    );

    // Expanded default: x="10", width="7"
    fillRect = container.querySelector("g[clip-path] rect");
    expect(fillRect).toHaveAttribute("x", "10");
    expect(fillRect).toHaveAttribute("width", "7");

    // Hover previews collapse: x="13", width="4"
    fireEvent.mouseEnter(btn);
    expect(fillRect).toHaveAttribute("x", "13");
    expect(fillRect).toHaveAttribute("width", "4");
  });

  it("renders dual-pane toggle icon with side='both' showing two bars", () => {
    const handleToggle = vi.fn();
    const { container, rerender } = render(
      <SidebarToggleIcon
        side="both"
        isCollapsed={true}
        onToggle={handleToggle}
        theme="cyan"
      />
    );

    const btn = screen.getByTestId("sidebar-toggle-both");
    expect(btn).toHaveAttribute(
      "title",
      "Panels collapsed (hover to preview expand)"
    );

    // Two bars inside clip path
    let fillRects = container.querySelectorAll("g[clip-path] rect");
    expect(fillRects).toHaveLength(2);
    // Left thin bar
    expect(fillRects[0]).toHaveAttribute("x", "1");
    expect(fillRects[0]).toHaveAttribute("width", "2.5");
    // Right thin bar
    expect(fillRects[1]).toHaveAttribute("x", "14.5");
    expect(fillRects[1]).toHaveAttribute("width", "2.5");

    // Hover previews dual expanded
    fireEvent.mouseEnter(btn);
    expect(btn).toHaveAttribute(
      "title",
      "Click to expand left and right panels"
    );
    expect(fillRects[0]).toHaveAttribute("width", "4.5");
    expect(fillRects[1]).toHaveAttribute("width", "4.5");

    // Unhover
    fireEvent.mouseLeave(btn);
    expect(fillRects[0]).toHaveAttribute("width", "2.5");
    expect(fillRects[1]).toHaveAttribute("width", "2.5");

    // Click triggers onToggle
    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Rerender as expanded
    rerender(
      <SidebarToggleIcon
        side="both"
        isCollapsed={false}
        onToggle={handleToggle}
        theme="cyan"
      />
    );

    fillRects = container.querySelectorAll("g[clip-path] rect");
    expect(fillRects[0]).toHaveAttribute("width", "4.5");
    expect(fillRects[1]).toHaveAttribute("width", "4.5");
  });
});
