import React, { useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}

export const SegmentedDateInput: React.FC<Props> = ({ value, onChange, hasError }) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Extract digits only from the input
    let raw = e.target.value.replace(/\D/g, '');
    
    // 2. Limit to 8 digits (YYYYMMDD)
    if (raw.length > 8) raw = raw.slice(0, 8);

    // 3. Reconstruct with slashes
    let formatted = '';
    
    // Year
    if (raw.length > 0) {
      formatted += raw.slice(0, 4);
    }
    
    // Month
    if (raw.length >= 5) {
      formatted += '/' + raw.slice(4, 6);
    }
    
    // Day
    if (raw.length >= 7) {
      formatted += '/' + raw.slice(6, 8);
    }

    // Pass standard YYYY-MM-DD to parent
    onChange(formatted.replace(/\//g, '-'));
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }

  const baseClass = `bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-2 outline-none transition-all text-left placeholder-slate-300 dark:placeholder-slate-600 dark:text-white w-full p-3 pr-12`;
  const errorClass = hasError ? 'border-red-500 bg-red-50/10 focus:ring-4 focus:ring-red-500/20' : 'border-transparent focus:border-primary/20';
  const combinedClass = `${baseClass} ${errorClass}`;

  // Display with slashes, handle empty safely
  const displayValue = value ? value.replace(/-/g, '/') : '';

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="numeric"
        placeholder="YYYY/MM/DD"
        value={displayValue}
        onChange={handleChange}
        className={combinedClass}
        maxLength={10} // YYYY/MM/DD
      />
      
      <button 
        type="button"
        onClick={() => hiddenInputRef.current?.showPicker()}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
      >
        <CalendarIcon size={20} />
      </button>

      {/* Hidden native input for picker support */}
      <input 
        ref={hiddenInputRef}
        type="date"
        className="absolute bottom-0 right-0 opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        value={value}
        onChange={handleNativeDateChange}
      />
    </div>
  );
};
