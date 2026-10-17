import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { loadEvents, getTodayString } from "../../utils/store";
import { CalendarEvent } from "../../types/hud";

const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 to 22:00

export const CalendarView: React.FC = () => {
  const [events] = useState<CalendarEvent[]>(loadEvents);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());

  // Week offset relative to current week
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // Month Grid Calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString("default", { month: "short" }).toUpperCase();

  // Week Grid Calculation (Monday to Sunday)
  const getWeekDates = (offsetWeeks: number) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday
    // Distance to Monday (if Sunday = 0, distance is -6; else 1 - day)
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + offsetWeeks * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      return {
        dayName: DAYS_OF_WEEK[i],
        dateNum: d.getDate(),
        isoString: iso,
        isToday: iso === getTodayString(),
      };
    });
  };

  const weekDays = getWeekDates(weekOffset);
  const weekRangeLabel = `${weekDays[0].dateNum} ${monthName} - ${weekDays[6].dateNum} ${monthName}`;

  return (
    <div className="h-full w-full flex flex-col p-2 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none gap-2">
      {/* ================= TOP HALF: MONTH VIEW ================= */}
      <div className="flex-1 min-h-[190px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 p-2 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]">
        {/* Month Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-orbitron font-bold text-cyan-200 tracking-wider">
              {monthName} {year}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              title="Previous Month"
              className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-[9px] font-tech uppercase px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
            >
              TODAY
            </button>
            <button
              onClick={nextMonth}
              title="Next Month"
              className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-100 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 text-center text-[9px] font-tech text-cyan-500/70 pb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className={i === 0 || i === 6 ? "text-cyan-400/40" : ""}>
              {d}
            </span>
          ))}
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-1 flex-1 text-center font-tech text-[10px]">
          {/* Blank cells for offset */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="p-1 opacity-20" />
          ))}

          {/* Month Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const isToday = iso === getTodayString();
            const isSelected = iso === selectedDate;
            const hasEvents = events.some((e) => e.date === iso);

            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`p-1 rounded flex flex-col items-center justify-center relative transition cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/30 border border-cyan-400 text-cyan-100 shadow-[0_0_8px_#00e5ff]"
                    : isToday
                    ? "border border-amber-400/60 text-amber-200"
                    : "hover:bg-cyan-950/40 text-cyan-300/80"
                }`}
              >
                <span>{dayNum}</span>
                {hasEvents && (
                  <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_4px_#00e5ff] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= BOTTOM HALF: WEEK VIEW ================= */}
      {/* Scrolled horizontally from left to right to see Monday to Sunday; hours vertical axis */}
      <div className="flex-1 min-h-[220px] flex flex-col rounded bg-[#050b14] border border-cyan-500/30 p-2 overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.08)]">
        {/* Week View Header & Arrows */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-orbitron font-bold text-amber-200 tracking-wider">
              WEEK: {weekRangeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              title="Previous Week"
              className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[9px] font-tech uppercase px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
            >
              CURRENT
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              title="Next Week"
              className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-100 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Week Timetable: Horizontal scroll from Monday to Sunday */}
        <div className="flex-1 overflow-x-auto overflow-y-auto pr-1">
          <div className="min-w-[420px] flex flex-col">
            {/* Days Header Row (Mon to Sun) */}
            <div className="flex border-b border-cyan-500/30 pb-1">
              <div className="w-12 shrink-0 text-[9px] font-tech text-cyan-500/60 uppercase text-center">
                TIME
              </div>
              {weekDays.map((wd) => (
                <div
                  key={wd.isoString}
                  className={`flex-1 text-center py-0.5 rounded text-[9.5px] font-tech uppercase tracking-wider mx-0.5 ${
                    wd.isToday
                      ? "bg-amber-950/40 border border-amber-400/50 text-amber-200 font-bold"
                      : "text-cyan-300/80"
                  }`}
                >
                  <div>{wd.dayName}</div>
                  <div className="text-[8.5px] text-cyan-400/60">{wd.dateNum}</div>
                </div>
              ))}
            </div>

            {/* Hourly Grid Rows */}
            <div className="flex flex-col divide-y divide-cyan-500/10 text-xs font-tech">
              {HOURS.map((hour) => {
                const timeLabel = `${String(hour).padStart(2, "0")}:00`;

                return (
                  <div key={hour} className="flex min-h-[32px] items-center hover:bg-cyan-950/20 transition">
                    {/* Vertical axis: Time */}
                    <div className="w-12 shrink-0 text-[9px] text-cyan-500/60 text-center font-mono select-none">
                      {timeLabel}
                    </div>

                    {/* Horizontal axis: Monday to Sunday Slots */}
                    {weekDays.map((wd) => {
                      const dayEvents = events.filter(
                        (e) => e.date === wd.isoString && parseInt(e.startTime.split(":")[0], 10) === hour
                      );

                      return (
                        <div
                          key={wd.isoString}
                          className="flex-1 min-h-[30px] border-l border-cyan-500/10 px-1 py-0.5 flex flex-col justify-center relative group"
                        >
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              style={{ borderLeftColor: ev.color || "#00e5ff" }}
                              className="w-full text-[8.5px] font-tech leading-tight px-1 py-0.5 rounded bg-cyan-950/60 border-l-2 border-cyan-400 text-cyan-100 truncate shadow-[0_0_6px_rgba(0,229,255,0.2)]"
                            >
                              {ev.title}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
