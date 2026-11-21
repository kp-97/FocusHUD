import { Home } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { HomeView } from "./HomeView";

export { HomeView };

export const homeViewDefinition: ViewDefinition = {
  id: "home",
  title: "HOME",
  icon: Home,
  component: HomeView,
  defaultDock: "left",
  minWidth: 280,
};
