import { useState, useEffect, useRef } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { CenterWorkspace } from "./components/CenterWorkspace";
import { ResizeHandle } from "./components/ResizeHandle";
import { TopNavHUD } from "./components/TopNavHUD";
import { updateDockSizes, restoreWorkArea } from "./utils/tauriBridge";

const SNAP_POINTS = [
  { value: 68, label: "SQUARE ICONS" },
  { value: 220, label: "COMPACT" },
  { value: 280, label: "DEFAULT" },
  { value: 360, label: "EXPANDED" },
];

const MIN_LEFT_WIDTH = 68;
const MIN_MIDDLE_WIDTH = 340;

export default function App() {
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem("hud_left_width");
    return saved ? Math.round(Number(saved)) : 280;
  });

  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem("hud_right_width");
    return saved ? Math.round(Number(saved)) : 280;
  });

  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [desktopDockActive, setDesktopDockActive] = useState<boolean>(false);
  const [snapMode, setSnapMode] = useState<"fluid" | "grid-snap" | "ratio-16-9">("fluid");
  const [activeNav, setActiveNav] = useState<string>("home");

  // Check if opened as dedicated dock window (e.g. ?dock=left or ?dock=right)
  const [dockWindowType] = useState<"left" | "right" | "full">(() => {
    const param = new URLSearchParams(window.location.search).get("dock");
    if (param === "left") return "left";
    if (param === "right") return "right";
    return "full";
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(window.innerWidth);

  // Keep track of container width on resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Save widths to localStorage
  useEffect(() => {
    localStorage.setItem("hud_left_width", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem("hud_right_width", String(rightWidth));
  }, [rightWidth]);

  // Initial sync of dock sizes on startup
  useEffect(() => {
    if (dockWindowType === "left") {
      updateDockSizes(leftWidth, null, true);
    } else if (dockWindowType === "right") {
      updateDockSizes(null, rightWidth, true);
    } else if (desktopDockActive) {
      updateDockSizes(leftWidth, rightWidth, true);
    }
  }, [dockWindowType, desktopDockActive]);

  const handleToggleDesktopDock = async () => {
    if (desktopDockActive) {
      await restoreWorkArea();
      setDesktopDockActive(false);
    } else {
      await updateDockSizes(leftWidth, rightWidth, true);
      setDesktopDockActive(true);
    }
  };

  // Drag handlers for Left Bar:
  // During drag, the transparent HWND canvas is already expanded to 520px,
  // so we only update React CSS state at 120fps with zero HWND resize jitter!
  const handleLeftDragChange = (newWidth: number) => {
    setLeftWidth(newWidth);
  };

  const handleLeftDragEnd = (finalWidth: number) => {
    setLeftWidth(finalWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(finalWidth, null, true);
    }
  };

  const handleLeftDoubleClick = () => {
    const next = leftWidth <= 70 ? 280 : 68;
    setLeftWidth(next);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(next, null, true);
    }
  };

  // Drag handlers for Right Bar:
  // Pure CSS resize inside the stationary 520px transparent HWND canvas during drag!
  const handleRightDragChange = (newWidth: number) => {
    setRightWidth(newWidth);
  };

  const handleRightDragEnd = (finalWidth: number) => {
    setRightWidth(finalWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, finalWidth, true);
    }
  };

  const handleRightDoubleClick = () => {
    const next = rightWidth <= 70 ? 280 : 68;
    setRightWidth(next);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, next, true);
    }
  };

  const handleApplyPreset = (left: number, right: number) => {
    setLeftWidth(left);
    setRightWidth(right);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(left, right, true);
    }
  };

  const handleReset = () => {
    setLeftWidth(280);
    setRightWidth(280);
    setMagneticSnap(true);
    restoreWorkArea();
    setDesktopDockActive(false);
  };

  const middleWidth = Math.max(
    MIN_MIDDLE_WIDTH,
    containerWidth - leftWidth - rightWidth
  );

  // Dedicated Left Dock window
  if (dockWindowType === "left") {
    return (
      <div className="w-screen h-screen flex justify-start overflow-hidden bg-transparent text-cyan-200 select-none relative font-hud">
        <div
          style={{ width: `${leftWidth}px` }}
          className="relative h-full flex flex-row bg-[#03070d] overflow-hidden shrink-0"
        >
          <LeftSidebar
            width={leftWidth}
            activeNav={activeNav}
            onSelectNav={setActiveNav}
            isCompact={leftWidth < 220}
            isDockMode={true}
          />
          <div className="absolute top-0 bottom-0 right-0 w-2.5 z-50">
            <ResizeHandle
              side="left"
              currentWidth={leftWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={500}
              snapPoints={magneticSnap ? SNAP_POINTS : []}
              className="relative w-full h-full flex items-center justify-center cursor-col-resize select-none touch-none"
              onDragChange={handleLeftDragChange}
              onDragEnd={handleLeftDragEnd}
              onDoubleClick={handleLeftDoubleClick}
            />
          </div>
        </div>
      </div>
    );
  }

  // Dedicated Right Dock window
  if (dockWindowType === "right") {
    return (
      <div className="w-screen h-screen flex justify-end overflow-hidden bg-transparent text-cyan-200 select-none relative font-hud">
        <div
          style={{ width: `${rightWidth}px` }}
          className="relative h-full flex flex-row bg-[#03070d] overflow-hidden shrink-0"
        >
          <div className="absolute top-0 bottom-0 left-0 w-2.5 z-50">
            <ResizeHandle
              side="right"
              currentWidth={rightWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={500}
              snapPoints={magneticSnap ? SNAP_POINTS : []}
              className="relative w-full h-full flex items-center justify-center cursor-col-resize select-none touch-none"
              onDragChange={handleRightDragChange}
              onDragEnd={handleRightDragEnd}
              onDoubleClick={handleRightDoubleClick}
            />
          </div>
          <RightSidebar
            width={rightWidth}
            activeNav={activeNav}
            isCompact={rightWidth < 220}
            isDockMode={true}
          />
        </div>
      </div>
    );
  }

  // Default Unified 3-Column Layout (Browser fallback / preview)
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#03070d] text-cyan-200 select-none relative font-hud">
      {/* Subtle futuristic scanline overlay across whole UI */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50 opacity-40" />

      {/* Top HUD control toolbar */}
      <TopNavHUD
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        magneticSnap={magneticSnap}
        onToggleMagneticSnap={() => setMagneticSnap(!magneticSnap)}
        desktopDockActive={desktopDockActive}
        onToggleDesktopDock={handleToggleDesktopDock}
        onApplyPreset={handleApplyPreset}
        onReset={handleReset}
      />

      {/* Main Resizable 3-Column HUD Layout */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-row overflow-hidden relative z-10"
      >
        {/* Left Sidebar */}
        <LeftSidebar
          width={leftWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={leftWidth < 220}
        />

        {/* Left Resize Splitter Handle */}
        <ResizeHandle
          side="left"
          currentWidth={leftWidth}
          minWidth={MIN_LEFT_WIDTH}
          maxWidth={containerWidth - rightWidth - MIN_MIDDLE_WIDTH}
          snapPoints={magneticSnap ? SNAP_POINTS : []}
          onDragChange={handleLeftDragChange}
          onDragEnd={handleLeftDragEnd}
          onDoubleClick={handleLeftDoubleClick}
        />

        {/* Center Workspace (Contents snap nicely) */}
        <CenterWorkspace
          middleWidth={middleWidth}
          snapMode={snapMode}
          onToggleSnapMode={setSnapMode}
        />

        {/* Right Resize Splitter Handle */}
        <ResizeHandle
          side="right"
          currentWidth={rightWidth}
          minWidth={MIN_LEFT_WIDTH}
          maxWidth={containerWidth - leftWidth - MIN_MIDDLE_WIDTH}
          snapPoints={magneticSnap ? SNAP_POINTS : []}
          onDragChange={handleRightDragChange}
          onDragEnd={handleRightDragEnd}
          onDoubleClick={handleRightDoubleClick}
        />

        {/* Right Sidebar */}
        <RightSidebar
          width={rightWidth}
          activeNav={activeNav}
          isCompact={rightWidth < 220}
        />
      </div>

      {/* Outer Sci-Fi Crosshairs overlay (matching picture crosshairs) */}
      <div className="absolute top-12 left-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute top-12 right-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute bottom-2 left-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute bottom-2 right-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
    </div>
  );
}
