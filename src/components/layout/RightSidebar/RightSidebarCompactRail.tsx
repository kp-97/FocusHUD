import React, { useState, useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { RightRailSystemStats } from "./RightRailSystemStats";
import { RailWindowControls } from "./RailWindowControls";
import { RailTimerSection } from "./RailTimerSection";
import { NAV_ICON_MAP } from "../LeftSidebar/LeftSidebar";
import {
  loadNavConfig,
  reorderNavConfig,
  getNavItemRail,
  broadcastNavChange,
  subscribeLayoutAction,
} from "../../../stores/layoutStore";
import { NavItemConfig, NavViewId, WindowModeState } from "../../../types/hud";
import { Tooltip, TooltipProvider } from "../../ui/Tooltip";

interface RightSidebarCompactRailProps {
  leftWidth?: number;
  rightWidth?: number;
  isRightCollapsed?: boolean;
  isJoinedMode?: boolean;
  windowState?: WindowModeState;
  isAppMaximized?: boolean;
  activeNav?: string;
  currentRightNav?: NavViewId;
  onSelectNav?: (id: string) => void;
  onSelectRightNav?: (id: NavViewId) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  onToggleLeftPane?: () => void;
  onToggleRightPane?: () => void;
  onToggleBothPanes?: () => void;
  onToggleMaximizeApp?: () => void;
  onClickMaximise?: () => void;
  onClickRestoreDown?: () => void;
  onClickFullscreen?: () => void;
  onClickExitFullscreen?: () => void;
  onClickSplit?: () => void;
  onClickMinimise?: () => void;
  onMaximizePanes?: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export const RightSidebarCompactRail: React.FC<RightSidebarCompactRailProps> = ({
  rightWidth,
  isRightCollapsed,
  isJoinedMode = false,
  windowState,
  isAppMaximized = false,
  activeNav = "home",
  currentRightNav = "chat",
  onSelectNav,
  onSelectRightNav,
  onExpand,
  onCollapse,
  onToggleRightPane,
  onToggleMaximizeApp,
  onClickMaximise,
  onClickRestoreDown,
  onClickMinimise,
  onMaximizePanes,
}) => {
  const [navItems, setNavItems] = useState<NavItemConfig[]>(() => loadNavConfig());
  const [draggedNavId, setDraggedNavId] = useState<NavViewId | null>(null);
  const [dragOverNavId, setDragOverNavId] = useState<NavViewId | null>(null);
  const draggedNavIdRef = useRef<NavViewId | null>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "focushud_nav_config") {
        setNavItems(loadNavConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    const unsub = subscribeLayoutAction((action) => {
      if (action.type === "NAV_CONFIG_CHANGE") {
        setNavItems(action.config);
      }
    });
    return () => {
      window.removeEventListener("storage", handleStorage);
      unsub();
    };
  }, []);

  const effectiveWindowState: WindowModeState =
    windowState ?? (isAppMaximized ? "maximised" : isJoinedMode ? "windowed" : "split");
  const effectiveIsMaximised = effectiveWindowState === "maximised" || isAppMaximized;
  const effectiveIsFullscreen = effectiveWindowState === "fullscreen";
  const effectiveIsJoined =
    isJoinedMode ||
    effectiveWindowState === "windowed" ||
    effectiveWindowState === "maximised" ||
    effectiveWindowState === "fullscreen";
  const collapsed = isRightCollapsed ?? (rightWidth ? rightWidth < 120 : true);

  const handleToggleRight = () => {
    if (onToggleRightPane) {
      onToggleRightPane();
    } else if (collapsed && onExpand) {
      onExpand();
    } else if (!collapsed && onCollapse) {
      onCollapse();
    }
  };

  const handleRightNavClick = (id: NavViewId) => {
    if (effectiveIsJoined) {
      if (onSelectNav) {
        onSelectNav(id);
      }
      broadcastNavChange(id);
      return;
    }

    const hasToggle = Boolean(onToggleRightPane || onExpand || onCollapse);
    if (collapsed) {
      if (onSelectRightNav) {
        onSelectRightNav(id);
      }
      if (hasToggle) {
        handleToggleRight();
      }
    } else if (currentRightNav === id && hasToggle) {
      handleToggleRight();
    } else if (onSelectRightNav) {
      onSelectRightNav(id);
    }
  };

  const handleNavDragStart = (e: React.DragEvent, id: NavViewId) => {
    draggedNavIdRef.current = id;
    setDraggedNavId(id);
    try {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    } catch {}
  };

  const handleNavDragOver = (e: React.DragEvent, targetId?: NavViewId) => {
    e.preventDefault();
    if (targetId && targetId !== dragOverNavId) {
      setDragOverNavId(targetId);
    }
  };

  const handleNavDrop = (e: React.DragEvent, targetId?: NavViewId) => {
    e.preventDefault();
    e.stopPropagation();
    let sourceId = draggedNavIdRef.current;
    if (!sourceId) {
      try {
        const transferred = e.dataTransfer.getData("text/plain") as NavViewId;
        if (transferred) sourceId = transferred;
      } catch {}
    }
    setDraggedNavId(null);
    setDragOverNavId(null);
    draggedNavIdRef.current = null;
    if (!sourceId) return;
    const next = reorderNavConfig(navItems, sourceId, targetId ?? null, "right");
    setNavItems(next);
  };

  const handleNavDragEnd = () => {
    setDraggedNavId(null);
    setDragOverNavId(null);
    draggedNavIdRef.current = null;
  };

  // Vertical position offsets for timer and stats along the right rail (in pixels)
  const [timerOffset, setTimerOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("focushud_right_rail_timer_offset");
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val)) return Math.max(0, Math.min(400, val));
      }
    } catch {}
    return 0;
  });

  const [statsOffset, setStatsOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("focushud_right_rail_stats_offset");
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val)) return Math.max(0, Math.min(500, val));
      }
    } catch {}
    return 0;
  });

  const [draggingSection, setDraggingSection] = useState<"timer" | "stats" | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const initialOffsetRef = useRef<number>(0);
  const draggingSectionRef = useRef<"timer" | "stats" | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("focushud_right_rail_timer_offset", String(Math.round(timerOffset)));
    } catch {}
  }, [timerOffset]);

  useEffect(() => {
    try {
      localStorage.setItem("focushud_right_rail_stats_offset", String(Math.round(statsOffset)));
    } catch {}
  }, [statsOffset]);

  // Pointer / Mouse drag handlers (live line dragging vertically to adjust vertical position)
  const handlePointerDown = (e: React.PointerEvent, section: "timer" | "stats") => {
    e.preventDefault();
    e.stopPropagation();
    dragStartYRef.current = e.clientY;
    initialOffsetRef.current = section === "timer" ? timerOffset : statsOffset;
    draggingSectionRef.current = section;
    setDraggingSection(section);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const section = draggingSectionRef.current;
    if (dragStartYRef.current === null || !section) return;
    const deltaY = e.clientY - dragStartYRef.current;
    if (section === "timer") {
      const next = Math.max(0, Math.min(400, initialOffsetRef.current + deltaY));
      setTimerOffset(next);
      try {
        localStorage.setItem("focushud_right_rail_timer_offset", String(Math.round(next)));
      } catch {}
    } else if (section === "stats") {
      const next = Math.max(0, Math.min(500, initialOffsetRef.current + deltaY));
      setStatsOffset(next);
      try {
        localStorage.setItem("focushud_right_rail_stats_offset", String(Math.round(next)));
      } catch {}
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragStartYRef.current = null;
    draggingSectionRef.current = null;
    setDraggingSection(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // HTML5 Drag and Drop handlers for vertical offset
  const handleDragStart = (e: React.DragEvent, section: "timer" | "stats") => {
    dragStartYRef.current = e.clientY;
    initialOffsetRef.current = section === "timer" ? timerOffset : statsOffset;
    draggingSectionRef.current = section;
    setDraggingSection(section);
    try {
      e.dataTransfer.setData("text/plain", section);
      e.dataTransfer.effectAllowed = "move";
    } catch {}
  };

  const handleDrag = (e: React.DragEvent, section: "timer" | "stats") => {
    if (!e.clientY || dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    if (section === "timer") {
      const next = Math.max(0, Math.min(400, initialOffsetRef.current + deltaY));
      setTimerOffset(next);
      try {
        localStorage.setItem("focushud_right_rail_timer_offset", String(Math.round(next)));
      } catch {}
    } else if (section === "stats") {
      const next = Math.max(0, Math.min(500, initialOffsetRef.current + deltaY));
      setStatsOffset(next);
      try {
        localStorage.setItem("focushud_right_rail_stats_offset", String(Math.round(next)));
      } catch {}
    }
  };

  const handleDragEnd = () => {
    dragStartYRef.current = null;
    draggingSectionRef.current = null;
    setDraggingSection(null);
  };

  const handleMaximize = () => {
    if (onMaximizePanes) {
      onMaximizePanes();
    } else if (onExpand) {
      onExpand();
    }
  };

  // Draggable Dividing Line Component above Timer or Stats
  const renderDraggableLine = (section: "timer" | "stats", label: string) => {
    const isDragging = draggingSection === section;
    return (
      <div
        data-testid={`${section}-drag-handle`}
        role="separator"
        aria-label={`Draggable dividing line above ${label}`}
        title={`Drag line vertically to reposition ${label}`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, section)}
        onDrag={(e) => handleDrag(e, section)}
        onDragEnd={handleDragEnd}
        onPointerDown={(e) => handlePointerDown(e, section)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`w-full py-1.5 cursor-row-resize active:cursor-grabbing group select-none touch-none flex flex-col items-center justify-center transition-all ${
          isDragging ? "opacity-90 scale-y-125" : ""
        }`}
      >
        <div
          className={`w-full h-[1.5px] transition-all rounded-full ${
            isDragging
              ? "bg-amber-400 shadow-[0_0_8px_#ff9100] h-[2px]"
              : "bg-amber-500/30 group-hover:bg-amber-400 group-hover:shadow-[0_0_6px_#ff9100]"
          }`}
        />
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col items-center overflow-y-auto overflow-x-hidden select-none px-1 py-1 gap-1">
        {/* 1. Top Section: Window Controls (Always Vertical) */}
        <div className="shrink-0 w-full flex flex-col items-center">
          {/* Window controls */}
          <RailWindowControls
            effectiveIsMaximised={effectiveIsMaximised}
            effectiveIsFullscreen={effectiveIsFullscreen}
            onClickRestoreDown={onClickRestoreDown}
            onClickMaximise={onClickMaximise}
            onToggleMaximizeApp={onToggleMaximizeApp}
            handleMaximize={handleMaximize}
            onClickMinimise={onClickMinimise}
          />

          {/* Dividing Line below the window controls */}
          <div className="w-full h-[1px] bg-amber-500/20 my-1.5" />

          {/* Right Rail Navigation Views (AI Chat by default, draggable to reorder) */}
          <div
            data-testid="right-rail-nav-list"
            onDragOver={(e) => handleNavDragOver(e)}
            onDrop={(e) => handleNavDrop(e)}
            className="flex flex-col items-center gap-1 w-full pb-0.5 min-h-[32px]"
          >
            {navItems
              .filter((item) => item.visible && getNavItemRail(item) === "right")
              .map((item) => {
                const IconComponent = NAV_ICON_MAP[item.id] || MessageSquare;
                const isActive = effectiveIsJoined
                  ? activeNav === item.id
                  : !collapsed && currentRightNav === item.id;
                const isDragging = draggedNavId === item.id;
                const isDragOver = dragOverNavId === item.id && draggedNavId !== item.id;
                return (
                  <Tooltip key={item.id} content={item.label} side="left" theme="amber">
                    <button
                      draggable={true}
                      onDragStart={(e) => handleNavDragStart(e, item.id)}
                      onDragOver={(e) => handleNavDragOver(e, item.id)}
                      onDrop={(e) => handleNavDrop(e, item.id)}
                      onDragEnd={handleNavDragEnd}
                      onClick={() => handleRightNavClick(item.id)}
                      data-testid={`right-rail-nav-${item.id}`}
                      aria-label={item.label}
                      className={`w-8 h-8 flex items-center justify-center rounded transition-all cursor-grab active:cursor-grabbing ${
                        isActive
                          ? "bg-amber-500/20 text-amber-200 border border-amber-400 shadow-[0_0_8px_rgba(255,145,0,0.4)]"
                          : "text-amber-400/70 hover:text-amber-200 hover:bg-amber-500/10"
                      } ${isDragging ? "opacity-50 scale-95" : ""} ${
                        isDragOver ? "border-t-2 border-amber-300" : ""
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span className="sr-only">{item.label}</span>
                    </button>
                  </Tooltip>
                );
              })}
          </div>
        </div>

        {/* 2. Timer Section: Dividing Line + Timer components underneath (Fixed order: always above stats) */}
        <div
          className="w-full shrink-0 flex flex-col items-center transition-all duration-75"
          style={{ marginTop: `${timerOffset}px` }}
          data-testid="right-rail-timer-wrapper"
        >
          {renderDraggableLine("timer", "Timer")}
          <RailTimerSection />
        </div>

        {/* 3. System Stats Section: Dividing Line + Stats components underneath (Fixed order: always below timer) */}
        <div
          className="w-full shrink-0 flex flex-col items-center transition-all duration-75"
          style={{ marginTop: `${statsOffset}px` }}
          data-testid="right-rail-stats-wrapper"
        >
          {renderDraggableLine("stats", "Stats")}
          <RightRailSystemStats />
        </div>
      </div>
    </TooltipProvider>
  );
};
