import { flattenTreeTo3D } from "./tree3DLayout";
import { project3DTo2D } from "./tree3DCamera";
import { renderGrid, renderConnections, renderNodes } from "./tree3DDrawing";

export interface TreeNode3D {
  id: string;
  title: string;
  completed?: boolean;
  children?: TreeNode3D[];
}

export interface SpatialNode {
  id: string;
  title: string;
  completed: boolean;
  x: number;
  y: number;
  z: number;
  parentId: string | null;
  depth: number;
}

export interface ProjectedNode {
  node: SpatialNode;
  px: number;
  py: number;
  scale: number;
  radius: number;
  zOrder: number;
}

export interface Tree3DRendererOptions {
  canvas: HTMLCanvasElement;
  accentColor?: string;
  onActiveNodeChange?: (node: SpatialNode | null) => void;
  onSelectNode?: (nodeId: string) => void;
  onHoverNodeChange?: (node: SpatialNode | null) => void;
  onVerticalLockChange?: (locked: boolean) => void;
  onZoomChange?: (zoom: number) => void;
  onPitchChange?: (pitch: number) => void;
}

/**
 * Standalone high-performance 3D canvas rendering engine for hierarchical trees.
 * Executes projection math, camera physics, drag rotation, and requestAnimationFrame
 * rendering loop completely outside React re-render cycles.
 */
export class Tree3DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private options: Tree3DRendererOptions;

  private data: TreeNode3D[] = [];
  private spatialNodes: SpatialNode[] = [];
  private projectedNodes: ProjectedNode[] = [];
  private activeNodeId: string | null = null;
  private hoveredNode: SpatialNode | null = null;
  private accentColor: string = "#00e5ff";

  // Rotation & camera targets
  private pitch: number = 0.2;
  private zoom: number = 1.0;
  private currentYaw: number = 0;
  private targetYaw: number = 0;
  private currentCamCenterY: number = -40;
  private targetCamCenterY: number = -40;
  private isVerticalLocked: boolean = true;

  // Drag interaction state
  private isDragging: boolean = false;
  private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };

  // Loop handle
  private animId: number | null = null;
  private isRunning: boolean = false;

  constructor(options: Tree3DRendererOptions) {
    this.canvas = options.canvas;
    this.options = options;
    if (options.accentColor) {
      this.accentColor = options.accentColor;
    }
    this.ctx = this.canvas.getContext("2d");
  }

  /**
   * Flatten nested tree nodes into 3D spatial cylindrical coordinates.
   */
  public static flattenTreeTo3D(nodes: TreeNode3D[]): SpatialNode[] {
    return flattenTreeTo3D(nodes);
  }

  /**
   * Set tree data and update spatial representation.
   */
  public setData(data: TreeNode3D[]): void {
    this.data = data;
    this.spatialNodes = Tree3DRenderer.flattenTreeTo3D(data);

    if (this.spatialNodes.length > 0) {
      const exists = this.spatialNodes.some((n) => n.id === this.activeNodeId);
      if (!exists) {
        this.focusOnNode(this.spatialNodes[0].id);
      }
    } else {
      this.activeNodeId = null;
      if (this.options.onActiveNodeChange) {
        this.options.onActiveNodeChange(null);
      }
    }
  }

  public setAccentColor(accentColor: string): void {
    this.accentColor = accentColor;
  }

  public setOptions(options: Partial<Tree3DRendererOptions>): void {
    this.options = { ...this.options, ...options };
    if (options.accentColor) {
      this.accentColor = options.accentColor;
    }
  }

  public getData(): TreeNode3D[] {
    return this.data;
  }

  public getActiveNodeId(): string | null {
    return this.activeNodeId;
  }

  public getActiveNode(): SpatialNode | null {
    return this.spatialNodes.find((n) => n.id === this.activeNodeId) || null;
  }

  public getSpatialNodes(): SpatialNode[] {
    return this.spatialNodes;
  }

  public getZoom(): number {
    return this.zoom;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public isLocked(): boolean {
    return this.isVerticalLocked;
  }

  /**
   * Focus camera on a specific node by ID, rotating smoothly towards it.
   */
  public focusOnNode(nodeId: string): void {
    const node = this.spatialNodes.find((n) => n.id === nodeId);
    if (!node) return;

    this.activeNodeId = node.id;
    if (this.options.onActiveNodeChange) {
      this.options.onActiveNodeChange(node);
    }
    if (this.options.onSelectNode) {
      this.options.onSelectNode(node.id);
    }

    // Rotate camera so node is front and center (x1 = 0, z1 > 0)
    const angle = Math.atan2(node.x, node.z);
    this.targetYaw = angle;
    this.targetCamCenterY = node.y;
  }

  /**
   * Navigate keyboard arrows across tree levels and nodes.
   */
  public navigateKeyboard(key: string): SpatialNode | null {
    if (this.spatialNodes.length === 0) return null;

    const currentNode =
      this.spatialNodes.find((n) => n.id === this.activeNodeId) || this.spatialNodes[0];

    if (key === "ArrowDown") {
      const targetDepth = currentNode.depth + 1;
      const children = this.spatialNodes.filter((n) => n.parentId === currentNode.id);
      if (children.length > 0) {
        this.focusOnNode(children[0].id);
        return children[0];
      } else {
        const nextLevelNodes = this.spatialNodes.filter((n) => n.depth === targetDepth);
        if (nextLevelNodes.length > 0) {
          this.focusOnNode(nextLevelNodes[0].id);
          return nextLevelNodes[0];
        }
      }
    } else if (key === "ArrowUp") {
      if (currentNode.parentId) {
        this.focusOnNode(currentNode.parentId);
        const parent = this.spatialNodes.find((n) => n.id === currentNode.parentId);
        return parent || null;
      } else if (currentNode.depth > 0) {
        const prevLevelNodes = this.spatialNodes.filter((n) => n.depth === currentNode.depth - 1);
        if (prevLevelNodes.length > 0) {
          this.focusOnNode(prevLevelNodes[0].id);
          return prevLevelNodes[0];
        }
      }
    } else if (key === "ArrowLeft") {
      const nodesAtLevel = this.spatialNodes.filter((n) => n.depth === currentNode.depth);
      if (nodesAtLevel.length > 1) {
        const sorted = [...nodesAtLevel].sort(
          (a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z)
        );
        const currIdx = sorted.findIndex((n) => n.id === currentNode.id);
        const nextIdx = (currIdx + 1) % sorted.length;
        this.focusOnNode(sorted[nextIdx].id);
        return sorted[nextIdx];
      }
    } else if (key === "ArrowRight") {
      const nodesAtLevel = this.spatialNodes.filter((n) => n.depth === currentNode.depth);
      if (nodesAtLevel.length > 1) {
        const sorted = [...nodesAtLevel].sort(
          (a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z)
        );
        const currIdx = sorted.findIndex((n) => n.id === currentNode.id);
        const prevIdx = (currIdx - 1 + sorted.length) % sorted.length;
        this.focusOnNode(sorted[prevIdx].id);
        return sorted[prevIdx];
      }
    }

    return null;
  }

  /**
   * Project 3D coordinate (x, y, z) into 2D screen coordinate.
   */
  public project(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number
  ): { px: number; py: number; scale: number; zOrder: number } | null {
    return project3DTo2D(
      x,
      y,
      z,
      width,
      height,
      this.currentYaw,
      this.pitch,
      this.currentCamCenterY,
      this.zoom
    );
  }

  /**
   * Hit test for a node at client mouse coordinates.
   */
  public getNodeAt(clientX: number, clientY: number): SpatialNode | null {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    for (const p of this.projectedNodes) {
      const dx = mouseX - p.px;
      const dy = mouseY - p.py;
      if (Math.sqrt(dx * dx + dy * dy) <= p.radius + 8) {
        return p.node;
      }
    }
    return null;
  }

  public updateHover(clientX: number, clientY: number): SpatialNode | null {
    const found = this.getNodeAt(clientX, clientY);
    if (found !== this.hoveredNode) {
      this.hoveredNode = found;
      if (this.options.onHoverNodeChange) {
        this.options.onHoverNodeChange(found);
      }
    }
    return found;
  }

  public clearHover(): void {
    if (this.hoveredNode !== null) {
      this.hoveredNode = null;
      if (this.options.onHoverNodeChange) {
        this.options.onHoverNodeChange(null);
      }
    }
  }

  public startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.lastMousePos = { x: clientX, y: clientY };
  }

  public drag(clientX: number, clientY: number): void {
    if (!this.isDragging) return;
    const dx = clientX - this.lastMousePos.x;
    const dy = clientY - this.lastMousePos.y;
    this.lastMousePos = { x: clientX, y: clientY };

    // Clockwise / anticlockwise rotation (horizontal yaw)
    const nextYaw = this.currentYaw + dx * 0.01;
    this.currentYaw = nextYaw;
    this.targetYaw = nextYaw;

    // Vertical rotation only if unlocked
    if (!this.isVerticalLocked) {
      const nextPitch = Math.max(-1.4, Math.min(1.4, this.pitch - dy * 0.01));
      this.pitch = nextPitch;
      if (this.options.onPitchChange) {
        this.options.onPitchChange(nextPitch);
      }
    }
  }

  public endDrag(): void {
    this.isDragging = false;
  }

  public zoomBy(delta: number): void {
    this.zoom = Math.max(0.4, Math.min(2.5, this.zoom + delta));
    if (this.options.onZoomChange) {
      this.options.onZoomChange(this.zoom);
    }
  }

  public resetView(): void {
    if (this.activeNodeId) {
      this.focusOnNode(this.activeNodeId);
    } else if (this.spatialNodes.length > 0) {
      this.focusOnNode(this.spatialNodes[0].id);
    }
    this.pitch = 0.2;
    this.zoom = 1.0;
    if (this.options.onZoomChange) {
      this.options.onZoomChange(this.zoom);
    }
    if (this.options.onPitchChange) {
      this.options.onPitchChange(this.pitch);
    }
  }

  public toggleVerticalLock(): boolean {
    this.isVerticalLocked = !this.isVerticalLocked;
    if (this.isVerticalLocked) {
      this.pitch = 0.2;
      if (this.options.onPitchChange) {
        this.options.onPitchChange(0.2);
      }
    }
    if (this.options.onVerticalLockChange) {
      this.options.onVerticalLockChange(this.isVerticalLocked);
    }
    return this.isVerticalLocked;
  }

  /**
   * Start 60fps animation loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animId = requestAnimationFrame(this.renderLoop);
  }

  /**
   * Stop animation loop.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  /**
   * Destroy renderer instance and clean up.
   */
  public destroy(): void {
    this.stop();
    this.ctx = null;
    this.spatialNodes = [];
    this.projectedNodes = [];
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;

    // Smoothly interpolate yaw and camera center Y towards target node
    if (!this.isDragging) {
      let diffYaw = this.targetYaw - this.currentYaw;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      this.currentYaw += diffYaw * 0.12;

      const diffY = this.targetCamCenterY - this.currentCamCenterY;
      this.currentCamCenterY += diffY * 0.12;
    }

    const canvas = this.canvas;
    const ctx = this.ctx;
    if (canvas && ctx) {
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 200;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const projectFn = (x: number, y: number, z: number, w: number, h: number) =>
        this.project(x, y, z, w, h);

      // Cyberpunk Wireframe Grid Floor
      renderGrid(ctx, width, height, projectFn);

      // Laser Connections
      renderConnections(ctx, width, height, this.spatialNodes, this.activeNodeId, projectFn);

      // Render 3D Nodes
      this.projectedNodes = renderNodes(
        ctx,
        width,
        height,
        this.spatialNodes,
        this.activeNodeId,
        this.hoveredNode,
        this.accentColor,
        projectFn
      );
    }

    this.animId = requestAnimationFrame(this.renderLoop);
  };
}
