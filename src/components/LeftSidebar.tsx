import React, { useState, useEffect } from "react";
import {
  Home,
  MessageSquare,
  Calendar,
  Target,
  CheckSquare,
  Columns3,
  Workflow,
  Timer,
  Menu,
  Activity,
  Cpu,
  Layers,
  HardDrive,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { HudBrackets } from "./HudBrackets";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { exitApp, getSystemDiagnostics, SystemDiagnostics } from "../utils/tauriBridge";
import { broadcastNavChange } from "../utils/store";
import { NavViewId } from "../types/hud";

interface LeftSidebarProps {
  width: number;
  activeNav: string;
  onSelectNav: (id: string) => void;
  isCompact?: boolean;
  isDockMode?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  width,
  activeNav,
  onSelectNav,
  isCompact = false,
}) => {
  const [diag, setDiag] = useState<SystemDiagnostics | null>(null);
  const [diagnosticsCollapsed, setDiagnosticsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("hud_diag_collapsed") === "true";
  });

  const toggleDiagnosticsCollapsed = () => {
    setDiagnosticsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hud_diag_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const fetchDiag = async () => {
      const data = await getSystemDiagnostics();
      if (mounted && data) {
        setDiag(data);
      }
    };

    fetchDiag();
    const interval = setInterval(fetchDiag, 1200);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: "home", label: "HOME", icon: Home },
    { id: "chat", label: "CHAT", icon: MessageSquare },
    { id: "calendar", label: "CALENDAR", icon: Calendar },
    { id: "goals", label: "GOALS", icon: Target },
    { id: "tasks", label: "TASKS", icon: CheckSquare },
    { id: "kanban", label: "KANBAN", icon: Columns3 },
    { id: "action_plans", label: "ACTION PLANS", icon: Workflow },
    { id: "timer", label: "TIMER", icon: Timer },
  ];

  const isIconOnly = width < 120;
  const compactMode = isCompact || width < 220;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`h-full shrink-0 flex flex-col ${
        isIconOnly ? "p-1.5" : "p-2.5"
      } bg-[#03070d] border-r border-cyan-500/30 text-cyan-300 select-none overflow-hidden relative z-10`}
    >
      <HudBrackets
        className={`h-full flex flex-col justify-between ${
          isIconOnly ? "p-1.5 items-center" : "p-3"
        } overflow-hidden`}
      >
        {/* Top Header: FocusHUD & Waveform Banner (Pinned) */}
        <div className="shrink-0 flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
            {!isIconOnly ? (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 shadow-[0_0_8px_#00e5ff]" />
                <h1 className="font-orbitron font-bold text-sm tracking-wider text-cyan-200 hud-glow-cyan">
                  FocusHUD
                </h1>
              </div>
            ) : (
              <div className="w-full flex justify-center py-0.5">
                <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 shadow-[0_0_8px_#00e5ff]" />
              </div>
            )}

            {!isIconOnly && (
              <div className="flex items-center gap-1">
                <button
                  title="System Controls"
                  className="text-cyan-400/80 hover:text-cyan-200 hover:scale-110 transition p-1"
                >
                  <Menu className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => exitApp()}
                  title="Close FocusHUD (Restores Desktop)"
                  className="text-cyan-500/50 hover:text-red-400 hover:scale-110 transition p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Diagnostic Waveform Banner */}
          {!isIconOnly && (
            <div className="my-0.5">
              <WaveformVisualizer isCompact={compactMode} />
            </div>
          )}
        </div>

        {/* Scrollable Navigation Views: Starts at HOME and ends above DIAGNOSTICS */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden my-2 pr-0.5">
          <nav className={`flex flex-col ${isIconOnly ? "gap-2 items-center w-full" : "gap-2"}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <div key={item.id} className={`flex flex-col ${isIconOnly ? "w-full items-center" : ""}`}>
                  <button
                    onClick={() => {
                      onSelectNav(item.id);
                      broadcastNavChange(item.id as NavViewId);
                    }}
                    className={`hud-btn flex items-center rounded text-xs font-hud tracking-widest uppercase cursor-pointer transition-all ${
                      isActive ? "hud-btn-active text-cyan-100" : "text-cyan-300/80"
                    } ${
                      isIconOnly
                        ? "w-full aspect-square justify-center p-0 max-w-[44px]"
                        : "justify-start px-3 py-2.5"
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-cyan-200" : "text-cyan-400/80"}`} />
                      {!isIconOnly && <span className="font-semibold">{item.label}</span>}
                    </div>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Diagnostics / Telemetry Info (Pinned) */}
        {!isIconOnly && (
          <div className="shrink-0 w-full border-t border-cyan-500/30 pt-2 text-[11px] font-tech text-cyan-400/80">
            {/* Header with collapse toggle */}
            <div
              onClick={toggleDiagnosticsCollapsed}
              className={`flex items-center justify-between text-[10.5px] text-cyan-300 font-hud tracking-wider uppercase cursor-pointer select-none group ${
                diagnosticsCollapsed ? "pb-0.5" : "border-b border-cyan-500/30 pb-1.5 mb-2.5"
              }`}
              title={diagnosticsCollapsed ? "Expand Diagnostics" : "Collapse Diagnostics"}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="w-1.5 h-1.5 bg-cyan-400 rotate-45 shadow-[0_0_5px_#00e5ff]" />
                <span className="font-bold tracking-widest text-cyan-200 group-hover:text-cyan-100 transition-colors">
                  DIAGNOSTICS
                </span>
                {diagnosticsCollapsed && diag && (
                  <span className="text-[9px] font-tech text-cyan-400/70 normal-case ml-1 truncate">
                    CPU {Math.round(diag.cpu_usage)}% · RAM {Math.round(diag.ram_usage)}%
                  </span>
                )}
              </div>

              <button className="text-cyan-400/70 group-hover:text-cyan-200 transition p-0.5 cursor-pointer">
                {diagnosticsCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Collapsible Telemetry Content */}
            {!diagnosticsCollapsed && (
              <div className="space-y-2 animate-in fade-in duration-150">
                {/* CPU Usage + Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-cyan-300/90 text-[10.5px]">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-cyan-400" /> CPU USAGE
                    </span>
                    <span className="font-bold text-cyan-200 font-tech">
                      {diag ? `${diag.cpu_usage.toFixed(1)}%` : "--%"}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-cyan-950/80 rounded-full border border-cyan-500/20 overflow-hidden p-[0.5px]">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-cyan-400 rounded-full shadow-[0_0_6px_#00e5ff] transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, diag ? diag.cpu_usage : 0))}%` }}
                    />
                  </div>
                </div>

                {/* Only render GPU & VRAM if a GPU is available on the machine */}
                {diag?.gpu_name && (
                  <>
                    {/* GPU Usage + Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-cyan-300/80 text-[10.5px]">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-cyan-400" /> GPU USAGE
                        </span>
                        <span className="font-bold text-cyan-200 font-tech">
                          {diag.gpu_usage !== null && diag.gpu_usage !== undefined
                            ? `${diag.gpu_usage.toFixed(0)}%`
                            : "0%"}
                          {diag.gpu_temp ? ` (${diag.gpu_temp}°C)` : ""}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-cyan-950/80 rounded-full border border-cyan-500/20 overflow-hidden p-[0.5px]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-cyan-400 rounded-full shadow-[0_0_6px_#00e5ff] transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, diag.gpu_usage ?? 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* VRAM Usage + Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-cyan-400/80 text-[10.5px]">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-cyan-400" /> VRAM USAGE
                        </span>
                        <span className="font-bold text-cyan-200 font-tech">
                          {diag.vram_used_bytes && diag.vram_total_bytes
                            ? `${(diag.vram_used_bytes / 1073741824).toFixed(1)} / ${(diag.vram_total_bytes / 1073741824).toFixed(1)} GB`
                            : diag.vram_usage !== null && diag.vram_usage !== undefined
                            ? `${diag.vram_usage.toFixed(0)}%`
                            : "0%"}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-cyan-950/80 rounded-full border border-cyan-500/20 overflow-hidden p-[0.5px]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-cyan-400 rounded-full shadow-[0_0_6px_#00e5ff] transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                diag.vram_usage ??
                                  (diag.vram_used_bytes && diag.vram_total_bytes && diag.vram_total_bytes > 0
                                    ? (diag.vram_used_bytes / diag.vram_total_bytes) * 100
                                    : 0)
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* RAM Usage + Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-cyan-300/80 text-[10.5px]">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-cyan-400" /> RAM USAGE
                    </span>
                    <span className="font-bold text-cyan-200 font-tech">
                      {diag
                        ? `${(diag.ram_used_bytes / 1073741824).toFixed(1)} / ${(diag.ram_total_bytes / 1073741824).toFixed(1)} GB`
                        : "--"}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-cyan-950/80 rounded-full border border-cyan-500/20 overflow-hidden p-[0.5px]">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-cyan-400 rounded-full shadow-[0_0_6px_#00e5ff] transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, diag ? diag.ram_usage : 0))}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Footer Details */}
                <div className="mt-2 text-[9px] text-cyan-500/60 flex items-center border-t border-cyan-500/20 pt-1 font-tech truncate">
                  <span className="truncate w-full" title={diag?.gpu_name || diag?.cpu_name || "HARDWARE"}>
                    {diag?.gpu_name
                      ? diag.gpu_name.replace("NVIDIA GeForce ", "")
                      : diag?.cpu_name
                      ? diag.cpu_name.replace(/(Processor|\(R\)|\(TM\))/gi, "").trim()
                      : "HARDWARE ACTIVE"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </HudBrackets>
    </aside>
  );
};
