import React from "react";
import { CalendarItemDisplay } from "../types";
import {
  formatDateISO,
  isEventOccurringOnDate,
} from "../../../../utils/calendarFormatters";

export interface YearViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onSelectDay: (d: Date) => void;
}

export const YearView: React.FC<YearViewProps> = ({
  date,
  items,
  todayISO,
  onSelectDay,
}) => {
  const year = date.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="h-full w-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-[#03070d]">
      {months.map((m) => {
        const firstDay = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const startDayOfWeek = (firstDay.getDay() + 6) % 7;
        const monthName = firstDay.toLocaleString("en-US", { month: "short" });

        return (
          <div
            key={m}
            className="p-2.5 rounded-lg border border-cyan-500/20 bg-[#050b14] flex flex-col shadow-[0_0_12px_rgba(0,229,255,0.05)]"
          >
            <div className="text-xs font-orbitron font-bold text-cyan-200 mb-1.5 uppercase tracking-wider">
              {monthName}
            </div>

            <div className="grid grid-cols-7 text-center text-[8px] font-tech text-cyan-500/50 pb-1 border-b border-cyan-500/10">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-tech mt-1">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="p-0.5" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const d = new Date(year, m, dayNum);
                const iso = formatDateISO(d);
                const isToday = iso === todayISO;
                const hasItems = items.some((it) =>
                  isEventOccurringOnDate(it.date, iso, it.originalEvent?.recurrence)
                );

                return (
                  <button
                    key={iso}
                    onClick={() => onSelectDay(d)}
                    className={`p-0.5 rounded flex flex-col items-center justify-center transition cursor-pointer hover:bg-cyan-500/20 ${
                      isToday
                        ? "bg-amber-400 text-black font-bold"
                        : hasItems
                        ? "text-cyan-100 font-medium"
                        : "text-cyan-400/60"
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasItems && !isToday && (
                      <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5 shadow-[0_0_3px_#00e5ff]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
