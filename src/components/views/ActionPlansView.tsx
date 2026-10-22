import React, { useState, useMemo, useEffect } from "react";
import { Workflow, Plus, Check, Trash2, ChevronRight, ChevronDown, Sparkles, Layers } from "lucide-react";
import { ActionPlanNode } from "../../types/hud";
import { loadActionPlans, saveActionPlans, getTodayString } from "../../stores/layoutStore";
import { Tree3DView, TreeNode3D } from "../features/tree3d/Tree3DView";
import { fetchActionPlans, onDbChange, isTauriEnvironment } from "../../services/dbService";
import { dbActionPlansToTree } from "../../services/dbAdapters";

interface ActionPlansViewProps {
  show3D?: boolean;
}

export const ActionPlansView: React.FC<ActionPlansViewProps> = ({ show3D = true }) => {
  const [plans, setPlans] = useState<ActionPlanNode[]>(loadActionPlans);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [addingStepToId, setAddingStepToId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    if (isTauriEnvironment()) {
      fetchActionPlans().then((dbPlans) => {
        if (active && dbPlans.length > 0) setPlans(dbActionPlansToTree(dbPlans));
      });
    }

    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === "action_plans" || payload.entity === "all") {
        fetchActionPlans().then((dbPlans) => {
          if (active) setPlans(dbActionPlansToTree(dbPlans));
        });
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten && unlisten());
    };
  }, []);

  const saveAndSetPlans = (newPlans: ActionPlanNode[]) => {
    setPlans(newPlans);
    saveActionPlans(newPlans);
  };

  // Add Action Plan
  const handleAddPlan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlanTitle.trim()) return;

    const newPlan: ActionPlanNode = {
      id: "ap_" + Date.now(),
      title: newPlanTitle.trim().toUpperCase(),
      completed: false,
      children: [],
    };

    saveAndSetPlans([...plans, newPlan]);
    setNewPlanTitle("");
  };

  // Add Nested Action Step
  const handleAddStep = (parentId: string) => {
    if (!stepTitle.trim()) return;

    const newStep: ActionPlanNode = {
      id: "step_" + Date.now(),
      title: stepTitle.trim().toUpperCase(),
      completed: false,
      parentId,
      children: [],
    };

    const insertStep = (list: ActionPlanNode[]): ActionPlanNode[] => {
      return list.map((item) => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newStep],
          };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: insertStep(item.children) };
        }
        return item;
      });
    };

    saveAndSetPlans(insertStep(plans));
    setStepTitle("");
    setAddingStepToId(null);
  };

  // Toggle Completion
  const toggleStepCompleted = (id: string) => {
    const today = getTodayString();

    const updateComplete = (list: ActionPlanNode[]): ActionPlanNode[] => {
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

    saveAndSetPlans(updateComplete(plans));
  };

  // Delete Action Plan or Step
  const deletePlan = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remove = (list: ActionPlanNode[]): ActionPlanNode[] => {
      return list
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children && item.children.length > 0) {
            return { ...item, children: remove(item.children) };
          }
          return item;
        });
    };

    saveAndSetPlans(remove(plans));
  };

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Check if any action plan has nested children
  const hasAnyNesting = useMemo(() => {
    const checkNesting = (list: ActionPlanNode[]): boolean => {
      for (const p of list) {
        if (p.children && p.children.length > 0) return true;
      }
      return false;
    };
    return checkNesting(plans);
  }, [plans]);

  // Convert plans to TreeNode3D format
  const treeData: TreeNode3D[] = useMemo(() => {
    const mapToTree = (list: ActionPlanNode[]): TreeNode3D[] => {
      return list.map((item) => ({
        id: item.id,
        title: item.title,
        completed: item.completed,
        children: item.children ? mapToTree(item.children) : undefined,
      }));
    };
    return mapToTree(plans);
  }, [plans]);

  // Recursive Item Renderer
  const renderPlanNode = (node: ActionPlanNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedMap[node.id];
    const isAddingStep = addingStepToId === node.id;

    return (
      <div key={node.id} className="flex flex-col group/item">
        <div
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          className={`flex items-center justify-between py-1 px-1 rounded hover:bg-cyan-950/40 transition group ${
            node.completed ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
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
              onClick={() => toggleStepCompleted(node.id)}
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 cursor-pointer ${
                node.completed
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_6px_#10b981]"
                  : "border-cyan-500/40 hover:border-cyan-400 bg-black/40"
              }`}
            >
              {node.completed && <Check className="w-2.5 h-2.5" />}
            </button>

            {/* Title with Strikethrough when ticked */}
            <span
              className={`text-xs font-tech tracking-wide truncate ${
                node.completed
                  ? "line-through text-cyan-400/40"
                  : depth === 0
                  ? "font-orbitron font-bold text-amber-200"
                  : "text-cyan-200"
              }`}
            >
              {node.title}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => setAddingStepToId(isAddingStep ? null : node.id)}
              title="Add nested step"
              className="p-0.5 rounded text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/20"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => deletePlan(node.id, e)}
              title="Delete step"
              className="p-0.5 rounded text-cyan-500/40 hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Inline Step Add input */}
        {isAddingStep && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            className="flex items-center gap-1 my-1 pr-1"
          >
            <input
              type="text"
              autoFocus
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep(node.id)}
              placeholder="Nested action step..."
              className="flex-1 bg-black/70 border border-amber-400/50 rounded px-2 py-0.5 text-xs text-amber-200 placeholder-amber-500/40 focus:outline-none"
            />
            <button
              onClick={() => handleAddStep(node.id)}
              className="px-2 py-0.5 rounded bg-amber-600/40 border border-amber-400 text-[10px] text-amber-200 font-tech font-bold"
            >
              ADD
            </button>
          </div>
        )}

        {hasChildren && !isCollapsed && (
          <div className="flex flex-col border-l border-cyan-500/10 ml-4">
            {node.children!.map((child) => renderPlanNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col p-2 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF: ACTION PLANS LIST ================= */}
      <div
        className={`${
          show3D ? "flex-1 min-h-[190px]" : "h-full"
        } flex flex-col rounded bg-[#050b14] border border-cyan-500/30 p-2 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-orbitron font-bold text-amber-200 tracking-wider">
              ACTION PLANS
            </span>
          </div>

          <span className="text-[10px] font-tech text-cyan-400/80 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
            {plans.length} PLANS
          </span>
        </div>

        {/* Add Plan Form */}
        <form onSubmit={handleAddPlan} className="flex items-center gap-1 my-1">
          <input
            type="text"
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            placeholder="+ Create action plan..."
            className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!newPlanTitle.trim()}
            className="p-1 rounded bg-amber-600/30 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Scrollable Action Plans List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 mt-1">
          {plans.map((p) => renderPlanNode(p, 0))}
        </div>
      </div>

      {/* ================= BOTTOM HALF: 3D VIEW (IF NESTED AND show3D IS TRUE) ================= */}
      {show3D && (
        <div className="flex-1 min-h-[190px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]">
          <div className="flex items-center justify-between px-2 pt-1.5 pb-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider text-cyan-400/90">
            <span className="flex items-center gap-1 font-bold text-amber-200">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {hasAnyNesting ? "3D ACTION PLAN TREE" : "ACTION PLAN EXECUTION"}
            </span>
            <span className="text-[9px] text-cyan-500/60">
              {hasAnyNesting ? "ROTATE TO VIEW" : "ADD NESTED STEPS"}
            </span>
          </div>

          <div className="flex-1 w-full min-h-0 relative">
            {hasAnyNesting ? (
              <Tree3DView data={treeData} accentColor="#ff9100" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Layers className="w-8 h-8 text-cyan-500/30 mb-2" />
                <p className="text-xs font-tech text-cyan-400/60 uppercase tracking-wider">
                  Add nested steps using the (+) button on any plan to activate the 3D execution tree.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
