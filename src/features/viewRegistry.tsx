import React from "react";
import type { NavViewId, ViewDefinition } from "../types/navigation";

// Import view definitions from feature packages
import { homeViewDefinition } from "./home";
import { chatViewDefinition } from "./chat";
import { calendarViewDefinition } from "./calendar";
import { goalsViewDefinition } from "./goals";
import { tasksViewDefinition } from "./tasks";
import { notesViewDefinition } from "./notes";
import { kanbanViewDefinition } from "./kanban";
import { actionPlansViewDefinition } from "./action-plans";
import { pomodoroViewDefinition } from "./pomodoro";

/**
 * Built-in view definitions for FocusHUD
 */
export const DEFAULT_VIEW_DEFINITIONS: ViewDefinition[] = [
  homeViewDefinition,
  chatViewDefinition,
  calendarViewDefinition,
  goalsViewDefinition,
  tasksViewDefinition,
  notesViewDefinition,
  actionPlansViewDefinition,
  pomodoroViewDefinition,
  kanbanViewDefinition,
];

// In-memory registry map
const viewRegistry = new Map<NavViewId, ViewDefinition>();

// Initialize with default definitions
DEFAULT_VIEW_DEFINITIONS.forEach((def) => {
  viewRegistry.set(def.id, def);
});

/**
 * Register or override a view definition in the registry
 */
export function registerView(definition: ViewDefinition): void {
  viewRegistry.set(definition.id, definition);
}

/**
 * Unregister a view definition by ID
 */
export function unregisterView(id: NavViewId | string): boolean {
  return viewRegistry.delete(id as NavViewId);
}

/**
 * Reset registry back to default view definitions
 */
export function resetViewRegistry(): void {
  viewRegistry.clear();
  DEFAULT_VIEW_DEFINITIONS.forEach((def) => {
    viewRegistry.set(def.id, def);
  });
}

/**
 * Get a view definition by NavViewId
 */
export function getViewDefinition(id: NavViewId | string): ViewDefinition | undefined {
  return viewRegistry.get(id as NavViewId);
}

/**
 * Get all registered view definitions
 */
export function getAllViews(): ViewDefinition[] {
  return Array.from(viewRegistry.values());
}

/**
 * Resolve the component for a given view ID, with fallback
 */
export function resolveViewComponent(
  id: NavViewId | string,
  fallbackId: NavViewId = "home"
): React.ComponentType<any> {
  const def = viewRegistry.get(id as NavViewId) ?? viewRegistry.get(fallbackId);
  return def?.component ?? homeViewDefinition.component;
}

/**
 * Helper to get an icon for any registered view
 */
export function getViewIcon(id: NavViewId | string): React.ComponentType<{ className?: string }> {
  const def = viewRegistry.get(id as NavViewId);
  return def?.icon ?? homeViewDefinition.icon;
}

/**
 * Pluggable Slot component that renders the active view dynamically from the registry
 */
export interface ViewSlotProps {
  viewId: NavViewId | string;
  fallbackId?: NavViewId;
  [key: string]: any;
}

export const ViewSlot: React.FC<ViewSlotProps> = ({
  viewId,
  fallbackId = "home",
  ...props
}) => {
  const Component = resolveViewComponent(viewId, fallbackId);
  return <Component {...props} />;
};

/**
 * Dynamic icon map for navigation rails, derived from registered view definitions
 */
export const NAV_ICON_MAP: Record<NavViewId, React.ComponentType<{ className?: string }>> = {
  home: homeViewDefinition.icon,
  chat: chatViewDefinition.icon,
  calendar: calendarViewDefinition.icon,
  goals: goalsViewDefinition.icon,
  tasks: tasksViewDefinition.icon,
  notes: notesViewDefinition.icon,
  action_plans: actionPlansViewDefinition.icon,
  timer: pomodoroViewDefinition.icon,
  kanban: kanbanViewDefinition.icon,
};

/**
 * View items available for right sidebar dropdown and dual-view selection
 */
export interface AvailableRightViewItem {
  id: NavViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const AVAILABLE_RIGHT_VIEWS: AvailableRightViewItem[] = [
  { id: "home", label: homeViewDefinition.title, icon: homeViewDefinition.icon },
  { id: "chat", label: chatViewDefinition.title, icon: chatViewDefinition.icon },
  { id: "calendar", label: calendarViewDefinition.title, icon: calendarViewDefinition.icon },
  { id: "goals", label: goalsViewDefinition.title, icon: goalsViewDefinition.icon },
  { id: "tasks", label: tasksViewDefinition.title, icon: tasksViewDefinition.icon },
  { id: "notes", label: notesViewDefinition.title, icon: notesViewDefinition.icon },
  { id: "action_plans", label: actionPlansViewDefinition.title, icon: actionPlansViewDefinition.icon },
  { id: "timer", label: pomodoroViewDefinition.title, icon: pomodoroViewDefinition.icon },
  { id: "kanban", label: kanbanViewDefinition.title, icon: kanbanViewDefinition.icon },
];
