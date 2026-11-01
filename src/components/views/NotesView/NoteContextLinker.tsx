import React, { useState, useEffect, useRef } from "react";
import {
  Target,
  CheckSquare,
  Workflow,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { GoalNode, TaskItem, ActionPlanNode } from "../../../types/hud";
import { loadGoals, loadTasks, loadActionPlans } from "../../../stores/layoutStore";
import { fetchGoals, fetchTasks, fetchActionPlans, isTauriEnvironment } from "../../../services/dbService";
import { dbGoalsToTree, dbTasksToTree, dbActionPlansToTree } from "../../../services/dbAdapters";

export interface NoteContextLinkerProps {
  goalId?: string | null;
  taskId?: string | null;
  actionPlanId?: string | null;
  onChangeLink: (links: {
    goalId?: string | null;
    taskId?: string | null;
    actionPlanId?: string | null;
  }) => void;
  goals?: GoalNode[];
  tasks?: TaskItem[];
  actionPlans?: ActionPlanNode[];
  className?: string;
}

export const NoteContextLinker: React.FC<NoteContextLinkerProps> = ({
  goalId,
  taskId,
  actionPlanId,
  onChangeLink,
  goals: propGoals,
  tasks: propTasks,
  actionPlans: propActionPlans,
  className = "",
}) => {
  const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Available context options to link note to
  const [goals, setGoals] = useState<GoalNode[]>(() => propGoals || loadGoals());
  const [tasks, setTasks] = useState<TaskItem[]>(() => propTasks || loadTasks());
  const [actionPlans, setActionPlans] = useState<ActionPlanNode[]>(() => propActionPlans || loadActionPlans());

  // Update from props if provided
  useEffect(() => {
    if (propGoals) setGoals(propGoals);
  }, [propGoals]);

  useEffect(() => {
    if (propTasks) setTasks(propTasks);
  }, [propTasks]);

  useEffect(() => {
    if (propActionPlans) setActionPlans(propActionPlans);
  }, [propActionPlans]);

  // Load goals, tasks, and action plans for contextual linking if running in Tauri
  useEffect(() => {
    if (!propGoals && !propTasks && !propActionPlans && isTauriEnvironment()) {
      fetchGoals().then((g) => {
        if (g.length > 0) setGoals(dbGoalsToTree(g));
      });
      fetchTasks().then((t) => {
        if (t.length > 0) setTasks(dbTasksToTree(t));
      });
      fetchActionPlans().then((ap) => {
        if (ap.length > 0) setActionPlans(dbActionPlansToTree(ap));
      });
    }
  }, [propGoals, propTasks, propActionPlans]);

  // Close context dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsLinkDropdownOpen(false);
      }
    };
    if (isLinkDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isLinkDropdownOpen]);

  // Flatten nested goals for selector
  const flattenGoals = (list: GoalNode[], depth = 0): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const g of list) {
      res.push({ id: g.id, title: g.title, depth });
      if (g.children && g.children.length > 0) {
        res.push(...flattenGoals(g.children, depth + 1));
      }
    }
    return res;
  };

  // Flatten nested tasks for selector
  const flattenTasks = (list: TaskItem[], depth = 0): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const t of list) {
      res.push({ id: t.id, title: t.title, depth });
      if (t.subtasks && t.subtasks.length > 0) {
        res.push(...flattenTasks(t.subtasks, depth + 1));
      }
    }
    return res;
  };

  // Flatten action plans for selector
  const flattenActionPlans = (
    list: ActionPlanNode[],
    depth = 0
  ): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const ap of list) {
      res.push({ id: ap.id, title: ap.title, depth });
      if (ap.children && ap.children.length > 0) {
        res.push(...flattenActionPlans(ap.children, depth + 1));
      }
    }
    return res;
  };

  const allFlatGoals = flattenGoals(goals);
  const allFlatTasks = flattenTasks(tasks);
  const allFlatPlans = flattenActionPlans(actionPlans);

  // Current linked name
  const linkedGoal = allFlatGoals.find((g) => g.id === goalId);
  const linkedTask = allFlatTasks.find((t) => t.id === taskId);
  const linkedPlan = allFlatPlans.find((p) => p.id === actionPlanId);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center justify-between text-[11px] font-tech text-cyan-400/80">
        <button
          type="button"
          onClick={() => setIsLinkDropdownOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-cyan-500/30 hover:border-cyan-400 transition cursor-pointer text-[10px]"
        >
          {linkedGoal ? (
            <>
              <Target className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-200 font-semibold truncate max-w-[200px]">
                GOAL: {linkedGoal.title}
              </span>
            </>
          ) : linkedTask ? (
            <>
              <CheckSquare className="w-3 h-3 text-amber-400" />
              <span className="text-amber-200 font-semibold truncate max-w-[200px]">
                TASK: {linkedTask.title}
              </span>
            </>
          ) : linkedPlan ? (
            <>
              <Workflow className="w-3 h-3 text-purple-400" />
              <span className="text-purple-200 font-semibold truncate max-w-[200px]">
                PLAN: {linkedPlan.title}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-cyan-500/70" />
              <span className="text-cyan-400/70">STANDALONE SCRATCHPAD</span>
            </>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {/* Unlink button if linked */}
        {(goalId || taskId || actionPlanId) && (
          <button
            type="button"
            onClick={() =>
              onChangeLink({ goalId: null, taskId: null, actionPlanId: null })
            }
            title="Detach from Context (Make Standalone)"
            className="text-[9px] text-cyan-500/60 hover:text-cyan-300 underline cursor-pointer"
          >
            Detach
          </button>
        )}
      </div>

      {/* Context Dropdown Popover */}
      {isLinkDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-56 overflow-y-auto rounded bg-[#03070d] border border-cyan-500/40 shadow-[0_4px_16px_rgba(0,0,0,0.8)] z-50 p-1.5 text-xs font-tech space-y-1">
          <div className="text-[10px] text-cyan-500/60 uppercase font-bold px-1.5 py-0.5 border-b border-cyan-500/20">
            Link Note To Context
          </div>

          {/* Standalone Option */}
          <div
            onClick={() => {
              onChangeLink({ goalId: null, taskId: null, actionPlanId: null });
              setIsLinkDropdownOpen(false);
            }}
            className={`p-1.5 rounded flex items-center gap-1.5 cursor-pointer transition ${
              !goalId && !taskId && !actionPlanId
                ? "bg-cyan-500/20 text-cyan-100 font-bold"
                : "hover:bg-cyan-950/50 text-cyan-300"
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Standalone Scratchpad (No Link)</span>
          </div>

          {/* Goals */}
          {allFlatGoals.length > 0 && (
            <div>
              <div className="text-[9px] text-cyan-500/50 uppercase px-1.5 pt-1">
                Goals
              </div>
              {allFlatGoals.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    onChangeLink({ goalId: g.id, taskId: null, actionPlanId: null });
                    setIsLinkDropdownOpen(false);
                  }}
                  style={{ paddingLeft: `${g.depth * 8 + 6}px` }}
                  className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                    goalId === g.id
                      ? "bg-cyan-500/20 text-cyan-100 font-bold"
                      : "hover:bg-cyan-950/50 text-cyan-300"
                  }`}
                >
                  <Target className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">{g.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tasks */}
          {allFlatTasks.length > 0 && (
            <div>
              <div className="text-[9px] text-amber-500/50 uppercase px-1.5 pt-1">
                Tasks
              </div>
              {allFlatTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onChangeLink({ goalId: null, taskId: t.id, actionPlanId: null });
                    setIsLinkDropdownOpen(false);
                  }}
                  style={{ paddingLeft: `${t.depth * 8 + 6}px` }}
                  className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                    taskId === t.id
                      ? "bg-amber-500/20 text-amber-100 font-bold"
                      : "hover:bg-amber-950/50 text-amber-300"
                  }`}
                >
                  <CheckSquare className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Plans */}
          {allFlatPlans.length > 0 && (
            <div>
              <div className="text-[9px] text-purple-500/50 uppercase px-1.5 pt-1">
                Action Plans
              </div>
              {allFlatPlans.map((ap) => (
                <div
                  key={ap.id}
                  onClick={() => {
                    onChangeLink({ goalId: null, taskId: null, actionPlanId: ap.id });
                    setIsLinkDropdownOpen(false);
                  }}
                  style={{ paddingLeft: `${ap.depth * 8 + 6}px` }}
                  className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                    actionPlanId === ap.id
                      ? "bg-purple-500/20 text-purple-100 font-bold"
                      : "hover:bg-purple-950/50 text-purple-300"
                  }`}
                >
                  <Workflow className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="truncate">{ap.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

