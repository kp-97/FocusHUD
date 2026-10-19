import React, { useState, useEffect } from "react";
import { X, Minus, Square } from "lucide-react";
import { exitApp, minimizeToTray } from "../utils/tauriBridge";
import { NavViewId } from "../types/hud";
import { getInitialNav, subscribeNavChange } from "../utils/store";
import { RightSidebarCompactRail } from "./RightSidebarCompactRail";
import { SidebarToggleIcon } from "./SidebarToggleIcon";

// View components
import { HomeView } from "./views/HomeView";
import { ChatView } from "./views/ChatView";
import { CalendarView } from "./views/CalendarView";
import { GoalsView } from "./views/GoalsView";
import { TasksView } from "./views/TasksView";
import { KanbanView } from "./views/KanbanView";
import { ActionPlansView } from "./views/ActionPlansView";
import { TimerView } from "./views/TimerView";

interface RightSidebarProps {
  width: number;
  activeNav?: string;
  isCompact?: boolean;
  isDockMode?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onMaximizePanes?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  width,
  activeNav: propActiveNav,
  onExpand,
  onCollapse,
  onMaximizePanes,
}) => {
  // Real-time synchronization across windows & props
  const [currentNav, setCurrentNav] = useState<NavViewId>(() => {
    return (propActiveNav as NavViewId) || getInitialNav();
  });

  useEffect(() => {
    if (propActiveNav) {
      setCurrentNav(propActiveNav as NavViewId);
    }
  }, [propActiveNav]);

  useEffect(() => {
    const unsubscribe = subscribeNavChange((nav) => {
      setCurrentNav(nav);
    });
    return () => unsubscribe();
  }, []);

  const isIconOnly = width < 120;

  // Render view corresponding to selected navigation
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

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`h-full shrink-0 flex flex-col ${
        isIconOnly ? "p-1.5" : "p-2"
      } bg-[#03070d] border-l border-cyan-500/30 text-cyan-300 select-none overflow-hidden relative z-10`}
    >
      {isIconOnly ? (
        <RightSidebarCompactRail
          onExpand={onExpand}
          onMaximizePanes={onMaximizePanes}
        />
      ) : (
        <>
          {/* Pinned Top Bar with Toggle Icon, Title, and Window Controls */}
          <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-cyan-500/20 text-[10px] font-tech text-cyan-400/80">
            {/* Left section: Toggle Icon + View Title */}
            <div className="flex items-center gap-1.5 truncate">
              {onCollapse && (
                <SidebarToggleIcon
                  side="right"
                  isCollapsed={false}
                  onToggle={onCollapse}
                  theme="cyan"
                />
              )}
              <span className="w-1.5 h-1.5 bg-amber-400 rotate-45 shadow-[0_0_6px_#ffb300]" />
              <span className="font-bold tracking-widest text-amber-200 uppercase truncate">
                VIEW: {currentNav.replace("_", " ")}
              </span>
            </div>

            {/* Right section: Window Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* 1. Minimize to Tray */}
              <button
                onClick={() => minimizeToTray()}
                title="Minimize FocusHUD to Tray (Frees Screen)"
                aria-label="Minimize FocusHUD to Tray"
                className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* 2. Maximize Panes */}
              <button
                onClick={onMaximizePanes}
                title="Maximize Left & Right Panes"
                aria-label="Maximize Left & Right Panes"
                className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
              </button>

              {/* 3. Exit FocusHUD */}
              <button
                onClick={() => exitApp()}
                title="Close FocusHUD (Restores Desktop)"
                aria-label="Close FocusHUD"
                className="text-cyan-500/50 hover:text-red-400 hover:scale-110 transition p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Content View Container */}
          <div className="flex-1 w-full min-h-0 overflow-hidden relative">
            {renderActiveView()}
          </div>
        </>
      )}
    </aside>
  );
};


