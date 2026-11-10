import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  Square,
  X,
  Minus,
  Copy,
  MessageSquare,
} from "lucide-react";
import { usePomodoro } from "../../../stores/pomodoroStore";
import { exitApp, minimizeToTray } from "../../../services/tauriBridge";
import { useTheme } from "../../../stores/themeStore";
import { RightRailSystemStats } from "./RightRailSystemStats";
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
  const { themeConfig } = useTheme();
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

  const {
    cycle,
    totalCycles,
    timeLeft,
    totalSeconds,
    isRunning,
    dailyStats,
    toggleRun,
    stop,
    reset,
  } = usePomodoro();

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const accent = themeConfig?.accentColor || "#ff9100";
  const isLightOrPink = themeConfig?.category === "light";
  const timerTextColor = isLightOrPink ? "var(--hud-text-primary)" : "#ffffff";

  const radius = 16;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

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

  // Timer Section Components grouped tightly together
  const renderTimerSection = () => (
    <div
      className="w-full flex flex-col items-center gap-1 py-0.5 shrink-0"
      data-testid="right-rail-timer-section"
    >
      {/* 1. Mini Ring Gauge & Countdown */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke={accent}
            strokeOpacity={0.18}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke={accent}
            strokeWidth={strokeWidth + 0.5}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-300"
            style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-tech text-[9px] font-bold tracking-tighter"
            style={{ color: timerTextColor }}
          >
            {minutes}m
          </span>
        </div>
      </div>

      <div
        className="text-[10px] font-tech font-bold tracking-tight"
        style={{ color: timerTextColor }}
      >
        {timeFormatted}
      </div>

      {/* 2. Action Controls (tightly grouped) */}
      <div className="flex flex-col items-center gap-1 w-full shrink-0 my-0.5">
        {isRunning ? (
          <>
            <button
              onClick={toggleRun}
              title="Pause Timer"
              aria-label="Pause Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all hud-btn-active border-amber-400 bg-amber-500/25 shadow-[0_0_12px_rgba(255,145,0,0.4)] text-amber-100"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={stop}
              title="Cancel Timer"
              aria-label="Cancel Timer"
              className="hud-btn w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all border-red-500/30 text-red-400/70 hover:text-red-200 hover:border-red-400"
            >
              <Square className="w-2.5 h-2.5 fill-red-400" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleRun}
              title="Start Focus Timer"
              aria-label="Start Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/40 text-amber-300 hover:text-amber-100 hover:border-amber-400"
            >
              <Play className="w-3.5 h-3.5 ml-0.5" />
            </button>

            <button
              onClick={reset}
              title="Reset Timer"
              aria-label="Reset Timer"
              className="hud-btn w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/30 text-amber-400/70 hover:text-amber-200 hover:border-amber-400"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </>
        )}
      </div>

      {/* 3. Session Cycles / Pips */}
      <div className="flex flex-col items-center w-full shrink-0 mt-0.5">
        <span className="text-[7px] font-tech uppercase tracking-widest text-amber-400/60 mb-0.5">
          CYCLES
        </span>
        <div className="flex flex-col gap-1 items-center">
          {Array.from({ length: totalCycles }).map((_, idx) => {
            const isDone = cycle > idx + 1;
            const isCurrent = cycle === idx + 1;
            return (
              <div
                key={idx}
                title={`Cycle ${idx + 1} of ${totalCycles}`}
                className={`w-1.5 h-1.5 rotate-45 transition-all ${
                  isDone
                    ? "bg-amber-400 shadow-[0_0_5px_#ff9100]"
                    : isCurrent
                    ? "bg-amber-400/60 border border-amber-300 shadow-[0_0_3px_#ff9100]"
                    : "bg-neutral-800 border border-amber-500/20"
                }`}
              />
            );
          })}
        </div>
        <span className="text-[7.5px] font-tech text-amber-300 font-semibold mt-0.5">
          {cycle}/{totalCycles}
        </span>
      </div>

      {/* 4. Completed Today Badge */}
      <div
        className="flex items-center gap-0.5 text-[8px] font-tech text-amber-300/90 pt-0.5"
        title={`Completed today: ${dailyStats.completedPomodoros} sessions (${dailyStats.totalFocusMinutes}m)`}
      >
        <Check className="w-2.5 h-2.5 text-amber-400" />
        <span>{dailyStats.completedPomodoros}</span>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col items-center overflow-y-auto overflow-x-hidden select-none px-1 py-1 gap-1">
        {/* 1. Top Section: Window Controls (Always Vertical) */}
        <div className="shrink-0 w-full flex flex-col items-center">
          {/* Window controls */}
          <div className="flex flex-col items-center gap-1 w-full pt-0.5">
            {/* Top: Exit */}
            <button
              onClick={() => exitApp()}
              data-testid="window-btn-close"
              title="Close FocusHUD (Restores Desktop)"
              aria-label="Close FocusHUD"
              className="text-cyan-500/50 hover:text-red-400 hover:scale-110 transition p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Maximise / Restore Down (Always visible; shows Restore Down in Maximised or Fullscreen Immersive states) */}
            <button
              onClick={
                effectiveIsMaximised || effectiveIsFullscreen
                  ? onClickRestoreDown || onToggleMaximizeApp
                  : onClickMaximise || onToggleMaximizeApp || handleMaximize
              }
              data-testid={
                effectiveIsMaximised || effectiveIsFullscreen
                  ? "window-btn-restore-down"
                  : "window-btn-maximise"
              }
              title={
                effectiveIsMaximised || effectiveIsFullscreen
                  ? "Click Restore Down (Restore FocusHUD)"
                  : "Click Maximise (Maximize FocusHUD)"
              }
              aria-label={
                effectiveIsMaximised || effectiveIsFullscreen
                  ? "Restore FocusHUD"
                  : "Maximize FocusHUD"
              }
              className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
            >
              {effectiveIsMaximised || effectiveIsFullscreen ? (
                <Copy className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Bottom: Minimize */}
            <button
              onClick={() => {
                if (onClickMinimise) {
                  onClickMinimise();
                } else {
                  minimizeToTray();
                }
              }}
              data-testid="window-btn-minimise"
              title="Click Minimise (Minimize FocusHUD to Tray)"
              aria-label="Minimize FocusHUD to Tray"
              className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>

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
          {renderTimerSection()}
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
