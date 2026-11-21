import { Columns3 } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { KanbanView } from "./KanbanView";

export { KanbanView };

export const kanbanViewDefinition: ViewDefinition = {
  id: "kanban",
  title: "KANBAN",
  icon: Columns3,
  component: KanbanView,
  defaultDock: "left",
  minWidth: 280,
};
