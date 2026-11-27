import React, { useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}

/**
 * YYYY/MM/DD input with a calendar button.
 *
 * Layout: the text field and the calendar button are flex siblings (not an absolutely
 * positioned icon over a padded input), so the digits can never sit underneath the icon.
 * The text field is `min-w-0 flex-1`; the button is `shrink-0`.
 */
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
  };

  const openPicker = () => {
    const el = hiddenInputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      // showPicker is unsupported / blocked in some browsers; fall back to focus
      el.focus();
    }
  };

  const wrapperClass = `relative flex items-center w-full min-w-0 bg-gray-50 dark:bg-white/[0.05] rounded-xl border-2 transition-all ${
    hasError
      ? 'border-red-500 bg-red-50/10 focus-within:ring-4 focus-within:ring-red-500/20'
      : 'border-transparent focus-within:border-primary/20'
  }`;

  // Display with slashes, handle empty safely
  const displayValue = value ? value.replace(/-/g, '/') : '';

  return (
    <div className={wrapperClass}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="YYYY/MM/DD"
        value={displayValue}
        onChange={handleChange}
        className="min-w-0 flex-1 bg-transparent outline-none py-3 pl-2.5 pr-1 sm:pl-3 font-black tabular-nums tracking-tight whitespace-nowrap text-left placeholder-slate-300 dark:placeholder-slate-500 dark:text-white"
        maxLength={10} // YYYY/MM/DD
      />

      <button
        type="button"
        aria-label="Pick date"
        onClick={openPicker}
        className="shrink-0 flex items-center justify-center w-11 h-11 -my-1 text-slate-400 hover:text-primary transition-colors"
      >
        <CalendarIcon size={20} />
      </button>

      {/* Hidden native input for picker support */}
      <input
        ref={hiddenInputRef}
        type="date"
        className="absolute bottom-0 right-0 opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={handleNativeDateChange}
      />
    </div>
  );
};
