
import React, { useState, useRef, useEffect } from 'react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { Clock, ChevronDown } from 'lucide-react';
import { SegmentedDateInput } from './SegmentedDateInput';

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
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <div className="space-y-1 relative" ref={pickerRef}>
      {label && <label className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest ml-1">{label}</label>}
      <div className="flex gap-2">
        <div className="flex-1">
          <SegmentedDateInput
            value={datePart}
            onChange={handleDateChange}
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700 text-sm font-mono font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/10 shadow-sm transition-all min-w-[110px] justify-between"
          >
            <Clock size={14} className="text-slate-400" />
            {timePart}
            <ChevronDown size={14} className={`text-slate-300 transition-transform duration-300 ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPicker && (
            <div className="absolute top-full right-0 mt-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[32px] shadow-2xl z-50 p-5 flex gap-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col gap-1.5">
                <div className="text-[9px] font-black text-slate-400 uppercase text-center mb-1 tracking-widest">H</div>
                <div className="h-56 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
                  {hours.map(h => (
                    <button
                      key={h}
                      onClick={() => selectTime(h, minute)}
                      className={`w-11 h-11 rounded-xl text-sm font-mono font-black flex items-center justify-center transition-all ${
                        h === hour ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px bg-slate-100 dark:bg-slate-700 my-2"></div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[9px] font-black text-slate-400 uppercase text-center mb-1 tracking-widest">M</div>
                <div className="h-56 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
                  {minutes.map(m => (
                    <button
                      key={m}
                      onClick={() => selectTime(hour, m)}
                      className={`w-11 h-11 rounded-xl text-sm font-mono font-black flex items-center justify-center transition-all ${
                        m === minute ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
