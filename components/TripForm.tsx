import React, { useEffect, useRef, useState } from 'react';
import { X, Plane, ArrowRight, Loader2, Check, ChevronLeft, AlertCircle, Plus, Zap, PenLine } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { FlightSegment, Currency, ItineraryItem, DayPlan, ChecklistItem } from '../types';
import { createNewTrip } from '../services/storageService';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from "../contexts/LocalizationContext";
import { SegmentedDateInput } from './SegmentedDateInput';
import { getDefaultBaggage, inferAirlineId } from '../services/airlineBaggageService';
import { getAirportCoords } from '../services/airportCoordsService';

interface Props {
  onClose: () => void;
  onSubmit: (tripData: any) => void | Promise<void>;
}

type Mode = 'quick' | 'flight';
type Direction = 'outbound' | 'inbound';
type Step = 'outbound-search' | 'outbound-select' | 'inbound-search' | 'inbound-select' | 'review';
type SearchIssue = { dir: Direction; kind: 'empty' | 'error' } | null;

const POPULAR_AIRPORTS = ['TPE', 'TSA', 'KHH', 'NRT', 'HND', 'KIX', 'ICN', 'HKG'];
const CABIN = 'Economy';
const DEFAULT_BUDGET = 50000;
const MAX_TRIP_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a strict YYYY-MM-DD string to a UTC timestamp (timezone/DST safe). Returns null when invalid. */
const parseYmd = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return ms;
};

const diffDays = (start: string, end: string): number | null => {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
};

const buildDateRange = (start: string, totalDays: number): string[] => {
  const base = parseYmd(start) ?? 0;
  return Array.from({ length: totalDays }, (_, i) => new Date(base + i * DAY_MS).toISOString().slice(0, 10));
};

const parseBudget = (value: string): number => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET;
};

const emptyManual = { airline: '', flightNumber: '', from: '', to: '', depTime: '', arrTime: '' };

const dayDiff = (dep: string, arr: string): number => {
  const [dy, dm, dd] = dep.split('T')[0].split('-').map(Number);
  const [ay, am, ad] = arr.split('T')[0].split('-').map(Number);
  const diff = Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(dy, dm - 1, dd)) / 86400000);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
};

const SegmentRow: React.FC<{ seg: FlightSegment; onRemove?: () => void }> = ({ seg, onRemove }) => {
  const plusDays = dayDiff(seg.departureTime, seg.arrivalTime);
  return (
  <div className="bg-slate-50 dark:bg-white/[0.05] p-3 rounded-2xl flex justify-between items-center gap-3 text-xs font-black border border-slate-100 dark:border-white/[0.08]">
    <div className="min-w-0 flex flex-col gap-0.5">
      <div className="truncate">
        <span className="text-slate-400 mr-2">{seg.flightNumber}</span>
        <span className="dark:text-white">{seg.departureAirport} → {seg.arrivalAirport}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{seg.departureTime.split('T')[0]}</span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <span className="dark:text-white tabular-nums whitespace-nowrap">
        {DateTimeUtils.formatTime24(seg.departureTime)} → {DateTimeUtils.formatTime24(seg.arrivalTime)}
        {plusDays > 0 && <sup className="ml-0.5 text-[9px] font-black text-orange-500">+{plusDays}</sup>}
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label="remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full"
        >
          <X size={12} />
        </button>
      )}
    </div>
  </div>
  );
};

const AirportChips: React.FC<{ value: string; onPick: (code: string) => void; label: string }> = ({ value, onPick, label }) => (
  <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label={label}>
    {POPULAR_AIRPORTS.map(code => (
      <button
        key={code}
        type="button"
        aria-pressed={value === code}
        onClick={() => onPick(code)}
        className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider border transition-all active:scale-95 ${value === code ? 'bg-primary text-white border-primary' : 'bg-slate-50 dark:bg-white/[0.05] text-slate-400 border-slate-100 dark:border-white/[0.08] hover:text-primary'}`}
      >
        {code}
      </button>
    ))}
  </div>
);

export const TripForm: React.FC<Props> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('quick');
  const [step, setStep] = useState<Step>('outbound-search');
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState('TPE');
  const [destination, setDestination] = useState('');
  const [outboundFlightNumber, setOutboundFlightNumber] = useState('');
  const [inboundFlightNumber, setInboundFlightNumber] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [inboundDate, setInboundDate] = useState('');
  const [flightOptions, setFlightOptions] = useState<FlightSegment[]>([]);
  const [outboundSegments, setOutboundSegments] = useState<FlightSegment[]>([]);
  const [inboundSegments, setInboundSegments] = useState<FlightSegment[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [searchIssue, setSearchIssue] = useState<SearchIssue>(null);
  const [showLeg, setShowLeg] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [manualError, setManualError] = useState(false);

  // Shared by quick mode and the flight review step
  const [tripName, setTripName] = useState('');
  const [budget, setBudget] = useState(String(DEFAULT_BUDGET));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const labels = {
    title: t('newTrip'),
    outboundSearch: t('searchOut'),
    inboundSearch: t('searchIn'),
    origin: t('origin'),
    destination: t('destination'),
    date: t('date'),
    flightNo: t('flightNo'),
    searchBtn: t('search'),
    back: t('back'),
    selectOut: t('selectOut'),
    selectIn: t('selectIn'),
    review: t('review'),
    confirmBtn: t('confirm'),
    addLayoverSegment: t('addLayoverSegment'),
    outboundSelected: t('outboundSelected'),
    inboundSelected: t('inboundSelected'),
  };

  const getDefaultChecklist = (): ChecklistItem[] => {
    const items = [
        { text: 'Passport & Visa', cat: 'Documents' },
        { text: 'Power Bank', cat: 'Gear' },
        { text: 'Medicine', cat: 'Toiletries' },
        { text: 'Cash', cat: 'Other' }
    ];
    return items.map((item) => ({
      id: crypto.randomUUID(),
      text: item.text,
      isCompleted: false,
      category: item.cat as any
    }));
  };

  // ---------- Flight search ----------

  const validateSearch = (dir: Direction) => {
    const newErrors: Record<string, boolean> = {};
    if (!origin) newErrors.origin = true;
    if (!destination) newErrors.destination = true;
    if (dir === 'outbound') {
      if (!outboundDate) newErrors.outboundDate = true;
      if (!outboundFlightNumber) newErrors.outboundFlightNumber = true;
    } else {
      if (!inboundDate) newErrors.inboundDate = true;
      if (!inboundFlightNumber) newErrors.inboundFlightNumber = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = async (dir: Direction) => {
    if (!validateSearch(dir)) return;

    const fNo = dir === 'outbound' ? outboundFlightNumber : inboundFlightNumber;
    const date = dir === 'outbound' ? outboundDate : inboundDate;

    setSearchIssue(null);
    setShowManual(false);
    setLoading(true);
    try {
      const results = await fetchTdxFlights(origin, destination, date, fNo);
      if (!results || results.length === 0) {
        setSearchIssue({ dir, kind: 'empty' });
        return;
      }
      setFlightOptions(results);
      setStep(dir === 'outbound' ? 'outbound-select' : 'inbound-select');
    } catch (e) {
      console.error(e);
      setSearchIssue({ dir, kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateDurationStr = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e)) return '';
    let diffMins = Math.floor((e - s) / 60000);
    if (diffMins < 0) diffMins += 24 * 60;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getMidPointTime = (t1: string, t2: string) => {
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    let min1 = h1 * 60 + m1;
    let min2 = h2 * 60 + m2;
    if (min2 < min1) min2 += 24 * 60;
    const mid = Math.floor((min1 + min2) / 2) % (24 * 60);
    return `${Math.floor(mid/60).toString().padStart(2, '0')}:${(mid%60).toString().padStart(2, '0')}`;
  };

  const commitSegment = (dir: Direction, seg: FlightSegment) => {
    const arrDate = seg.arrivalTime.split('T')[0];
    if (dir === 'outbound') {
      setOutboundSegments(prev => [...prev, seg]);
      setOutboundDate(arrDate);
      setOutboundFlightNumber('');
    } else {
      setInboundSegments(prev => [...prev, seg]);
      setInboundDate(arrDate);
      setInboundFlightNumber('');
    }
    setFlightOptions([]);
    setOrigin(seg.arrivalAirport);
    setDestination('');
    setSearchIssue(null);
    setShowManual(false);
    setShowLeg(false);
    setErrors({});
    setStep(dir === 'outbound' ? 'outbound-search' : 'inbound-search');
  };

  const removeOutboundSegment = (idx: number) => {
    const newSegs = [...outboundSegments];
    newSegs.splice(idx, 1);
    setOutboundSegments(newSegs);
    setShowLeg(false);
    if (newSegs.length > 0) {
      const last = newSegs[newSegs.length - 1];
      setOrigin(last.arrivalAirport);
      setOutboundDate(last.arrivalTime.split('T')[0]);
    } else {
      setOrigin('TPE');
      setOutboundDate('');
    }
  };

  const removeInboundSegment = (idx: number) => {
    const newSegs = [...inboundSegments];
    newSegs.splice(idx, 1);
    setInboundSegments(newSegs);
    setShowLeg(false);
    if (newSegs.length > 0) {
      const last = newSegs[newSegs.length - 1];
      setOrigin(last.arrivalAirport);
      setInboundDate(last.arrivalTime.split('T')[0]);
    } else if (outboundSegments.length > 0) {
      const lastOut = outboundSegments[outboundSegments.length - 1];
      setOrigin(lastOut.arrivalAirport);
      setDestination(outboundSegments[0].departureAirport);
      setInboundDate(lastOut.arrivalTime.split('T')[0]);
    } else {
      setOrigin('');
      setInboundDate('');
    }
  };

  /** Opens the (secondary) "add layover leg" search form, continuing from the last selected leg. */
  const openLegForm = (dir: Direction) => {
    const segs = dir === 'outbound' ? outboundSegments : inboundSegments;
    const last = segs[segs.length - 1];
    if (last) {
      setOrigin(last.arrivalAirport);
      if (dir === 'outbound') setOutboundDate(last.arrivalTime.split('T')[0]);
      else setInboundDate(last.arrivalTime.split('T')[0]);
    }
    setDestination('');
    if (dir === 'outbound') setOutboundFlightNumber('');
    else setInboundFlightNumber('');
    setErrors({});
    setSearchIssue(null);
    setShowManual(false);
    setShowLeg(true);
  };

  const resetSearchUi = () => {
    setShowLeg(false);
    setShowManual(false);
    setSearchIssue(null);
    setErrors({});
  };

  const nextToInbound = () => {
    if (outboundSegments.length === 0) return;
    const lastOut = outboundSegments[outboundSegments.length - 1];
    resetSearchUi();
    if (inboundSegments.length === 0) {
      setOrigin(lastOut.arrivalAirport);
      setDestination(outboundSegments[0].departureAirport);
      setInboundDate(lastOut.arrivalTime.split('T')[0]);
      setInboundFlightNumber('');
    }
    setStep('inbound-search');
  };

  const nextToReview = () => {
    if (inboundSegments.length === 0) return;
    resetSearchUi();
    setStep('review');
  };

  const handleInboundBack = () => {
    if (showLeg && inboundSegments.length > 0) {
      setShowLeg(false);
      setSearchIssue(null);
      setShowManual(false);
      return;
    }
    resetSearchUi();
    setStep('outbound-search');
  };

  const handleReviewBack = () => {
    resetSearchUi();
    setStep('inbound-search');
  };

  // ---------- Manual flight entry ----------

  const openManual = (dir: Direction) => {
    const date = dir === 'outbound' ? outboundDate : inboundDate;
    const fNo = dir === 'outbound' ? outboundFlightNumber : inboundFlightNumber;
    setManual({
      ...emptyManual,
      flightNumber: fNo,
      from: origin,
      to: destination,
      depTime: date ? `${date}T09:00` : '',
    });
    setManualError(false);
    setShowManual(true);
  };

  const submitManual = (dir: Direction) => {
    const m = manual;
    const dep = new Date(m.depTime).getTime();
    const arr = new Date(m.arrTime).getTime();
    const valid =
      m.airline.trim() && m.flightNumber.trim() && m.from.trim() && m.to.trim() &&
      m.depTime && m.arrTime && !isNaN(dep) && !isNaN(arr) && arr > dep;
    if (!valid) {
      setManualError(true);
      return;
    }
    const airline = m.airline.trim();
    commitSegment(dir, {
      airline,
      airlineID: '',
      airlineNameZh: airline,
      airlineNameEn: airline,
      flightNumber: m.flightNumber.trim().toUpperCase(),
      departureTime: m.depTime,
      arrivalTime: m.arrTime,
      departureAirport: m.from.trim().toUpperCase(),
      arrivalAirport: m.to.trim().toUpperCase(),
      terminal: '',
      gate: '',
      status: 'Scheduled',
      baggage: getDefaultBaggage(inferAirlineId(m.flightNumber), CABIN),
    });
    setManual(emptyManual);
    setManualError(false);
  };

  /** Leaves the flight flow for quick mode, carrying over whatever destination/dates were already entered. */
  const skipToQuick = () => {
    const target = outboundSegments.length > 0
      ? outboundSegments[outboundSegments.length - 1].arrivalAirport
      : destination.trim();
    const start = outboundSegments.length > 0
      ? outboundSegments[0].departureTime.split('T')[0]
      : outboundDate;
    const end = inboundSegments.length > 0
      ? inboundSegments[inboundSegments.length - 1].arrivalTime.split('T')[0]
      : (outboundSegments.length > 0 ? inboundDate : '');

    if (target && !tripName.trim()) setTripName(target);
    if (start) setStartDate(start);
    if (end) {
      const gap = start ? diffDays(start, end) : null;
      setEndDate(gap !== null && gap < 0 ? '' : end);
    }
    setQuickErrors({});
    resetSearchUi();
    setMode('quick');
  };

  // ---------- Trip creation ----------

  const submitWithLock = async (buildTrip: () => any) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = onSubmit(buildTrip());
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsSubmitting(true);
        await result;
      }
    } catch (err) {
      console.error(err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleQuickCreate = async () => {
    if (submittingRef.current) return;
    const errs: Record<string, string> = {};
    const name = tripName.trim();
    if (!name) errs.tripName = t('required');
    const startMs = parseYmd(startDate);
    const endMs = parseYmd(endDate);
    if (startMs === null) errs.startDate = t('tfInvalidDate');
    if (endMs === null) errs.endDate = t('tfInvalidDate');
    if (startMs !== null && endMs !== null) {
      const gap = Math.round((endMs - startMs) / DAY_MS);
      if (gap < 0) errs.endDate = t('tfEndBeforeStart');
      else if (gap + 1 > MAX_TRIP_DAYS) errs.endDate = t('tfTripTooLong');
    }
    setQuickErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await submitWithLock(() => {
      const totalDays = (diffDays(startDate, endDate) as number) + 1;
      const newTrip = createNewTrip({ destination: name, startDate, endDate });
      newTrip.name = name;
      newTrip.itinerary = buildDateRange(startDate, totalDays).map(date => ({ date, items: [] }));
      newTrip.checklist = getDefaultChecklist();
      newTrip.flights = [];
      newTrip.budget = parseBudget(budget);
      return newTrip;
    });
  };

  const handleCreateTrip = async () => {
    if (submittingRef.current) return;
    if (outboundSegments.length === 0 || inboundSegments.length === 0) return;

    await submitWithLock(() => {
      const lastOutbound = outboundSegments[outboundSegments.length - 1];
      const lastInbound = inboundSegments[inboundSegments.length - 1];

      const startStr = outboundSegments[0].departureTime.split('T')[0];
      const endStr = lastInbound.arrivalTime.split('T')[0];
      const totalDays = Math.abs(diffDays(startStr, endStr) ?? 0) + 1;

      const addSegmentItineraryItems = (seg: FlightSegment, itemsMap: Record<string, ItineraryItem[]>) => {
        const depDate = seg.departureTime.split('T')[0];
        const arrDate = seg.arrivalTime.split('T')[0];
        const depCoords = getAirportCoords(seg.departureAirport);
        const arrCoords = getAirportCoords(seg.arrivalAirport);

        if (!itemsMap[depDate]) itemsMap[depDate] = [];
        if (!itemsMap[arrDate]) itemsMap[arrDate] = [];

        itemsMap[depDate].push({
          id: crypto.randomUUID(),
          time: DateTimeUtils.formatTime24(seg.departureTime),
          placeName: `${seg.departureAirport} Airport`,
          ...(depCoords ?? {}),
          type: 'Place', transportType: 'Flight',
          note: `Flight: ${seg.flightNumber}`, date: depDate
        });

        itemsMap[depDate].push({
          id: crypto.randomUUID(),
          time: getMidPointTime(DateTimeUtils.formatTime24(seg.departureTime), DateTimeUtils.formatTime24(seg.arrivalTime)),
          placeName: 'Flight', type: 'Transport', transportType: 'Flight',
          note: calculateDurationStr(seg.departureTime, seg.arrivalTime), date: depDate
        });

        itemsMap[arrDate].push({
          id: crypto.randomUUID(),
          time: DateTimeUtils.formatTime24(seg.arrivalTime),
          placeName: `${seg.arrivalAirport} Airport`,
          ...(arrCoords ?? {}),
          type: 'Place', transportType: 'Flight', note: 'Arrival', date: arrDate
        });
      };

      const itemsMap: Record<string, ItineraryItem[]> = {};
      outboundSegments.forEach(seg => addSegmentItineraryItems(seg, itemsMap));
      inboundSegments.forEach(seg => addSegmentItineraryItems(seg, itemsMap));

      const generatedItinerary: DayPlan[] = buildDateRange(startStr, totalDays).map(dateStr => {
        const uniqueItems: ItineraryItem[] = [];
        (itemsMap[dateStr] || []).forEach(item => {
          const isDuplicate = uniqueItems.some(existing =>
            existing.time === item.time &&
            existing.placeName === item.placeName &&
            existing.type === item.type
          );
          if (!isDuplicate) uniqueItems.push(item);
        });
        return { date: dateStr, items: uniqueItems.sort((a, b) => a.time.localeCompare(b.time)) };
      });

      const withPreset = (seg: FlightSegment): FlightSegment => {
        const b = seg.baggage;
        const hasWeights = !!b && (parseFloat((b.carryOn?.weight || '').replace(/[^0-9.]/g, '')) > 0 || parseFloat((b.checked?.weight || '').replace(/[^0-9.]/g, '')) > 0);
        return hasWeights ? seg : { ...seg, baggage: getDefaultBaggage(seg.airlineID, CABIN) };
      };

      const buildCompoundSegment = (rawSegs: FlightSegment[]): FlightSegment => {
        const segs = rawSegs.map(withPreset);
        if (segs.length === 1) return segs[0];
        return {
          airline: segs.map(s => s.airline).join(' + '),
          airlineID: segs[0].airlineID,
          airlineNameZh: segs.map(s => s.airlineNameZh || s.airline).join(' + '),
          airlineNameEn: segs.map(s => s.airlineNameEn || s.airline).join(' + '),
          flightNumber: segs.map(s => s.flightNumber).join(' + '),
          departureTime: segs[0].departureTime,
          arrivalTime: segs[segs.length - 1].arrivalTime,
          departureAirport: segs[0].departureAirport,
          arrivalAirport: segs[segs.length - 1].arrivalAirport,
          terminal: segs[0].terminal || '',
          gate: segs[0].gate || '',
          status: 'Scheduled',
          baggage: getDefaultBaggage(segs[0].airlineID, CABIN),
          segments: segs
        };
      };

      const name = tripName.trim() || lastOutbound.arrivalAirport;
      const newTrip = createNewTrip({ destination: name, startDate: startStr, endDate: endStr });
      newTrip.name = name;
      newTrip.itinerary = generatedItinerary;
      newTrip.checklist = getDefaultChecklist();
      const outboundFlight = buildCompoundSegment(outboundSegments);
      const inboundFlight = buildCompoundSegment(inboundSegments);
      newTrip.flights = [{
        id: crypto.randomUUID(), user_id: '', traveler_name: 'TRAVELER', price: 0, currency: Currency.TWD, cabinClass: CABIN,
        outbound: outboundFlight,
        inbound: inboundFlight,
        baggage: outboundFlight.baggage || getDefaultBaggage(outboundFlight.airlineID, CABIN), budget: parseBudget(budget)
      }];
      return newTrip;
    });
  };

  // ---------- Render helpers ----------

  const inputClass = (isError: boolean) => `w-full p-3 bg-gray-50 dark:bg-white/[0.05] dark:text-white rounded-xl font-black border-2 outline-none transition-all ${isError ? 'border-red-500 bg-red-50/10 focus:ring-4 focus:ring-red-500/20 animate-pulse-soft' : 'border-slate-100 dark:border-white/[0.08] focus:border-primary/20'}`;
  const labelClass = (isError?: boolean) => `text-[10px] font-black uppercase tracking-widest ${isError ? 'text-red-500' : 'text-slate-400'}`;
  const primaryBtn = 'w-full bg-primary text-white py-3.5 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2';
  const darkBtn = 'w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-2';
  const ghostBtn = 'w-full text-xs font-black text-slate-400 py-2 flex items-center justify-center gap-1';

  const stepIndex = step === 'review' ? 2 : step.startsWith('inbound') ? 1 : 0;
  const stepLabels = [t('outbound'), t('inbound'), t('review')];

  const renderStepIndicator = () => (
    <ol aria-label={t('tfStepsLabel')} className="flex items-center mb-6">
      {stepLabels.map((label, i) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        return (
          <React.Fragment key={label}>
            <li
              aria-current={active ? 'step' : undefined}
              data-state={done ? 'done' : active ? 'active' : 'pending'}
              className="flex items-center gap-2"
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black tabular-nums transition-all ${active ? 'bg-primary text-white shadow-lg' : done ? 'bg-primary/15 text-primary' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-400'}`}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-xs font-black ${active ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{label}</span>
            </li>
            {i < stepLabels.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? 'bg-primary/40' : 'bg-slate-100 dark:bg-white/[0.08]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );

  const renderSearchIssue = (dir: Direction) => {
    if (!searchIssue || searchIssue.dir !== dir) return null;
    const isError = searchIssue.kind === 'error';
    return (
      <div role="alert" className="rounded-2xl border border-amber-300/60 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 p-4 space-y-3">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-black text-amber-700 dark:text-amber-300">{isError ? t('tfApiErrorTitle') : t('tfNoFlightsTitle')}</p>
            <p className="text-xs font-bold text-amber-700/80 dark:text-amber-200/70 leading-relaxed">{isError ? t('tfApiErrorDesc') : t('tfNoFlightsDesc')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {!showManual && (
            <button type="button" onClick={() => openManual(dir)} className="w-full py-2.5 rounded-xl bg-white dark:bg-white/[0.08] border border-amber-200 dark:border-white/[0.12] text-xs font-black text-slate-800 dark:text-white flex items-center justify-center gap-2 active:scale-95 transition-all">
              <PenLine size={14} /> {t('tfManualEntry')}
            </button>
          )}
          <button type="button" onClick={skipToQuick} className="w-full py-2.5 rounded-xl text-xs font-black text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2 hover:bg-amber-100/60 dark:hover:bg-white/[0.05] active:scale-95 transition-all">
            <Zap size={14} /> {t('tfSkipToQuick')}
          </button>
        </div>
      </div>
    );
  };

  const renderManualForm = (dir: Direction) => {
    if (!showManual || searchIssue?.dir !== dir) return null;
    const setField = (key: keyof typeof emptyManual, value: string) => {
      setManual(prev => ({ ...prev, [key]: value }));
      setManualError(false);
    };
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-4 space-y-3" data-testid="manual-flight-form">
        <h4 className="text-xs font-black text-slate-800 dark:text-white">{t('tfManualTitle')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="manual-airline" className={labelClass(manualError && !manual.airline.trim())}>{t('tfAirline')}</label>
            <input id="manual-airline" value={manual.airline} onChange={e => setField('airline', e.target.value)} className={inputClass(manualError && !manual.airline.trim())} />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-flight-number" className={labelClass(manualError && !manual.flightNumber.trim())}>{t('flightNo')}</label>
            <input id="manual-flight-number" value={manual.flightNumber} onChange={e => setField('flightNumber', e.target.value.toUpperCase())} className={inputClass(manualError && !manual.flightNumber.trim())} />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-from" className={labelClass(manualError && !manual.from.trim())}>{t('departureAirport')}</label>
            <input id="manual-from" value={manual.from} onChange={e => setField('from', e.target.value.toUpperCase())} className={inputClass(manualError && !manual.from.trim())} />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-to" className={labelClass(manualError && !manual.to.trim())}>{t('arrivalAirport')}</label>
            <input id="manual-to" value={manual.to} onChange={e => setField('to', e.target.value.toUpperCase())} className={inputClass(manualError && !manual.to.trim())} />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-dep-time" className={labelClass(manualError && !manual.depTime)}>{t('departureTime')}</label>
            <input id="manual-dep-time" type="datetime-local" value={manual.depTime} onChange={e => setField('depTime', e.target.value)} className={`${inputClass(manualError && !manual.depTime)} text-xs tabular-nums`} />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-arr-time" className={labelClass(manualError && !manual.arrTime)}>{t('arrivalTime')}</label>
            <input id="manual-arr-time" type="datetime-local" value={manual.arrTime} onChange={e => setField('arrTime', e.target.value)} className={`${inputClass(manualError && !manual.arrTime)} text-xs tabular-nums`} />
          </div>
        </div>
        {manualError && <p role="alert" className="text-xs font-black text-red-500">{t('tfManualInvalid')}</p>}
        <button type="button" onClick={() => submitManual(dir)} className={primaryBtn}>
          <Plus size={14} /> {t('tfAddSegment')}
        </button>
      </div>
    );
  };

  const renderSearchStep = (dir: Direction) => {
    const isOut = dir === 'outbound';
    const segments = isOut ? outboundSegments : inboundSegments;
    const date = isOut ? outboundDate : inboundDate;
    const setDate = isOut ? setOutboundDate : setInboundDate;
    const flightNo = isOut ? outboundFlightNumber : inboundFlightNumber;
    const setFlightNo = isOut ? setOutboundFlightNumber : setInboundFlightNumber;
    const dateKey = isOut ? 'outboundDate' : 'inboundDate';
    const fnKey = isOut ? 'outboundFlightNumber' : 'inboundFlightNumber';
    const showForm = segments.length === 0 || showLeg;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="text-center"><h3 className="text-xl font-black text-slate-800 dark:text-white">{isOut ? labels.outboundSearch : labels.inboundSearch}</h3></div>

        {segments.length > 0 && (
          <div className="space-y-2">
            <label className={labelClass()}>{isOut ? labels.outboundSelected : labels.inboundSelected}</label>
            <div className="space-y-2">
              {segments.map((seg, idx) => (
                <SegmentRow key={idx} seg={seg} onRemove={() => (isOut ? removeOutboundSegment(idx) : removeInboundSegment(idx))} />
              ))}
            </div>
            {!showForm && (
              <div className="space-y-1 pt-2">
                <button type="button" onClick={isOut ? nextToInbound : nextToReview} className={primaryBtn}>
                  {isOut ? t('tfSetInbound') : t('tfGoReview')} <ArrowRight size={14} />
                </button>
                <button type="button" onClick={() => openLegForm(dir)} className="w-full text-xs font-black text-slate-400 hover:text-primary py-2 flex items-center justify-center gap-1 transition-colors">
                  <Plus size={12} /> {labels.addLayoverSegment}
                </button>
                {!isOut && (
                  <button type="button" onClick={handleInboundBack} className={ghostBtn}><ChevronLeft size={14}/> {labels.back}</button>
                )}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <>
            {segments.length > 0 && <div className="w-full h-px bg-slate-100 dark:bg-white/[0.08]" />}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor={`${dir}-origin`} className={labelClass(errors.origin)}>{labels.origin}</label>
                <input id={`${dir}-origin`} value={origin} onChange={e => {setOrigin(e.target.value.toUpperCase()); setErrors({...errors, origin: false})}} className={inputClass(errors.origin)} placeholder="TPE" />
                <AirportChips value={origin} label={`${t('tfPopularAirports')} · ${labels.origin}`} onPick={code => {setOrigin(code); setErrors({...errors, origin: false})}} />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${dir}-destination`} className={labelClass(errors.destination)}>{labels.destination}</label>
                <input id={`${dir}-destination`} value={destination} onChange={e => {setDestination(e.target.value.toUpperCase()); setErrors({...errors, destination: false})}} className={inputClass(errors.destination)} placeholder="KIX" />
                <AirportChips value={destination} label={`${t('tfPopularAirports')} · ${labels.destination}`} onPick={code => {setDestination(code); setErrors({...errors, destination: false})}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass(errors[dateKey])}>{labels.date}</label>
                <SegmentedDateInput value={date} onChange={val => {setDate(val); setErrors({...errors, [dateKey]: false})}} hasError={errors[dateKey]} />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${dir}-flight-number`} className={labelClass(errors[fnKey])}>{labels.flightNo}</label>
                <input id={`${dir}-flight-number`} value={flightNo} onChange={e => {setFlightNo(e.target.value.toUpperCase()); setErrors({...errors, [fnKey]: false})}} className={inputClass(errors[fnKey])} placeholder={isOut ? 'BR198' : 'BR197'} />
              </div>
            </div>

            {renderSearchIssue(dir)}
            {renderManualForm(dir)}

            <button type="button" onClick={() => handleSearch(dir)} disabled={loading} className={darkBtn}>
              {loading ? <Loader2 className="animate-spin" /> : segments.length > 0 ? labels.addLayoverSegment : labels.searchBtn}
            </button>
            {(segments.length > 0 || !isOut) && (
              <button type="button" onClick={isOut ? () => { setShowLeg(false); setSearchIssue(null); setShowManual(false); } : handleInboundBack} className={ghostBtn}>
                <ChevronLeft size={14}/> {labels.back}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSelectStep = (dir: Direction) => {
    const isOut = dir === 'outbound';
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <h3 className="font-black text-slate-800 dark:text-white">{isOut ? labels.selectOut : labels.selectIn}</h3>
        <div className="space-y-3">{flightOptions.map((f, i) => (
          <div key={i} role="button" tabIndex={0}
            onClick={() => commitSegment(dir, f)}
            onKeyDown={e => { if (e.key === 'Enter') commitSegment(dir, f); }}
            className="bg-gray-50 dark:bg-white/[0.04] p-4 rounded-2xl cursor-pointer hover:ring-2 hover:ring-primary border border-slate-100 dark:border-white/[0.08]">
            <div className="flex justify-between items-center mb-1"><span className="font-black text-sm dark:text-white">{f.airline}</span><span className="text-xs font-black text-slate-400">{f.flightNumber}</span></div>
            <div className="flex justify-between text-xs font-black dark:text-white tabular-nums"><span>{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span><span>{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span></div>
          </div>
        ))}</div>
        <button type="button" onClick={() => setStep(isOut ? 'outbound-search' : 'inbound-search')} className={ghostBtn}><ChevronLeft size={14}/> {labels.back}</button>
      </div>
    );
  };

  const renderBudgetField = (id: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass()}>{t('tfStartingBudget')} <span className="normal-case tracking-normal font-bold">({t('tfOptional')})</span></label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">NT$</span>
        <input id={id} type="number" inputMode="numeric" min={0} value={budget} onChange={e => setBudget(e.target.value)} className={`${inputClass(false)} pl-12 tabular-nums`} placeholder={String(DEFAULT_BUDGET)} />
      </div>
    </div>
  );

  const quickGap = startDate && endDate ? diffDays(startDate, endDate) : null;
  const showBadge = quickGap !== null && quickGap >= 0 && quickGap + 1 <= MAX_TRIP_DAYS;

  const renderQuickMode = () => (
    <form
      noValidate
      onSubmit={e => { e.preventDefault(); handleQuickCreate(); }}
      className="space-y-5 animate-in fade-in duration-300"
    >
      <div className="space-y-1">
        <label htmlFor="trip-name" className={labelClass(!!quickErrors.tripName)}>{t('tfTripName')}</label>
        <input id="trip-name" value={tripName} onChange={e => { setTripName(e.target.value); setQuickErrors({ ...quickErrors, tripName: '' }); }} className={inputClass(!!quickErrors.tripName)} placeholder={t('tfTripNamePlaceholder')} autoFocus />
        {quickErrors.tripName && <p className="text-[11px] font-black text-red-500">{quickErrors.tripName}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className={labelClass(!!quickErrors.startDate)}>{t('tfStartDate')}</label>
          <SegmentedDateInput value={startDate} onChange={val => { setStartDate(val); setQuickErrors({ ...quickErrors, startDate: '', endDate: '' }); }} hasError={!!quickErrors.startDate} />
          {quickErrors.startDate && <p className="text-[11px] font-black text-red-500">{quickErrors.startDate}</p>}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!quickErrors.endDate)}>{t('tfEndDate')}</label>
          <SegmentedDateInput value={endDate} onChange={val => { setEndDate(val); setQuickErrors({ ...quickErrors, endDate: '' }); }} hasError={!!quickErrors.endDate} />
          {quickErrors.endDate && <p className="text-[11px] font-black text-red-500">{quickErrors.endDate}</p>}
        </div>
      </div>
      {showBadge && (
        <div className="flex justify-center">
          <span data-testid="duration-badge" className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black tabular-nums">
            {quickGap === 0
              ? t('tfDayTrip')
              : t('tfDurationBadge').replace('{days}', String((quickGap as number) + 1)).replace('{nights}', String(quickGap))}
          </span>
        </div>
      )}
      {renderBudgetField('quick-budget')}
      <button type="submit" disabled={isSubmitting} className={`${darkBtn} disabled:opacity-60 disabled:cursor-not-allowed`}>
        {isSubmitting && <Loader2 className="animate-spin" size={16} />}
        {t('tfCreateTrip')}
        {!isSubmitting && <ArrowRight size={18}/>}
      </button>
    </form>
  );

  const renderReviewStep = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.review}</h3></div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.outboundSelected}</div>
          {outboundSegments.map((seg, idx) => <SegmentRow key={idx} seg={seg} />)}
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.inboundSelected}</div>
          {inboundSegments.map((seg, idx) => <SegmentRow key={idx} seg={seg} />)}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="review-trip-name" className={labelClass()}>{t('tfTripNameReview')}</label>
        <input id="review-trip-name" value={tripName} onChange={e => setTripName(e.target.value)} className={inputClass(false)} placeholder={outboundSegments[outboundSegments.length - 1]?.arrivalAirport || t('tfTripNamePlaceholder')} />
      </div>
      {renderBudgetField('review-budget')}

      <button type="button" onClick={handleCreateTrip} disabled={isSubmitting} className={`${darkBtn} shadow-lg disabled:opacity-60 disabled:cursor-not-allowed`}>
        {isSubmitting && <Loader2 className="animate-spin" size={16} />}
        {labels.confirmBtn}
        {!isSubmitting && <ArrowRight size={18}/>}
      </button>
      <button type="button" onClick={handleReviewBack} className={ghostBtn}><ChevronLeft size={14}/> {labels.back}</button>
    </div>
  );

  const modeTabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'quick', label: t('tfQuickCreate'), icon: <Zap size={14} /> },
    { id: 'flight', label: t('tfImportFlights'), icon: <Plane size={14} /> },
  ];

  return (
    <div
      data-testid="trip-form-backdrop"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={labels.title} className="bg-white dark:bg-[#121318]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.14] rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 pb-5 border-b border-gray-100 dark:border-white/[0.08] space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{labels.title}</h2>
            <button type="button" onClick={onClose} aria-label={t('tfClose')} className="p-3 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-full text-slate-400"><X size={20} /></button>
          </div>
          <div role="tablist" aria-label={t('tfModeSwitch')} className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
            {modeTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setMode(tab.id)}
                className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${mode === tab.id ? 'bg-white dark:bg-white/[0.14] text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {mode === 'quick' ? renderQuickMode() : (
            <>
              {renderStepIndicator()}
              {step === 'outbound-search' && renderSearchStep('outbound')}
              {step === 'outbound-select' && renderSelectStep('outbound')}
              {step === 'inbound-search' && renderSearchStep('inbound')}
              {step === 'inbound-select' && renderSelectStep('inbound')}
              {step === 'review' && renderReviewStep()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
