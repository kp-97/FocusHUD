import React, { useState } from "react";
import { CalendarItemDisplay } from "../types";
import { HOURS, HOUR_HEIGHT } from "../constants";
import {
  DAYS_OF_WEEK_SHORT,
  formatDateISO,
  formatHour12,
  formatTime12,
  isEventOccurringOnDate,
  calculateEventPosition,
} from "../../../../utils/calendarFormatters";

export interface DayViewProps {
  date: Date;
  items: CalendarItemDisplay[];
  hourHeight?: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  timeIndicatorTop: number;
  todayISO: string;
  onSlotClick: (dateISO: string, hour: number, minute?: number) => void;
  onEventClick: (item: CalendarItemDisplay) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  date,
  items,
  hourHeight = HOUR_HEIGHT,
  scrollRef,
  timeIndicatorTop,
  todayISO,
  onSlotClick,
  onEventClick,
}) => {
  const dateISO = formatDateISO(date);
  const isToday = dateISO === todayISO;
  const dayItems = items.filter((item) =>
    isEventOccurringOnDate(item.date, dateISO, item.originalEvent?.recurrence)
  );
  const [hoveredQuarter, setHoveredQuarter] = useState<{ hour: number; minute: number } | null>(
    null
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#03070d]">
      {/* Day header banner */}
      <div className="h-10 shrink-0 flex items-center px-4 border-b border-cyan-500/20 bg-[#050b14]/60 text-xs font-tech">
        <span className="text-cyan-500/70 uppercase">
          {DAYS_OF_WEEK_SHORT[(date.getDay() + 6) % 7]}
        </span>
        <span
          className={`ml-2 text-sm font-bold ${
            isToday ? "text-amber-300 font-orbitron" : "text-cyan-200"
          }`}
        >
          {date.getDate()}
        </span>
      </div>

      {/* 24-hour Timetable (12H labels + 15m increments) */}
      <div
        ref={scrollRef}
        onMouseLeave={() => setHoveredQuarter(null)}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        <div className="relative min-w-[320px]" style={{ height: HOURS.length * hourHeight }}>
          {/* Current time line */}
          {isToday && (
            <div
              className="absolute left-16 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: timeIndicatorTop }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ff5252] -ml-1" />
              <div className="flex-1 h-[2px] bg-red-400 shadow-[0_0_6px_#ff5252]" />
            </div>
          )}

          {/* 1-Hour Dynamic Hover Preview Block (lights up 4 x 15m intervals) */}
          {hoveredQuarter && (
            <div
              data-testid="day-hover-preview"
              className="absolute left-16 right-0 z-5 pointer-events-none rounded border border-cyan-400/20 bg-cyan-500/8 transition-[top,height] duration-75 ease-out will-change-[top,height]"
              style={{
                top: hoveredQuarter.hour * hourHeight + (hoveredQuarter.minute / 60) * hourHeight,
                height: Math.min(
                  hourHeight,
                  HOURS.length * hourHeight -
                    (hoveredQuarter.hour * hourHeight + (hoveredQuarter.minute / 60) * hourHeight)
                ),
              }}
            />
          )}

          {/* Hourly Slots Grid Background */}
          {HOURS.map((hour) => {
            const time12Label = formatHour12(hour);

            return (
              <div
                key={hour}
                data-testid={`day-slot-${hour}`}
                className="flex border-b border-cyan-500/20 transition relative group"
                style={{ height: hourHeight }}
              >
                <div className="w-16 shrink-0 text-[10px] text-cyan-400 font-mono text-center pt-1 select-none font-semibold">
                  {time12Label}
                </div>

                {/* 15-minute hover/click increments container */}
                <div className="flex-1 border-l border-cyan-500/20 relative">
                  {/* 4 x 15-minute hover zones */}
                  <div className="absolute inset-0 grid grid-rows-4 z-0">
                    {[0, 15, 30, 45].map((minute) => (
                      <div
                        key={minute}
                        onMouseEnter={() => setHoveredQuarter({ hour, minute })}
                        onClick={() => onSlotClick(dateISO, hour, minute)}
                        title={`${formatTime12(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)} - Click to add 1-hour event`}
                        data-testid={`day-quarter-${hour}-${minute}`}
                        className="transition cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Rendered Event Chips positioned precisely by start and end minute */}
          <div className="absolute left-16 right-0 top-0 bottom-0 pointer-events-none z-10 p-1">
            {dayItems.map((item) => {
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
                  className="absolute left-1 right-6 pointer-events-auto px-2 py-1 rounded bg-[#071322]/95 border-l-2 text-xs font-tech text-cyan-100 flex flex-col justify-start gap-0.5 shadow-[0_0_8px_rgba(0,229,255,0.15)] hover:bg-cyan-900/50 hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] transition overflow-hidden cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{item.title}</span>
                    {item.startTime && (
                      <span className="text-[10px] font-mono text-cyan-400/80 shrink-0">
                        {formatTime12(item.startTime)}
                        {item.endTime ? ` – ${formatTime12(item.endTime)}` : ""}
                      </span>
                    )}
                  </div>
                  {item.location && height >= 36 && (
                    <span className="text-[10px] font-tech text-cyan-500/70 truncate">
                      {item.location}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

