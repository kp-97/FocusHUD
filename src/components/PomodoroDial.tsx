import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Timer, Plus, Minus, Check, X, Sliders, Square } from "lucide-react";
import { usePomodoro } from "../utils/pomodoroStore";

interface PomodoroDialProps {
  isCompact?: boolean;
}

type AdjustTarget = "focus" | "short_break" | "long_break" | "cycles" | null;

export const PomodoroDial: React.FC<PomodoroDialProps> = ({ isCompact = false }) => {
  const {
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    totalCycles,
    mode,
    cycle,
    totalSeconds,
    timeLeft,
    isRunning,
    dailyStats,
    toggleRun,
    stop: stopTimer,
    reset: resetTimer,
    adjustMinutes,
    setFocusMinutes,
    setShortBreakMinutes,
    setLongBreakMinutes,
    setTotalCycles,
  } = usePomodoro();

  // Adjust scroll modal state
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget>(null);
  const [tempMinutes, setTempMinutes] = useState<number>(25);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartValRef = useRef<number>(0);

  // Bounds for adjusting
  const getBounds = (target: AdjustTarget) => {
    switch (target) {
      case "focus":
        return { min: 1, max: 120, default: 25 };
      case "short_break":
        return { min: 1, max: 30, default: 5 };
      case "long_break":
        return { min: 1, max: 60, default: 15 };
      case "cycles":
        return { min: 1, max: 12, default: 4 };
      default:
        return { min: 1, max: 60, default: 25 };
    }
  };

  // Open adjustment scroll modal
  const openAdjust = (target: AdjustTarget) => {
    setAdjustTarget(target);
    if (target === "focus") setTempMinutes(focusMinutes);
    else if (target === "short_break") setTempMinutes(shortBreakMinutes);
    else if (target === "long_break") setTempMinutes(longBreakMinutes);
    else if (target === "cycles") setTempMinutes(totalCycles);
  };

  const cancelAdjust = () => {
    setAdjustTarget(null);
  };

  const acceptAdjust = () => {
    if (!adjustTarget) return;
    const bounds = getBounds(adjustTarget);
    const clamped = Math.max(bounds.min, Math.min(bounds.max, tempMinutes));

    if (adjustTarget === "focus") {
      setFocusMinutes(clamped);
    } else if (adjustTarget === "short_break") {
      setShortBreakMinutes(clamped);
    } else if (adjustTarget === "long_break") {
      setLongBreakMinutes(clamped);
    } else if (adjustTarget === "cycles") {
      setTotalCycles(clamped);
    }
    setAdjustTarget(null);
  };

  // Mouse wheel & drag handling for the scroll graphic
  const handleScrollWheel = (e: React.WheelEvent) => {
    if (!adjustTarget) return;
    const bounds = getBounds(adjustTarget);
    const step = e.deltaY < 0 ? 1 : -1;
    setTempMinutes((prev) => Math.max(bounds.min, Math.min(bounds.max, prev + step)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartValRef.current = tempMinutes;
  };

  useEffect(() => {
    if (!isDragging) return;
    const bounds = getBounds(adjustTarget);

    const onMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartYRef.current - e.clientY; // drag up = increase
      const stepChange = Math.round(deltaY / 12);
      const nextVal = Math.max(bounds.min, Math.min(bounds.max, dragStartValRef.current + stepChange));
      setTempMinutes(nextVal);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, adjustTarget]);

  // Formatted display values
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const radius = isCompact ? 58 : 74;
  const strokeWidth = isCompact ? 9 : 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative w-full flex flex-col items-center justify-center p-3 select-none">
      {/* 1. HUD Telemetry Top Header (STANDBY -> POMODORO TIMER) */}
      <div className="w-full flex justify-between items-center text-[10px] text-orange-400/80 font-tech uppercase tracking-wider mb-2">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-amber-400 animate-ping shadow-[0_0_8px_#ffb300]" : "bg-neutral-600"
            }`}
          />
          <span className="font-semibold text-orange-200">
            {isRunning ? "TIMER RUNNING" : "POMODORO TIMER"}
          </span>
        </span>
        <button
          onClick={() => !isRunning && openAdjust("cycles")}
          disabled={isRunning}
          title={!isRunning ? "Click to adjust number of cycles" : undefined}
          className={`text-orange-300 font-bold tracking-widest ${
            !isRunning ? "hover:text-amber-200 hover:underline cursor-pointer transition" : ""
          }`}
        >
          {mode === "focus"
            ? `CYCLE: ${String(cycle).padStart(2, "0")}/${String(totalCycles).padStart(2, "0")}`
            : mode === "short_break"
            ? "SHORT BREAK"
            : "LONG BREAK"}
        </button>
      </div>

      {/* 2. Center Dial & Scroll Graphic Container */}
      <div className="relative flex items-center justify-center my-1 w-full min-h-[165px]">
        {/* Normal Dial View */}
        <div
          onClick={() => !isRunning && openAdjust("focus")}
          title={!isRunning ? "Click to adjust focus duration" : undefined}
          className={`relative flex items-center justify-center ${
            !isRunning ? "cursor-pointer group hover:scale-[1.01] transition-transform" : ""
          }`}
        >
          <svg
            width={isCompact ? 160 : 200}
            height={isCompact ? 160 : 200}
            className="transform -rotate-90 filter drop-shadow-[0_0_12px_rgba(255,87,34,0.3)]"
          >
            <defs>
              <linearGradient id="pomodoroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffb300" />
                <stop offset="50%" stopColor="#ff5722" />
                <stop offset="100%" stopColor="#e53935" />
              </linearGradient>

              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer mechanical tick ring */}
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius + strokeWidth + 4}
              fill="none"
              stroke="rgba(255, 110, 64, 0.2)"
              strokeWidth="1.5"
              strokeDasharray="3 6"
            />

            {/* Track background */}
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius}
              fill="none"
              stroke="#1b1212"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius}
              fill="none"
              stroke="rgba(255, 87, 34, 0.15)"
              strokeWidth={strokeWidth}
            />

            {/* Active progress arc */}
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius}
              fill="none"
              stroke="url(#pomodoroGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#neonGlow)"
              className="transition-all duration-500 ease-linear"
            />

            {/* Inner ring */}
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius - strokeWidth - 2}
              fill="none"
              stroke="rgba(255, 87, 34, 0.25)"
              strokeWidth="1"
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] tracking-widest text-orange-400/90 font-hud font-bold uppercase">
              {mode === "focus" ? "FOCUS" : mode === "short_break" ? "SHORT BREAK" : "LONG BREAK"}
            </span>
            <span className="font-orbitron text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,145,0,0.8)] my-0.5">
              {timeFormatted}
            </span>
            <div className="flex items-center gap-1 text-orange-400/80">
              <Timer className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} style={{ animationDuration: "4s" }} />
              {!isRunning && (
                <span className="text-[9px] font-tech text-orange-400/60 group-hover:text-orange-300 transition">
                  EDIT
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Interactive Scroll Graphic Adjustment Overlay */}
        {adjustTarget && (
          <div
            onWheel={handleScrollWheel}
            className="absolute inset-0 z-30 bg-[#090503]/95 backdrop-blur-md border border-orange-500/50 rounded-lg p-2.5 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(255,87,34,0.4)] animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between text-[10px] font-tech uppercase tracking-wider text-orange-400 border-b border-orange-500/30 pb-1">
              <span className="flex items-center gap-1.5 font-bold text-orange-200">
                <Sliders className="w-3 h-3 text-orange-400" />
                {adjustTarget === "focus"
                  ? "SET FOCUS TIME"
                  : adjustTarget === "short_break"
                  ? "SET SHORT BREAK"
                  : adjustTarget === "long_break"
                  ? "SET LONG BREAK"
                  : "SET TOTAL CYCLES"}
              </span>
              <span className="text-[9px] text-orange-500/70">SCROLL / DRAG</span>
            </div>

            {/* Scroll Cylinder / Graduated Ruler Graphic */}
            <div
              onMouseDown={handleMouseDown}
              className={`w-full flex-1 flex items-center justify-center relative cursor-ns-resize my-1.5 py-1 select-none overflow-hidden rounded bg-black/40 border border-orange-500/20 ${
                isDragging ? "border-orange-400 shadow-[inset_0_0_12px_rgba(255,87,34,0.3)]" : ""
              }`}
              title="Click and drag up/down or use mouse scroll wheel to adjust"
            >
              {/* Vertical graduation ticks on the left */}
              <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-between py-1 text-[8px] text-orange-500/40 pointer-events-none">
                <span>—</span>
                <span>—</span>
                <span className="text-orange-400 font-bold font-tech">▶</span>
                <span>—</span>
                <span>—</span>
              </div>

              {/* Central Scrolling Tumbler Values */}
              <div className="flex flex-col items-center justify-center gap-1 font-orbitron">
                {/* 2 steps above */}
                <span className="text-xs text-orange-500/30 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes + 2)}
                </span>
                <span className="text-sm text-orange-500/50 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes + 1)}
                </span>

                {/* Central active value */}
                <div className="flex items-baseline gap-1 px-3 py-0.5 rounded bg-orange-950/60 border border-orange-500/80 shadow-[0_0_15px_rgba(255,145,0,0.5)]">
                  <span className="text-2xl font-black text-amber-200 tracking-wider">
                    {String(tempMinutes).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-tech text-orange-400 font-bold">
                    {adjustTarget === "cycles" ? "CYCLES" : "MIN"}
                  </span>
                </div>

                {/* 2 steps below */}
                <span className="text-sm text-orange-500/50 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes - 1)}
                </span>
                <span className="text-xs text-orange-500/30 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes - 2)}
                </span>
              </div>

              {/* Vertical graduation ticks on the right */}
              <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-1 text-[8px] text-orange-500/40 pointer-events-none">
                <span>—</span>
                <span>—</span>
                <span className="text-orange-400 font-bold font-tech">◀</span>
                <span>—</span>
                <span>—</span>
              </div>
            </div>

            {/* Accept (Tick) and Discard (Cross) Action Buttons */}
            <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-orange-500/30">
              <button
                onClick={cancelAdjust}
                title="Discard Changes"
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-red-950/30 hover:bg-red-900/50 border border-red-500/50 hover:border-red-400 text-red-300 text-[10px] font-tech uppercase tracking-wider transition"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span>DISCARD</span>
              </button>

              <button
                onClick={acceptAdjust}
                title="Accept Changes"
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-amber-950/40 hover:bg-amber-600/30 border border-amber-400 hover:border-amber-300 text-amber-200 text-[10px] font-tech uppercase tracking-wider shadow-[0_0_8px_rgba(255,179,0,0.3)] transition font-bold"
              >
                <Check className="w-3.5 h-3.5 text-amber-300" />
                <span>ACCEPT</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Action Controls (+/- 1 minute increment) */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => adjustMinutes(-1)}
          disabled={timeLeft < 60}
          title={timeLeft < 60 ? "Cannot decrease below 1 minute" : "Decrease 1m"}
          className={`p-1 rounded bg-black/40 border text-orange-400 transition ${
            timeLeft < 60
              ? "border-orange-500/10 text-orange-400/30 cursor-not-allowed"
              : "border-orange-500/30 hover:border-orange-400 hover:text-white cursor-pointer"
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={stopTimer}
          title="Stop Timer (Shift to Next Phase)"
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-tech font-bold uppercase transition bg-red-950/30 border border-red-500/40 text-red-400 hover:bg-red-900/40 hover:border-red-400 hover:text-red-200 cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.2)]"
        >
          <Square className="w-3 h-3 fill-red-400" /> STOP
        </button>

        <button
          onClick={toggleRun}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-tech font-bold uppercase transition ${
            isRunning
              ? "bg-amber-600/30 border border-amber-500 text-amber-200 shadow-[0_0_12px_rgba(255,179,0,0.3)]"
              : "bg-orange-500/20 border border-orange-500 text-orange-300 hover:bg-orange-500/30"
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3 h-3 fill-amber-300" /> PAUSE
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-orange-400" /> START
            </>
          )}
        </button>

        <button
          onClick={resetTimer}
          title="Reset Timer"
          className="p-1 rounded bg-black/40 border border-orange-500/30 text-orange-400 hover:border-orange-400 hover:text-white transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => adjustMinutes(1)}
          title="Increase 1m"
          className="p-1 rounded bg-black/40 border border-orange-500/30 text-orange-400 hover:border-orange-400 hover:text-white transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. Sub-telemetry readout (Interactive: Short Break / Focus / Long Break / Cycles) */}
      <div className="w-full flex justify-between items-center text-[9px] text-orange-500/70 font-tech mt-2.5 px-1 border-t border-orange-500/20 pt-1.5">
        <button
          onClick={() => openAdjust("short_break")}
          title="Click to adjust short break length"
          className="hover:text-amber-200 hover:underline transition p-0.5"
        >
          SHORT: {shortBreakMinutes}M
        </button>

        <button
          onClick={() => openAdjust("focus")}
          title="Click to adjust focus length"
          className="hover:text-amber-200 hover:underline transition p-0.5 text-orange-400 font-bold"
        >
          FOCUS: {focusMinutes}M
        </button>

        <button
          onClick={() => openAdjust("long_break")}
          title="Click to adjust long break length"
          className="hover:text-amber-200 hover:underline transition p-0.5"
        >
          LONG: {longBreakMinutes}M
        </button>

        <button
          onClick={() => openAdjust("cycles")}
          title="Click to adjust total cycles"
          className="hover:text-amber-200 hover:underline transition p-0.5 text-amber-300/90 font-bold"
        >
          CYCLES: {totalCycles}
        </button>
      </div>

      {/* 6. Daily Completed Pomodoro & Focus Time Tally */}
      <div className="w-full flex justify-between items-center bg-orange-950/20 border border-orange-500/20 rounded px-2 py-1 mt-2 text-[9px] font-tech text-orange-300">
        <span className="flex items-center gap-1">
          <span className="text-orange-500/70">COMPLETED:</span>
          <span className="font-bold text-amber-200">{dailyStats.completedPomodoros} POMOS</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-orange-500/70">FOCUS:</span>
          <span className="font-bold text-amber-200">
            {Math.floor(dailyStats.totalFocusMinutes / 60)}H {dailyStats.totalFocusMinutes % 60}M
          </span>
        </span>
      </div>
    </div>
  );
};
