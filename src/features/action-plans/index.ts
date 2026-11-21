import { Workflow } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { ActionPlansView } from "./ActionPlansView";

export { ActionPlansView };

export const actionPlansViewDefinition: ViewDefinition = {
  id: "action_plans",
  title: "ACTION PLANS",
  icon: Workflow,
  component: ActionPlansView,
  defaultDock: "left",
  minWidth: 280,
};
