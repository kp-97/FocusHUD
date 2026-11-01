import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  CheckCircle2,
} from "lucide-react";
import {
  CalendarMode,
  CALENDAR_MODES,
} from "../../../utils/calendarFormatters";

export interface CalendarHeaderProps {
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  headerTitle: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  showEvents: boolean;
  setShowEvents: React.Dispatch<React.SetStateAction<boolean>>;
  showTasks: boolean;
  setShowTasks: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  mode,
  setMode,
  headerTitle,
  onToday,
  onPrev,
  onNext,
  showEvents,
  setShowEvents,
  showTasks,
  setShowTasks,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeModeOption = CALENDAR_MODES.find((m) => m.id === mode) || CALENDAR_MODES[1];

  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-3 border-b border-cyan-500/20 bg-[#050b14] relative z-40">
      {/* Left Navigation Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToday}
          data-testid="today-button"
          className="rounded-full px-3.5 py-1 text-xs font-medium border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/15 hover:border-cyan-400/50 transition cursor-pointer"
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            title="Previous"
            data-testid="prev-button"
            className="p-1 rounded-full text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNext}
            title="Next"
            data-testid="next-button"
            className="p-1 rounded-full text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <h1
          data-testid="calendar-header-title"
          className="text-base font-orbitron font-medium text-cyan-100 tracking-wide select-text ml-1"
        >
          {headerTitle}
        </h1>
      </div>

      {/* Right Controls: Mode Dropdown + Independent Events/Tasks Toggles */}
      <div className="flex items-center gap-2 relative z-50">
        {/* View Mode Switcher Dropdown */}
        <div className="relative z-50" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            data-testid="mode-dropdown-button"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-cyan-500/30 text-cyan-200 bg-[#050b14] hover:bg-cyan-500/15 hover:border-cyan-400/50 transition cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.05)]"
          >
            <span>{activeModeOption.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70" />
          </button>

          {isDropdownOpen && (
            <div
              data-testid="mode-dropdown-menu"
              className="absolute right-0 mt-1.5 w-44 rounded-lg bg-[#071322] border border-cyan-500/30 shadow-[0_8px_24px_rgba(0,0,0,0.7)] backdrop-blur py-1 z-50 text-xs font-tech"
            >
              {CALENDAR_MODES.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMode(opt.id);
                    setIsDropdownOpen(false);
                  }}
                  data-testid={`mode-option-${opt.id}`}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition cursor-pointer ${
                    mode === opt.id
                      ? "bg-cyan-500/25 text-cyan-100 font-semibold border-l-2 border-cyan-400"
                      : "text-cyan-300/80 hover:bg-cyan-500/15 hover:text-cyan-100"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] font-mono text-cyan-400/60 uppercase">
                    {opt.shortcutKey}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Independent Events & Tasks Toggle Buttons */}
        <div data-testid="data-type-toggle" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEvents((v) => !v)}
            title={showEvents ? "Hide Events" : "Show Events"}
            data-testid="toggle-events-button"
            className={`p-1.5 rounded-full border transition cursor-pointer ${
              showEvents
                ? "bg-cyan-600/30 text-cyan-100 border-cyan-400/50 shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                : "bg-[#050b14] text-cyan-500/40 border-cyan-500/20 hover:text-cyan-400/70"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowTasks((v) => !v)}
            title={showTasks ? "Hide Tasks" : "Show Tasks"}
            data-testid="toggle-tasks-button"
            className={`p-1.5 rounded-full border transition cursor-pointer ${
              showTasks
                ? "bg-cyan-600/30 text-cyan-100 border-cyan-400/50 shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                : "bg-[#050b14] text-cyan-500/40 border-cyan-500/20 hover:text-cyan-400/70"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

