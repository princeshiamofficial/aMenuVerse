import React, { useState, useRef, useEffect } from "react";
import { cn } from "../src/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const RANGE_OPTIONS = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "This Year",
  "Last Year",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isBetween(date: Date, start: Date, end: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

export default function DateRangePicker({
  selectedRange,
  onRangeChange,
  isOpen,
  onClose,
  className,
}: DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom Date Picker Selection States
  const [calendarStart, setCalendarStart] = useState<Date | null>(new Date());
  const [calendarEnd, setCalendarEnd] = useState<Date | null>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const leftMonth = currentMonth;
  const rightMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

  // Adjust state during render when isOpen or selectedRange changes to avoid useEffect setState
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevSelectedRange, setPrevSelectedRange] = useState(selectedRange);
  if (isOpen !== prevIsOpen || selectedRange !== prevSelectedRange) {
    setPrevIsOpen(isOpen);
    setPrevSelectedRange(selectedRange);
    if (isOpen) {
      const isPreset = RANGE_OPTIONS.includes(selectedRange) || selectedRange === "Custom Range";
      if (isPreset) {
        const today = new Date();
        setCalendarStart(today);
        setCalendarEnd(today);
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      } else {
        const parts = selectedRange.split(" - ");
        if (parts.length === 2) {
          const start = new Date(parts[0]);
          const end = new Date(parts[1]);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            setCalendarStart(start);
            setCalendarEnd(end);
            setCurrentMonth(new Date(start.getFullYear(), start.getMonth(), 1));
          }
        }
      }
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (clickedDate: Date) => {
    if (!calendarStart || (calendarStart && calendarEnd)) {
      setCalendarStart(clickedDate);
      setCalendarEnd(null);
    } else {
      if (clickedDate < calendarStart) {
        setCalendarEnd(calendarStart);
        setCalendarStart(clickedDate);
      } else {
        setCalendarEnd(clickedDate);
      }
    }
  };

  const handleApply = () => {
    if (calendarStart && calendarEnd) {
      const startStr = `${calendarStart.toLocaleString("default", { month: "short" })} ${calendarStart.getDate()}, ${calendarStart.getFullYear()}`;
      const endStr = `${calendarEnd.toLocaleString("default", { month: "short" })} ${calendarEnd.getDate()}, ${calendarEnd.getFullYear()}`;
      onRangeChange(`${startStr} - ${endStr}`);
      onClose();
    }
  };

  const renderCalendar = (monthDate: Date, isLeft: boolean) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const cells: { date: Date; isCurrentMonth: boolean; dayNum: number }[] = [];
    const startDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();

    // Prev month lead-in
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevDaysCount = new Date(prevYear, prevMonth + 1, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevDaysCount - i;
      cells.push({
        date: new Date(prevYear, prevMonth, day),
        isCurrentMonth: false,
        dayNum: day,
      });
    }

    // Current month days
    for (let day = 1; day <= daysCount; day++) {
      cells.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
        dayNum: day,
      });
    }

    // Next month lead-out (complete 42 cells)
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    let nextDayNum = 1;
    while (cells.length < 42) {
      cells.push({
        date: new Date(nextYear, nextMonth, nextDayNum),
        isCurrentMonth: false,
        dayNum: nextDayNum,
      });
      nextDayNum++;
    }

    return (
      <div className="w-[260px] flex flex-col select-none">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-4 relative h-8">
          {isLeft && (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors absolute left-0"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="text-sm font-bold text-slate-800 mx-auto tracking-wide font-sans">
            {MONTH_NAMES[month]} {year}
          </span>
          {!isLeft && (
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors absolute right-0"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-2 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day} className="text-[11px] font-semibold text-slate-400 font-sans">
              {day}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, idx) => {
            const isStart = calendarStart && isSameDay(cell.date, calendarStart);
            const isEnd = calendarEnd && isSameDay(cell.date, calendarEnd);
            const inRange =
              calendarStart && calendarEnd && isBetween(cell.date, calendarStart, calendarEnd);
            const isSelected = isStart || isEnd || inRange;

            const isSunday = idx % 7 === 0;
            const isSaturday = idx % 7 === 6;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayClick(cell.date)}
                className={cn(
                  "h-9 flex items-center justify-center text-[13px] font-semibold font-sans transition-all relative w-full",
                  isSelected
                    ? "bg-[#ff7a00] text-white"
                    : cell.isCurrentMonth
                      ? "text-slate-700 hover:bg-slate-50"
                      : "text-slate-300 hover:bg-slate-50/50",
                  isSelected && (isStart || isSunday) && "rounded-l-lg",
                  isSelected && (isEnd || isSaturday) && "rounded-r-lg",
                  !isSelected && "rounded-lg",
                )}
              >
                {cell.dayNum}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const isCustomActive = selectedRange === "Custom Range" || selectedRange.includes("-");

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col md:flex-row overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
        isCustomActive ? "w-[300px] md:w-[780px]" : "w-[240px]",
        className,
      )}
    >
      {/* Custom Range Calendars Panel (Shown on the Left) */}
      {isCustomActive && (
        <div className="flex flex-col p-5 border-b md:border-b-0 md:border-r border-slate-100 flex-1">
          {/* Calendar Views Grid */}
          <div className="flex flex-col sm:flex-row gap-6 md:gap-8 justify-center items-center">
            {renderCalendar(leftMonth, true)}
            {renderCalendar(rightMonth, false)}
          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
            <button
              type="button"
              onClick={handleApply}
              disabled={!calendarStart || !calendarEnd}
              className="bg-[#ff7a00] hover:bg-[#e56d00] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg text-sm transition-all duration-200 active:scale-95 cursor-pointer font-sans"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Options List Panel (Shown on the Right) */}
      <div
        className={cn(
          "p-1.5 flex flex-col gap-0.5 shrink-0",
          isCustomActive ? "w-full md:w-[180px]" : "w-full",
        )}
      >
        {/* Header (Only shown when not side-by-side to keep layout compact) */}
        {!isCustomActive && (
          <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5">
            <span className="text-sm font-bold text-slate-800 tracking-wide font-sans">
              Filter by Date
            </span>
          </div>
        )}

        {RANGE_OPTIONS.map((option) => {
          const isSelected = selectedRange === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                onRangeChange(option);
                onClose();
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors font-sans",
                isSelected
                  ? "bg-[#ff7a00] text-white font-semibold shadow-sm"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {option}
            </button>
          );
        })}

        {/* Divider for Custom Range */}
        <div className="h-px bg-slate-100 my-1" />

        {/* Custom Range Option */}
        <button
          type="button"
          onClick={() => {
            onRangeChange("Custom Range");
          }}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors font-sans",
            isCustomActive
              ? "bg-[#ff7a00] text-white font-semibold shadow-sm"
              : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          Custom Range
        </button>
      </div>
    </div>
  );
}
