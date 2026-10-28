import { useState, useEffect, useRef } from "react";
import { LeftSidebar } from "./components/layout/LeftSidebar/LeftSidebar";
import { RightSidebar } from "./components/layout/RightSidebar/RightSidebar";
import { CenterWorkspace } from "./components/layout/CenterWorkspace";
import { ResizeHandle } from "./components/layout/ResizeHandle";
import { TopNavHUD } from "./components/layout/TopNavHUD";
import { SettingsModal } from "./components/features/settings/SettingsModal";
import {
  updateDockSizes,
  restoreWorkArea,
  openSettingsWindow,
  closeSettingsWindow,
} from "./services/tauriBridge";
import {
  getRememberedLeftWidth,
  getRememberedRightWidth,
  setRememberedLeftWidth,
  setRememberedRightWidth,
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  broadcastLayoutAction,
  subscribeLayoutAction,
  getMaxLeftWidth,
  getMaxRightWidth,
} from "./stores/layoutStore";
import { runLegacyStorageMigrationIfNeeded } from "./services/storageMigration";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Check if opened as dedicated dock window (e.g. ?dock=left or ?dock=right or ?dock=settings)
  const [dockWindowType] = useState<"left" | "right" | "settings" | "full">(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dockParam = urlParams.get("dock");
    const viewParam = urlParams.get("view");
    if (dockParam === "settings" || viewParam === "settings") return "settings";
    if (dockParam === "left") return "left";
    if (dockParam === "right") return "right";
    return "full";
  });

  const [maxLeftWidth, setMaxLeftWidth] = useState<number>(() => getMaxLeftWidth());
  const [maxRightWidth, setMaxRightWidth] = useState<number>(() => getMaxRightWidth());

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
    runLegacyStorageMigrationIfNeeded();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Save widths to localStorage and remember expanded widths when >= 120px
  useEffect(() => {
    localStorage.setItem("hud_left_width", String(leftWidth));
    if (leftWidth >= 120) {
      setRememberedLeftWidth(leftWidth);
    }
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem("hud_right_width", String(rightWidth));
    if (rightWidth >= 120) {
      setRememberedRightWidth(rightWidth);
    }
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

  // Cross-window layout command listener (e.g. Maximize Panes)
  useEffect(() => {
    const unsubscribe = subscribeLayoutAction((action) => {
      // If the action was sent by another window, update local state only.
      // Do NOT re-invoke updateDockSizes to avoid duplicate Win32 work area / snap calculations.
      const isRemote = Boolean(action.sender && action.sender !== dockWindowType);

      if (action.type === "MAXIMIZE_PANES") {
        const prevL = getRememberedLeftWidth();
        const prevR = getRememberedRightWidth();
        setLeftWidth(prevL);
        setRightWidth(prevR);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(prevL, prevR, true);
        }
      } else if (action.type === "SET_PANES_WIDTH") {
        setLeftWidth(action.leftWidth);
        setRightWidth(action.rightWidth);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(action.leftWidth, action.rightWidth, true);
        }
      } else if (action.type === "SET_LEFT_WIDTH") {
        setLeftWidth(action.width);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(action.width, null, true);
        }
      } else if (action.type === "SET_RIGHT_WIDTH") {
        setRightWidth(action.width);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(null, action.width, true);
        }
      } else if (action.type === "SET_MAX_WIDTHS") {
        setMaxLeftWidth(action.maxLeftWidth);
        setMaxRightWidth(action.maxRightWidth);
      }
    });
    return () => unsubscribe();
  }, [dockWindowType, desktopDockActive]);

  const handleOpenSettings = async () => {
    if (dockWindowType !== "full") {
      const opened = await openSettingsWindow();
      if (!opened) {
        setIsSettingsOpen(true);
      }
    } else {
      setIsSettingsOpen(true);
    }
  };

  const handleToggleDesktopDock = async () => {
    if (desktopDockActive) {
      await restoreWorkArea();
      setDesktopDockActive(false);
    } else {
      await updateDockSizes(leftWidth, rightWidth, true);
      setDesktopDockActive(true);
    }
  };

  const leftDragRafRef = useRef<number | null>(null);
  const rightDragRafRef = useRef<number | null>(null);

  // Drag handlers for Left Bar:
  const handleLeftDragChange = (newWidth: number) => {
    setLeftWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      if (leftDragRafRef.current === null) {
        leftDragRafRef.current = requestAnimationFrame(() => {
          leftDragRafRef.current = null;
          updateDockSizes(newWidth, null, false);
        });
      }
    }
  };

  const handleLeftDragEnd = (finalWidth: number) => {
    if (leftDragRafRef.current !== null) {
      cancelAnimationFrame(leftDragRafRef.current);
      leftDragRafRef.current = null;
    }
    setLeftWidth(finalWidth);
    if (finalWidth >= 120) {
      setRememberedLeftWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(finalWidth, null, true);
    }
  };

  const handleLeftDoubleClick = () => {
    if (leftWidth <= 70) {
      const next = getRememberedLeftWidth();
      setLeftWidth(next);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(next, null, true);
      }
    } else {
      setRememberedLeftWidth(leftWidth);
      setLeftWidth(68);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(68, null, true);
      }
    }
  };

  // Sidebar toggle expand / collapse both panes simultaneously:
  // If either pane is collapsed (< 120px), expand both to their previous (remembered) widths.
  // If both are expanded, collapse both to 68px.
  const handleToggleBothPanes = () => {
    if (leftWidth < 120 || rightWidth < 120) {
      const prevLeft = getRememberedLeftWidth();
      const prevRight = getRememberedRightWidth();
      setLeftWidth(prevLeft);
      setRightWidth(prevRight);
      broadcastLayoutAction({
        type: "SET_PANES_WIDTH",
        leftWidth: prevLeft,
        rightWidth: prevRight,
        sender: dockWindowType,
      });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(prevLeft, prevRight, true);
      }
    } else {
      setRememberedLeftWidth(leftWidth);
      setRememberedRightWidth(rightWidth);
      setLeftWidth(68);
      setRightWidth(68);
      broadcastLayoutAction({
        type: "SET_PANES_WIDTH",
        leftWidth: 68,
        rightWidth: 68,
        sender: dockWindowType,
      });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(68, 68, true);
      }
    }
  };

  const handleLeftToggleCollapse = handleToggleBothPanes;

  const handleRightToggleCollapse = () => {
    if (rightWidth < 120) {
      const next = getRememberedRightWidth();
      setRightWidth(next);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, next, true);
      }
    } else {
      setRememberedRightWidth(rightWidth);
      setRightWidth(68);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, 68, true);
      }
    }
  };

  // Maximize both left and right panes to their previous (remembered) widths
  const handleMaximizePanes = () => {
    const prevLeft = getRememberedLeftWidth();
    const prevRight = getRememberedRightWidth();
    setLeftWidth(prevLeft);
    setRightWidth(prevRight);
    broadcastLayoutAction({ type: "MAXIMIZE_PANES", sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(prevLeft, prevRight, true);
    }
  };

  // Drag handlers for Right Bar:
  const handleRightDragChange = (newWidth: number) => {
    setRightWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      if (rightDragRafRef.current === null) {
        rightDragRafRef.current = requestAnimationFrame(() => {
          rightDragRafRef.current = null;
          updateDockSizes(null, newWidth, false);
        });
      }
    }
  };

  const handleRightDragEnd = (finalWidth: number) => {
    if (rightDragRafRef.current !== null) {
      cancelAnimationFrame(rightDragRafRef.current);
      rightDragRafRef.current = null;
    }
    setRightWidth(finalWidth);
    if (finalWidth >= 120) {
      setRememberedRightWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, finalWidth, true);
    }
  };

  const handleRightDoubleClick = () => {
    if (rightWidth <= 70) {
      const next = getRememberedRightWidth();
      setRightWidth(next);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, next, true);
      }
    } else {
      setRememberedRightWidth(rightWidth);
      setRightWidth(68);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, 68, true);
      }
    }
  };

  const handleResetWidths = () => {
    setRememberedLeftWidth(DEFAULT_LEFT_WIDTH);
    setRememberedRightWidth(DEFAULT_RIGHT_WIDTH);
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    setRightWidth(DEFAULT_RIGHT_WIDTH);
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      sender: dockWindowType,
    });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH, true);
    }
  };

  const handleApplyPreset = (left: number, right: number) => {
    setLeftWidth(left);
    setRightWidth(right);
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: left,
      rightWidth: right,
      sender: dockWindowType,
    });
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
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: 280,
      rightWidth: 280,
      sender: dockWindowType,
    });
  };

  const middleWidth = Math.max(
    MIN_MIDDLE_WIDTH,
    containerWidth - leftWidth - rightWidth
  );

  // Dedicated Centered Settings window
  if (dockWindowType === "settings") {
    return (
      <SettingsModal
        isOpen={true}
        isStandalone={true}
        onClose={() => {
          closeSettingsWindow();
        }}
        onResetWidths={handleResetWidths}
      />
    );
  }

  // Dedicated Left Dock window
  if (dockWindowType === "left") {
    return (
      <div className="w-screen h-screen flex justify-start overflow-visible bg-transparent text-cyan-200 select-none relative font-hud">
        <div
          style={{ width: `${leftWidth}px` }}
          className="relative h-full flex flex-row bg-[#03070d] overflow-visible shrink-0"
        >
          <LeftSidebar
            width={leftWidth}
            activeNav={activeNav}
            onSelectNav={setActiveNav}
            isCompact={leftWidth < 220}
            isDockMode={true}
            onToggleCollapse={handleLeftToggleCollapse}
            onOpenSettings={handleOpenSettings}
          />
          <div className="absolute top-0 bottom-0 right-0 w-2.5 z-50">
            <ResizeHandle
              side="left"
              currentWidth={leftWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={maxLeftWidth}
              snapPoints={magneticSnap ? SNAP_POINTS : []}
              className="relative w-full h-full flex items-center justify-center cursor-col-resize select-none touch-none"
              onDragChange={handleLeftDragChange}
              onDragEnd={handleLeftDragEnd}
              onDoubleClick={handleLeftDoubleClick}
            />
          </div>
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onResetWidths={handleResetWidths}
        />
      </div>
    );
  }

  // Dedicated Right Dock window
  if (dockWindowType === "right") {
    return (
      <div className="w-screen h-screen flex justify-end overflow-visible bg-transparent text-cyan-200 select-none relative font-hud">
        <div
          style={{ width: `${rightWidth}px` }}
          className="relative h-full flex flex-row bg-[#03070d] overflow-visible shrink-0"
        >
          <div className="absolute top-0 bottom-0 left-0 w-2.5 z-50">
            <ResizeHandle
              side="right"
              currentWidth={rightWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={maxRightWidth}
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
            onExpand={handleRightToggleCollapse}
            onCollapse={handleRightToggleCollapse}
            onMaximizePanes={handleMaximizePanes}
            onOpenSettings={handleOpenSettings}
          />
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onResetWidths={handleResetWidths}
        />
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
          onToggleCollapse={handleLeftToggleCollapse}
          onOpenSettings={handleOpenSettings}
        />

        {/* Left Resize Splitter Handle */}
        <ResizeHandle
          side="left"
          currentWidth={leftWidth}
          minWidth={MIN_LEFT_WIDTH}
          maxWidth={Math.min(maxLeftWidth, containerWidth - rightWidth - MIN_MIDDLE_WIDTH)}
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
          maxWidth={Math.min(maxRightWidth, containerWidth - leftWidth - MIN_MIDDLE_WIDTH)}
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
          onExpand={handleRightToggleCollapse}
          onCollapse={handleRightToggleCollapse}
          onMaximizePanes={handleMaximizePanes}
          onOpenSettings={handleOpenSettings}
        />
      </div>

      {/* Settings Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetWidths={handleResetWidths}
      />

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
