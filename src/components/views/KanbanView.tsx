import React, { useState } from "react";
import { Columns3, Plus, ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { TaskItem } from "../../types/hud";
import { loadTasks, saveTasks, getTodayString } from "../../utils/store";

export const KanbanView: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>(loadTasks);
  const [newTitle, setNewTitle] = useState("");
  const [activeCol, setActiveCol] = useState<"todo" | "in_progress" | "done">("todo");

  const saveAndSetTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: TaskItem = {
      id: "kb_" + Date.now(),
      title: newTitle.trim().toUpperCase(),
      completed: activeCol === "done",
      status: activeCol,
    };

    saveAndSetTasks([...tasks, newTask]);
    setNewTitle("");
  };

  const moveTask = (id: string, newStatus: "todo" | "in_progress" | "done") => {
    const today = getTodayString();
    saveAndSetTasks(
      tasks.map((t) => {
        if (t.id === id) {
          const isDone = newStatus === "done";
          return {
            ...t,
            status: newStatus,
            completed: isDone,
            completedAt: isDone ? today : undefined,
          };
        }
        return t;
      })
    );
  };

  const deleteTask = (id: string) => {
    saveAndSetTasks(tasks.filter((t) => t.id !== id));
  };

  const columns: Array<{ id: "todo" | "in_progress" | "done"; label: string; color: string }> = [
    { id: "todo", label: "TO DO", color: "text-cyan-400 border-cyan-500/40" },
    { id: "in_progress", label: "IN PROGRESS", color: "text-amber-400 border-amber-500/40" },
    { id: "done", label: "DONE", color: "text-emerald-400 border-emerald-500/40" },
  ];

  return (
    <div className="h-full w-full flex flex-col p-2 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Columns3 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-orbitron font-bold text-cyan-200 tracking-wider">
            KANBAN WORKFLOW
          </span>
        </div>

        {/* Column Navigation Tabs */}
        <div className="flex items-center gap-1">
          {columns.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCol(c.id)}
              className={`px-2 py-0.5 rounded text-[9.5px] font-tech uppercase transition cursor-pointer border ${
                activeCol === c.id
                  ? "bg-cyan-950/70 border-cyan-400 text-cyan-100 shadow-[0_0_8px_rgba(0,229,255,0.25)] font-bold"
                  : "border-cyan-500/20 text-cyan-400/60 hover:text-cyan-200"
              }`}
            >
              {c.label} ({tasks.filter((t) => (t.status || "todo") === c.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Card */}
      <form onSubmit={handleAddTask} className="flex items-center gap-1 mb-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={`+ Add task to ${activeCol.toUpperCase()}...`}
          className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="p-1 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 disabled:opacity-40 transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Active Column Cards Stream */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {tasks
          .filter((t) => (t.status || "todo") === activeCol)
          .map((task) => (
            <div
              key={task.id}
              className={`p-2 rounded bg-[#060c16] border border-cyan-500/20 flex flex-col gap-1.5 hover:border-cyan-500/50 transition group ${
                task.completed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-xs font-tech tracking-wide ${
                    task.completed ? "line-through text-cyan-400/40" : "text-cyan-100"
                  }`}
                >
                  {task.title}
                </span>

                <button
                  onClick={() => deleteTask(task.id)}
                  title="Delete Card"
                  className="opacity-0 group-hover:opacity-100 text-cyan-500/40 hover:text-red-400 p-0.5 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Status Move Controls */}
              <div className="flex items-center justify-between text-[9px] font-tech text-cyan-500/60 pt-1 border-t border-cyan-500/10">
                <div>
                  {activeCol !== "todo" && (
                    <button
                      onClick={() =>
                        moveTask(task.id, activeCol === "done" ? "in_progress" : "todo")
                      }
                      className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-200 transition"
                    >
                      <ArrowLeft className="w-2.5 h-2.5" /> BACK
                    </button>
                  )}
                </div>

                <div>
                  {activeCol !== "done" && (
                    <button
                      onClick={() =>
                        moveTask(task.id, activeCol === "todo" ? "in_progress" : "done")
                      }
                      className="flex items-center gap-0.5 text-amber-300 hover:text-amber-100 transition font-bold"
                    >
                      ADVANCE <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

        {tasks.filter((t) => (t.status || "todo") === activeCol).length === 0 && (
          <div className="text-center py-8 text-cyan-500/40 text-xs font-tech">
            NO TASKS IN {activeCol.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};
