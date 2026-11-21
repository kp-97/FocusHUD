import { Target } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { GoalsView } from "./GoalsView";

export { GoalsView };

export const goalsViewDefinition: ViewDefinition = {
  id: "goals",
  title: "GOALS",
  icon: Target,
  component: GoalsView,
  defaultDock: "left",
  minWidth: 280,
};
