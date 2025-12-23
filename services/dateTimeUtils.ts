
/**
 * Date & Time Utilities for Go Travel
 * Strictly enforces 24-hour format (HH:mm).
 * Uses local time methods to avoid timezone shift bugs (the "minus one day" issue).
 */

const pad = (n: number) => n.toString().padStart(2, '0');

export const DateTimeUtils = {
  /**
   * Formats any date/string to HH:mm (Strict 24h)
   */
  formatTime24: (date: Date | string | undefined | null): string => {
    if (!date) return "09:00";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "09:00";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * Formats any date/string to YYYY-MM-DD (Local Time)
   */
  formatDate: (date: Date | string | undefined | null): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    // Using local time methods to avoid the ISO UTC shift bug
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  /**
   * Formats any date/string to friendly display (Local Time)
   * Supports locale based on current language
   */
  formatDateFriendly: (date: Date | string | undefined | null, lang: 'zh' | 'en' = 'zh'): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const locale = lang === 'zh' ? 'zh-TW' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Combines date (YYYY-MM-DD) and time (HH:mm) into a reliable ISO-like string
   */
  combineToISO: (datePart: string, timePart: string): string => {
    if (!datePart) return "";
    const time = timePart || "09:00";
    // We construct a local date string that the JS Date constructor handles as local time
    return `${datePart}T${time}:00`;
  },

  /**
   * Validates if a string is a valid 24h time format HH:mm
   */
  isValidTime24: (time: string): boolean => {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time);
  },

  /**
   * Calculates duration string between two HH:mm strings
   */
  getDuration: (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "";
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    
    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }
};
