/**
 * @deprecated src/types/hud.ts is decomposed into scoped domain type modules (Issue #82).
 * Retained as a backward-compatible re-export barrel for gradual UI migration (Issue #79).
 * Prefer importing directly from:
 * - src/types/navigation
 * - src/types/dock
 * - src/types/theme
 * - src/types/entities
 * - src/types/diagnostics
 * - src/types/settings
 */

export * from "./navigation";
export * from "./dock";
export * from "./theme";
export * from "./entities";
export * from "./diagnostics";
export * from "./settings";
