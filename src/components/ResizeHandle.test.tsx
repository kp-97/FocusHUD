import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

// Mock Tauri bridge invocation
vi.mock("../utils/tauriBridge", () => ({
  setDockDragMode: vi.fn().mockResolvedValue(true),
}));

describe("ResizeHandle component", () => {
  it("renders with default styling and title tooltip", () => {
    const onDragChange = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={onDragChange}
        onDragEnd={onDragEnd}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");
    expect(handle).toBeInTheDocument();
  });

  it("triggers onDoubleClick handler when double-clicked", () => {
    const onDoubleClick = vi.fn();
    const onDragChange = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={onDragChange}
        onDragEnd={onDragEnd}
        onDoubleClick={onDoubleClick}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");
    fireEvent.doubleClick(handle);

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("shows current width indicator on mouse enter", () => {
    const onDragChange = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={onDragChange}
        onDragEnd={onDragEnd}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");
    fireEvent.mouseEnter(handle);

    expect(screen.getByText("280px")).toBeInTheDocument();
  });
});
