import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  MessageSquare,
  Calendar,
  Target,
  CheckSquare,
  Columns3,
  Workflow,
  Timer,
  Menu,
  Settings,
  FileText,
} from "lucide-react";
import { HudBrackets } from "../../ui/HudBrackets";
import { SidebarToggleIcon } from "../../ui/SidebarToggleIcon";
import { getSystemDiagnostics, setDockPopoutMode } from "../../../services/tauriBridge";
import type { SystemDiagnostics } from "../../../types/diagnostics";
import { broadcastNavChange, loadNavConfig, subscribeLayoutAction } from "../../../stores/layoutStore";
import { NavViewId, NavItemConfig } from "../../../types/hud";
import { Tooltip, TooltipProvider } from "../../ui/Tooltip";
import { SystemMenuDropdown } from "./SystemMenuDropdown";
import { useTheme } from "../../../stores/themeStore";

// View components for Left Pane
import { HomeView } from "../../views/HomeView";
import { ChatView } from "../../views/ChatView";
import { CalendarView } from "../../views/CalendarView";
import { GoalsView } from "../../views/GoalsView";
import { TasksView } from "../../views/TasksView";
import { NotesView } from "../../views/NotesView";
import { KanbanView } from "../../views/KanbanView";
import { ActionPlansView } from "../../views/ActionPlansView";
import { TimerView } from "../../views/TimerView";

const NAV_ICON_MAP: Record<NavViewId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  chat: MessageSquare,
  calendar: Calendar,
  goals: Target,
  tasks: CheckSquare,
  notes: FileText,
  action_plans: Workflow,
  timer: Timer,
  kanban: Columns3,
};

interface LeftSidebarProps {
  width: number;
  activeNav: string;
  onSelectNav: (id: string) => void;
  isCompact?: boolean;
  isDockMode?: boolean;
  leftWidth?: number;
  rightWidth?: number;
  onToggleCollapse?: () => void;
  onToggleLeftPane?: () => void;
  onToggleRightPane?: () => void;
  onToggleBothPanes?: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  width,
  activeNav,
  onSelectNav,
  isDockMode = false,
  leftWidth,
  rightWidth: _rightWidth,
  onToggleCollapse,
  onToggleLeftPane,
  onToggleRightPane: _onToggleRightPane,
  onToggleBothPanes: _onToggleBothPanes,
  onOpenSettings,
}) => {
  const { themeConfig } = useTheme();
  const [, setDiag] = useState<SystemDiagnostics | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMenuOpenRef = useRef(isMenuOpen);
  isMenuOpenRef.current = isMenuOpen;
  const menuOpenedAtRef = useRef<number>(0);
  const activeTooltipRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTooltipOpen = useCallback((id: string) => {
    if (popoutCloseTimer.current) {
      clearTimeout(popoutCloseTimer.current);
      popoutCloseTimer.current = null;
    }
    activeTooltipRef.current = id;
    try {
      Promise.resolve(setDockPopoutMode("left", true)).catch(() => {});
    } catch {}
  }, []);

  const handleTooltipClose = useCallback((id: string) => {
    if (activeTooltipRef.current === id) {
      activeTooltipRef.current = null;
      if (popoutCloseTimer.current) {
        clearTimeout(popoutCloseTimer.current);
      }
      popoutCloseTimer.current = setTimeout(() => {
        if (!activeTooltipRef.current && !isMenuOpenRef.current) {
          try {
            Promise.resolve(setDockPopoutMode("left", false)).catch(() => {});
          } catch {}
        }
      }, 100);
    }
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    activeTooltipRef.current = null;
    if (popoutCloseTimer.current) {
      clearTimeout(popoutCloseTimer.current);
    }
    popoutCloseTimer.current = setTimeout(() => {
      if (!isMenuOpenRef.current) {
        try {
          Promise.resolve(setDockPopoutMode("left", false)).catch(() => {});
        } catch {}
      }
    }, 100);
  }, []);

  const isLeftCollapsed = (leftWidth ?? width) < 120;

  const handleToggleLeft = () => {
    if (onToggleLeftPane) {
      onToggleLeftPane();
    } else if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getSystemDiagnostics();
      if (data) setDiag(data);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const [navItems, setNavItems] = useState<NavItemConfig[]>(() => loadNavConfig());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "focushud_nav_config") {
        setNavItems(loadNavConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const activeItem = navItems.find((item) => item.id === activeNav);
    if (activeItem && !activeItem.visible) {
      const firstVisible = navItems.find((item) => item.visible);
      if (firstVisible) {
        onSelectNav(firstVisible.id);
        broadcastNavChange(firstVisible.id);
      } else {
        onSelectNav("home");
        broadcastNavChange("home");
      }
    }
  }, [navItems, activeNav, onSelectNav]);

  useEffect(() => {
    const unsub = subscribeLayoutAction((action) => {
      if (action.type === "SET_ACTIVE_NAV") {
        onSelectNav(action.nav);
      }
    });
    return () => unsub();
  }, [onSelectNav]);

  useEffect(() => {
    if (isMenuOpen) {
      menuOpenedAtRef.current = Date.now();
      try {
        Promise.resolve(setDockPopoutMode("left", true)).catch(() => {});
      } catch {}
    } else {
      if (!activeTooltipRef.current) {
        try {
          Promise.resolve(setDockPopoutMode("left", false)).catch(() => {});
        } catch {}
      }
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleWindowBlur = () => {
      const elapsed = Date.now() - menuOpenedAtRef.current;
      if (elapsed > 250) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const isIconOnly = width < 120;

  const renderActiveView = () => {
    switch (activeNav) {
      case "home":
        return <HomeView />;
      case "chat":
        return <ChatView />;
      case "calendar":
        return <CalendarView />;
      case "goals":
        return <GoalsView />;
      case "tasks":
        return <TasksView />;
      case "notes":
        return <NotesView isLeftDock={isDockMode} />;
      case "kanban":
        return <KanbanView />;
      case "action_plans":
        return <ActionPlansView />;
      case "timer":
        return <TimerView />;
      default:
        return <HomeView />;
    }
  };

  const handleNavClick = (id: string) => {
    onSelectNav(id);
    broadcastNavChange(id as NavViewId);
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      onMouseLeave={handleSidebarMouseLeave}
      className="h-full shrink-0 flex flex-row p-2 bg-[#03070d] border-r border-cyan-500/30 text-cyan-300 select-none overflow-visible relative z-30"
    >
      <TooltipProvider
        onTooltipOpen={handleTooltipOpen}
        onTooltipClose={handleTooltipClose}
      >
        {/* ================= LEFT RAIL COLUMN (Permanently fixed width with its own brackets & dots) ================= */}
        <div
          className="relative hud-panel rounded-sm shadow-[0_0_12px_rgba(0,229,255,0.2)] h-full w-[52px] shrink-0 flex flex-col justify-between items-center p-1 select-none overflow-visible"
        >
          {/* Top Left Bracket & Dot */}
          <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none z-20" />
          <div className="absolute top-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

          {/* Top Right Bracket & Dot: FIXED on the Left Rail */}
          <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none z-20" />
          <div className="absolute top-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

          {/* Bottom Left Bracket & Dot */}
          <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none z-20" />
          <div className="absolute bottom-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

          {/* Bottom Right Bracket & Dot: FIXED on the Left Rail */}
          <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none z-20" />
          <div className="absolute bottom-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

          {/* Top Rail Header: Fixed Hamburger Menu + Toggles underneath */}
          <div className="shrink-0 flex flex-col items-center w-full border-b border-cyan-500/30 pb-1.5 mb-1 gap-1">
            {/* 1. Hamburger Menu replacing old toggle, fixed at top of rail */}
            <Tooltip content="System Menu" side="right" theme="cyan" disabled={isMenuOpen}>
              <button
                ref={menuBtnRef}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="System Menu"
                aria-expanded={isMenuOpen}
                className="hover:scale-110 transition p-1 cursor-pointer w-8 h-8 flex items-center justify-center rounded"
                style={{
                  color:
                    themeConfig?.category === "light"
                      ? "var(--hud-text-primary)"
                      : (themeConfig?.accentColor || "#00e5ff"),
                }}
              >
                <Menu className="w-4 h-4" />
              </button>
            </Tooltip>

            {/* 2. Left Pane Toggle fixed underneath hamburger */}
            <div className="flex flex-col items-center gap-1 w-full pt-0.5">
              <SidebarToggleIcon
                side="left"
                isCollapsed={isLeftCollapsed}
                onToggle={handleToggleLeft}
                theme="cyan"
              />
            </div>
          </div>

          {/* Hamburger Popout Menu */}
          <SystemMenuDropdown
            isOpen={isMenuOpen}
            menuRef={menuRef}
            onClose={() => setIsMenuOpen(false)}
            onOpenSettings={onOpenSettings}
          />

          {/* Center Navigation Icons (Vertically fixed, icon-only, located under the line) */}
          <div className="flex-1 flex flex-col gap-1 items-center justify-start w-full min-h-0 pt-0.5 pb-1 overflow-y-auto overflow-x-hidden">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const IconComponent = NAV_ICON_MAP[item.id] || Home;
                const isActive = activeNav === item.id;
                return (
                  <Tooltip key={item.id} content={item.label} side="right" theme="cyan">
                    <button
                      onClick={() => handleNavClick(item.id)}
                      data-testid={`left-rail-nav-${item.id}`}
                      aria-label={item.label}
                      className={`w-8 h-8 flex items-center justify-center rounded transition-all cursor-pointer ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]"
                          : "text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/10"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span className="sr-only">{item.label}</span>
                    </button>
                  </Tooltip>
                );
              })}
          </div>

          {/* Bottom Settings Button */}
          <div className="shrink-0 flex flex-col items-center w-full border-t border-cyan-500/30 pt-1.5 mt-1">
            <Tooltip content="Settings" side="right" theme="cyan">
              <button
                onClick={() => onOpenSettings && onOpenSettings()}
                aria-label="Settings"
                className="w-8 h-8 flex items-center justify-center rounded text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/10 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ================= LEFT PANE CONTENT (Only rendered when expanded, width >= 120) ================= */}
        {!isIconOnly && (
          <div className="flex-1 min-w-0 h-full pl-2">
            <HudBrackets className="h-full w-full flex flex-col min-w-0 overflow-y-auto">
              <div className="flex-1 flex flex-col p-2 min-w-0 overflow-y-auto">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rotate-45 shadow-[0_0_6px_#00e5ff]" />
                    <span className="font-tech text-xs tracking-widest text-cyan-400 uppercase font-bold">
                      FocusHUD
                    </span>
                  </div>
                  <div className="text-[9px] font-tech text-cyan-500/60 uppercase">
                    SYS.ZONE.01
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {renderActiveView()}
                </div>
              </div>
            </HudBrackets>
          </div>
        )}
      </TooltipProvider>
    </aside>
  );
};
