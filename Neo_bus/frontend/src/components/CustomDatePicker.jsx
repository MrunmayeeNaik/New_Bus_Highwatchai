import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export default function CustomDatePicker({ selectedDate, onChange, minDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef(null);

  // Parse initial date
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate days list
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push(d);
  }

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day) => {
    const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if less than minDate
    if (minDate && formattedDate < minDate) {
      return; // Do not select past dates
    }

    onChange(formattedDate);
    setIsOpen(false);
  };

  // Date Checkers
  const isWeekend = (day) => {
    if (!day) return false;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const isDateSelected = (day) => {
    if (!day) return false;
    const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return selectedDate === dateString;
  };

  const isDateDisabled = (day) => {
    if (!day) return true;
    const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return minDate && dateString < minDate;
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Select Journey Date';
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="relative w-full text-left" ref={datePickerRef}>
      {/* Date Picker Input Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-slate-105 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 text-sm outline-none transition-all text-slate-850 dark:text-slate-100 cursor-pointer"
      >
        <span className="truncate">{formatDisplayDate(selectedDate)}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {/* Custom Calendar Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-2xl p-4 w-72 z-[150] animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header controls */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black text-slate-800 dark:text-white">
              {months[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {weekdays.map((day, idx) => (
              <span
                key={day}
                className={`text-[10px] font-black uppercase ${
                  idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {day}
              </span>
            ))}
          </div>

          {/* Monthly grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-7"></div>;
              }

              const isWknd = isWeekend(day);
              const isSelected = isDateSelected(day);
              const isDisabled = isDateDisabled(day);

              let cellStyle = "h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all relative cursor-pointer ";
              
              if (isDisabled) {
                cellStyle += "text-slate-350 dark:text-slate-700 cursor-not-allowed bg-transparent";
              } else if (isSelected) {
                cellStyle += "bg-brand-500 text-white font-extrabold shadow-sm";
              } else if (isWknd) {
                cellStyle += "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20";
              } else {
                cellStyle += "bg-slate-50/50 dark:bg-slate-850/50 text-slate-755 dark:text-slate-350 border border-slate-100/50 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800";
              }

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => !isDisabled && handleSelectDay(day)}
                  className={cellStyle}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Quick Legend Helper */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-[9px] text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500/30 inline-block"></span>
              <span>Weekend</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700 inline-block"></span>
              <span>Weekday</span>
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
