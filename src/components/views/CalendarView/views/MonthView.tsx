import React from "react";
import { CalendarItemDisplay } from "../types";
import {
  DAYS_OF_WEEK_SHORT,
  formatDateISO,
  isEventOccurringOnDate,
} from "../../../../utils/calendarFormatters";

export interface MonthViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onSelectDay: (d: Date) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  date,
  items,
  todayISO,
  onSelectDay,
  onEventClick,
}) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const prevMonthDays = new Date(year, month, 0).getDate();
  const leadingDays = Array.from({ length: startDayOfWeek }, (_, i) => {
    const dayNum = prevMonthDays - startDayOfWeek + i + 1;
    const d = new Date(year, month - 1, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: false };
  });

  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => {
    const dayNum = i + 1;
    const d = new Date(year, month, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: true };
  });

  const totalCellsSoFar = leadingDays.length + currentMonthDays.length;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const trailingDays = Array.from({ length: targetTotal - totalCellsSoFar }, (_, i) => {
    const dayNum = i + 1;
    const d = new Date(year, month + 1, dayNum);
    return { date: d, iso: formatDateISO(d), dayNum, isCurrentMonth: false };
  });

  const allMonthCells = [...leadingDays, ...currentMonthDays, ...trailingDays];

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* Day header row */}
      <div className="grid grid-cols-7 border-b border-cyan-500/20 bg-[#050b14]/70 text-center py-1.5 text-[10px] font-tech text-cyan-500/70">
        {DAYS_OF_WEEK_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Month 7x5 or 7x6 Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 border-b border-cyan-500/15">
        {allMonthCells.map((cell) => {
          const isToday = cell.iso === todayISO;
          const dayItems = items.filter((it) =>
            isEventOccurringOnDate(it.date, cell.iso, it.originalEvent?.recurrence)
          );
          const visibleItems = dayItems.slice(0, 2);
          const moreCount = dayItems.length - visibleItems.length;

          return (
            <div
              key={cell.iso}
              onClick={() => onSelectDay(cell.date)}
              className={`border-r border-b border-cyan-500/10 p-1 flex flex-col justify-start transition cursor-pointer hover:bg-cyan-500/10 ${
                cell.isCurrentMonth ? "bg-[#03070d]" : "bg-[#020509]/80 opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-tech rounded-full px-1.5 py-0.5 ${
                    isToday
                      ? "bg-amber-400 text-black font-bold shadow-[0_0_8px_#ffb300]"
                      : "text-cyan-300/80"
                  }`}
                >
                  {cell.dayNum}
                </span>
                {dayItems.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_4px_#00e5ff]" />
                )}
              </div>

              <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                {visibleItems.map((it) => (
                  <div
                    key={it.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(it);
                    }}
                    style={{ borderLeftColor: it.color || "#00e5ff" }}
                    className="px-1 py-0.5 rounded bg-[#071322] border-l-2 text-[9px] font-tech text-cyan-100 truncate cursor-pointer hover:bg-cyan-900/40"
                  >
                    {it.title}
                  </div>
                ))}
                {moreCount > 0 && (
                  <span className="text-[8.5px] font-mono text-cyan-400/60 pl-1">
                    +{moreCount} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
