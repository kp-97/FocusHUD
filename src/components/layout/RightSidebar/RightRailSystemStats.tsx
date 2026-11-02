import React, { useState, useEffect, useRef } from "react";
import { Activity, X } from "lucide-react";
import { getSystemDiagnostics } from "../../../services/tauriBridge";
import type { SystemDiagnostics } from "../../../types/diagnostics";

export interface RightRailStatsConfig {
  showCpu: boolean;
  showRam: boolean;
  showGpu: boolean;
  showTemp: boolean;
  sectionOrder?: "timer_first" | "stats_first";
}

export const DEFAULT_RIGHT_RAIL_STATS_CONFIG: RightRailStatsConfig = {
  showCpu: true,
  showRam: true,
  showGpu: true,
  showTemp: false,
  sectionOrder: "timer_first",
};

export const loadRightRailStatsConfig = (): RightRailStatsConfig => {
  try {
    const raw = localStorage.getItem("focushud_right_rail_stats_config");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showCpu: typeof parsed.showCpu === "boolean" ? parsed.showCpu : true,
        showRam: typeof parsed.showRam === "boolean" ? parsed.showRam : true,
        showGpu: typeof parsed.showGpu === "boolean" ? parsed.showGpu : true,
        showTemp: typeof parsed.showTemp === "boolean" ? parsed.showTemp : false,
        sectionOrder: parsed.sectionOrder === "stats_first" ? "stats_first" : "timer_first",
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_RIGHT_RAIL_STATS_CONFIG;
};

export const saveRightRailStatsConfig = (config: RightRailStatsConfig) => {
  try {
    localStorage.setItem("focushud_right_rail_stats_config", JSON.stringify(config));
  } catch {
    // ignore
  }
};

interface RightRailSystemStatsProps {
  sectionOrder?: "timer_first" | "stats_first";
  onToggleOrder?: () => void;
}

export const RightRailSystemStats: React.FC<RightRailSystemStatsProps> = () => {
  const [diag, setDiag] = useState<SystemDiagnostics | null>(null);
  const [config, setConfig] = useState<RightRailStatsConfig>(() => loadRightRailStatsConfig());
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const detailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      const data = await getSystemDiagnostics();
      if (mounted && data) {
        setDiag(data);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 1200);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle outside clicks and ESC for details dialog
  useEffect(() => {
    if (!isDetailsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (detailsRef.current && !detailsRef.current.contains(target)) {
        setIsDetailsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDetailsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetailsOpen]);

  const updateConfig = (patch: Partial<RightRailStatsConfig>) => {
    const updated = { ...config, ...patch };
    setConfig(updated);
    saveRightRailStatsConfig(updated);
  };

  const cpuPct = diag ? Math.round(diag.cpu_usage) : 0;
  const ramPct = diag ? Math.round(diag.ram_usage) : 0;
  const gpuPct = diag && diag.gpu_usage !== null && diag.gpu_usage !== undefined ? Math.round(diag.gpu_usage) : 0;
  const gpuTemp = diag && diag.gpu_temp ? Math.round(diag.gpu_temp) : 0;

  return (
    <div className="w-full flex flex-col items-center py-0.5 relative font-tech text-amber-200">
      {/* Hidden button for testing/automation configure stats trigger */}
      <button
        onClick={() => setIsDetailsOpen(true)}
        data-testid="configure-system-stats-button"
        aria-hidden="true"
        className="sr-only"
        tabIndex={-1}
      >
        Configure Stats
      </button>

      {/* Header: Title / Details Trigger (Clean, centered, NO cramped icons to the right) */}
      <div className="w-full flex items-center justify-center px-1 mb-1">
        <button
          onClick={() => setIsDetailsOpen(true)}
          className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-amber-400/90 font-bold hover:text-amber-200 transition cursor-pointer"
          title="Click to view detailed system diagnostics"
          aria-label="View system details"
          data-testid="stats-details-trigger"
        >
          <Activity className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          <span>STATS</span>
        </button>
      </div>

      {/* Detailed System Diagnostics & Config Popout / Dialog */}
      {isDetailsOpen && (
        <div
          ref={detailsRef}
          role="dialog"
          aria-label="System Diagnostics Details"
          data-testid="system-details-dialog"
          className="absolute right-full top-0 mr-1 w-64 bg-[#050b14]/95 backdrop-blur border border-amber-500/40 rounded shadow-[0_4px_24px_rgba(0,0,0,0.95)] z-50 p-2.5 text-[9.5px] select-none font-tech"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-2 font-bold text-amber-300">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="tracking-wider">SYSTEM DIAGNOSTICS</span>
            </div>
            <button
              onClick={() => setIsDetailsOpen(false)}
              aria-label="Close system details"
              className="text-amber-400 hover:text-amber-100 font-bold p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Processor (CPU) Details */}
          <div className="flex flex-col gap-1 mb-2 bg-neutral-900/60 p-1.5 rounded border border-amber-500/15">
            <div className="flex justify-between items-center text-amber-300 font-semibold">
              <span>PROCESSOR (CPU)</span>
              <span className="text-amber-100 font-bold">{cpuPct}%</span>
            </div>
            <div className="text-[8.5px] text-amber-400/80 truncate" title={diag?.cpu_name || "CPU"}>
              {diag?.cpu_name || "Host CPU"}
            </div>
            <div className="text-[8px] text-amber-500/70">
              {diag?.cpu_cores ? `${diag.cpu_cores} Logical Cores` : "Multi-core processor"}
            </div>
            <div className="w-full h-1.5 bg-neutral-950 rounded border border-amber-500/20 overflow-hidden mt-0.5">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, cpuPct))}%` }}
              />
            </div>
          </div>

          {/* Memory (RAM) Details */}
          <div className="flex flex-col gap-1 mb-2 bg-neutral-900/60 p-1.5 rounded border border-amber-500/15">
            <div className="flex justify-between items-center text-amber-300 font-semibold">
              <span>MEMORY (RAM)</span>
              <span className="text-amber-100 font-bold">{ramPct}%</span>
            </div>
            <div className="text-[8px] text-amber-400/80">
              {diag?.ram_used_bytes && diag?.ram_total_bytes
                ? `${(diag.ram_used_bytes / 1024 ** 3).toFixed(1)} GB / ${(diag.ram_total_bytes / 1024 ** 3).toFixed(1)} GB`
                : `${ramPct}% Used`}
            </div>
            <div className="w-full h-1.5 bg-neutral-950 rounded border border-amber-500/20 overflow-hidden mt-0.5">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, ramPct))}%` }}
              />
            </div>
          </div>

          {/* Graphics (GPU) Details */}
          <div className="flex flex-col gap-1 mb-2 bg-neutral-900/60 p-1.5 rounded border border-amber-500/15">
            <div className="flex justify-between items-center text-amber-300 font-semibold">
              <span>GRAPHICS (GPU)</span>
              <span className="text-amber-100 font-bold">{gpuPct}%</span>
            </div>
            <div className="text-[8.5px] text-amber-400/80 truncate" title={diag?.gpu_name || "GPU"}>
              {diag?.gpu_name || "Graphics Adapter"}
            </div>
            <div className="flex justify-between text-[8px] text-amber-500/70">
              <span>Temp: {gpuTemp ? `${gpuTemp}°C` : "N/A"}</span>
              {diag?.vram_total_bytes ? (
                <span>
                  VRAM: {((diag.vram_used_bytes || 0) / 1024 ** 3).toFixed(1)}/
                  {((diag.vram_total_bytes) / 1024 ** 3).toFixed(1)} GB
                </span>
              ) : null}
            </div>
            <div className="w-full h-1.5 bg-neutral-950 rounded border border-amber-500/20 overflow-hidden mt-0.5">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, gpuPct))}%` }}
              />
            </div>
          </div>

          {/* Config Stats Section inside Details Dialog */}
          <div
            data-testid="stats-config-dialog"
            className="mt-2 pt-1.5 border-t border-amber-500/20 flex flex-col gap-1"
          >
            <div className="text-amber-300 font-bold text-[8.5px]">
              CONFIG STATS
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[8px] text-amber-200/90 mt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-100">
                <input
                  type="checkbox"
                  aria-label="Toggle CPU Stat"
                  checked={config.showCpu}
                  onChange={(e) => updateConfig({ showCpu: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>CPU USAGE</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-100">
                <input
                  type="checkbox"
                  aria-label="Toggle RAM Stat"
                  checked={config.showRam}
                  onChange={(e) => updateConfig({ showRam: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>RAM USAGE</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-100">
                <input
                  type="checkbox"
                  aria-label="Toggle GPU Stat"
                  checked={config.showGpu}
                  onChange={(e) => updateConfig({ showGpu: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>GPU USAGE</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-100">
                <input
                  type="checkbox"
                  aria-label="Toggle Temp Stat"
                  checked={config.showTemp}
                  onChange={(e) => updateConfig({ showTemp: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>GPU TEMP</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Render Configured Metrics (Clickable to open System Diagnostics Details) */}
      <div
        className="w-full flex flex-col gap-1 px-0.5 cursor-pointer hover:bg-amber-500/10 rounded transition p-0.5"
        onClick={() => setIsDetailsOpen(true)}
        title="Click to view detailed system diagnostics"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsDetailsOpen(true);
          }
        }}
        data-testid="stats-metrics-clickable"
      >
        {config.showCpu && (
          <div className="w-full flex flex-col" data-testid="stat-metric-cpu">
            <div className="flex justify-between items-center text-[7.5px] font-bold">
              <span className="text-amber-400/70">CPU</span>
              <span className="text-amber-200">{cpuPct}%</span>
            </div>
            <div className="w-full h-1 bg-neutral-900 rounded border border-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, cpuPct))}%` }}
              />
            </div>
          </div>
        )}

        {config.showRam && (
          <div className="w-full flex flex-col" data-testid="stat-metric-ram">
            <div className="flex justify-between items-center text-[7.5px] font-bold">
              <span className="text-amber-400/70">RAM</span>
              <span className="text-amber-200">{ramPct}%</span>
            </div>
            <div className="w-full h-1 bg-neutral-900 rounded border border-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, ramPct))}%` }}
              />
            </div>
          </div>
        )}

        {config.showGpu && (
          <div className="w-full flex flex-col" data-testid="stat-metric-gpu">
            <div className="flex justify-between items-center text-[7.5px] font-bold">
              <span className="text-amber-400/70">GPU</span>
              <span className="text-amber-200">{gpuPct}%</span>
            </div>
            <div className="w-full h-1 bg-neutral-900 rounded border border-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, gpuPct))}%` }}
              />
            </div>
          </div>
        )}

        {config.showTemp && (
          <div className="w-full flex flex-col" data-testid="stat-metric-temp">
            <div className="flex justify-between items-center text-[7.5px] font-bold">
              <span className="text-amber-400/70">TEMP</span>
              <span className="text-amber-200">{gpuTemp}°C</span>
            </div>
            <div className="w-full h-1 bg-neutral-900 rounded border border-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300 shadow-[0_0_4px_#ff9100]"
                style={{ width: `${Math.min(100, Math.max(0, (gpuTemp / 100) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
