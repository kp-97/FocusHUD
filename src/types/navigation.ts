import type { LucideIcon } from "lucide-react";
import type React from "react";

export type NavViewId =
  | "home"
  | "chat"
  | "calendar"
  | "goals"
  | "tasks"
  | "notes"
  | "kanban"
  | "action_plans"
  | "timer";

export type NavRailSide = "left" | "right";

export interface NavItemConfig {
  id: NavViewId;
  label: string;
  visible: boolean;
  rail?: NavRailSide;
}

/**
 * Registry definition contract for pluggable view modules (Issue #80).
 */
export interface ViewDefinition {
  id: NavViewId;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType<any>;
  defaultDock: "left" | "right";
  minWidth?: number;
  compactRailWidget?: React.ComponentType<any>;
}

