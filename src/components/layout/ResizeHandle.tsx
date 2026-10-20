import React, { useState, useRef } from "react";
import { GripVertical } from "lucide-react";
import { setDockDragMode } from "../../services/tauriBridge";

interface ResizeHandleProps {
  side: "left" | "right";
  currentWidth: number;
  minWidth?: number;
  maxWidth?: number;
  snapPoints?: Array<{ value: number; label: string }>;
  className?: string;
  onDragStart?: () => void;
  onDragChange: (newWidth: number, snapLabel: string | null) => void;
  onDragEnd: (finalWidth: number) => void;
  onDoubleClick?: () => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  side,
  currentWidth,
  minWidth = 68,
  maxWidth = 500,
  snapPoints = [
    { value: 68, label: "SQUARE ICONS" },
    { value: 220, label: "COMPACT" },
    { value: 280, label: "DEFAULT" },
    { value: 360, label: "EXPANDED" },
  ],
  className,
  onDragStart,
  onDragChange,
  onDragEnd,
  onDoubleClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeSnapLabel, setActiveSnapLabel] = useState<string | null>(null);

  const grabOffsetRef = useRef<number>(0);
  const currentWidthRef = useRef<number>(currentWidth);
  currentWidthRef.current = currentWidth;
  const pointerDownPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  isDraggingRef.current = isDragging;

  const getDistanceFromScreenEdge = (clientX: number) => {
    return side === "left" ? clientX : window.innerWidth - clientX;
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    pointerDownPosRef.current = { clientX: e.clientX, clientY: e.clientY };

    const dist = getDistanceFromScreenEdge(e.clientX);
    const rawOffset = dist - currentWidthRef.current;
    grabOffsetRef.current = Math.max(-14, Math.min(14, rawOffset));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownPosRef.current) return;

    if (!isDraggingRef.current) {
      const delta = Math.hypot(
        e.clientX - pointerDownPosRef.current.clientX,
        e.clientY - pointerDownPosRef.current.clientY
      );
      if (delta >= 3) {
        setDockDragMode(side, true);
        setIsDragging(true);
        isDraggingRef.current = true;
        onDragStart?.();
      } else {
        return;
      }
    }

    const dist = getDistanceFromScreenEdge(e.clientX);
    let targetWidth = Math.round(dist - grabOffsetRef.current);

    targetWidth = Math.max(minWidth, Math.min(targetWidth, maxWidth));

    // Magnetic snapping check
    let snapLabel: string | null = null;
    const SNAP_THRESHOLD = 14;
    for (const snap of snapPoints) {
      if (Math.abs(targetWidth - snap.value) <= SNAP_THRESHOLD) {
        targetWidth = snap.value;
        snapLabel = snap.label;
        break;
      }
    }

    currentWidthRef.current = targetWidth;
    setActiveSnapLabel(snapLabel);
    onDragChange(targetWidth, snapLabel);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
      setActiveSnapLabel(null);
      onDragEnd(currentWidthRef.current);
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title="Drag to resize (Double-click to toggle width)"
      className={
        className ??
        `relative w-3.5 -mx-1.5 z-50 flex items-center justify-center cursor-col-resize select-none touch-none ${
          isDragging ? "bg-cyan-500/20" : ""
        }`
      }
    >
      {/* Central glow line */}
      <div
        className={`w-[2px] h-full transition-all duration-150 pointer-events-none ${
          isDragging
            ? "bg-cyan-300 shadow-[0_0_12px_#00e5ff] scale-x-125"
            : isHovered
            ? "bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]"
            : "bg-cyan-500/30"
        }`}
      />

      {/* Futuristic handle grip in the middle: ONLY appears on hover or dragging */}
      {(isHovered || isDragging || activeSnapLabel) && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center py-2 px-0.5 rounded-sm bg-[#03070d] border transition-all duration-150 pointer-events-none z-50 ${
            isDragging || activeSnapLabel
              ? "border-cyan-300 shadow-[0_0_12px_#00e5ff] text-cyan-200"
              : "border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,229,255,0.5)]"
          }`}
        >
          <GripVertical className="w-2.5 h-3.5" />
        </div>
      )}

      {/* Floating HUD Tooltip during dragging or hover */}
      {(isDragging || isHovered) && (
        <div
          className={`absolute top-12 ${
            side === "left" ? "right-4" : "left-4"
          } pointer-events-none whitespace-nowrap px-2 py-1 rounded bg-[#03070d] border border-cyan-400/80 shadow-[0_0_15px_rgba(0,229,255,0.3)] text-[10px] font-tech text-cyan-200 z-50 flex items-center gap-1.5`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>
            {side.toUpperCase()}: <strong className="text-white">{currentWidth}px</strong>
          </span>
          {activeSnapLabel && (
            <span className="px-1 py-0.5 rounded bg-cyan-500/30 text-cyan-300 text-[9px] font-bold border border-cyan-400/60">
              {activeSnapLabel}
            </span>
          )}
        </div>
      )}

      {/* Visual Alignment Crosshair ticks at top and bottom */}
      {(isHovered || isDragging) && (
        <>
          <div className="absolute top-4 w-2 h-[1px] bg-cyan-400/60 pointer-events-none" />
          <div className="absolute bottom-4 w-2 h-[1px] bg-cyan-400/60 pointer-events-none" />
        </>
      )}
    </div>
  );
};
