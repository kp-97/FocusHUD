import { HudBrackets } from "./HudBrackets";
import React, { useState, useEffect } from "react";
import { X, Minus, Square } from "lucide-react";
import { exitApp, minimizeToTray } from "../utils/tauriBridge";
import { NavViewId } from "../types/hud";
import { getInitialNav, subscribeNavChange } from "../utils/store";
import { RightSidebarCompactRail } from "./RightSidebarCompactRail";

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
  onOpenSettings?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  width,
  activeNav: propActiveNav,
  onMaximizePanes,
  onOpenSettings,
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
      className="h-full shrink-0 flex flex-col p-2 bg-[#03070d] border-l border-cyan-500/30 text-cyan-300 select-none overflow-visible relative z-30"
    >
      <HudBrackets
        variant="amber"
        showTicks={false}
        className="h-full w-full flex flex-col justify-between p-1 overflow-visible select-none"
      >
        {isIconOnly ? (
          <RightSidebarCompactRail
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <>
            {/* Pinned Top Bar with Window Controls */}
            <div className="shrink-0 w-full flex flex-col border-b border-amber-500/20 pb-1 mb-1">
              {/* Row 1: Window Controls (Exit at far right) */}
              <div className="flex items-center justify-end h-7 px-1 text-[10px] font-tech text-cyan-400/80">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => minimizeToTray()}
                    title="Minimize FocusHUD to Tray (Frees Screen)"
                    aria-label="Minimize FocusHUD to Tray"
                    className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onMaximizePanes}
                    title="Maximize Left & Right Panes"
                    aria-label="Maximize Left & Right Panes"
                    className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
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
            </div>

            {/* Main Content View Container */}
            <div className="flex-1 w-full min-h-0 overflow-hidden relative">
              {renderActiveView()}
            </div>
          </>
        )}
      </HudBrackets>
    </aside>
  );
};
