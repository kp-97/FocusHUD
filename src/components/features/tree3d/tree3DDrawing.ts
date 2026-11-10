import type { SpatialNode, ProjectedNode } from "./Tree3DRenderer";

export type ProjectFn = (
  x: number,
  y: number,
  z: number,
  width: number,
  height: number
) => { px: number; py: number; scale: number; zOrder: number } | null;

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: ProjectFn
): void {
  ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
  ctx.lineWidth = 1;
  const gridSize = 160;
  const gridStep = 40;

  for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
    const p1 = project(gx, 110, -gridSize, width, height);
    const p2 = project(gx, 110, gridSize, width, height);
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
  }
  for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
    const p1 = project(-gridSize, 110, gz, width, height);
    const p2 = project(gridSize, 110, gz, width, height);
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
  }
}

export function renderConnections(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spatialNodes: SpatialNode[],
  activeNodeId: string | null,
  project: ProjectFn
): void {
  const nodeMap = new Map<string, SpatialNode>();
  spatialNodes.forEach((n) => nodeMap.set(n.id, n));

  spatialNodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = nodeMap.get(node.parentId);
    if (!parent) return;

    const p1 = project(parent.x, parent.y, parent.z, width, height);
    const p2 = project(node.x, node.y, node.z, width, height);

    if (p1 && p2) {
      const isLineActive =
        activeNodeId === node.id || activeNodeId === parent.id;

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

export function renderNodes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spatialNodes: SpatialNode[],
  activeNodeId: string | null,
  hoveredNode: SpatialNode | null,
  accentColor: string,
  project: ProjectFn
): ProjectedNode[] {
  const projectedList: ProjectedNode[] = [];

  spatialNodes.forEach((node) => {
    const p = project(node.x, node.y, node.z, width, height);
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

  projectedList.forEach(({ node, px, py, radius, scale }) => {
    const isHovered = hoveredNode?.id === node.id;
    const isSelected = activeNodeId === node.id;
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
      : accentColor;
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

  return projectedList;
}

