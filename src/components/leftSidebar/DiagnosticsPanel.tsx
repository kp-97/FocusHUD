import React from "react";
import {
  Activity,
  Cpu,
  Layers,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SystemDiagnostics } from "../../types/diagnostics";

interface DiagnosticsPanelProps {
  diag: SystemDiagnostics | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diag,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <div className="w-full text-[11px] font-tech text-cyan-400/80 mb-2">
      {/* Header with collapse toggle */}
      <div
        onClick={onToggleCollapse}
        className={`flex items-center justify-between text-[10.5px] text-cyan-300 font-hud tracking-wider uppercase cursor-pointer select-none group ${
          collapsed ? "pb-0.5" : "border-b border-cyan-500/30 pb-1.5 mb-2.5"
        }`}
        title={collapsed ? "Expand System Stats" : "Collapse System Stats"}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className="w-1.5 h-1.5 bg-cyan-400 rotate-45 shadow-[0_0_5px_#00e5ff]" />
          <span className="font-bold tracking-widest text-cyan-200 group-hover:text-cyan-100 transition-colors">
            SYSTEM STATS
          </span>
          {collapsed && diag && (
            <span className="text-[9px] font-tech text-cyan-400/70 normal-case ml-1 truncate">
              CPU {Math.round(diag.cpu_usage)}% · RAM {Math.round(diag.ram_usage)}%
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label={collapsed ? "Expand System Stats" : "Collapse System Stats"}
          className="text-cyan-400/70 group-hover:text-cyan-200 transition p-0.5 cursor-pointer"
        >
          {collapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Collapsible Telemetry Content */}
      {!collapsed && (
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
  );
};
