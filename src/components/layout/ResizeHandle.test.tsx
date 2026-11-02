import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

// Mock Tauri bridge invocation
vi.mock("../../services/tauriBridge", () => ({
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

  it("positions the drag bar where the cursor is when hovering over the edge", () => {
    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={vi.fn()}
        onDragEnd={vi.fn()}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");

    // Mock getBoundingClientRect
    handle.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      height: 800,
      left: 280,
      width: 14,
    });

    // Hover at clientY = 250 (which is 150px relative to top)
    fireEvent.mouseEnter(handle, { clientY: 250 });

    const dragBar = screen.getByTestId("resize-drag-bar");
    expect(dragBar).toBeInTheDocument();
    expect(dragBar).toHaveStyle({ top: "150px" });

    // Move cursor to clientY = 400 (which is 300px relative to top)
    fireEvent.mouseMove(handle, { clientY: 400 });
    expect(dragBar).toHaveStyle({ top: "300px" });
  });

  it("keeps the resize line completely transparent on hover and triggers light effect when holding click", () => {
    const { rerender } = render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={vi.fn()}
        onDragEnd={vi.fn()}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");
    const glowLine = screen.getByTestId("resize-glow-line");

    // Line is completely transparent by default
    expect(glowLine).toHaveClass("bg-transparent");
    expect(glowLine).toHaveClass("opacity-0");

    // Line is pushed all the way to respective edge (left for side="left")
    expect(glowLine).toHaveClass("mr-auto");

    // Hovering does NOT trigger the light effect
    fireEvent.mouseEnter(handle);
    expect(glowLine).toHaveClass("bg-transparent");
    expect(glowLine).toHaveClass("opacity-0");

    // Holding click triggers the light effect
    fireEvent.pointerDown(handle, { clientX: 280, clientY: 300, pointerId: 1 });
    expect(glowLine).toHaveClass("bg-cyan-300");
    expect(glowLine).toHaveClass("opacity-100");

    // Releasing click returns to transparent
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(glowLine).toHaveClass("bg-transparent");
    expect(glowLine).toHaveClass("opacity-0");

    // For side="right", line is pushed to the right edge
    rerender(
      <ResizeHandle
        side="right"
        currentWidth={280}
        onDragChange={vi.fn()}
        onDragEnd={vi.fn()}
      />
    );
    const rightGlowLine = screen.getByTestId("resize-glow-line");
    expect(rightGlowLine).toHaveClass("ml-auto");
  });

  it("locks the vertical position of the resize button once the user holds click when resizing", () => {
    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={vi.fn()}
        onDragEnd={vi.fn()}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");
    handle.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      height: 800,
      left: 280,
      width: 14,
    });

    // 1. Hover at clientY = 250 (150px from top)
    fireEvent.mouseEnter(handle, { clientY: 250 });
    const dragBar = screen.getByTestId("resize-drag-bar");
    expect(dragBar).toHaveStyle({ top: "150px" });

    // 2. Click down at clientY = 300 (200px from top)
    fireEvent.pointerDown(handle, { clientX: 280, clientY: 300, pointerId: 1 });
    expect(dragBar).toHaveStyle({ top: "200px" });
    expect(dragBar).toHaveClass("transition-none");

    // 3. Move cursor vertically while holding click down (e.g. clientY moves to 500)
    // Vertical position MUST NOT update; it stays locked at 200px
    fireEvent.pointerMove(handle, { clientX: 320, clientY: 500, pointerId: 1 });
    expect(dragBar).toHaveStyle({ top: "200px" });

    // 4. Release click
    fireEvent.pointerUp(handle, { pointerId: 1 });

    // 5. Moving while not holding click updates position again
    fireEvent.mouseMove(handle, { clientY: 500 });
    expect(dragBar).toHaveStyle({ top: "400px" });
  });

  it("allows expanding past 500px without restriction when dragged", () => {
    const onDragChange = vi.fn();
    render(
      <ResizeHandle
        side="left"
        currentWidth={280}
        onDragChange={onDragChange}
        onDragEnd={vi.fn()}
      />
    );

    const handle = screen.getByTitle("Drag to resize (Double-click to toggle width)");

    // Start drag at x=280
    fireEvent.pointerDown(handle, { clientX: 280, clientY: 300, pointerId: 1 });

    // Drag past 500px to 850px
    fireEvent.pointerMove(handle, { clientX: 850, clientY: 300, pointerId: 1 });

    // Ensure onDragChange was called with > 500px (e.g. 850px), not capped at 500px
    expect(onDragChange).toHaveBeenCalled();
    const lastCalledWidth = onDragChange.mock.calls[onDragChange.mock.calls.length - 1][0];
    expect(lastCalledWidth).toBe(850);
  });
});
