/**
 * @deprecated src/types/hud.ts is a legacy backward-compatible re-export barrel (Issue #82, #113).
 *
 * CONTRIBUTOR GUIDANCE:
 * - DO NOT add new types or interfaces to this file.
 * - Add new types directly to their corresponding domain module under `src/types/`:
 *   - `navigation.ts`  -> Navigation view IDs, rail sides, and ViewDefinition registry contracts
 *   - `dock.ts`        -> Dock layout, window modes (split, joined, fullscreen), and snap points
 *   - `theme.ts`       -> Cyberpunk HUD theme keys, palettes, and typography configurations
 *   - `entities.ts`    -> Domain entities (Notes, Goals, Tasks, Action Plans, Calendar Events)
 *   - `diagnostics.ts` -> Hardware telemetry, system stats, CPU/RAM/GPU diagnostics
 *   - `settings.ts`    -> User preferences and modal tab interfaces
 * - When writing new components, import directly from scoped modules:
 *   e.g. `import type { NavViewId, ViewDefinition } from "../types/navigation";`
 */

export * from "./navigation";
export * from "./dock";
export * from "./theme";
export * from "./entities";
export * from "./diagnostics";
export * from "./settings";
