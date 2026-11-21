import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Tree3DRenderer, TreeNode3D } from "./Tree3DRenderer";

describe("Tree3DRenderer class", () => {
  let canvas: HTMLCanvasElement;
  let mockContext: any;

  const sampleTree: TreeNode3D[] = [
    {
      id: "root-1",
      title: "Root Objective 1",
      completed: false,
      children: [
        {
          id: "child-1-1",
          title: "Child Task 1.1",
          completed: true,
          children: [],
        },
        {
          id: "child-1-2",
          title: "Child Task 1.2",
          completed: false,
          children: [],
        },
      ],
    },
    {
      id: "root-2",
      title: "Root Objective 2",
      completed: false,
      children: [],
    },
  ];

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
    };

    canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 600, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 400, configurable: true });
    vi.spyOn(canvas, "getContext").mockReturnValue(mockContext as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("flattenTreeTo3D", () => {
    it("returns empty array for empty node list", () => {
      expect(Tree3DRenderer.flattenTreeTo3D([])).toEqual([]);
    });

    it("flattens hierarchical tree into spatial coordinates with correct depths and parent relations", () => {
      const spatial = Tree3DRenderer.flattenTreeTo3D(sampleTree);
      expect(spatial).toHaveLength(4);

      const root1 = spatial.find((n) => n.id === "root-1");
      expect(root1).toBeDefined();
      expect(root1?.depth).toBe(0);
      expect(root1?.parentId).toBeNull();

      const child1 = spatial.find((n) => n.id === "child-1-1");
      expect(child1).toBeDefined();
      expect(child1?.depth).toBe(1);
      expect(child1?.parentId).toBe("root-1");
      expect(child1?.completed).toBe(true);
    });
  });

  describe("renderer lifecycle and interactions", () => {
    it("initializes and focuses on first node when data is set", () => {
      const onActive = vi.fn();
      const onSelect = vi.fn();
      const renderer = new Tree3DRenderer({
        canvas,
        onActiveNodeChange: onActive,
        onSelectNode: onSelect,
      });

      renderer.setData(sampleTree);

      expect(renderer.getActiveNodeId()).toBe("root-1");
      expect(onActive).toHaveBeenCalledWith(
        expect.objectContaining({ id: "root-1" })
      );
      expect(onSelect).toHaveBeenCalledWith("root-1");
      expect(renderer.getSpatialNodes()).toHaveLength(4);
    });

    it("updates zoom and clamps within boundary range [0.4, 2.5]", () => {
      const onZoom = vi.fn();
      const renderer = new Tree3DRenderer({
        canvas,
        onZoomChange: onZoom,
      });

      expect(renderer.getZoom()).toBe(1.0);

      renderer.zoomBy(0.5);
      expect(renderer.getZoom()).toBe(1.5);
      expect(onZoom).toHaveBeenCalledWith(1.5);

      // Attempt to exceed max zoom
      renderer.zoomBy(5.0);
      expect(renderer.getZoom()).toBe(2.5);

      // Attempt to go below min zoom
      renderer.zoomBy(-10.0);
      expect(renderer.getZoom()).toBe(0.4);
    });

    it("toggles vertical lock and resets pitch on locking", () => {
      const onLockChange = vi.fn();
      const onPitchChange = vi.fn();
      const renderer = new Tree3DRenderer({
        canvas,
        onVerticalLockChange: onLockChange,
        onPitchChange: onPitchChange,
      });

      expect(renderer.isLocked()).toBe(true);

      // Unlock
      renderer.toggleVerticalLock();
      expect(renderer.isLocked()).toBe(false);
      expect(onLockChange).toHaveBeenCalledWith(false);

      // Start drag and tilt vertically while unlocked
      renderer.startDrag(100, 100);
      renderer.drag(100, 150);
      renderer.endDrag();
      expect(renderer.getPitch()).not.toBe(0.2);

      // Lock again -> pitch resets to 0.2
      renderer.toggleVerticalLock();
      expect(renderer.isLocked()).toBe(true);
      expect(renderer.getPitch()).toBe(0.2);
    });

    it("navigates down to child and up to parent with keyboard arrows", () => {
      const renderer = new Tree3DRenderer({ canvas });
      renderer.setData(sampleTree);

      expect(renderer.getActiveNodeId()).toBe("root-1");

      // Down -> focuses child-1-1
      const downTarget = renderer.navigateKeyboard("ArrowDown");
      expect(downTarget?.id).toBe("child-1-1");
      expect(renderer.getActiveNodeId()).toBe("child-1-1");

      // Right -> rotates to child-1-2 (same depth)
      const rightTarget = renderer.navigateKeyboard("ArrowRight");
      expect(rightTarget?.id).toBe("child-1-2");
      expect(renderer.getActiveNodeId()).toBe("child-1-2");

      // Up -> focuses back to parent root-1
      const upTarget = renderer.navigateKeyboard("ArrowUp");
      expect(upTarget?.id).toBe("root-1");
      expect(renderer.getActiveNodeId()).toBe("root-1");
    });

    it("projects 3D coordinates to 2D canvas screen points", () => {
      const renderer = new Tree3DRenderer({ canvas });
      renderer.setData(sampleTree);

      const proj = renderer.project(0, 0, 50, 600, 400);
      expect(proj).not.toBeNull();
      expect(proj?.px).toBeGreaterThan(0);
      expect(proj?.py).toBeGreaterThan(0);
      expect(proj?.scale).toBeGreaterThan(0);
      expect(proj?.zOrder).toBeGreaterThan(0);
    });

    it("runs animation frame render loop and cleans up on destroy", () => {
      let reqId = 1;
      const requestSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation(() => {
          return reqId++;
        });
      const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

      const renderer = new Tree3DRenderer({ canvas });
      renderer.setData(sampleTree);
      renderer.start();

      expect(requestSpy).toHaveBeenCalled();

      renderer.destroy();
      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
