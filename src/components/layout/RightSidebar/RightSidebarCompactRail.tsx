import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Check, Menu, Settings, Palette, Puzzle, LogOut, Square } from "lucide-react";
import { usePomodoro } from "../../../stores/pomodoroStore";
import { exitApp, setDockPopoutMode } from "../../../services/tauriBridge";
import { useTheme } from "../../../stores/themeStore";

interface RightSidebarCompactRailProps {
  onExpand?: () => void;
  onMaximizePanes?: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export const RightSidebarCompactRail: React.FC<RightSidebarCompactRailProps> = ({
  onOpenSettings,
}) => {
  const { themeConfig } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMenuOpenRef = useRef(isMenuOpen);
  isMenuOpenRef.current = isMenuOpen;
  const menuOpenedAtRef = useRef<number>(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    isMenuOpenRef.current = isMenuOpen;
    setDockPopoutMode("right", isMenuOpen);

    if (!isMenuOpen) return;

    menuOpenedAtRef.current = Date.now();

    const handleClickOutside = (e: MouseEvent) => {
      // Prevent outside-click dismissal during opening click phase
      if (Date.now() - menuOpenedAtRef.current < 100) {
        return;
      }
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuBtnRef.current?.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    const handleBlur = () => {
      // Ignore blur events that occur during opening focus shifts / dock popout geometry updates
      if (Date.now() - menuOpenedAtRef.current < 250) {
        return;
      }
      setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      setDockPopoutMode("right", false);
    };
  }, [isMenuOpen]);

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
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Mini gauge calculations
  const accent = themeConfig?.accentColor || "#ff9100";
  const isLightOrPink = themeConfig?.category === "light";
  const timerTextColor = isLightOrPink ? "var(--hud-text-primary)" : "#ffffff";

  const radius = 17;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="h-full w-full flex flex-col justify-between items-center overflow-hidden select-none">
      {/* 1. Top Pinned Status Header */}
      <div className="shrink-0 w-full flex flex-col relative">
        {/* Row 1: Status Ping & Hamburger Menu where escape symbol was (h-7, px-1) */}
        <div className="border-b border-amber-500/20 pb-1 mb-1">
          <div className="w-full flex items-center justify-between h-7 px-1 text-amber-500/60">
            <div className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isRunning ? "animate-ping shadow-sm" : "bg-neutral-600"
                  }`}
                style={{
                  backgroundColor: isRunning ? accent : undefined,
                  boxShadow: isRunning ? `0 0 6px ${accent}` : undefined,
                }}
                title={isRunning ? "Timer Active" : "Timer Standby"}
              />
            </div>
            {/* Hamburger Menu replacing the escape symbol */}
            <button
              ref={menuBtnRef}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="System Menu"
              aria-label="System Menu"
              aria-expanded={isMenuOpen}
              className="text-amber-400/80 hover:text-amber-200 hover:scale-110 transition p-1 cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Floating Hamburger Dropdown Menu in Compact Rail (Spills left into the center pane) */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute top-1 right-[calc(100%+20px)] w-52 bg-[#040d1a]/95 backdrop-blur-md border border-amber-500/40 rounded-lg shadow-[0_0_20px_rgba(255,179,0,0.25)] z-50 p-1.5 flex flex-col gap-1 font-hud text-xs animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-label="System Menu"
          >
            {/* Pointing notch back to sidebar */}
            <div className="absolute -right-1.5 top-3 w-2.5 h-2.5 bg-[#040d1a] rotate-45 border-r border-t border-amber-500/50" />
            <div className="px-2.5 py-1 text-[9px] font-tech text-amber-400/60 uppercase tracking-widest border-b border-amber-500/20">
              SYSTEM MENU
            </div>

            {/* 1. Settings */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenSettings) onOpenSettings("all");
              }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 transition-all text-left cursor-pointer"
              role="menuitem"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold tracking-wider">SETTINGS</span>
                <span className="text-[9px] font-tech text-amber-400/70">Preferences & Panes</span>
              </div>
            </button>

            {/* 2. Themes */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenSettings) onOpenSettings("appearance");
              }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 transition-all text-left cursor-pointer"
              role="menuitem"
            >
              <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold tracking-wider">THEMES</span>
                <span className="text-[9px] font-tech text-amber-400/70">
                  {themeConfig?.name || "Cyber HUD"} (Active)
                </span>
              </div>
            </button>

            {/* 3. Extensions */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 transition-all text-left cursor-pointer"
              role="menuitem"
            >
              <Puzzle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold tracking-wider">EXTENSIONS</span>
                <span className="text-[9px] font-tech text-amber-400/70">Plugins & Integrations</span>
              </div>
            </button>

            <div className="my-0.5 border-t border-amber-500/20" />

            {/* 4. Log out */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                exitApp();
              }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-red-400/80 hover:text-red-300 hover:bg-red-500/15 transition-all text-left cursor-pointer"
              role="menuitem"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold tracking-wider">LOG OUT</span>
                <span className="text-[9px] font-tech text-red-400/60">Lock HUD & Exit</span>
              </div>
            </button>
          </div>
        )}
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
              stroke={accent}
              strokeOpacity={0.18}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Active Glow Ring */}
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

          {/* Centered Monospace Time (Short Form) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-tech text-[10px] font-bold tracking-tighter"
              style={{ color: timerTextColor }}
            >
              {minutes}m
            </span>
          </div>
        </div>

        {/* Precise MM:SS text */}
        <div
          className="text-[11px] font-tech font-bold tracking-tight mt-1"
          style={{ color: timerTextColor }}
        >
          {timeFormatted}
        </div>
      </div>

      {/* 3. Centered Action Controls */}
      <div className="flex flex-col items-center gap-1.5 w-full shrink-0">
        {isRunning ? (
          <>
            <button
              onClick={toggleRun}
              title="Pause Timer"
              aria-label="Pause Timer"
              className="hud-btn w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all hud-btn-active border-amber-400 bg-amber-500/25 shadow-[0_0_12px_rgba(255,145,0,0.4)] text-amber-100"
            >
              <Pause className="w-4 h-4" />
            </button>

            <button
              onClick={stop}
              title="Cancel Timer"
              aria-label="Cancel Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all border-red-500/30 text-red-400/70 hover:text-red-200 hover:border-red-400"
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
              className="hud-btn w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/40 text-amber-300 hover:text-amber-100 hover:border-amber-400"
            >
              <Play className="w-4 h-4 ml-0.5" />
            </button>

            <button
              onClick={reset}
              title="Reset Timer"
              aria-label="Reset Timer"
              className="hud-btn w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all border-amber-500/30 text-amber-400/70 hover:text-amber-200 hover:border-amber-400"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </>
        )}
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
                className={`w-1.5 h-1.5 rotate-45 transition-all ${isDone
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

      {/* 5. Bottom Pinned Telemetry */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1 border-t border-amber-500/20 pt-1.5 pb-0.5">
        <div
          className="flex items-center gap-0.5 text-[8.5px] font-tech text-amber-300/90"
          title={`Completed today: ${dailyStats.completedPomodoros} sessions (${dailyStats.totalFocusMinutes}m)`}
        >
          <Check className="w-2.5 h-2.5 text-amber-400" />
          <span>{dailyStats.completedPomodoros}</span>
        </div>
      </div>
    </div>
  );
};
