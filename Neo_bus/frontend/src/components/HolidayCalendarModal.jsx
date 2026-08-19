import React, { useState, useEffect } from 'react';
import { X, Calendar as CalIcon, Loader, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HolidayCalendarModal({ isOpen, onClose }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Calendar Navigation State (Default to current month or January 2026)
  const year = 2026;
  const [monthIndex, setMonthIndex] = useState(0); // 0-11
  const [hoveredHoliday, setHoveredHoliday] = useState(null);
  const [selectedHoliday, setSelectedHoliday] = useState(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (!isOpen) return;

    const fetchHolidays = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('https://api.api-ninjas.com/v1/holidays?country=IN', {
          headers: {
            'X-Api-Key': 'iZ403yFvS6ZVffhGV5BDy0fg3OSENFOauvYnwNZv'
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch holidays from public calendar API');
        }
        const data = await response.json();
        const mappedData = data.map((h) => ({
          ...h,
          localName: h.name,
          global: h.type?.toLowerCase().includes('public') || h.type?.toLowerCase().includes('national')
        }));
        setHolidays(mappedData);
      } catch (err) {
        console.error(err);
        setError('Could not load Indian holiday calendar. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate grid parameters for the selected month
  const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  // Create calendar cells (padding + day numbers)
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  // Next / Prev Month Nav
  const handlePrevMonth = () => {
    setMonthIndex((prev) => (prev === 0 ? 11 : prev - 1));
    setSelectedHoliday(null);
    setHoveredHoliday(null);
  };

  const handleNextMonth = () => {
    setMonthIndex((prev) => (prev === 11 ? 0 : prev + 1));
    setSelectedHoliday(null);
    setHoveredHoliday(null);
  };

  // Helper to match dates and types
  const getHolidayForDay = (day) => {
    if (!day) return null;
    const dateString = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.find((h) => h.date === dateString);
  };

  const checkIsWeekend = (day) => {
    if (!day) return false;
    const dateObj = new Date(year, monthIndex, day);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  };

  // List of holidays inside the active selected month
  const activeMonthHolidays = holidays.filter((h) => {
    const holidayMonth = new Date(h.date).getMonth();
    return holidayMonth === monthIndex;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-md shadow-2xl p-5 relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-xl">
              <CalIcon size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-sm tracking-tight">Travel Holiday Calendar</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">India Public Holidays & Weekends ({year})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-2">
            <Loader className="animate-spin text-brand-500" size={24} />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Loading Calendar Database...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-rose-500 text-xs font-bold p-4 bg-rose-500/5 rounded-xl border border-rose-500/10 mt-4">
            <Clock className="mx-auto mb-2 text-rose-500 opacity-60" size={24} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Legend & Month Navigation */}
            <div className="mt-4 space-y-3">
              {/* Legend Block */}
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-1 bg-slate-50 dark:bg-slate-950/20 py-1.5 rounded-lg border border-slate-100 dark:border-slate-850">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600/20 inline-block"></span>
                  <span>Holiday</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/20 border border-rose-500 inline-block"></span>
                  <span className="text-rose-600 dark:text-rose-400">Weekend</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-700 inline-block"></span>
                  <span>Weekday</span>
                </span>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                  {months[monthIndex]} {year}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Monthly Grid */}
            <div className="mt-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekdays.map((day, idx) => (
                  <div 
                    key={day} 
                    className={`text-[10px] font-black uppercase text-center py-1 ${
                      idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Monthly Grid Days */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-8"></div>;
                  }

                  const holiday = getHolidayForDay(day);
                  const isWeekend = checkIsWeekend(day);

                  // Style determination
                  let cellClasses = "h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer border ";
                  if (holiday) {
                    // Holiday style
                    cellClasses += "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/10 hover:brightness-110";
                  } else if (isWeekend) {
                    // Weekend style
                    cellClasses += "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20";
                  } else {
                    // Standard Weekday
                    cellClasses += "bg-slate-50/50 dark:bg-slate-850/50 text-slate-700 dark:text-slate-350 border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800";
                  }

                  // If selected / clicked
                  const isSelected = selectedHoliday && new Date(selectedHoliday.date).getDate() === day;
                  if (isSelected) {
                    cellClasses += " ring-2 ring-brand-500";
                  }

                  return (
                    <div
                      key={`day-${day}`}
                      className={cellClasses}
                      onMouseEnter={() => holiday && setHoveredHoliday(holiday)}
                      onMouseLeave={() => setHoveredHoliday(null)}
                      onClick={() => holiday && setSelectedHoliday(holiday)}
                      title={holiday ? `${holiday.localName} (Click for details)` : isWeekend ? 'Weekend' : undefined}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Holiday / Weekend Details Display */}
            <div className="mt-4 p-3 rounded-xl min-h-[70px] bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 text-left flex flex-col justify-center">
              {hoveredHoliday || selectedHoliday ? (
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-500 text-base">🎉</span>
                    <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                      {(hoveredHoliday || selectedHoliday).localName}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                    English: {(hoveredHoliday || selectedHoliday).name}
                  </p>
                  <p className="text-[9px] text-brand-500 dark:text-brand-400 font-extrabold pl-6 mt-0.5">
                    {(hoveredHoliday || selectedHoliday).global ? '🇮🇳 National Public Holiday' : '📍 State/Regional Holiday'}
                  </p>
                </div>
              ) : (
                <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold py-2">
                  <span>Hover or Click any <span className="text-emerald-500 font-bold">green date</span> to view holiday details.</span>
                </div>
              )}
            </div>

            {/* Scrollable list of active month holidays */}
            <div className="mt-3 flex-1 overflow-y-auto max-h-[160px] space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-left">
              <h4 className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-2">
                Holidays in {months[monthIndex]}
              </h4>
              {activeMonthHolidays.length === 0 ? (
                <p className="text-[10px] text-slate-400 dark:text-slate-550 py-2 text-center">No public holidays in this month.</p>
              ) : (
                activeMonthHolidays.map((holiday) => {
                  const dayNum = new Date(holiday.date).getDate();
                  const weekdayName = new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <button
                      key={holiday.date + holiday.name}
                      onClick={() => setSelectedHoliday(holiday)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-100/50 dark:border-slate-850/50 bg-slate-50/20 dark:bg-slate-950/10 hover:border-brand-500/20 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[11px] font-black text-emerald-500 w-8">
                          {dayNum} {weekdayName}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          {holiday.localName}
                        </span>
                      </div>
                      <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-4">
          <span>Holidays: Nager.Date API</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-brand-500/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
