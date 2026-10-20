import { NavItemConfig } from "./hud";

export type SettingsTabId =
  | "views"
  | "limits"
  | "appearance"
  | "shortcuts"
  | "system";

export interface PaneLimitsConfig {
  maxLeft: number;
  maxRight: number;
}

export interface SettingsState {
  navConfig: NavItemConfig[];
  limits: PaneLimitsConfig;
}
