import React from "react";
import { Play, Pause, RotateCcw, Check, Square } from "lucide-react";
import { usePomodoro } from "../../../stores/pomodoroStore";
import { useTheme } from "../../../stores/themeStore";
import { formatMinutesSeconds } from "../../../utils/formatters";

export const RailTimerSection: React.FC = () => {
  const { themeConfig } = useTheme();
  const {
    cycle,
    totalCycles,
    timeLeft,
    totalSeconds,
    isRunning,
    dailyStats,
    toggleRun,
    stop,
    reset,
  } = usePomodoro();

  const minutes = Math.floor(timeLeft / 60);
  const timeFormatted = formatMinutesSeconds(timeLeft);

  const accent = themeConfig?.accentColor || "#ff9100";
  const isLightOrPink = themeConfig?.category === "light";
  const timerTextColor = isLightOrPink ? "var(--hud-text-primary)" : "#ffffff";

  const radius = 16;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className="w-full flex flex-col items-center gap-1 py-0.5 shrink-0"
      data-testid="right-rail-timer-section"
    >
      {/* 1. Mini Ring Gauge & Countdown */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke={accent}
            strokeOpacity={0.18}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke={accent}
            strokeWidth={strokeWidth + 0.5}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-300"
            style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-tech text-[9px] font-bold tracking-tighter"
            style={{ color: timerTextColor }}
          >
            {minutes}m
          </span>
        </div>
      </div>

      <div
        className="text-[10px] font-tech font-bold tracking-tight"
        style={{ color: timerTextColor }}
      >
        {timeFormatted}
      </div>

      {/* 2. Action Controls (tightly grouped) */}
      <div className="flex flex-col items-center gap-1 w-full shrink-0 my-0.5">
        {isRunning ? (
          <>
            <button
              onClick={toggleRun}
              title="Pause Timer"
              aria-label="Pause Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all hud-btn-active border-amber-400 bg-amber-500/25 shadow-[0_0_12px_rgba(255,145,0,0.4)] text-amber-100"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={stop}
              title="Cancel Timer"
              aria-label="Cancel Timer"
              className="hud-btn w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all border-red-500/30 text-red-400/70 hover:text-red-200 hover:border-red-400"
            >
              <Square className="w-2.5 h-2.5 fill-red-400" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleRun}
              title="Start Focus Timer"
              aria-label="Start Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/40 text-amber-300 hover:text-amber-100 hover:border-amber-400"
            >
              <Play className="w-3.5 h-3.5 ml-0.5" />
            </button>

            <button
              onClick={reset}
              title="Reset Timer"
              aria-label="Reset Timer"
              className="hud-btn w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/30 text-amber-400/70 hover:text-amber-200 hover:border-amber-400"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </>
        )}
      </div>

      {/* 3. Session Cycles / Pips */}
      <div className="flex flex-col items-center w-full shrink-0 mt-0.5">
        <span className="text-[7px] font-tech uppercase tracking-widest text-amber-400/60 mb-0.5">
          CYCLES
        </span>
        <div className="flex flex-col gap-1 items-center">
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
        <span className="text-[7.5px] font-tech text-amber-300 font-semibold mt-0.5">
          {cycle}/{totalCycles}
        </span>
      </div>

      {/* 4. Completed Today Badge */}
      <div
        className="flex items-center gap-0.5 text-[8px] font-tech text-amber-300/90 pt-0.5"
        title={`Completed today: ${dailyStats.completedPomodoros} sessions (${dailyStats.totalFocusMinutes}m)`}
      >
        <Check className="w-2.5 h-2.5 text-amber-400" />
        <span>{dailyStats.completedPomodoros}</span>
      </div>
    </div>
  );
};

