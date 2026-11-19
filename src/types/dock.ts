export type JoinedWindowState = "windowed" | "maximised" | "fullscreen" | "minimised";
export type WindowModeState = JoinedWindowState | "split";

export type DockSide = "left" | "right";

export interface DockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DockPresetWidth = 68 | 220 | 280 | 360;

export interface SnapPoint {
  value: number;
  label: string;
}

