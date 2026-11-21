import React from "react";

export interface CustomRecurrenceConfig {
  interval: number;
  unit: "day" | "week" | "month" | "year";
  daysOfWeek: number[]; // 0 = Mon, 6 = Sun
  endType: "never" | "on" | "after";
  endDate?: string;
  occurrences?: number;
}

const DAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

export interface EventCustomRecurrenceModalProps {
  isOpen: boolean;
  interval: number;
  unit: "day" | "week" | "month" | "year";
  daysOfWeek: number[];
  endType: "never" | "on" | "after";
  endDate: string;
  occurrences: number;
  onChangeInterval: (val: number) => void;
  onChangeUnit: (val: "day" | "week" | "month" | "year") => void;
  onToggleDay: (dayIdx: number) => void;
  onChangeEndType: (val: "never" | "on" | "after") => void;
  onChangeEndDate: (val: string) => void;
  onChangeOccurrences: (val: number) => void;
  onCancel: () => void;
  onDone: () => void;
}

export const EventCustomRecurrenceModal: React.FC<EventCustomRecurrenceModalProps> = ({
  isOpen,
  interval,
  unit,
  daysOfWeek,
  endType,
  endDate,
  occurrences,
  onChangeInterval,
  onChangeUnit,
  onToggleDay,
  onChangeEndType,
  onChangeEndDate,
  onChangeOccurrences,
  onCancel,
  onDone,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="custom-recurrence-overlay"
      className="absolute inset-0 z-50 rounded-xl bg-[#071322] border border-cyan-400/60 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.9)] flex flex-col justify-between font-hud"
    >
      <div>
        <h2 className="text-sm font-semibold text-cyan-100 mb-4 tracking-wide">
          Custom recurrence
        </h2>

        {/* Repeat every N [unit] */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span>Repeat every</span>
          <input
            type="number"
            min={1}
            max={99}
            data-testid="custom-interval-input"
            value={interval}
            onChange={(e) => onChangeInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-12 bg-[#03070d] border border-cyan-500/40 rounded px-2 py-1 text-center text-cyan-100"
          />
          <select
            data-testid="custom-unit-select"
            value={unit}
            onChange={(e) => onChangeUnit(e.target.value as any)}
            className="bg-[#03070d] border border-cyan-500/40 rounded px-2 py-1 text-cyan-200 outline-none"
          >
            <option value="day">day{interval > 1 ? "s" : ""}</option>
            <option value="week">week{interval > 1 ? "s" : ""}</option>
            <option value="month">month{interval > 1 ? "s" : ""}</option>
            <option value="year">year{interval > 1 ? "s" : ""}</option>
          </select>
        </div>

        {/* Repeat on (days of week) when unit is week */}
        {unit === "week" && (
          <div className="mb-4">
            <span className="block text-xs text-cyan-400/80 mb-2">Repeat on</span>
            <div className="flex items-center gap-1.5">
              {DAYS_SHORT.map((dayLabel, idx) => {
                const isSelected = daysOfWeek.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onToggleDay(idx)}
                    data-testid={`custom-day-${idx}`}
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500 text-black shadow-[0_0_8px_#00e5ff]"
                        : "bg-[#03070d] text-cyan-400/60 border border-cyan-500/20 hover:text-cyan-200"
                    }`}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ends configuration */}
        <div className="flex flex-col gap-2.5 text-xs">
          <span className="text-cyan-400/80">Ends</span>

          {/* Never */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === "never"}
              onChange={() => onChangeEndType("never")}
              className="text-cyan-500 focus:ring-0 bg-[#03070d]"
            />
            <span>Never</span>
          </label>

          {/* On [Date] */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === "on"}
              onChange={() => onChangeEndType("on")}
              className="text-cyan-500 focus:ring-0 bg-[#03070d]"
            />
            <span>On</span>
            <input
              type="date"
              disabled={endType !== "on"}
              value={endDate}
              onChange={(e) => onChangeEndDate(e.target.value)}
              className="bg-[#03070d] border border-cyan-500/30 rounded px-2 py-0.5 text-cyan-200 outline-none disabled:opacity-40"
            />
          </label>

          {/* After N occurrences */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={endType === "after"}
              onChange={() => onChangeEndType("after")}
              className="text-cyan-500 focus:ring-0 bg-[#03070d]"
            />
            <span>After</span>
            <input
              type="number"
              min={1}
              max={999}
              disabled={endType !== "after"}
              value={occurrences}
              onChange={(e) => onChangeOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-14 bg-[#03070d] border border-cyan-500/30 rounded px-2 py-0.5 text-center text-cyan-200 outline-none disabled:opacity-40"
            />
            <span>occurrences</span>
          </label>
        </div>
      </div>

      {/* Modal Bottom Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-cyan-500/20">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 rounded-full text-xs text-cyan-400/80 hover:text-cyan-100 hover:bg-cyan-500/10 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDone}
          data-testid="custom-recurrence-done-btn"
          className="px-4 py-1 rounded-full text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.4)] transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};

