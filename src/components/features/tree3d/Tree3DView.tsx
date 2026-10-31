import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Lock, Unlock, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useTheme } from "../../../stores/themeStore";

export interface TreeNode3D {
  id: string;
  title: string;
  completed?: boolean;
  children?: TreeNode3D[];
}

interface Tree3DViewProps {
  data: TreeNode3D[];
  height?: number | string;
  accentColor?: string;
  onSelectNode?: (nodeId: string) => void;
}

interface SpatialNode {
  id: string;
  title: string;
  completed: boolean;
  x: number;
  y: number;
  z: number;
  parentId: string | null;
  depth: number;
}

export const Tree3DView: React.FC<Tree3DViewProps> = ({
  data,
  height = "100%",
  accentColor: customAccent,
  onSelectNode,
}) => {
  const { themeConfig } = useTheme();
  const accentColor = customAccent || themeConfig.accentColor || "#00e5ff";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation & camera target state
  const [pitch, setPitch] = useState<number>(0.2);
  const [zoom, setZoom] = useState<number>(1.0);

  // Target values for smooth camera interpolation towards focused node
  const targetYawRef = useRef<number>(0);
  const targetCamCenterYRef = useRef<number>(-40);
  const currentYawRef = useRef<number>(0);
  const currentCamCenterYRef = useRef<number>(-40);

  // Vertical rotation locked by default (only clockwise / anticlockwise horizontal rotation)
  const [isVerticalLocked, setIsVerticalLocked] = useState<boolean>(true);

  // Active / Focused Node state
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SpatialNode | null>(null);
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const projectedNodesRef = useRef<Array<{ node: SpatialNode; px: number; py: number; radius: number }>>([]);

  // Flatten nested tree into 3D coordinates
  const flattenTreeTo3D = useCallback((nodes: TreeNode3D[]): SpatialNode[] => {
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
  }, []);

  const spatialNodes = useMemo(() => flattenTreeTo3D(data), [data, flattenTreeTo3D]);

  // Center camera on a specific node (so it is focused in front)
  const focusOnNode = useCallback(
    (nodeId: string) => {
      const node = spatialNodes.find((n) => n.id === nodeId);
      if (!node) return;

      setActiveNodeId(node.id);
      if (onSelectNode) onSelectNode(node.id);

      // Rotate camera so node is front and center (x1 = 0, z1 > 0)
      const angle = Math.atan2(node.x, node.z);
      targetYawRef.current = angle;
      targetCamCenterYRef.current = node.y;
    },
    [spatialNodes, onSelectNode]
  );

  // Set initial active node if none selected or data changed
  useEffect(() => {
    if (spatialNodes.length > 0) {
      const exists = spatialNodes.some((n) => n.id === activeNodeId);
      if (!exists) {
        focusOnNode(spatialNodes[0].id);
      }
    }
  }, [spatialNodes, activeNodeId, focusOnNode]);

  // Up/Down shifts focus between levels; Left/Right rotates clockwise/anticlockwise between nodes at current level
  const handleKeyboardNav = useCallback(
    (key: string) => {
      if (spatialNodes.length === 0) return;

      const currentNode = spatialNodes.find((n) => n.id === activeNodeId) || spatialNodes[0];

      if (key === "ArrowDown") {
        // Shift focus DOWN one level
        const targetDepth = currentNode.depth + 1;
        // Prefer child of current node
        const children = spatialNodes.filter((n) => n.parentId === currentNode.id);
        if (children.length > 0) {
          focusOnNode(children[0].id);
        } else {
          // If no direct child, find any node at the next level
          const nextLevelNodes = spatialNodes.filter((n) => n.depth === targetDepth);
          if (nextLevelNodes.length > 0) {
            focusOnNode(nextLevelNodes[0].id);
          }
        }
      } else if (key === "ArrowUp") {
        // Shift focus UP one level
        if (currentNode.parentId) {
          focusOnNode(currentNode.parentId);
        } else if (currentNode.depth > 0) {
          const prevLevelNodes = spatialNodes.filter((n) => n.depth === currentNode.depth - 1);
          if (prevLevelNodes.length > 0) {
            focusOnNode(prevLevelNodes[0].id);
          }
        }
      } else if (key === "ArrowLeft") {
        // Rotate to next node in CLOCKWISE direction at current level
        const nodesAtLevel = spatialNodes.filter((n) => n.depth === currentNode.depth);
        if (nodesAtLevel.length > 1) {
          // Sort by circular polar angle
          const sorted = [...nodesAtLevel].sort((a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z));
          const currIdx = sorted.findIndex((n) => n.id === currentNode.id);
          const nextIdx = (currIdx + 1) % sorted.length;
          focusOnNode(sorted[nextIdx].id);
        }
      } else if (key === "ArrowRight") {
        // Rotate to next node in ANTICLOCKWISE direction at current level
        const nodesAtLevel = spatialNodes.filter((n) => n.depth === currentNode.depth);
        if (nodesAtLevel.length > 1) {
          // Sort by circular polar angle
          const sorted = [...nodesAtLevel].sort((a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z));
          const currIdx = sorted.findIndex((n) => n.id === currentNode.id);
          const prevIdx = (currIdx - 1 + sorted.length) % sorted.length;
          focusOnNode(sorted[prevIdx].id);
        }
      }
    },
    [spatialNodes, activeNodeId, focusOnNode]
  );

  // Global window keydown when mouse is hovered over the 3D canvas
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (
        isMouseOver &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        handleKeyboardNav(e.key);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [isMouseOver, handleKeyboardNav]);

  // Render loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      // Smoothly interpolate yaw and camera center Y towards target node
      if (!isDraggingRef.current) {
        let diffYaw = targetYawRef.current - currentYawRef.current;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        currentYawRef.current += diffYaw * 0.12;

        const diffY = targetCamCenterYRef.current - currentCamCenterYRef.current;
        currentCamCenterYRef.current += diffY * 0.12;
      }

      // Handle canvas resize
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 200;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Cyberpunk Wireframe Grid Floor
      const cx = width / 2;
      const cy = height / 2 + 10;
      const fov = 320 * zoom;
      const camDist = 280;

      // Project 3D point (x, y, z) to 2D screen (px, py)
      const project = (x: number, y: number, z: number) => {
        // Rotate around Y axis (yaw: clockwise/anticlockwise)
        const cosY = Math.cos(currentYawRef.current);
        const sinY = Math.sin(currentYawRef.current);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotate around X axis (pitch: vertical tilt) centered on focused node's level
        const shiftedY = y - currentCamCenterYRef.current;
        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);
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
      };

      // Draw wireframe grid plane at bottom (y = 110)
      ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 160;
      const gridStep = 40;
      for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
        const p1 = project(gx, 110, -gridSize);
        const p2 = project(gx, 110, gridSize);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      }
      for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
        const p1 = project(-gridSize, 110, gz);
        const p2 = project(gridSize, 110, gz);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      }

      const nodeMap = new Map<string, SpatialNode>();
      spatialNodes.forEach((n) => nodeMap.set(n.id, n));

      // Draw Laser connection lines from parent to child
      spatialNodes.forEach((node) => {
        if (!node.parentId) return;
        const parent = nodeMap.get(node.parentId);
        if (!parent) return;

        const p1 = project(parent.x, parent.y, parent.z);
        const p2 = project(node.x, node.y, node.z);

        if (p1 && p2) {
          const isLineActive = activeNodeId === node.id || activeNodeId === parent.id;

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
          ctx.fillStyle = isLineActive ? "#ffb300" : node.completed ? "#00e676" : "#00e5ff";
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2.2 * p2.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Sort nodes by distance (painter's algorithm)
      const projectedList: Array<{
        node: SpatialNode;
        px: number;
        py: number;
        scale: number;
        radius: number;
        zOrder: number;
      }> = [];

      spatialNodes.forEach((node) => {
        const p = project(node.x, node.y, node.z);
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

      projectedList.sort((a, b) => b.zOrder - a.zOrder);
      projectedNodesRef.current = projectedList;

      // Draw 3D nodes
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
        ctx.arc(px, py, radius * (isSelected ? 2.8 : isHovered ? 2.2 : 1.6), 0, Math.PI * 2);
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
          ctx.fillStyle = isSelected ? "#fef08a" : isCompleted ? "#a7f3d0" : "#bae6fd";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = node.title.length > 20 ? node.title.slice(0, 18) + "…" : node.title;
          ctx.fillText(label, px, py + radius + 4);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [spatialNodes, pitch, zoom, hoveredNode, activeNodeId, accentColor]);

  // Mouse click on node to focus on it
  const handleClick = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (const p of projectedNodesRef.current) {
        const dx = mouseX - p.px;
        const dy = mouseY - p.py;
        if (Math.sqrt(dx * dx + dy * dy) <= p.radius + 8) {
          focusOnNode(p.node.id);
          break;
        }
      }
    }
  };

  // Mouse drag handlers:
  // When isVerticalLocked is true (default), ONLY horizontal rotation (yaw: clockwise/anticlockwise) is modified!
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) {
      containerRef.current.focus();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Check node hover
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found: SpatialNode | null = null;
      for (const p of projectedNodesRef.current) {
        const dx = mouseX - p.px;
        const dy = mouseY - p.py;
        if (Math.sqrt(dx * dx + dy * dy) <= p.radius + 6) {
          found = p.node;
          break;
        }
      }
      setHoveredNode(found);
    }

    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Clockwise / anticlockwise rotation (horizontal yaw)
    const nextYaw = currentYawRef.current + dx * 0.01;
    currentYawRef.current = nextYaw;
    targetYawRef.current = nextYaw;

    // Vertical rotation is only modified if unlocked!
    if (!isVerticalLocked) {
      setPitch((prev) => Math.max(-1.4, Math.min(1.4, prev - dy * 0.01)));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.max(0.4, Math.min(2.5, prev + delta)));
  };

  const resetView = () => {
    if (activeNodeId) {
      focusOnNode(activeNodeId);
    } else if (spatialNodes.length > 0) {
      focusOnNode(spatialNodes[0].id);
    }
    setPitch(0.2);
    setZoom(1.0);
  };

  const toggleVerticalLock = () => {
    setIsVerticalLocked((prev) => {
      const next = !prev;
      if (next) {
        // Reset pitch to standard comfortable angle when locking
        setPitch(0.2);
      }
      return next;
    });
  };

  // Find currently focused node details
  const focusedNode = spatialNodes.find((n) => n.id === activeNodeId) || spatialNodes[0];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          handleKeyboardNav(e.key);
        }
      }}
      onMouseEnter={() => setIsMouseOver(true)}
      onMouseLeave={() => {
        setIsMouseOver(false);
        handleMouseUp();
      }}
      style={{ height }}
      className="relative w-full h-full flex flex-col rounded bg-[#03070d]/90 border border-cyan-500/20 overflow-hidden select-none focus:outline-none focus:border-cyan-400/50 transition-colors"
    >
      {/* 3D Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating 3D HUD Controls Toolbar */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-20">
        {/* Vertical Rotation Lock Toggle (Locked by default) */}
        <button
          onClick={toggleVerticalLock}
          title={
            isVerticalLocked
              ? "Vertical rotation locked to horizontal plane. Click to unlock free 3D tilt."
              : "Free 3D tilt active. Click to lock vertical tilt."
          }
          className={`p-1 rounded text-[9px] font-tech uppercase tracking-wider flex items-center gap-1 border transition cursor-pointer ${
            isVerticalLocked
              ? "bg-amber-950/70 border-amber-400/60 text-amber-200 shadow-[0_0_8px_rgba(255,179,0,0.3)]"
              : "bg-black/50 border-cyan-500/20 text-cyan-400/60 hover:text-cyan-200"
          }`}
        >
          {isVerticalLocked ? (
            <>
              <Lock className="w-3 h-3 text-amber-300" />
              <span>V-LOCKED</span>
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3 text-cyan-400" />
              <span>FREE 3D</span>
            </>
          )}
        </button>

        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
          title="Zoom In"
          className="p-1 rounded bg-black/50 border border-cyan-500/20 text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 transition cursor-pointer"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        <button
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          title="Zoom Out"
          className="p-1 rounded bg-black/50 border border-cyan-500/20 text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 transition cursor-pointer"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <button
          onClick={resetView}
          title="Re-Center on Focused Node"
          className="p-1 rounded bg-black/50 border border-cyan-500/20 text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 transition cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Status HUD readout with Level and Node information */}
      <div className="absolute bottom-1.5 left-2 right-2 flex justify-between items-center text-[9px] font-tech text-cyan-400/80 pointer-events-none z-20">
        <span className="truncate max-w-[70%]">
          {focusedNode ? (
            <span className="text-amber-200 font-bold tracking-wider">
              [L{focusedNode.depth}] {focusedNode.title}{" "}
              {focusedNode.completed ? "✓ (COMPLETE)" : "⏳ (ACTIVE)"}
            </span>
          ) : (
            <span className="text-cyan-500/60">CLICK NODE OR USE ARROW KEYS</span>
          )}
        </span>
        <span className="text-cyan-500/60 font-mono tracking-tighter">
          [↑/↓ LEVEL · ←/→ ROTATE]
        </span>
      </div>
    </div>
  );
};
