import React from "react";
import { Lock, Unlock, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useTheme } from "../../../stores/themeStore";
import {
  TreeNode3D,
  SpatialNode,
  ProjectedNode,
  Tree3DRenderer,
} from "./Tree3DRenderer";
import { useTree3DCanvas } from "./useTree3DCanvas";

export type { TreeNode3D, SpatialNode, ProjectedNode };
export { Tree3DRenderer, useTree3DCanvas };

export interface Tree3DViewProps {
  data: TreeNode3D[];
  height?: number | string;
  accentColor?: string;
  onSelectNode?: (nodeId: string) => void;
}

/**
 * Declarative HUD container and UI wrapper for the Tree3D canvas rendering engine.
 */
export const Tree3DView: React.FC<Tree3DViewProps> = ({
  data,
  height = "100%",
  accentColor: customAccent,
  onSelectNode,
}) => {
  const { themeConfig } = useTheme();
  const accentColor = customAccent || themeConfig.accentColor || "#00e5ff";

  const {
    canvasRef,
    containerRef,
    activeNode,
    isVerticalLocked,
    setIsMouseOver,
    handleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleKeyboardNav,
    toggleVerticalLock,
    zoomIn,
    zoomOut,
    resetView,
  } = useTree3DCanvas({
    data,
    accentColor,
    onSelectNode,
  });

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
          onClick={zoomIn}
          title="Zoom In"
          className="p-1 rounded bg-black/50 border border-cyan-500/20 text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 transition cursor-pointer"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        <button
          onClick={zoomOut}
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
          {activeNode ? (
            <span className="text-amber-200 font-bold tracking-wider">
              [L{activeNode.depth}] {activeNode.title}{" "}
              {activeNode.completed ? "✓ (COMPLETE)" : "⏳ (ACTIVE)"}
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
