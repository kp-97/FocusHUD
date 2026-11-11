import { HudBrackets } from "../../ui/HudBrackets";
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Home,
  MessageSquare,
  Calendar,
  Target,
  CheckSquare,
  FileText,
  Workflow,
  Timer,
  Columns3,
} from "lucide-react";
import { NavViewId, WindowModeState } from "../../../types/hud";
import {
  getInitialRightNav,
  broadcastRightNavChange,
  subscribeRightNavChange,
} from "../../../stores/layoutStore";
import { RightSidebarCompactRail } from "./RightSidebarCompactRail";

// View components
import { HomeView } from "../../views/HomeView";
import { ChatView } from "../../views/ChatView";
import { CalendarView } from "../../views/CalendarView";
import { GoalsView } from "../../views/GoalsView";
import { TasksView } from "../../views/TasksView";
import { KanbanView } from "../../views/KanbanView";
import { ActionPlansView } from "../../views/ActionPlansView";
import { NotesView } from "../../views/NotesView";
import { PomodoroDial } from "../../features/pomodoro/PomodoroDial";

export const AVAILABLE_RIGHT_VIEWS: Array<{ id: NavViewId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "home", label: "HOME", icon: Home },
  { id: "chat", label: "AI CHAT", icon: MessageSquare },
  { id: "calendar", label: "CALENDAR", icon: Calendar },
  { id: "goals", label: "GOALS", icon: Target },
  { id: "tasks", label: "TASKS", icon: CheckSquare },
  { id: "notes", label: "NOTES", icon: FileText },
  { id: "action_plans", label: "ACTION PLANS", icon: Workflow },
  { id: "timer", label: "TIMER", icon: Timer },
  { id: "kanban", label: "KANBAN", icon: Columns3 },
];

interface RightSidebarProps {
  width: number;
  activeNav?: string;
  onSelectNav?: (id: string) => void;
  isCompact?: boolean;
  isDockMode?: boolean;
  isJoinedMode?: boolean;
  windowState?: WindowModeState;
  isAppMaximized?: boolean;
  leftWidth?: number;
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

export const RightSidebar: React.FC<RightSidebarProps> = ({
  width,
  leftWidth = 280,
  activeNav,
  onSelectNav,
  isJoinedMode = false,
  windowState,
  isAppMaximized = false,
  onExpand,
  onCollapse,
  onToggleLeftPane,
  onToggleRightPane,
  onToggleBothPanes,
  onToggleMaximizeApp,
  onClickMaximise,
  onClickRestoreDown,
  onClickFullscreen,
  onClickExitFullscreen,
  onClickSplit,
  onClickMinimise,
  onMaximizePanes,
  onOpenSettings,
}) => {
  // Independent view selection for the Right Pane
  const [currentNav, setCurrentNav] = useState<NavViewId>(() => {
    return getInitialRightNav();
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync right pane view across windows independently of the left pane
  useEffect(() => {
    const unsubscribe = subscribeRightNavChange((nav) => {
      setCurrentNav(nav);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown on click outside or escape
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleSelectNav = (nav: NavViewId) => {
    setCurrentNav(nav);
    broadcastRightNavChange(nav);
    setIsDropdownOpen(false);
  };

  const isIconOnly = width < 120;

  // Render view corresponding to selected navigation in the Right Pane
  const renderActiveView = () => {
    switch (currentNav) {
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
        return <NotesView />;
      case "kanban":
        return <KanbanView />;
      case "action_plans":
        return <ActionPlansView />;
      case "timer":
        return <PomodoroDial isCompact={false} />;
      default:
        return <HomeView />;
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-full shrink-0 flex flex-row justify-end p-2 bg-[#03070d] border-l border-cyan-500/30 text-cyan-300 select-none overflow-visible relative z-30"
    >
      {/* ================= RIGHT PANE CONTENT (left side of RightSidebar, only rendered when !isIconOnly) ================= */}
      {!isIconOnly && (
        <div className="flex-1 min-w-0 h-full pr-2">
          <HudBrackets
            variant="amber"
            showTicks={false}
            className="h-full w-full flex flex-col overflow-visible select-none"
          >
            <div className="flex-1 min-w-0 h-full flex flex-col p-1.5 overflow-visible relative">
              {/* Right Pane Top Bar with View Selector Dropdown */}
              <div className="shrink-0 flex items-center justify-between h-7 border-b border-amber-500/20 pb-1 mb-1 px-1">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    aria-label="Select Right Pane View"
                    data-testid="right-pane-view-dropdown-button"
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-amber-500/30 hover:border-amber-400 text-[10px] font-tech text-amber-200 transition cursor-pointer max-w-[180px]"
                  >
                    <span className="w-1.5 h-1.5 bg-amber-400 rotate-45 shadow-[0_0_6px_#ffb300] shrink-0" />
                    <span className="font-bold tracking-widest uppercase truncate">
                      VIEW: {currentNav.toUpperCase()}
                    </span>
                    <ChevronDown className="w-3 h-3 text-amber-400 shrink-0 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div
                      role="menu"
                      aria-label="Right Pane Views"
                      className="absolute top-full left-0 mt-1 w-44 bg-[#050b14] border border-amber-500/40 rounded shadow-[0_4px_16px_rgba(0,0,0,0.8)] z-50 py-1 font-tech select-none"
                    >
                      {AVAILABLE_RIGHT_VIEWS.map((item) => {
                        const Icon = item.icon;
                        const isSelected = currentNav === item.id;
                        return (
                          <button
                            key={item.id}
                            role="menuitem"
                            onClick={() => handleSelectNav(item.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition cursor-pointer ${
                              isSelected
                                ? "bg-amber-500/20 text-amber-300 font-bold border-l-2 border-amber-400"
                                : "text-amber-200/80 hover:bg-amber-500/10 hover:text-amber-100"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[9px] font-tech text-amber-500/60 uppercase">
                  SYS.ZONE.02
                </div>
              </div>

              {/* View Content Body */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {renderActiveView()}
              </div>
            </div>
          </HudBrackets>
        </div>
      )}

      {/* ================= RIGHT RAIL (ALWAYS permanently docked on right, fixed w-[52px] with fixed brackets & dots) ================= */}
      <div
        className="relative hud-panel rounded-sm shadow-[0_0_12px_rgba(255,145,0,0.2)] h-full w-[52px] shrink-0 flex flex-col items-center select-none overflow-visible ml-auto"
      >
        {/* Top Left Bracket & Dot: FIXED on the Right Rail */}
        <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute top-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

        {/* Top Right Bracket & Dot */}
        <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute top-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

        {/* Bottom Left Bracket & Dot */}
        <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute bottom-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

        {/* Bottom Right Bracket & Dot: FIXED on the Right Rail */}
        <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute bottom-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

        <RightSidebarCompactRail
          leftWidth={leftWidth}
          rightWidth={width}
          isRightCollapsed={isIconOnly}
          isJoinedMode={isJoinedMode}
          windowState={windowState}
          isAppMaximized={isAppMaximized}
          activeNav={activeNav}
          currentRightNav={currentNav}
          onSelectNav={onSelectNav}
          onSelectRightNav={handleSelectNav}
          onExpand={onExpand || onToggleRightPane}
          onCollapse={onCollapse || onToggleRightPane}
          onToggleLeftPane={onToggleLeftPane}
          onToggleRightPane={onToggleRightPane || onExpand || onCollapse}
          onToggleBothPanes={onToggleBothPanes}
          onToggleMaximizeApp={onToggleMaximizeApp}
          onClickMaximise={onClickMaximise}
          onClickRestoreDown={onClickRestoreDown}
          onClickFullscreen={onClickFullscreen}
          onClickExitFullscreen={onClickExitFullscreen}
          onClickSplit={onClickSplit}
          onClickMinimise={onClickMinimise}
          onMaximizePanes={onMaximizePanes}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </aside>
  );
};
