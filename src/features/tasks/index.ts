import { CheckSquare } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { TasksView } from "./TasksView";

export { TasksView };

export const tasksViewDefinition: ViewDefinition = {
  id: "tasks",
  title: "TASKS",
  icon: CheckSquare,
  component: TasksView,
  defaultDock: "left",
  minWidth: 280,
};
