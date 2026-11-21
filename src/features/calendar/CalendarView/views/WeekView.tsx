import React, { useState } from "react";
import { CalendarItemDisplay } from "../types";
import { HOURS, HOUR_HEIGHT } from "../constants";
import {
  DAYS_OF_WEEK_SHORT,
  formatDateISO,
  getMondayOfWeek,
  formatHour12,
  formatTime12,
  isEventOccurringOnDate,
  calculateEventPosition,
} from "../../../../utils/calendarFormatters";

export interface WeekViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  hourHeight?: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  timeIndicatorTop: number;
  todayISO: string;
  onSelectDay: (d: Date) => void;
  onSlotClick: (dateISO: string, hour: number, minute?: number) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  date,
  items,
  hourHeight = HOUR_HEIGHT,
  scrollRef,
  timeIndicatorTop,
  todayISO,
  onSelectDay,
  onSlotClick,
  onEventClick,
}) => {
  const monday = getMondayOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatDateISO(d);
    return {
      date: d,
      iso,
      dayName: DAYS_OF_WEEK_SHORT[i],
      dateNum: d.getDate(),
      isToday: iso === todayISO,
    };
  });
  const [hoveredQuarter, setHoveredQuarter] = useState<{
    iso: string;
    dayIndex: number;
    hour: number;
    minute: number;
  } | null>(null);

  return (
    <div
      ref={scrollRef}
      className="h-full w-full flex flex-col bg-[#03070d] overflow-auto relative"
    >
      <div className="min-w-[560px] flex-1 flex flex-col relative">
        {/* 7-Day Header */}
        <div
          data-testid="week-days-header"
          className="sticky top-0 z-30 h-12 shrink-0 flex border-b border-cyan-500/20 bg-[#050b14] shadow-sm"
        >
          <div className="w-16 shrink-0 bg-[#050b14]" />
          {weekDays.map((wd) => (
            <button
              key={wd.iso}
              onClick={() => onSelectDay(wd.date)}
              className={`flex-1 flex flex-col items-center justify-center border-l border-cyan-500/15 transition cursor-pointer hover:bg-cyan-500/10 ${
                wd.isToday ? "bg-amber-950/20" : ""
              }`}
            >
              <span className="text-[9px] font-tech text-cyan-500/60 uppercase">{wd.dayName}</span>
              <span
                className={`text-xs font-semibold ${
                  wd.isToday
                    ? "w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold shadow-[0_0_8px_#ffb300]"
                    : "text-cyan-200"
                }`}
              >
                {wd.dateNum}
              </span>
            </button>
          ))}
        </div>

        {/* Timetable grid */}
        <div
          onMouseLeave={() => setHoveredQuarter(null)}
          className="flex-1 relative"
        >
          <div className="relative w-full" style={{ height: HOURS.length * hourHeight }}>
            {/* Current time line across today */}
            {weekDays.some((w) => w.isToday) && (
              <div
                className="absolute left-16 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: timeIndicatorTop }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ff5252] -ml-1" />
                <div className="flex-1 h-[2px] bg-red-400 shadow-[0_0_6px_#ff5252]" />
              </div>
            )}

            {HOURS.map((hour) => {
              const time12Label = formatHour12(hour);

              return (
                <div
                  key={hour}
                  className="flex border-b border-cyan-500/20 transition"
                  style={{ height: hourHeight }}
                >
                  <div className="w-16 shrink-0 text-[10px] text-cyan-400 font-mono text-center pt-1 select-none font-semibold">
                    {time12Label}
                  </div>
                  {weekDays.map((wd, dayIdx) => {
                    return (
                      <div
                        key={wd.iso}
                        data-testid={`week-slot-${wd.iso}-${hour}`}
                        className="flex-1 border-l border-cyan-500/20 relative overflow-hidden group/cell"
                      >
                        {/* 4 x 15-minute hover hit areas */}
                        <div className="absolute inset-0 grid grid-rows-4 z-10">
                          {[0, 15, 30, 45].map((minute) => (
                            <div
                              key={minute}
                              onMouseEnter={() =>
                                setHoveredQuarter({
                                  iso: wd.iso,
                                  dayIndex: dayIdx,
                                  hour,
                                  minute,
                                })
                              }
                              onClick={() => onSlotClick(wd.iso, hour, minute)}
                              title={`${formatTime12(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)} - Click to add 1-hour event`}
                              data-testid={`week-quarter-${wd.iso}-${hour}-${minute}`}
                              className="transition cursor-pointer"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Rendered Event Chips positioned precisely by start and end minute in each day column */}
            {weekDays.map((wd, dayIdx) => {
              const dayEvents = items.filter((it) =>
                isEventOccurringOnDate(it.date, wd.iso, it.originalEvent?.recurrence)
              );

              return (
                <div
                  key={`events-col-${wd.iso}`}
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{
                    left: `calc(4rem + ${dayIdx} * ((100% - 4rem) / 7))`,
                    width: `calc((100% - 4rem) / 7)`,
                  }}
                >
                  {/* 1-Hour Dynamic Hover Preview Block in this column */}
                  {hoveredQuarter && hoveredQuarter.iso === wd.iso && (
                    <div
                      data-testid="week-hover-preview"
                      className="absolute left-0 right-0 z-5 pointer-events-none rounded border border-cyan-400/20 bg-cyan-500/8 transition-[top,height] duration-75 ease-out will-change-[top,height]"
                      style={{
                        top: `${hoveredQuarter.hour * hourHeight + (hoveredQuarter.minute / 60) * hourHeight}px`,
                        height: `${Math.min(
                          hourHeight,
                          HOURS.length * hourHeight -
                            (hoveredQuarter.hour * hourHeight + (hoveredQuarter.minute / 60) * hourHeight)
                        )}px`,
                      }}
                    />
                  )}

                  {dayEvents.map((item) => {
                    const { top, height } = calculateEventPosition(
                      item.startTime,
                      item.endTime,
                      hourHeight
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(item);
                        }}
                        data-testid={`event-item-${item.id}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          borderLeftColor: item.color || "#00e5ff",
                        }}
                        className="absolute left-0.5 right-4 pointer-events-auto px-1 py-0.5 rounded bg-[#071322]/95 border-l-2 text-[10px] font-tech text-cyan-100 flex flex-col justify-start shadow-[0_0_6px_rgba(0,229,255,0.15)] hover:bg-cyan-900/50 hover:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition overflow-hidden cursor-pointer"
                      >
                        <span className="truncate font-medium">{item.title}</span>
                        {item.startTime && height >= 28 && (
                          <span className="text-[9px] font-mono text-cyan-400/80 truncate">
                            {formatTime12(item.startTime)}
                          </span>
                        )}
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
  );
};

