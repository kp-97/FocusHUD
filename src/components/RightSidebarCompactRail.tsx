import React from "react";
import { Play, Pause, RotateCcw, Check, Maximize2, X, Minus, Square } from "lucide-react";
import { usePomodoro } from "../utils/pomodoroStore";
import { HudBrackets } from "./HudBrackets";
import { exitApp, minimizeToTray } from "../utils/tauriBridge";
import { SidebarToggleIcon } from "./SidebarToggleIcon";

interface RightSidebarCompactRailProps {
  onExpand?: () => void;
  onMaximizePanes?: () => void;
}

export const RightSidebarCompactRail: React.FC<RightSidebarCompactRailProps> = ({
  onExpand,
  onMaximizePanes,
}) => {
  const {
    mode,
    cycle,
    totalCycles,
    timeLeft,
    totalSeconds,
    isRunning,
    dailyStats,
    toggleRun,
    reset,
  } = usePomodoro();

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Mini gauge calculations
  const radius = 17;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <HudBrackets
      variant="amber"
      showTicks={false}
      className="h-full w-full flex flex-col justify-between items-center p-1.5 overflow-hidden select-none"
    >
      {/* 1. Top Pinned Status Header */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1 border-b border-amber-500/20 pb-1.5">
        {/* Row 1: Sidebar Toggle & Status Ping */}
        <div className="w-full flex items-center justify-between px-0.5">
          {onExpand && (
            <SidebarToggleIcon
              side="right"
              isCollapsed={true}
              onToggle={onExpand}
              theme="amber"
            />
          )}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? "bg-amber-400 animate-ping shadow-[0_0_6px_#ffb300]" : "bg-neutral-600"
            }`}
            title={isRunning ? "Timer Active" : "Timer Standby"}
          />
        </div>

        {/* Row 2: Compact Window Controls: Minimize, Maximize Panes, Exit */}
        <div className="w-full flex items-center justify-between px-0.5 text-amber-500/60">
          <button
            onClick={() => minimizeToTray()}
            title="Minimize to Tray"
            aria-label="Minimize to Tray"
            className="hover:text-amber-200 hover:scale-110 transition p-0.5 cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={onMaximizePanes}
            title="Maximize Panes"
            aria-label="Maximize Panes"
            className="hover:text-amber-200 hover:scale-110 transition p-0.5 cursor-pointer"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => exitApp()}
            title="Close FocusHUD"
            aria-label="Close FocusHUD"
            className="hover:text-red-400 hover:scale-110 transition p-0.5 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <span className="text-[7.5px] font-tech font-bold uppercase tracking-widest text-amber-300/90 text-center truncate w-full">
          {mode === "focus" ? "FOCUS" : mode === "short_break" ? "SHORT" : "LONG"}
        </span>
      </div>

      {/* 2. Mini Ring Gauge & Countdown */}
      <div className="flex flex-col items-center justify-center my-1 w-full shrink-0">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
            {/* Background Track */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              stroke="rgba(255, 145, 0, 0.15)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Active Glow Ring */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              stroke="#ff9100"
              strokeWidth={strokeWidth + 0.5}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-300"
              style={{ filter: "drop-shadow(0 0 4px #ff9100)" }}
            />
          </svg>

          {/* Centered Monospace Time (Short Form) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-tech text-[10px] font-bold text-amber-200 tracking-tighter">
              {minutes}m
            </span>
          </div>
        </div>

        {/* Precise MM:SS text */}
        <div className="text-[11px] font-tech font-bold tracking-tight text-amber-200/90 mt-1">
          {timeFormatted}
        </div>
      </div>

      {/* 3. Centered Action Controls */}
      <div className="flex flex-col items-center gap-1.5 w-full shrink-0">
        <button
          onClick={toggleRun}
          title={isRunning ? "Pause Timer" : "Start Focus Timer"}
          className={`hud-btn w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all ${
            isRunning
              ? "hud-btn-active border-amber-400 bg-amber-500/25 shadow-[0_0_12px_rgba(255,145,0,0.4)] text-amber-100"
              : "border-amber-500/40 text-amber-300 hover:text-amber-100 hover:border-amber-400"
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <button
          onClick={reset}
          title="Reset Timer"
          className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/30 text-amber-400/70 hover:text-amber-200 hover:border-amber-400"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* 4. Session Cycles / Pips */}
      <div className="flex flex-col items-center my-1 w-full shrink-0">
        <span className="text-[7.5px] font-tech uppercase tracking-widest text-amber-400/60 mb-1">
          CYCLES
        </span>
        <div className="flex flex-col gap-1.5 items-center">
          {Array.from({ length: totalCycles }).map((_, idx) => {
            const isDone = cycle > idx + 1;
            const isCurrent = cycle === idx + 1;
            return (
              <div
                key={idx}
                title={`Cycle ${idx + 1} of ${totalCycles}`}
                className={`w-1.5 h-1.5 rotate-45 transition-all ${
                  isDone
                    ? "bg-amber-400 shadow-[0_0_5px_#ff9100]"
                    : isCurrent
                    ? "bg-amber-400/60 border border-amber-300 shadow-[0_0_3px_#ff9100]"
                    : "bg-neutral-800 border border-amber-500/20"
                }`}
              />
            );
          })}
        </div>
        <span className="text-[8px] font-tech text-amber-300 font-semibold mt-1">
          {cycle}/{totalCycles}
        </span>
      </div>

      {/* 5. Bottom Pinned Telemetry & Expand Button */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1 border-t border-amber-500/20 pt-1.5">
        <div
          className="flex items-center gap-0.5 text-[8.5px] font-tech text-amber-300/90"
          title={`Completed today: ${dailyStats.completedPomodoros} sessions (${dailyStats.totalFocusMinutes}m)`}
        >
          <Check className="w-2.5 h-2.5 text-amber-400" />
          <span>{dailyStats.completedPomodoros}</span>
        </div>

        {onExpand && (
          <button
            onClick={onExpand}
            title="Expand Right Panel (or double-click border)"
            className="hud-btn w-6 h-6 flex items-center justify-center rounded border-amber-500/30 text-amber-400/60 hover:text-amber-200 hover:border-amber-400 transition cursor-pointer mt-0.5"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </HudBrackets>
  );
};
