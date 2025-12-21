
import React, { useState, useRef, useEffect } from 'react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { Clock, ChevronDown } from 'lucide-react';

interface Props {
  value: string; // ISO string YYYY-MM-DDTHH:mm:ss
  onChange: (newValue: string) => void;
  label?: string;
}

export const CustomDateTimeInput: React.FC<Props> = ({ value, onChange, label }) => {
  const [showPicker, setShowPicker] = useState(false);
  const datePart = DateTimeUtils.formatDate(value);
  const timePart = DateTimeUtils.formatTime24(value);
  const [hour, minute] = timePart.split(':');
  
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const handleDateChange = (newDate: string) => {
    const combined = DateTimeUtils.combineToISO(newDate, timePart);
    onChange(combined);
  };

  const selectTime = (h: string, m: string) => {
    const combined = DateTimeUtils.combineToISO(datePart, `${h}:${m}`);
    onChange(combined);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')); // 5 min intervals for better UX

  return (
    <div className="space-y-1 relative" ref={pickerRef}>
      {label && <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">{label}</label>}
      <div className="flex gap-2">
        <input 
          type="date"
          value={datePart}
          onChange={(e) => handleDateChange(e.target.value)}
          className="flex-1 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/10 focus:outline-none shadow-sm transition-all"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 text-sm font-mono font-bold text-slate-700 focus:ring-2 focus:ring-primary/10 shadow-sm transition-all min-w-[100px] justify-between"
          >
            <Clock size={14} className="text-slate-400" />
            {timePart}
            <ChevronDown size={14} className={`text-slate-300 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPicker && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-100 rounded-3xl shadow-2xl z-50 p-4 flex gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-slate-400 uppercase text-center mb-1">小時 (H)</div>
                <div className="h-48 overflow-y-auto no-scrollbar space-y-1 pr-1">
                  {hours.map(h => (
                    <button
                      key={h}
                      onClick={() => selectTime(h, minute)}
                      className={`w-10 h-10 rounded-xl text-sm font-mono font-bold flex items-center justify-center transition-all ${
                        h === hour ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-gray-100 text-slate-600'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px bg-gray-100 my-2"></div>
              <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-slate-400 uppercase text-center mb-1">分鐘 (M)</div>
                <div className="h-48 overflow-y-auto no-scrollbar space-y-1 pr-1">
                  {minutes.map(m => (
                    <button
                      key={m}
                      onClick={() => selectTime(hour, m)}
                      className={`w-10 h-10 rounded-xl text-sm font-mono font-bold flex items-center justify-center transition-all ${
                        m === minute ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-gray-100 text-slate-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  {/* Also allow manual 1-minute steps if needed by scrolling or adding more items */}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
