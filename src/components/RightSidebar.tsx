import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { exitApp } from "../utils/tauriBridge";
import { NavViewId } from "../types/hud";
import { getInitialNav, subscribeNavChange } from "../utils/store";

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
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  width,
  activeNav: propActiveNav,
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
      className="h-full shrink-0 flex flex-col p-2 bg-[#03070d] border-l border-cyan-500/30 text-cyan-300 select-none overflow-hidden relative z-10"
    >
      {/* Pinned Top Bar with Close FocusHUD Button */}
      {!isIconOnly && (
        <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-cyan-500/20 text-[10px] font-tech text-cyan-400/80">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 bg-amber-400 rotate-45 shadow-[0_0_6px_#ffb300]" />
            <span className="font-bold tracking-widest text-amber-200 uppercase truncate">
              VIEW: {currentNav.replace("_", " ")}
            </span>
          </div>

          <button
            onClick={() => exitApp()}
            title="Close FocusHUD (Restores Desktop)"
            className="text-cyan-500/40 hover:text-red-400 hover:scale-110 transition p-0.5 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content View Container */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {renderActiveView()}
      </div>
    </aside>
  );
};
