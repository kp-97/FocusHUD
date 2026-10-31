import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { CalendarItemDisplay } from "../types";
import {
  DAYS_OF_WEEK_SHORT,
  formatDateISO,
  getMondayOfWeek,
  formatTime12,
  isEventOccurringOnDate,
} from "../../../../utils/calendarFormatters";

export interface ScheduleViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  todayISO: string;
  onEventClick: (item: CalendarItemDisplay) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  date,
  items,
  todayISO,
  onEventClick,
}) => {
  const monday = getMondayOfWeek(date);
  const daysFeed = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatDateISO(d);
    return {
      date: d,
      iso,
      dayName: DAYS_OF_WEEK_SHORT[(d.getDay() + 6) % 7],
      fullDateLabel: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      isToday: iso === todayISO,
      items: items.filter((it) =>
        isEventOccurringOnDate(it.date, iso, it.originalEvent?.recurrence)
      ),
    };
  });

  const activeDays = daysFeed.filter((d) => d.items.length > 0 || d.isToday);

  return (
    <div className="h-full w-full overflow-y-auto p-4 bg-[#03070d]">
      {activeDays.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-cyan-500/50 font-tech">
          <CalendarIcon className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
          <p className="text-sm">No scheduled events or tasks in this period</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {activeDays.map((d) => (
            <div
              key={d.iso}
              className={`p-3 rounded-lg border transition ${
                d.isToday
                  ? "border-amber-400/40 bg-amber-950/10 shadow-[0_0_12px_rgba(255,179,0,0.1)]"
                  : "border-cyan-500/20 bg-[#050b14]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-cyan-500/15">
                <span
                  className={`text-xs font-orbitron font-bold tracking-wider ${
                    d.isToday ? "text-amber-300" : "text-cyan-200"
                  }`}
                >
                  {d.fullDateLabel}
                </span>
                {d.isToday && (
                  <span className="text-[9px] font-tech uppercase px-1.5 py-0.2 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200">
                    TODAY
                  </span>
                )}
              </div>

              {d.items.length === 0 ? (
                <p className="text-[11px] font-tech text-cyan-500/40 italic">
                  No scheduled items for this date
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {d.items.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => onEventClick(it)}
                      style={{ borderLeftColor: it.color || "#00e5ff" }}
                      className="px-2.5 py-1.5 rounded bg-[#071322] border-l-2 flex items-center justify-between text-xs font-tech text-cyan-100 shadow-[0_0_6px_rgba(0,229,255,0.1)] hover:bg-cyan-900/30 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {it.isTask && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              it.completed ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                        )}
                        <span className="truncate">{it.title}</span>
                      </div>
                      {it.startTime && (
                        <span className="text-[10px] font-mono text-cyan-400/60 ml-3 shrink-0">
                          {formatTime12(it.startTime)}
                          {it.endTime ? ` - ${formatTime12(it.endTime)}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

