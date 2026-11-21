import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tree3DView, TreeNode3D } from "./Tree3DView";

describe("Tree3DView component", () => {
  const sampleTree: TreeNode3D[] = [
    {
      id: "node-root",
      title: "Root Objective",
      completed: false,
      children: [
        {
          id: "node-child",
          title: "Sub-Project Alpha",
          completed: true,
          children: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
    }) as any;

    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(vi.fn());
  });

  it("renders HUD controls and active node status readout", () => {
    const onSelect = vi.fn();
    render(<Tree3DView data={sampleTree} onSelectNode={onSelect} />);

    // Vertical lock button (default V-LOCKED)
    expect(screen.getByText("V-LOCKED")).toBeInTheDocument();

    // Zoom and reset buttons
    expect(screen.getByTitle("Zoom In")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom Out")).toBeInTheDocument();
    expect(screen.getByTitle("Re-Center on Focused Node")).toBeInTheDocument();

    // Status readout
    expect(screen.getByText(/Root Objective/i)).toBeInTheDocument();
    expect(screen.getByText(/\[↑\/↓ LEVEL · ←\/→ ROTATE\]/i)).toBeInTheDocument();
  });

  it("toggles vertical lock when V-LOCKED button is clicked", () => {
    render(<Tree3DView data={sampleTree} />);

    const lockBtn = screen.getByText("V-LOCKED");
    fireEvent.click(lockBtn);

    expect(screen.getByText("FREE 3D")).toBeInTheDocument();

    fireEvent.click(screen.getByText("FREE 3D"));
    expect(screen.getByText("V-LOCKED")).toBeInTheDocument();
  });

  it("supports keyboard arrow navigation within container", () => {
    render(<Tree3DView data={sampleTree} />);

    const container = screen.getByText(/\[↑\/↓ LEVEL · ←\/→ ROTATE\]/i).closest("div")?.parentElement;
    expect(container).toBeDefined();

    if (container) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
      // Child node should now be focused
      expect(screen.getByText(/Sub-Project Alpha/i)).toBeInTheDocument();
      expect(screen.getByText(/COMPLETE/i)).toBeInTheDocument();
    }
  });

  it("triggers zoom and reset view actions", () => {
    render(<Tree3DView data={sampleTree} />);

    const zoomInBtn = screen.getByTitle("Zoom In");
    const zoomOutBtn = screen.getByTitle("Zoom Out");
    const resetBtn = screen.getByTitle("Re-Center on Focused Node");

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(resetBtn);

    expect(screen.getByText(/Root Objective/i)).toBeInTheDocument();
  });
});

