import React, { useState, useMemo, useEffect } from "react";
import { CheckSquare, Search, Plus, Check, Trash2, Tag, Sparkles } from "lucide-react";
import { TaskItem, GoalNode } from "../../types/hud";
import { loadTasks, saveTasks, loadGoals, getTodayString } from "../../stores/layoutStore";
import { Tree3DView, TreeNode3D } from "../features/tree3d/Tree3DView";
import { fetchTasks, fetchGoals, onDbChange, isTauriEnvironment } from "../../services/dbService";
import { dbTasksToTree, dbGoalsToTree } from "../../services/dbAdapters";

interface TasksViewProps {
  show3D?: boolean;
}

export const TasksView: React.FC<TasksViewProps> = ({ show3D = true }) => {
  const [tasks, setTasks] = useState<TaskItem[]>(loadTasks);
  const [goals, setGoals] = useState<GoalNode[]>(loadGoals);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "ungrouped" | "grouped">("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id || null);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState<string>("none");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [addingSubToId, setAddingSubToId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isTauriEnvironment()) {
      fetchTasks().then((dbTasks) => {
        if (active && dbTasks.length > 0) setTasks(dbTasksToTree(dbTasks));
      });
      fetchGoals().then((dbGoals) => {
        if (active && dbGoals.length > 0) setGoals(dbGoalsToTree(dbGoals));
      });
    }

    const unlistenPromise = onDbChange((payload) => {
      if (payload.entity === "tasks" || payload.entity === "all") {
        fetchTasks().then((dbTasks) => {
          if (active) setTasks(dbTasksToTree(dbTasks));
        });
      }
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

  const saveAndSetTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  // Add Task
  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: "task_" + Date.now(),
      title: newTaskTitle.trim().toUpperCase(),
      completed: false,
      goalId: selectedGoalId === "none" ? null : selectedGoalId,
      status: "todo",
      subtasks: [],
    };

    saveAndSetTasks([...tasks, newTask]);
    setNewTaskTitle("");
    if (!selectedTaskId) setSelectedTaskId(newTask.id);
  };

  // Add Subtask (infinitely nested breakdown)
  const handleAddSubtask = (parentTaskId: string) => {
    if (!subtaskTitle.trim()) return;

    const newSub: TaskItem = {
      id: "subt_" + Date.now(),
      title: subtaskTitle.trim().toUpperCase(),
      completed: false,
      parentId: parentTaskId,
      status: "todo",
      subtasks: [],
    };

    const insertSub = (list: TaskItem[]): TaskItem[] => {
      return list.map((item) => {
        if (item.id === parentTaskId) {
          return {
            ...item,
            subtasks: [...(item.subtasks || []), newSub],
          };
        }
        if (item.subtasks && item.subtasks.length > 0) {
          return { ...item, subtasks: insertSub(item.subtasks) };
        }
        return item;
      });
    };

    saveAndSetTasks(insertSub(tasks));
    setSubtaskTitle("");
    setAddingSubToId(null);
  };

  // Toggle Task Completion
  const toggleTaskCompleted = (id: string) => {
    const today = getTodayString();

    const updateComplete = (list: TaskItem[]): TaskItem[] => {
      return list.map((item) => {
        if (item.id === id) {
          const next = !item.completed;
          return {
            ...item,
            completed: next,
            completedAt: next ? today : undefined,
            status: next ? "done" : "todo",
          };
        }
        if (item.subtasks && item.subtasks.length > 0) {
          return { ...item, subtasks: updateComplete(item.subtasks) };
        }
        return item;
      });
    };

    saveAndSetTasks(updateComplete(tasks));
  };

  // Delete Task
  const deleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remove = (list: TaskItem[]): TaskItem[] => {
      return list
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.subtasks && item.subtasks.length > 0) {
            return { ...item, subtasks: remove(item.subtasks) };
          }
          return item;
        });
    };

    saveAndSetTasks(remove(tasks));
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  // Filter tasks by search query and category
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    // Category filter
    if (filterMode === "ungrouped") {
      result = result.filter((t) => !t.goalId);
    } else if (filterMode === "grouped") {
      result = result.filter((t) => !!t.goalId);
    }

    return result;
  }, [tasks, searchQuery, filterMode]);

  // Group tasks by goals for display
  const goalMap = useMemo(() => {
    const map = new Map<string, string>();
    const flatten = (list: GoalNode[]) => {
      list.forEach((g) => {
        map.set(g.id, g.title);
        if (g.children) flatten(g.children);
      });
    };
    flatten(goals);
    return map;
  }, [goals]);

  // Find currently selected task for breakdown tree
  const selectedTask = useMemo(() => {
    const findInList = (list: TaskItem[]): TaskItem | null => {
      for (const t of list) {
        if (t.id === selectedTaskId) return t;
        if (t.subtasks && t.subtasks.length > 0) {
          const found = findInList(t.subtasks);
          if (found) return found;
        }
      }
      return null;
    };
    return findInList(tasks);
  }, [tasks, selectedTaskId]);

  // Convert selected task and its subtasks into TreeNode3D format for the bottom tree
  const treeData: TreeNode3D[] = useMemo(() => {
    if (!selectedTask) {
      // If no task selected, show all root tasks
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        children: t.subtasks?.map((st) => ({
          id: st.id,
          title: st.title,
          completed: st.completed,
          children: st.subtasks,
        })),
      }));
    }

    return [
      {
        id: selectedTask.id,
        title: selectedTask.title,
        completed: selectedTask.completed,
        children: selectedTask.subtasks?.map((st) => ({
          id: st.id,
          title: st.title,
          completed: st.completed,
          children: st.subtasks,
        })),
      },
    ];
  }, [selectedTask, tasks]);

  // Render Subtask items in breakdown list
  const renderSubtaskItem = (sub: TaskItem, depth: number = 0) => {
    const hasChildren = sub.subtasks && sub.subtasks.length > 0;
    const isAdding = addingSubToId === sub.id;

    return (
      <div key={sub.id} className="flex flex-col group/sub">
        <div
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center justify-between py-1 px-1 rounded hover:bg-cyan-950/40 transition group ${
            sub.completed ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
            <button
              onClick={() => toggleTaskCompleted(sub.id)}
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 cursor-pointer ${
                sub.completed
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_6px_#10b981]"
                  : "border-cyan-500/40 hover:border-cyan-400 bg-black/40"
              }`}
            >
              {sub.completed && <Check className="w-2.5 h-2.5" />}
            </button>

            <span
              className={`text-xs font-tech tracking-wide truncate ${
                sub.completed ? "line-through text-cyan-400/40" : "text-cyan-200"
              }`}
            >
              {sub.title}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => setAddingSubToId(isAdding ? null : sub.id)}
              title="Add sub-subtask"
              className="p-0.5 rounded text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/20"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => deleteTask(sub.id, e)}
              title="Delete subtask"
              className="p-0.5 rounded text-cyan-500/40 hover:text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {isAdding && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 14}px` }}
            className="flex items-center gap-1 my-1 pr-1"
          >
            <input
              type="text"
              autoFocus
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubtask(sub.id)}
              placeholder="Nested subtask title..."
              className="flex-1 bg-black/70 border border-cyan-400/50 rounded px-2 py-0.5 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none"
            />
            <button
              onClick={() => handleAddSubtask(sub.id)}
              className="px-2 py-0.5 rounded bg-cyan-600/40 border border-cyan-400 text-[10px] text-cyan-200 font-tech font-bold"
            >
              ADD
            </button>
          </div>
        )}

        {hasChildren && (
          <div className="flex flex-col border-l border-cyan-500/10 ml-4">
            {sub.subtasks!.map((child) => renderSubtaskItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col p-2 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF: TASK LIST (SEARCHABLE & GOAL-GROUPED) ================= */}
      <div
        className={`${
          show3D ? "flex-1 min-h-[190px]" : "h-full"
        } flex flex-col rounded bg-[#050b14] border border-cyan-500/30 p-2 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]`}
      >
        {/* Header & Filter Tabs */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-orbitron font-bold text-cyan-200 tracking-wider">
              TASK INVENTORY
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-tech uppercase">
            {(["all", "grouped", "ungrouped"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                  filterMode === mode
                    ? "bg-cyan-500/30 border-cyan-400 text-cyan-100"
                    : "border-cyan-500/20 text-cyan-400/60 hover:text-cyan-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative flex items-center mb-1.5">
          <Search className="w-3.5 h-3.5 text-cyan-500/50 absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-black/60 border border-cyan-500/30 rounded pl-7 pr-2 py-1 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Add Task Form with Goal Selector */}
        <form onSubmit={handleAddTask} className="flex items-center gap-1 mb-1">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="+ New task title..."
            className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
          />

          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="bg-black/80 border border-cyan-500/30 rounded px-1 py-1 text-[10px] text-cyan-300 font-tech focus:outline-none max-w-[90px] truncate"
          >
            <option value="none">UNGROUPED</option>
            {Array.from(goalMap.entries()).map(([gId, title]) => (
              <option key={gId} value={gId}>
                {title.slice(0, 15)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="p-1 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Scrollable Tasks List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-4 text-cyan-500/40 text-xs font-tech">
              NO MATCHING TASKS FOUND
            </div>
          ) : (
            filteredTasks.map((task) => {
              const goalTitle = task.goalId ? goalMap.get(task.goalId) : null;
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`flex items-center justify-between p-1.5 rounded border transition cursor-pointer group ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-400/80 shadow-[0_0_8px_rgba(0,229,255,0.2)]"
                      : "bg-[#070e18]/80 border-cyan-500/20 hover:border-cyan-500/40"
                  } ${task.completed ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                    {/* Checkbox with Strikethrough Effect */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskCompleted(task.id);
                      }}
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 cursor-pointer ${
                        task.completed
                          ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_6px_#10b981]"
                          : "border-cyan-500/40 hover:border-cyan-400 bg-black/40"
                      }`}
                    >
                      {task.completed && <Check className="w-2.5 h-2.5" />}
                    </button>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-xs font-tech tracking-wide truncate ${
                          task.completed
                            ? "line-through text-cyan-400/40"
                            : isSelected
                            ? "font-bold text-cyan-100"
                            : "text-cyan-200"
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Goal Badge if assigned */}
                      {goalTitle && (
                        <span className="text-[8.5px] font-tech text-amber-300/80 flex items-center gap-1 mt-0.5 truncate">
                          <Tag className="w-2.5 h-2.5" /> {goalTitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingSubToId(addingSubToId === task.id ? null : task.id);
                      }}
                      title="Add subtask"
                      className="p-1 rounded text-cyan-400/60 hover:text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => deleteTask(task.id, e)}
                      title="Delete task"
                      className="p-1 rounded text-cyan-500/40 hover:text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= BOTTOM HALF: SUBTASKS BREAKDOWN TREE (Only when show3D is true) ================= */}
      {show3D && (
        <div className="flex-1 min-h-[190px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]">
          <div className="flex items-center justify-between px-2 pt-1.5 pb-1 border-b border-cyan-500/20 text-[10px] font-tech uppercase tracking-wider text-cyan-400/90">
            <span className="flex items-center gap-1 font-bold text-cyan-200 truncate max-w-[65%]">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {selectedTask ? `SUBTASKS: ${selectedTask.title}` : "TASK HIERARCHY TREE"}
            </span>

            {selectedTask && (
              <button
                onClick={() => setAddingSubToId(selectedTask.id)}
                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-400/40 text-amber-200 hover:bg-amber-900/50"
              >
                <Plus className="w-2.5 h-2.5" /> SUBTASK
              </button>
            )}
          </div>

          {/* Split bottom view: Subtask List or 3D Tree */}
          <div className="flex-1 w-full min-h-0 relative flex flex-col">
            {selectedTask && addingSubToId === selectedTask.id && (
              <div className="flex items-center gap-1 m-1.5 p-1 rounded bg-black/60 border border-amber-400/40">
                <input
                  type="text"
                  autoFocus
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubtask(selectedTask.id)}
                  placeholder="New subtask title..."
                  className="flex-1 bg-transparent border-none text-xs text-amber-200 placeholder-amber-500/40 focus:outline-none"
                />
                <button
                  onClick={() => handleAddSubtask(selectedTask.id)}
                  className="px-2 py-0.5 rounded bg-amber-600/40 border border-amber-400 text-[10px] text-amber-200 font-tech font-bold"
                >
                  ADD
                </button>
              </div>
            )}

            {/* Render 3D tree of the breakdown */}
            <div className="flex-1 w-full min-h-0 relative">
              <Tree3DView data={treeData} accentColor="#ffb300" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
