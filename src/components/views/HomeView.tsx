import React, { useState } from "react";
import { PomodoroDial } from "../features/pomodoro/PomodoroDial";
import { ActionPlansView } from "./ActionPlansView";
import { ChatView } from "./ChatView";
import { CalendarView } from "./CalendarView";
import { GoalsView } from "./GoalsView";
import { TasksView } from "./TasksView";
import { KanbanView } from "./KanbanView";
import { NotesView } from "./NotesView";
import { NavViewId } from "../../types/hud";
import { loadNavConfig } from "../../stores/navStore";

const AVAILABLE_VIEWS: Array<{ id: NavViewId; label: string }> = [
  { id: "timer", label: "POMODORO TIMER" },
  { id: "notes", label: "NOTES & SCRATCHPAD" },
  { id: "action_plans", label: "ACTION PLANS" },
  { id: "chat", label: "AI AGENT CHAT" },
  { id: "calendar", label: "CALENDAR SCHEDULE" },
  { id: "goals", label: "GOALS & OBJECTIVES" },
  { id: "tasks", label: "TASKS & TODOS" },
  { id: "kanban", label: "KANBAN BOARD" },
];

export const HomeView: React.FC = () => {
  const navConfig = loadNavConfig();
  const availableViews = AVAILABLE_VIEWS.filter((v) => {
    const item = navConfig.find((n) => n.id === v.id);
    return item ? item.visible : true;
  });

  // Layout mode: "split" (2 half-height views) or "single" (1 full-height view)
  const [layoutMode, setLayoutMode] = useState<"single" | "split">(() => {
    const saved = localStorage.getItem("focushud_home_layout_mode");
    return saved === "single" ? "single" : "split";
  });

  // Top half / Single view (Default: Pomodoro Timer)
  const [topView, setTopView] = useState<NavViewId>(() => {
    const saved = localStorage.getItem("focushud_home_top_view");
    return (saved as NavViewId) || "timer";
  });

  // Bottom half view (Default: Action Plans)
  const [bottomView, setBottomView] = useState<NavViewId>(() => {
    const saved = localStorage.getItem("focushud_home_bottom_view");
    return (saved as NavViewId) || "action_plans";
  });

  const handleToggleLayoutMode = () => {
    const nextMode = layoutMode === "single" ? "split" : "single";
    setLayoutMode(nextMode);
    localStorage.setItem("focushud_home_layout_mode", nextMode);
  };

  const handleSetTopView = (view: NavViewId) => {
    setTopView(view);
    localStorage.setItem("focushud_home_top_view", view);
  };

  const handleSetBottomView = (view: NavViewId) => {
    setBottomView(view);
    localStorage.setItem("focushud_home_bottom_view", view);
  };

  const renderSlotView = (viewId: NavViewId, isCompact: boolean) => {
    switch (viewId) {
      case "timer":
        return (
          <div className="w-full h-full flex items-center justify-center overflow-y-auto">
            <PomodoroDial isCompact={isCompact} />
          </div>
        );
      case "notes":
        return <NotesView isCompact={isCompact} />;
      case "action_plans":
        return <ActionPlansView show3D={false} isCompact={isCompact} />;
      case "chat":
        return <ChatView isCompact={isCompact} />;
      case "calendar":
        return <CalendarView isCompact={isCompact} />;
      case "goals":
        return <GoalsView show3D={false} isCompact={isCompact} />;
      case "tasks":
        return <TasksView show3D={false} isCompact={isCompact} />;
      case "kanban":
        return <KanbanView isCompact={isCompact} />;
      default:
        return <PomodoroDial isCompact={isCompact} />;
    }
  };

  if (layoutMode === "single") {
    return (
      <div className="h-full w-full flex flex-col p-1.5 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none">
        {/* ================= FULL HEIGHT SINGLE VIEW ================= */}
        <div className="flex-1 h-full flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_12px_rgba(0,229,255,0.06)]">
          {/* Header with Layout Toggle & View Switcher */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider bg-black/40">
            <span className="text-cyan-400/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-cyan-400 rotate-45" />
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleLayoutMode}
                data-testid="home-layout-toggle"
                aria-label="Switch to 2 views"
                title="Switch to 2 half-height views"
                className="bg-black/80 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-950/40 text-[9px] text-cyan-300 font-tech uppercase tracking-wider px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1.5"
              >
                <span className="text-[11px] leading-none text-cyan-400">⚏</span>
                <span>2 VIEWS</span>
              </button>

              <select
                value={topView}
                onChange={(e) => handleSetTopView(e.target.value as NavViewId)}
                aria-label="Select Top View"
                data-testid="home-view-select"
                className="bg-black/80 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[9px] text-cyan-200 font-tech uppercase tracking-wider focus:outline-none hover:border-cyan-400 transition cursor-pointer"
              >
                {availableViews.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#050b14] text-cyan-200">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Full Height Content (isCompact=false shows full title & views) */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            {renderSlotView(topView, false)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col p-1.5 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF (Default: Pomodoro Timer) ================= */}
      <div className="flex-1 min-h-[220px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_12px_rgba(0,229,255,0.06)]">
        {/* Top Slot Header with View Switcher */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider bg-black/40">
          <span className="text-cyan-400/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-cyan-400 rotate-45" />
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLayoutMode}
              data-testid="home-layout-toggle"
              aria-label="Switch to 1 view"
              title="Switch to 1 full-height view"
              className="bg-black/80 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-950/40 text-[9px] text-cyan-300 font-tech uppercase tracking-wider px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1.5"
            >
              <span className="text-[10px] leading-none text-cyan-400">⏹</span>
              <span>1 VIEW</span>
            </button>

            {/* Switch View Dropdown */}
            <select
              value={topView}
              onChange={(e) => handleSetTopView(e.target.value as NavViewId)}
              aria-label="Select Top View"
              className="bg-black/80 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[9px] text-cyan-200 font-tech uppercase tracking-wider focus:outline-none hover:border-cyan-400 transition cursor-pointer"
            >
              {availableViews.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#050b14] text-cyan-200">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top Slot Content */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {renderSlotView(topView, true)}
        </div>
      </div>

      {/* ================= BOTTOM HALF (Default: Action Plans) ================= */}
      <div className="flex-1 min-h-[220px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_12px_rgba(0,229,255,0.06)]">
        {/* Bottom Slot Header with View Switcher */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider bg-black/40">
          <span className="text-amber-400/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rotate-45" />
          </span>

          {/* Switch View Dropdown */}
          <div className="relative flex items-center">
            <select
              value={bottomView}
              onChange={(e) => handleSetBottomView(e.target.value as NavViewId)}
              aria-label="Select Bottom View"
              className="bg-black/80 border border-amber-500/40 rounded px-1.5 py-0.5 text-[9px] text-amber-200 font-tech uppercase tracking-wider focus:outline-none hover:border-amber-400 transition cursor-pointer"
            >
              {availableViews.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#050b14] text-amber-200">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Slot Content */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {renderSlotView(bottomView, true)}
        </div>
      </div>
    </div>
  );
};
