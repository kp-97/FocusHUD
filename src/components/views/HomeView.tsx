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

const AVAILABLE_VIEWS: Array<{ id: NavViewId; label: string }> = [
  { id: "timer", label: "POMODORO TIMER" },
  { id: "notes", label: "NOTES & SCRATCHPAD" },
  { id: "action_plans", label: "ACTION PLANS" },
  { id: "chat", label: "AI CHAT" },
  { id: "calendar", label: "CALENDAR" },
  { id: "goals", label: "GOALS" },
  { id: "tasks", label: "TASKS" },
  { id: "kanban", label: "KANBAN" },
];

export const HomeView: React.FC = () => {
  // Top half view (Default: Pomodoro Timer)
  const [topView, setTopView] = useState<NavViewId>(() => {
    const saved = localStorage.getItem("focushud_home_top_view");
    return (saved as NavViewId) || "timer";
  });

  // Bottom half view (Default: Action Plans)
  const [bottomView, setBottomView] = useState<NavViewId>(() => {
    const saved = localStorage.getItem("focushud_home_bottom_view");
    return (saved as NavViewId) || "action_plans";
  });

  const handleSetTopView = (view: NavViewId) => {
    setTopView(view);
    localStorage.setItem("focushud_home_top_view", view);
  };

  const handleSetBottomView = (view: NavViewId) => {
    setBottomView(view);
    localStorage.setItem("focushud_home_bottom_view", view);
  };

  const renderSlotView = (viewId: NavViewId, _isTop: boolean) => {
    switch (viewId) {
      case "timer":
        return (
          <div className="w-full h-full flex items-center justify-center overflow-y-auto">
            <PomodoroDial isCompact={true} />
          </div>
        );
      case "notes":
        return <NotesView />;
      case "action_plans":
        return <ActionPlansView show3D={false} />;
      case "chat":
        return <ChatView />;
      case "calendar":
        return <CalendarView />;
      case "goals":
        return <GoalsView show3D={false} />;
      case "tasks":
        return <TasksView show3D={false} />;
      case "kanban":
        return <KanbanView />;
      default:
        return <PomodoroDial isCompact={true} />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-1.5 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF (Default: Pomodoro Timer) ================= */}
      <div className="flex-1 min-h-[220px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_12px_rgba(0,229,255,0.06)]">
        {/* Top Slot Header with View Switcher */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider bg-black/40">
          <span className="text-cyan-400/80 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-cyan-400 rotate-45" />
            TOP SLOT: {AVAILABLE_VIEWS.find((v) => v.id === topView)?.label}
          </span>

          {/* Switch View Dropdown */}
          <div className="relative flex items-center">
            <select
              value={topView}
              onChange={(e) => handleSetTopView(e.target.value as NavViewId)}
              className="bg-black/80 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[9px] text-cyan-200 font-tech uppercase tracking-wider focus:outline-none hover:border-cyan-400 transition cursor-pointer"
            >
              {AVAILABLE_VIEWS.map((v) => (
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
          <span className="text-amber-400/80 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rotate-45" />
            BOTTOM SLOT: {AVAILABLE_VIEWS.find((v) => v.id === bottomView)?.label}
          </span>

          {/* Switch View Dropdown */}
          <div className="relative flex items-center">
            <select
              value={bottomView}
              onChange={(e) => handleSetBottomView(e.target.value as NavViewId)}
              className="bg-black/80 border border-amber-500/40 rounded px-1.5 py-0.5 text-[9px] text-amber-200 font-tech uppercase tracking-wider focus:outline-none hover:border-amber-400 transition cursor-pointer"
            >
              {AVAILABLE_VIEWS.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#050b14] text-amber-200">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Slot Content */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {renderSlotView(bottomView, false)}
        </div>
      </div>
    </div>
  );
};
