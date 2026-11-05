import { useEffect, useState } from "react";
import { AppWindow, Check, SkipForward, X } from "lucide-react";
import {
  getSnapOverlayState,
  selectSnapAssistWindow,
  skipSnapAssistZone,
  dismissSnapAssist,
  type SnapOverlayState,
  type LogicalRect,
  type TopBarLayoutGroup,
} from "../../../services/tauriBridge";
import { isTauriEnvironment } from "../../../services/ipc";

function getZoneBorderRadius(zone: LogicalRect, group: LogicalRect): string {
  const isLeft = Math.abs(zone.x - group.x) <= 2;
  const isTop = Math.abs(zone.y - group.y) <= 2;
  const isRight = Math.abs(zone.x + zone.width - (group.x + group.width)) <= 2;
  const isBottom = Math.abs(zone.y + zone.height - (group.y + group.height)) <= 2;

  const tl = isLeft && isTop ? "6px" : "2px";
  const tr = isRight && isTop ? "6px" : "2px";
  const br = isRight && isBottom ? "6px" : "2px";
  const bl = isLeft && isBottom ? "6px" : "2px";
  return `${tl} ${tr} ${br} ${bl}`;
}

export function SnapOverlayApp() {
  const [state, setState] = useState<SnapOverlayState | null>(null);

  useEffect(() => {
    let mounted = true;
    getSnapOverlayState().then((initial) => {
      if (mounted && initial) {
        setState(initial);
      }
    });

    let unlistenFn: (() => void) | undefined;
    if (isTauriEnvironment()) {
      import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen<SnapOverlayState>("snap-overlay-state", (event) => {
            if (mounted && event.payload) {
              setState(event.payload);
            }
          })
        )
        .then((unlisten) => {
          unlistenFn = unlisten;
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    if (state?.mode !== "assist") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissSnapAssist();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state?.mode]);

  if (!state || state.mode === "hidden") {
    return <div data-testid="snap-overlay-app" className="w-screen h-screen pointer-events-none" />;
  }

  const handleSelectCandidate = async (hwnd: number) => {
    if (state.assist_zone_index === null) return;
    const next = await selectSnapAssistWindow(hwnd, state.assist_zone_index);
    if (next) setState(next);
  };

  const handleSkipZone = async () => {
    if (state.assist_zone_index === null) return;
    const next = await skipSnapAssistZone(state.assist_zone_index);
    if (next) setState(next);
  };

  const handleDismiss = async () => {
    await dismissSnapAssist();
    setState((prev) => (prev ? { ...prev, mode: "hidden" } : null));
  };

  const { top_bar, preview_rect } = state;

  return (
    <div
      data-testid="snap-overlay-app"
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{ background: "transparent" }}
    >
      {/* Target Zone Preview Outline during Drag */}
      {(state.mode === "pill" || state.mode === "expanded") && preview_rect && (
        <div
          data-testid="snap-zone-preview"
          className="absolute pointer-events-none transition-all duration-100"
          style={{
            left: `${Math.max(4, preview_rect.x + 6)}px`,
            top: `${Math.max(4, preview_rect.y + 6)}px`,
            width: `${Math.max(40, preview_rect.width - 12)}px`,
            height: `${Math.max(40, preview_rect.height - 12)}px`,
            background: "rgba(214, 157, 248, 0.14)",
            border: "2px solid rgba(214, 157, 248, 0.72)",
            borderRadius: "10px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
          }}
        />
      )}

      {/* Collapsed Top-Center Pill Indicator (matches Windows 11 drag start bar) */}
      {state.mode === "pill" && (
        <div
          data-testid="snap-top-pill"
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            left: `${top_bar.pill_rect.x}px`,
            top: `${top_bar.pill_rect.y}px`,
            width: `${top_bar.pill_rect.width}px`,
            height: `${top_bar.pill_rect.height}px`,
            background: "rgba(30, 30, 34, 0.95)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.18)",
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "0 0 10px 10px",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "4px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.42)",
            }}
          />
        </div>
      )}

      {/* Expanded Windows 11-Style Top Snap Layouts Bar */}
      {state.mode === "expanded" && (
        <div
          data-testid="snap-expanded-bar"
          className="absolute pointer-events-none"
          style={{
            left: `${top_bar.bar_rect.x}px`,
            top: `${top_bar.bar_rect.y}px`,
            width: `${top_bar.bar_rect.width}px`,
            height: `${top_bar.bar_rect.height}px`,
            background: "rgba(32, 32, 36, 0.96)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "12px",
            boxShadow: "0 16px 44px rgba(0, 0, 0, 0.65)",
          }}
        >
          {top_bar.groups.map((group: TopBarLayoutGroup) =>
            group.zones.map((zone: LogicalRect, zIdx: number) => {
              const isHovered =
                state.hovered_template === group.template &&
                state.hovered_zone_index === zIdx;
              return (
                <div
                  key={`${group.template}-${zIdx}`}
                  data-testid={`snap-zone-${group.template}-${zIdx}`}
                  style={{
                    position: "absolute",
                    left: `${zone.x - top_bar.bar_rect.x}px`,
                    top: `${zone.y - top_bar.bar_rect.y}px`,
                    width: `${zone.width}px`,
                    height: `${zone.height}px`,
                    backgroundColor: isHovered ? "#d69df8" : "#3b3b40",
                    border: isHovered
                      ? "1.5px solid #f0d6ff"
                      : "1.5px solid rgba(255, 255, 255, 0.34)",
                    borderRadius: getZoneBorderRadius(zone, group.rect),
                    transition: "background 75ms ease, border-color 75ms ease",
                  }}
                />
              );
            })
          )}
        </div>
      )}

      {/* Multi-Pane Snap Assist App Picker (Option A) */}
      {state.mode === "assist" && state.assist_zone_rect && (
        <div
          data-testid="snap-assist-backdrop"
          className="relative w-full h-full"
          onClick={handleDismiss}
        >
          {/* Subtle outlines for other remaining unfilled panes in 3- or 4-pane layouts */}
          {state.assist_all_zone_rects.map((zRect, idx) => {
            if (idx === state.assist_zone_index || state.assist_filled_zones[idx]) {
              return null;
            }
            return (
              <div
                key={`queued-zone-${idx}`}
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  left: `${zRect.x + 8}px`,
                  top: `${zRect.y + 8}px`,
                  width: `${Math.max(40, zRect.width - 16)}px`,
                  height: `${Math.max(40, zRect.height - 16)}px`,
                  background: "rgba(20, 20, 24, 0.45)",
                  border: "1.5px dashed rgba(255, 255, 255, 0.22)",
                  borderRadius: "12px",
                }}
              >
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-black/60 text-white/70 border border-white/10">
                  Up Next: Pane {idx + 1} of {state.assist_all_zone_rects.length}
                </span>
              </div>
            );
          })}

          {/* Active Empty Pane App Picker */}
          <div
            data-testid="snap-assist-picker"
            onClick={(e) => e.stopPropagation()}
            className="absolute flex flex-col overflow-hidden"
            style={{
              left: `${state.assist_zone_rect.x + 8}px`,
              top: `${state.assist_zone_rect.y + 8}px`,
              width: `${Math.max(220, state.assist_zone_rect.width - 16)}px`,
              height: `${Math.max(160, state.assist_zone_rect.height - 16)}px`,
              background: "rgba(24, 24, 28, 0.92)",
              backdropFilter: "blur(18px)",
              border: "1.5px solid rgba(214, 157, 248, 0.55)",
              borderRadius: "12px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.65)",
            }}
          >
            {/* Picker Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#d69df8]" />
                <span className="text-xs font-bold tracking-wider uppercase text-white">
                  Select App for Pane {(state.assist_zone_index ?? 0) + 1} of{" "}
                  {Math.max(2, state.assist_all_zone_rects.length)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {state.assist_all_zone_rects.length > 2 && (
                  <button
                    type="button"
                    data-testid="snap-assist-skip-btn"
                    onClick={handleSkipZone}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip Pane
                  </button>
                )}
                <button
                  type="button"
                  data-testid="snap-assist-dismiss-btn"
                  onClick={handleDismiss}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </div>

            {/* Candidate Windows Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {state.assist_candidates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-white/60">
                  <AppWindow className="w-8 h-8 text-white/40" />
                  <p className="text-sm font-medium">No other open desktop windows available to snap</p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="mt-1 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#d69df8]/20 text-[#e9c8fc] border border-[#d69df8]/40 hover:bg-[#d69df8]/30 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Keep Pane Empty
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {state.assist_candidates.map((win) => (
                    <button
                      key={win.hwnd}
                      type="button"
                      data-testid={`snap-candidate-${win.hwnd}`}
                      onClick={() => handleSelectCandidate(win.hwnd)}
                      className="group flex flex-col justify-between p-3.5 rounded-xl text-left bg-white/[0.06] hover:bg-[#d69df8]/20 border border-white/10 hover:border-[#d69df8]/70 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#d69df8]/20 text-[#e4b8fc] font-bold text-xs border border-[#d69df8]/30 shrink-0">
                          {win.app_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-white/75 group-hover:text-white truncate">
                          {win.app_name}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white line-clamp-2 break-words leading-snug">
                        {win.title}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
