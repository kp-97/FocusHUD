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
    const result: SpatialNode[] = [];

    const traverse = (
      itemList: TreeNode3D[],
      parentId: string | null,
      depth: number,
      centerX: number,
      centerY: number,
      centerZ: number,
      angleSpread: number,
      startAngle: number
    ) => {
      const count = itemList.length;
      if (count === 0) return;

      const angleStep = count > 1 ? angleSpread / (count - 1) : 0;
      const radius = 90 + depth * 35;

      itemList.forEach((item, idx) => {
        let x = centerX;
        let y = centerY;
        let z = centerZ;

        if (depth === 0) {
          // Place root nodes along circle
          const a = (idx / Math.max(1, count)) * Math.PI * 2;
          x = Math.cos(a) * 75;
          z = Math.sin(a) * 75;
          y = -40;
        } else {
          // Spread child nodes downward in cone
          const a = startAngle + (idx - (count - 1) / 2) * (angleStep || 0.6);
          x = centerX + Math.cos(a) * radius * 0.7;
          z = centerZ + Math.sin(a) * radius * 0.7;
          y = centerY + 55;
        }

        const spatial: SpatialNode = {
          id: item.id,
          title: item.title,
          completed: !!item.completed,
          x,
          y,
          z,
          parentId,
          depth,
        };

        result.push(spatial);

        if (item.children && item.children.length > 0) {
          traverse(item.children, item.id, depth + 1, x, y, z, Math.PI * 0.9, Math.atan2(z, x));
        }
      });
    };

    traverse(nodes, null, 0, 0, -40, 0, Math.PI * 2, 0);
    return result;
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
    const cx = width / 2;
    const cy = height / 2 + 10;
    const fov = 320 * this.zoom;
    const camDist = 280;

    // Rotate around Y axis (yaw: clockwise/anticlockwise)
    const cosY = Math.cos(this.currentYaw);
    const sinY = Math.sin(this.currentYaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Rotate around X axis (pitch: vertical tilt) centered on focused node's level
    const shiftedY = y - this.currentCamCenterY;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const y2 = shiftedY * cosP - z1 * sinP;
    const z2 = shiftedY * sinP + z1 * cosP;

    const distance = z2 + camDist;
    if (distance <= 10) return null;

    const scale = fov / distance;
    return {
      px: cx + x1 * scale,
      py: cy + y2 * scale,
      scale,
      zOrder: distance,
    };
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

      // Cyberpunk Wireframe Grid Floor
      this.renderGrid(ctx, width, height);

      // Laser Connections
      this.renderConnections(ctx, width, height);

      // Render 3D Nodes
      this.renderNodes(ctx, width, height);
    }

    this.animId = requestAnimationFrame(this.renderLoop);
  };

  private renderGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 160;
    const gridStep = 40;

    for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
      const p1 = this.project(gx, 110, -gridSize, width, height);
      const p2 = this.project(gx, 110, gridSize, width, height);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
    }
    for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
      const p1 = this.project(-gridSize, 110, gz, width, height);
      const p2 = this.project(gridSize, 110, gz, width, height);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
    }
  }

  private renderConnections(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const nodeMap = new Map<string, SpatialNode>();
    this.spatialNodes.forEach((n) => nodeMap.set(n.id, n));

    this.spatialNodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = nodeMap.get(node.parentId);
      if (!parent) return;

      const p1 = this.project(parent.x, parent.y, parent.z, width, height);
      const p2 = this.project(node.x, node.y, node.z, width, height);

      if (p1 && p2) {
        const isLineActive =
          this.activeNodeId === node.id || this.activeNodeId === parent.id;

        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);

        // Glowing laser line
        ctx.strokeStyle = isLineActive
          ? "rgba(255, 179, 0, 0.65)"
          : node.completed
          ? "rgba(0, 230, 118, 0.45)"
          : "rgba(0, 229, 255, 0.35)";
        ctx.lineWidth = Math.max(1, (isLineActive ? 2.4 : 1.6) * p2.scale);
        ctx.stroke();

        // Animated pulses along lines
        const pulseT = (Date.now() % 2000) / 2000;
        const pulseX = p1.px + (p2.px - p1.px) * pulseT;
        const pulseY = p1.py + (p2.py - p1.py) * pulseT;
        ctx.fillStyle = isLineActive
          ? "#ffb300"
          : node.completed
          ? "#00e676"
          : "#00e5ff";
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 2.2 * p2.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private renderNodes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const projectedList: ProjectedNode[] = [];

    this.spatialNodes.forEach((node) => {
      const p = this.project(node.x, node.y, node.z, width, height);
      if (p) {
        const radius = Math.max(3.5, 7.5 * p.scale);
        projectedList.push({
          node,
          px: p.px,
          py: p.py,
          scale: p.scale,
          radius,
          zOrder: p.zOrder,
        });
      }
    });

    // Painter's algorithm
    projectedList.sort((a, b) => b.zOrder - a.zOrder);
    this.projectedNodes = projectedList;

    projectedList.forEach(({ node, px, py, radius, scale }) => {
      const isHovered = this.hoveredNode?.id === node.id;
      const isSelected = this.activeNodeId === node.id;
      const isCompleted = node.completed;

      // Outer glow
      const glowColor = isSelected
        ? "rgba(255, 179, 0, 0.85)"
        : isHovered
        ? "rgba(255, 215, 0, 0.6)"
        : isCompleted
        ? "rgba(0, 230, 118, 0.4)"
        : "rgba(0, 229, 255, 0.4)";

      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(
        px,
        py,
        radius * (isSelected ? 2.8 : isHovered ? 2.2 : 1.6),
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Pulsing selection brackets on focused node
      if (isSelected) {
        ctx.strokeStyle = "#ffb300";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
        ctx.stroke();

        // Outer reticle corners
        const bSize = radius + 9;
        ctx.strokeStyle = "rgba(255, 179, 0, 0.7)";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px - bSize, py - bSize, bSize * 2, bSize * 2);
      }

      // Node circle
      ctx.fillStyle = isSelected
        ? "#ffb300"
        : isHovered
        ? "#ffd700"
        : isCompleted
        ? "#00e676"
        : this.accentColor;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.fillStyle = "#03070d";
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Node label
      if (scale > 0.6 || isHovered || isSelected) {
        ctx.font = `${isSelected || isHovered ? "bold " : ""}9.5px Orbitron, monospace`;
        ctx.fillStyle = isSelected
          ? "#fef08a"
          : isCompleted
          ? "#a7f3d0"
          : "#bae6fd";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label =
          node.title.length > 20 ? node.title.slice(0, 18) + "…" : node.title;
        ctx.fillText(label, px, py + radius + 4);
      }
    });
  }
}
