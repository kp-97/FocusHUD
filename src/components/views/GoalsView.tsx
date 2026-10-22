import React, { useState, useEffect } from "react";
import { Target, Plus, Check, Trash2, ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import { GoalNode } from "../../types/hud";
import { loadGoals, saveGoals, getTodayString } from "../../stores/layoutStore";
import { Tree3DView } from "../features/tree3d/Tree3DView";
import { fetchGoals, onDbChange, isTauriEnvironment } from "../../services/dbService";
import { dbGoalsToTree } from "../../services/dbAdapters";

interface GoalsViewProps {
  show3D?: boolean;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ show3D = true }) => {
  const [goals, setGoals] = useState<GoalNode[]>(loadGoals);
  const [newRootTitle, setNewRootTitle] = useState("");
  const [addingSubToId, setAddingSubToId] = useState<string | null>(null);
  const [subGoalTitle, setSubGoalTitle] = useState("");
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    if (isTauriEnvironment()) {
      fetchGoals().then((dbGoals) => {
        if (active && dbGoals.length > 0) setGoals(dbGoalsToTree(dbGoals));
      });
    }

    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === "goals" || payload.entity === "all") {
        fetchGoals().then((dbGoals) => {
          if (active) setGoals(dbGoalsToTree(dbGoals));
        });
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten && unlisten());
    };
  }, []);

  const saveAndSetGoals = (newGoals: GoalNode[]) => {
    setGoals(newGoals);
    saveGoals(newGoals);
  };

  // Add Root Goal
  const handleAddRootGoal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRootTitle.trim()) return;

    const newGoal: GoalNode = {
      id: "goal_" + Date.now(),
      title: newRootTitle.trim().toUpperCase(),
      completed: false,
      children: [],
    };

    saveAndSetGoals([...goals, newGoal]);
    setNewRootTitle("");
  };

  // Add Sub-Goal (infinitely nested)
  const handleAddSubGoal = (parentId: string) => {
    if (!subGoalTitle.trim()) return;

    const newSub: GoalNode = {
      id: "sub_" + Date.now(),
      title: subGoalTitle.trim().toUpperCase(),
      completed: false,
      parentId,
      children: [],
    };

    const insertSub = (list: GoalNode[]): GoalNode[] => {
      return list.map((item) => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newSub],
          };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: insertSub(item.children) };
        }
        return item;
      });
    };

    saveAndSetGoals(insertSub(goals));
    setSubGoalTitle("");
    setAddingSubToId(null);
  };

  // Toggle Completed (with strikethrough)
  const toggleGoalCompleted = (id: string) => {
    const today = getTodayString();

    const updateComplete = (list: GoalNode[]): GoalNode[] => {
      return list.map((item) => {
        if (item.id === id) {
          const next = !item.completed;
          return {
            ...item,
            completed: next,
            completedAt: next ? today : undefined,
          };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: updateComplete(item.children) };
        }
        return item;
      });
    };

    saveAndSetGoals(updateComplete(goals));
  };

  // Delete Goal
  const deleteGoal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remove = (list: GoalNode[]): GoalNode[] => {
      return list
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children && item.children.length > 0) {
            return { ...item, children: remove(item.children) };
          }
          return item;
        });
    };

    saveAndSetGoals(remove(goals));
  };

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Count stats
  let totalCount = 0;
  let completedCount = 0;
  const countStats = (list: GoalNode[]) => {
    list.forEach((item) => {
      totalCount++;
      if (item.completed) completedCount++;
      if (item.children) countStats(item.children);
    });
  };
  countStats(goals);

  // Recursive Goal Tree Item Renderer
  const renderGoalNode = (node: GoalNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedMap[node.id];
    const isAddingSub = addingSubToId === node.id;

    return (
      <div key={node.id} className="flex flex-col group/item">
        <div
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          className={`flex items-center justify-between py-1 px-1 rounded hover:bg-cyan-950/40 transition group ${
            node.completed ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
            {/* Collapse / Expand caret if has children */}
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(node.id)}
                className="text-cyan-400/60 hover:text-cyan-200 p-0.5"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {/* Checkbox with Strikethrough Effect */}
            <button
              onClick={() => toggleGoalCompleted(node.id)}
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 cursor-pointer ${
                node.completed
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_6px_#10b981]"
                  : "border-cyan-500/40 hover:border-cyan-400 bg-black/40"
              }`}
            >
              {node.completed && <Check className="w-2.5 h-2.5" />}
            </button>

            {/* Goal Title with Strikethrough when ticked */}
            <span
              className={`text-xs font-tech tracking-wide truncate ${
                node.completed
                  ? "line-through text-cyan-400/40"
                  : depth === 0
                  ? "font-orbitron font-bold text-cyan-100"
                  : "text-cyan-200/90"
              }`}
            >
              {node.title}
            </span>
          </div>

          {/* Quick Actions (Add Sub-goal, Delete) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => setAddingSubToId(isAddingSub ? null : node.id)}
              title="Add nested sub-goal"
              className="p-0.5 rounded text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/20"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => deleteGoal(node.id, e)}
              title="Delete goal"
              className="p-0.5 rounded text-cyan-500/40 hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Inline Sub-goal input */}
        {isAddingSub && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            className="flex items-center gap-1 my-1 pr-1 animate-in fade-in duration-100"
          >
            <input
              type="text"
              autoFocus
              value={subGoalTitle}
              onChange={(e) => setSubGoalTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubGoal(node.id)}
              placeholder="Nested sub-goal title..."
              className="flex-1 bg-black/70 border border-cyan-400/50 rounded px-2 py-0.5 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none"
            />
            <button
              onClick={() => handleAddSubGoal(node.id)}
              className="px-2 py-0.5 rounded bg-cyan-600/40 border border-cyan-400 text-[10px] text-cyan-200 font-tech font-bold"
            >
              ADD
            </button>
          </div>
        )}

        {/* Render nested children */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col border-l border-cyan-500/10 ml-4">
            {node.children!.map((child) => renderGoalNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col p-2 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF: GOALS HIERARCHICAL LIST ================= */}
      <div
        className={`${
          show3D ? "flex-1 min-h-[190px]" : "h-full"
        } flex flex-col rounded bg-[#050b14] border border-cyan-500/30 p-2 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]`}
      >
        {/* Header with Stats */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-orbitron font-bold text-cyan-200 tracking-wider">
              GOALS HIERARCHY
            </span>
          </div>

          <span className="text-[10px] font-tech text-cyan-400/80 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
            {completedCount}/{totalCount} COMPLETED
          </span>
        </div>

        {/* Add Root Goal Input */}
        <form onSubmit={handleAddRootGoal} className="flex items-center gap-1 my-1">
          <input
            type="text"
            value={newRootTitle}
            onChange={(e) => setNewRootTitle(e.target.value)}
            placeholder="+ Add top-level objective..."
            className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!newRootTitle.trim()}
            className="p-1 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Scrollable Goals Tree List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 mt-1">
          {goals.map((g) => renderGoalNode(g, 0))}
        </div>
      </div>

      {/* ================= BOTTOM HALF: 3D VIEW OF GOAL TREE (Only when show3D is true) ================= */}
      {show3D && (
        <div className="flex-1 min-h-[190px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]">
          <div className="flex items-center justify-between px-2 pt-1.5 pb-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider text-cyan-400/90">
            <span className="flex items-center gap-1 font-bold text-cyan-200">
              <Sparkles className="w-3 h-3 text-cyan-400" /> 3D NEURAL GOAL TREE
            </span>
            <span className="text-[9px] text-cyan-500/60">ROTATE TO VIEW</span>
          </div>

          <div className="flex-1 w-full min-h-0 relative">
            <Tree3DView data={goals} accentColor="#00e5ff" />
          </div>
        </div>
      )}
    </div>
  );
};
