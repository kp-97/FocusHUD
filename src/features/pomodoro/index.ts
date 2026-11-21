import { Timer } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { PomodoroDial } from "./PomodoroDial";

export { PomodoroDial };
export * from "./pomodoroThemes";

export const pomodoroViewDefinition: ViewDefinition = {
  id: "timer",
  title: "TIMER",
  icon: Timer,
  component: PomodoroDial,
  defaultDock: "right",
  minWidth: 220,
};
