import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Timer, Plus, Minus, Check, X, Sliders, Square } from "lucide-react";
import { usePomodoro } from "../../../stores/pomodoroStore";
import { useTheme } from "../../../stores/themeStore";

interface PomodoroDialProps {
  isCompact?: boolean;
}

type AdjustTarget = "focus" | "short_break" | "long_break" | "cycles" | null;

interface PomodoroThemeStyle {
  stop1: string;
  stop2: string;
  stop3: string;
  trackColor: string;
  tickColor: string;
  innerRingColor: string;
  glowColor: string;
  digitsColor: string;
  digitsShadow: string;
  modeBadgeColor: string;
  subtextColor: string;
  btnBorder: string;
  btnBg: string;
  btnText: string;
  activeBtnBg: string;
  tallyBg: string;
  tallyBorder: string;
  tallyText: string;
  tallyHighlight: string;
  modalBg: string;
  modalBorder: string;
  modalHeaderBg: string;
}

const THEME_POMODORO: Record<string, PomodoroThemeStyle> = {
  cyber: {
    stop1: "#00e5ff",
    stop2: "#0284c7",
    stop3: "#38bdf8",
    trackColor: "rgba(0, 229, 255, 0.12)",
    tickColor: "rgba(0, 229, 255, 0.25)",
    innerRingColor: "rgba(0, 229, 255, 0.2)",
    glowColor: "#00e5ff",
    digitsColor: "#ffffff",
    digitsShadow: "0 0 14px rgba(0, 229, 255, 0.85)",
    modeBadgeColor: "text-cyan-400",
    subtextColor: "text-cyan-400/70",
    btnBorder: "border-cyan-500/40 hover:border-cyan-300",
    btnBg: "bg-cyan-950/40 hover:bg-cyan-900/60",
    btnText: "text-cyan-300 hover:text-white",
    activeBtnBg: "bg-cyan-600/30 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.3)]",
    tallyBg: "bg-cyan-950/30",
    tallyBorder: "border-cyan-500/30",
    tallyText: "text-cyan-400/80",
    tallyHighlight: "text-cyan-200",
    modalBg: "bg-[#040d1a]/95",
    modalBorder: "border-cyan-500/50 shadow-[0_0_20px_rgba(0,229,255,0.3)]",
    modalHeaderBg: "border-cyan-500/30 text-cyan-300",
  },
  pink: {
    stop1: "#fb7185",
    stop2: "#f43f5e",
    stop3: "#ec4899",
    trackColor: "rgba(244, 63, 94, 0.2)",
    tickColor: "rgba(244, 63, 94, 0.35)",
    innerRingColor: "rgba(244, 63, 94, 0.25)",
    glowColor: "rgba(244, 63, 94, 0.45)",
    digitsColor: "#831843",
    digitsShadow: "0 2px 8px rgba(244, 63, 94, 0.25)",
    modeBadgeColor: "text-rose-900 font-extrabold",
    subtextColor: "text-rose-950 font-bold",
    btnBorder: "border-rose-300 hover:border-rose-500",
    btnBg: "bg-white/95 hover:bg-rose-50 shadow-sm",
    btnText: "text-rose-900 hover:text-rose-950 font-bold",
    activeBtnBg: "bg-rose-500 hover:bg-rose-600 border border-rose-600 text-white font-bold shadow-[0_0_10px_rgba(244,63,94,0.35)]",
    tallyBg: "bg-white/95 shadow-sm",
    tallyBorder: "border-rose-300",
    tallyText: "text-rose-950 font-bold",
    tallyHighlight: "text-rose-950 font-extrabold",
    modalBg: "bg-white/98 shadow-2xl",
    modalBorder: "border-rose-300 shadow-[0_8px_32px_rgba(244,63,94,0.2)]",
    modalHeaderBg: "border-rose-200 text-rose-950 font-bold",
  },
  amber: {
    stop1: "#ffb000",
    stop2: "#ff9100",
    stop3: "#ff5722",
    trackColor: "rgba(255, 176, 0, 0.12)",
    tickColor: "rgba(255, 176, 0, 0.25)",
    innerRingColor: "rgba(255, 176, 0, 0.2)",
    glowColor: "#ffb000",
    digitsColor: "#fffbeb",
    digitsShadow: "0 0 14px rgba(255, 176, 0, 0.9)",
    modeBadgeColor: "text-amber-400",
    subtextColor: "text-amber-400/70",
    btnBorder: "border-amber-500/40 hover:border-amber-300",
    btnBg: "bg-amber-950/40 hover:bg-amber-900/60",
    btnText: "text-amber-300 hover:text-white",
    activeBtnBg: "bg-amber-600/30 border border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(255,179,0,0.3)]",
    tallyBg: "bg-amber-950/30",
    tallyBorder: "border-amber-500/30",
    tallyText: "text-amber-400/80",
    tallyHighlight: "text-amber-200",
    modalBg: "bg-[#100d08]/95",
    modalBorder: "border-amber-500/50 shadow-[0_0_20px_rgba(255,176,0,0.3)]",
    modalHeaderBg: "border-amber-500/30 text-amber-300",
  },
  matrix: {
    stop1: "#00ff66",
    stop2: "#10b981",
    stop3: "#059669",
    trackColor: "rgba(0, 255, 102, 0.12)",
    tickColor: "rgba(0, 255, 102, 0.25)",
    innerRingColor: "rgba(0, 255, 102, 0.2)",
    glowColor: "#00ff66",
    digitsColor: "#dcfce7",
    digitsShadow: "0 0 14px rgba(0, 255, 102, 0.85)",
    modeBadgeColor: "text-emerald-400",
    subtextColor: "text-emerald-400/70",
    btnBorder: "border-emerald-500/40 hover:border-emerald-300",
    btnBg: "bg-emerald-950/40 hover:bg-emerald-900/60",
    btnText: "text-emerald-300 hover:text-white",
    activeBtnBg: "bg-emerald-600/30 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(0,255,102,0.3)]",
    tallyBg: "bg-emerald-950/30",
    tallyBorder: "border-emerald-500/30",
    tallyText: "text-emerald-400/80",
    tallyHighlight: "text-emerald-200",
    modalBg: "bg-[#020803]/95",
    modalBorder: "border-emerald-500/50 shadow-[0_0_20px_rgba(0,255,102,0.3)]",
    modalHeaderBg: "border-emerald-500/30 text-emerald-300",
  },
  nord: {
    stop1: "#88c0d0",
    stop2: "#81a1c1",
    stop3: "#5e81ac",
    trackColor: "rgba(136, 192, 208, 0.12)",
    tickColor: "rgba(136, 192, 208, 0.22)",
    innerRingColor: "rgba(136, 192, 208, 0.18)",
    glowColor: "#88c0d0",
    digitsColor: "#eceff4",
    digitsShadow: "0 0 12px rgba(136, 192, 208, 0.6)",
    modeBadgeColor: "text-sky-300",
    subtextColor: "text-sky-200/70",
    btnBorder: "border-slate-500/40 hover:border-sky-300",
    btnBg: "bg-slate-800/60 hover:bg-slate-700/70",
    btnText: "text-slate-200 hover:text-white",
    activeBtnBg: "bg-sky-500/25 border border-sky-400 text-sky-200 shadow-[0_0_10px_rgba(136,192,208,0.3)]",
    tallyBg: "bg-slate-800/40",
    tallyBorder: "border-slate-600/30",
    tallyText: "text-slate-300",
    tallyHighlight: "text-slate-100",
    modalBg: "bg-[#242933]/95",
    modalBorder: "border-sky-400/40 shadow-[0_0_20px_rgba(136,192,208,0.25)]",
    modalHeaderBg: "border-slate-600/40 text-sky-200",
  },
  light: {
    stop1: "#0284c7",
    stop2: "#0369a1",
    stop3: "#1d4ed8",
    trackColor: "rgba(148, 163, 184, 0.25)",
    tickColor: "rgba(148, 163, 184, 0.45)",
    innerRingColor: "rgba(148, 163, 184, 0.25)",
    glowColor: "rgba(2, 132, 199, 0.35)",
    digitsColor: "#0f172a",
    digitsShadow: "0 1px 4px rgba(15, 23, 42, 0.15)",
    modeBadgeColor: "text-sky-900 font-extrabold",
    subtextColor: "text-slate-900 font-bold",
    btnBorder: "border-slate-300 hover:border-sky-500",
    btnBg: "bg-white hover:bg-slate-100 shadow-sm",
    btnText: "text-slate-900 hover:text-slate-950 font-bold",
    activeBtnBg: "bg-sky-600 hover:bg-sky-700 border border-sky-700 text-white font-bold shadow-[0_0_8px_rgba(2,132,199,0.3)]",
    tallyBg: "bg-white shadow-sm",
    tallyBorder: "border-slate-300",
    tallyText: "text-slate-900 font-bold",
    tallyHighlight: "text-slate-950 font-extrabold",
    modalBg: "bg-white/98 shadow-2xl",
    modalBorder: "border-slate-300 shadow-xl",
    modalHeaderBg: "border-slate-200 text-slate-900 font-bold",
  },
  dark: {
    stop1: "#f8fafc",
    stop2: "#cbd5e1",
    stop3: "#94a3b8",
    trackColor: "rgba(148, 163, 184, 0.12)",
    tickColor: "rgba(148, 163, 184, 0.2)",
    innerRingColor: "rgba(148, 163, 184, 0.15)",
    glowColor: "rgba(248, 250, 252, 0.4)",
    digitsColor: "#ffffff",
    digitsShadow: "0 0 12px rgba(248, 250, 252, 0.5)",
    modeBadgeColor: "text-slate-200",
    subtextColor: "text-slate-400",
    btnBorder: "border-neutral-700 hover:border-neutral-400",
    btnBg: "bg-neutral-900/60 hover:bg-neutral-800/80",
    btnText: "text-neutral-200 hover:text-white",
    activeBtnBg: "bg-neutral-200 hover:bg-white border border-white text-neutral-900 font-bold",
    tallyBg: "bg-neutral-900/40",
    tallyBorder: "border-neutral-800",
    tallyText: "text-neutral-400",
    tallyHighlight: "text-neutral-100",
    modalBg: "bg-[#0a0a0c]/95",
    modalBorder: "border-neutral-700 shadow-xl",
    modalHeaderBg: "border-neutral-800 text-neutral-200",
  },
};

export const PomodoroDial: React.FC<PomodoroDialProps> = ({ isCompact = false }) => {
  const { effectiveTheme } = useTheme();
  const themeStyle = THEME_POMODORO[effectiveTheme] || THEME_POMODORO.cyber;

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
            className="transform -rotate-90"
            style={{ filter: `drop-shadow(0 0 10px ${themeStyle.glowColor})` }}
          >
            <defs>
              <linearGradient id="pomodoroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={themeStyle.stop1} />
                <stop offset="50%" stopColor={themeStyle.stop2} />
                <stop offset="100%" stopColor={themeStyle.stop3} />
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
              stroke={themeStyle.tickColor}
              strokeWidth="1.5"
              strokeDasharray="3 6"
            />

            {/* Track background */}
            <circle
              cx={isCompact ? 80 : 100}
              cy={isCompact ? 80 : 100}
              r={radius}
              fill="none"
              stroke={themeStyle.trackColor}
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
              stroke={themeStyle.innerRingColor}
              strokeWidth="1"
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className={`text-[10px] tracking-widest font-hud font-bold uppercase ${themeStyle.modeBadgeColor}`}>
              {mode === "focus" ? "FOCUS" : mode === "short_break" ? "SHORT BREAK" : "LONG BREAK"}
            </span>
            <span
              className="font-orbitron text-3xl font-extrabold tracking-tight my-0.5"
              style={{
                color: themeStyle.digitsColor,
                textShadow: themeStyle.digitsShadow,
              }}
            >
              {timeFormatted}
            </span>
            <div className={`flex items-center gap-1 ${themeStyle.subtextColor}`}>
              <Timer className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} style={{ animationDuration: "4s" }} />
              {!isRunning && (
                <span className="text-[9px] font-tech opacity-75 group-hover:opacity-100 transition">
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
            className={`absolute inset-0 z-30 backdrop-blur-md rounded-lg p-2.5 flex flex-col items-center justify-between animate-in fade-in zoom-in-95 duration-150 ${themeStyle.modalBg} border ${themeStyle.modalBorder}`}
          >
            {/* Modal Header */}
            <div className={`w-full flex items-center justify-between text-[10px] font-tech uppercase tracking-wider pb-1 border-b ${themeStyle.modalHeaderBg}`}>
              <span className="flex items-center gap-1.5 font-bold">
                <Sliders className="w-3 h-3" />
                {adjustTarget === "focus"
                  ? "SET FOCUS TIME"
                  : adjustTarget === "short_break"
                  ? "SET SHORT BREAK"
                  : adjustTarget === "long_break"
                  ? "SET LONG BREAK"
                  : "SET TOTAL CYCLES"}
              </span>
              <span className="text-[9px] opacity-70">SCROLL / DRAG</span>
            </div>

            {/* Scroll Cylinder / Graduated Ruler Graphic */}
            <div
              onMouseDown={handleMouseDown}
              className={`w-full flex-1 flex items-center justify-center relative cursor-ns-resize my-1.5 py-1 select-none overflow-hidden rounded bg-black/20 border ${themeStyle.modalBorder} ${
                isDragging ? "shadow-inner" : ""
              }`}
              title="Click and drag up/down or use mouse scroll wheel to adjust"
            >
              {/* Vertical graduation ticks on the left */}
              <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-between py-1 text-[8px] opacity-40 pointer-events-none">
                <span>—</span>
                <span>—</span>
                <span className="font-bold font-tech">▶</span>
                <span>—</span>
                <span>—</span>
              </div>

              {/* Central Scrolling Tumbler Values */}
              <div className="flex flex-col items-center justify-center gap-1 font-orbitron">
                {/* 2 steps above */}
                <span className="text-xs opacity-40 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes + 2)}
                </span>
                <span className="text-sm opacity-60 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes + 1)}
                </span>

                {/* Central active value */}
                <div
                  className="flex items-baseline gap-1 px-3 py-0.5 rounded border shadow-md"
                  style={{
                    backgroundColor: themeStyle.stop1 + "25",
                    borderColor: themeStyle.stop1,
                  }}
                >
                  <span className="text-2xl font-black tracking-wider" style={{ color: themeStyle.digitsColor }}>
                    {String(tempMinutes).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-tech font-bold" style={{ color: themeStyle.stop2 }}>
                    {adjustTarget === "cycles" ? "CYCLES" : "MIN"}
                  </span>
                </div>

                {/* 2 steps below */}
                <span className="text-sm opacity-60 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes - 1)}
                </span>
                <span className="text-xs opacity-40 font-bold">
                  {Math.max(getBounds(adjustTarget).min, tempMinutes - 2)}
                </span>
              </div>

              {/* Vertical graduation ticks on the right */}
              <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-1 text-[8px] opacity-40 pointer-events-none">
                <span>—</span>
                <span>—</span>
                <span className="font-bold font-tech">◀</span>
                <span>—</span>
                <span>—</span>
              </div>
            </div>

            {/* Accept (Tick) and Discard (Cross) Action Buttons */}
            <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-black/10">
              <button
                onClick={cancelAdjust}
                title="Discard Changes"
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-red-950/30 hover:bg-red-900/50 border border-red-500/50 hover:border-red-400 text-red-400 text-[10px] font-tech uppercase tracking-wider transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span>DISCARD</span>
              </button>

              <button
                onClick={acceptAdjust}
                title="Accept Changes"
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[10px] font-tech uppercase tracking-wider transition font-bold cursor-pointer ${themeStyle.activeBtnBg}`}
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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
          className={`p-1 rounded border transition ${themeStyle.btnBorder} ${themeStyle.btnBg} ${themeStyle.btnText} ${
            timeLeft < 60 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {isRunning ? (
          <>
            <button
              onClick={stopTimer}
              title="Cancel Timer"
              aria-label="Cancel Timer"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-tech font-bold uppercase transition bg-red-950/40 border border-red-500/50 text-red-400 hover:bg-red-900/50 hover:border-red-400 hover:text-red-200 cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.2)]"
            >
              <Square className="w-3 h-3 fill-red-400" /> CANCEL
            </button>

            <button
              onClick={toggleRun}
              title="Pause Timer"
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-tech font-bold uppercase transition cursor-pointer ${themeStyle.activeBtnBg}`}
            >
              <Pause className="w-3 h-3 fill-current" /> PAUSE
            </button>
          </>
        ) : (
          <button
            onClick={toggleRun}
            title="Start Focus Timer"
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-tech font-bold uppercase transition cursor-pointer ${themeStyle.activeBtnBg}`}
          >
            <Play className="w-3 h-3 fill-current" /> START
          </button>
        )}

        <button
          onClick={resetTimer}
          title="Reset Timer"
          className={`p-1 rounded border transition cursor-pointer ${themeStyle.btnBorder} ${themeStyle.btnBg} ${themeStyle.btnText}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => adjustMinutes(1)}
          title="Increase 1m"
          className={`p-1 rounded border transition cursor-pointer ${themeStyle.btnBorder} ${themeStyle.btnBg} ${themeStyle.btnText}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. Sub-telemetry readout (Interactive: Short Break / Focus / Long Break / Cycles) */}
      <div className={`w-full flex justify-between items-center text-[9px] font-tech mt-2.5 px-1 border-t border-black/10 pt-1.5 ${themeStyle.subtextColor}`}>
        <button
          onClick={() => openAdjust("short_break")}
          title="Click to adjust short break length"
          className="hover:underline transition p-0.5 cursor-pointer"
        >
          SHORT: {shortBreakMinutes}M
        </button>

        <button
          onClick={() => openAdjust("focus")}
          title="Click to adjust focus length"
          className="hover:underline transition p-0.5 font-bold cursor-pointer"
        >
          FOCUS: {focusMinutes}M
        </button>

        <button
          onClick={() => openAdjust("long_break")}
          title="Click to adjust long break length"
          className="hover:underline transition p-0.5 cursor-pointer"
        >
          LONG: {longBreakMinutes}M
        </button>

        <button
          onClick={() => openAdjust("cycles")}
          title="Click to adjust total cycles"
          className="hover:underline transition p-0.5 font-bold cursor-pointer"
        >
          CYCLES: {totalCycles}
        </button>
      </div>

      {/* 6. Daily Completed Pomodoro & Focus Time Tally */}
      <div className={`w-full flex justify-between items-center rounded px-2 py-1 mt-2 text-[9px] font-tech border ${themeStyle.tallyBg} ${themeStyle.tallyBorder} ${themeStyle.tallyText}`}>
        <span className="flex items-center gap-1">
          <span className="font-semibold">COMPLETED:</span>
          <span className={`font-bold ${themeStyle.tallyHighlight}`}>{dailyStats.completedPomodoros} POMOS</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold">FOCUS:</span>
          <span className={`font-bold ${themeStyle.tallyHighlight}`}>
            {Math.floor(dailyStats.totalFocusMinutes / 60)}H {dailyStats.totalFocusMinutes % 60}M
          </span>
        </span>
      </div>
    </div>
  );
};
