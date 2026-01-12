
import React, { useState } from 'react';
import { X, Calendar, MapPin, Plane, ArrowRight, Loader2, Check, Info, ChevronLeft, AlertCircle } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { FlightSegment, Trip, Currency, ItineraryItem, DayPlan, ChecklistItem } from '../types';
import { createNewTrip } from '../services/storageService';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from "../contexts/LocalizationContext";
import { SegmentedDateInput } from './SegmentedDateInput';

interface Props {
  onClose: () => void;
  onSubmit: (tripData: any) => void;
}

type Step = 'outbound-search' | 'outbound-select' | 'inbound-search' | 'inbound-select' | 'review';

export const TripForm: React.FC<Props> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('outbound-search');
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState('TPE');
  const [destination, setDestination] = useState('');
  const [outboundFlightNumber, setOutboundFlightNumber] = useState('');
  const [inboundFlightNumber, setInboundFlightNumber] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [inboundDate, setInboundDate] = useState('');
  const [flightOptions, setFlightOptions] = useState<FlightSegment[]>([]);
  const [outboundFlight, setOutboundFlight] = useState<FlightSegment | null>(null);
  const [inboundFlight, setInboundFlight] = useState<FlightSegment | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

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
    required: t('required')
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

  const validateSearch = (type: 'outbound' | 'inbound') => {
    const newErrors: Record<string, boolean> = {};
    if (type === 'outbound') {
      if (!origin) newErrors.origin = true;
      if (!destination) newErrors.destination = true;
      if (!outboundDate) newErrors.outboundDate = true;
      if (!outboundFlightNumber) newErrors.outboundFlightNumber = true;
    } else {
      if (!inboundDate) newErrors.inboundDate = true;
      if (!inboundFlightNumber) newErrors.inboundFlightNumber = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = async (type: 'outbound' | 'inbound') => {
    if (!validateSearch(type)) return;

    const fNo = type === 'outbound' ? outboundFlightNumber : inboundFlightNumber;
    const date = type === 'outbound' ? outboundDate : inboundDate;

    setLoading(true);
    try {
      const from = type === 'outbound' ? origin : destination;
      const to = type === 'outbound' ? destination : origin;
      const results = await fetchTdxFlights(from, to, date, fNo);
      setFlightOptions(results);
      setStep(type === 'outbound' ? 'outbound-select' : 'inbound-select');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  const handleCreateTrip = () => {
    if (!outboundFlight || !inboundFlight) return;
    
    const startStr = outboundFlight.departureTime.split('T')[0];
    const endStr = inboundFlight.departureTime.split('T')[0];
    const start = new Date(startStr);
    const diffTime = Math.abs(new Date(endStr).getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const generatedItinerary: DayPlan[] = [];
    
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = DateTimeUtils.formatDate(currentDate);
      const items: ItineraryItem[] = [];

      // Outbound logic
      if (dateStr === outboundFlight.departureTime.split('T')[0]) {
         items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(outboundFlight.departureTime), 
          placeName: `${outboundFlight.departureAirport} Airport`, 
          type: 'Place', transportType: 'Flight', 
          note: `Flight: ${outboundFlight.flightNumber}`, date: dateStr 
        });
        items.push({
           id: crypto.randomUUID(),
           time: getMidPointTime(DateTimeUtils.formatTime24(outboundFlight.departureTime), DateTimeUtils.formatTime24(outboundFlight.arrivalTime)),
           placeName: 'Flight', type: 'Transport', transportType: 'Flight',
           note: calculateDurationStr(outboundFlight.departureTime, outboundFlight.arrivalTime), date: dateStr
        });
      }
      if (dateStr === outboundFlight.arrivalTime.split('T')[0]) {
         items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(outboundFlight.arrivalTime), 
          placeName: `${outboundFlight.arrivalAirport} Airport`, 
          type: 'Place', transportType: 'Flight', note: 'Arrival', date: dateStr 
        });
      }

      // Inbound logic
      if (dateStr === inboundFlight.departureTime.split('T')[0]) {
         items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(inboundFlight.departureTime), 
          placeName: `${inboundFlight.departureAirport} Airport`, 
          type: 'Place', transportType: 'Flight', 
          note: `Flight: ${inboundFlight.flightNumber}`, date: dateStr 
        });
        items.push({
           id: crypto.randomUUID(),
           time: getMidPointTime(DateTimeUtils.formatTime24(inboundFlight.departureTime), DateTimeUtils.formatTime24(inboundFlight.arrivalTime)),
           placeName: 'Flight', type: 'Transport', transportType: 'Flight',
           note: calculateDurationStr(inboundFlight.departureTime, inboundFlight.arrivalTime), date: dateStr
        });
      }
      if (dateStr === inboundFlight.arrivalTime.split('T')[0]) {
         items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(inboundFlight.arrivalTime), 
          placeName: `${inboundFlight.arrivalAirport} Airport`, 
          type: 'Place', transportType: 'Flight', note: 'Arrival', date: dateStr 
        });
      }

      generatedItinerary.push({ date: dateStr, items: items.sort((a,b) => a.time.localeCompare(b.time)) });
    }

    const newTrip = createNewTrip({ destination, startDate: startStr, endDate: endStr });
    newTrip.itinerary = generatedItinerary;
    newTrip.checklist = getDefaultChecklist();
    newTrip.flights = [{ 
      id: crypto.randomUUID(), user_id: '', traveler_name: 'TRAVELER', price: 0, currency: Currency.TWD, cabinClass: 'Economy', 
      outbound: { ...outboundFlight, baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } } }, 
      inbound: { ...inboundFlight, baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } } }, 
      baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } }, budget: 50000
    }];
    onSubmit(newTrip);
  };

  const inputClass = (isError: boolean) => `w-full p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-2 outline-none transition-all ${isError ? 'border-red-500 bg-red-50/10 focus:ring-4 focus:ring-red-500/20 animate-pulse-soft' : 'border-transparent focus:border-primary/20'}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
          <div><h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{labels.title}</h2></div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
           {step === 'outbound-search' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.outboundSearch}</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.origin ? "text-red-500" : "text-slate-400"}`}>{labels.origin}</label>
                    <input value={origin} onChange={e => {setOrigin(e.target.value.toUpperCase()); setErrors({...errors, origin: false})}} className={inputClass(errors.origin)} placeholder="TPE" />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.destination ? "text-red-500" : "text-slate-400"}`}>{labels.destination}</label>
                    <input value={destination} onChange={e => {setDestination(e.target.value.toUpperCase()); setErrors({...errors, destination: false})}} className={inputClass(errors.destination)} placeholder="KIX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.outboundDate ? "text-red-500" : "text-slate-400"}`}>{labels.date}</label>
                    <SegmentedDateInput value={outboundDate} onChange={val => {setOutboundDate(val); setErrors({...errors, outboundDate: false})}} hasError={errors.outboundDate} />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.outboundFlightNumber ? "text-red-500" : "text-slate-400"}`}>{labels.flightNo}</label>
                    <input value={outboundFlightNumber} onChange={e => {setOutboundFlightNumber(e.target.value.toUpperCase()); setErrors({...errors, outboundFlightNumber: false})}} className={inputClass(errors.outboundFlightNumber)} placeholder="BR198" />
                  </div>
                </div>
                <button onClick={() => handleSearch('outbound')} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-black transition-all active:scale-95">{loading ? <Loader2 className="animate-spin mx-auto" /> : labels.searchBtn}</button>
             </div>
           )}
           {step === 'outbound-select' && (
             <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="font-black text-slate-800 dark:text-white">{labels.selectOut}</h3>
                <div className="space-y-3">{flightOptions.map((f, i) => (
                   <div key={i} onClick={() => { setOutboundFlight(f); setStep('inbound-search'); setFlightOptions([]); }} className="bg-gray-50 dark:bg-slate-900 p-4 rounded-2xl cursor-pointer hover:ring-2 hover:ring-primary">
                      <div className="flex justify-between items-center mb-1"><span className="font-black text-sm">{f.airline}</span><span className="text-xs font-black text-slate-400">{f.flightNumber}</span></div>
                      <div className="flex justify-between text-xs font-black"><span>{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span><span>{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span></div>
                   </div>
                ))}</div>
                <button onClick={() => setStep('outbound-search')} className="w-full text-xs font-black text-slate-400 py-2 flex items-center justify-center gap-1"><ChevronLeft size={14}/> {labels.back}</button>
             </div>
           )}
           {step === 'inbound-search' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.inboundSearch}</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.inboundDate ? "text-red-500" : "text-slate-400"}`}>{labels.date}</label>
                    <SegmentedDateInput value={inboundDate} onChange={val => {setInboundDate(val); setErrors({...errors, inboundDate: false})}} hasError={errors.inboundDate} />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${errors.inboundFlightNumber ? "text-red-500" : "text-slate-400"}`}>{labels.flightNo}</label>
                    <input value={inboundFlightNumber} onChange={e => {setInboundFlightNumber(e.target.value.toUpperCase()); setErrors({...errors, inboundFlightNumber: false})}} className={inputClass(errors.inboundFlightNumber)} placeholder="BR197" />
                  </div>
                </div>
                <button onClick={() => handleSearch('inbound')} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-black">{loading ? <Loader2 className="animate-spin mx-auto" /> : labels.searchBtn}</button>
                <button onClick={() => setStep('outbound-select')} className="w-full text-xs font-black text-slate-400 py-2 flex items-center justify-center gap-1"><ChevronLeft size={14}/> {labels.back}</button>
             </div>
           )}
           {step === 'inbound-select' && (
             <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="font-black text-slate-800 dark:text-white">{labels.selectIn}</h3>
                <div className="space-y-3">{flightOptions.map((f, i) => (
                   <div key={i} onClick={() => { setInboundFlight(f); setStep('review'); }} className="bg-gray-50 dark:bg-slate-900 p-4 rounded-2xl cursor-pointer hover:ring-2 hover:ring-primary">
                      <div className="flex justify-between items-center mb-1"><span className="font-black text-sm">{f.airline}</span><span className="text-xs font-black text-slate-400">{f.flightNumber}</span></div>
                      <div className="flex justify-between text-xs font-black"><span>{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span><span>{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span></div>
                   </div>
                ))}</div>
                <button onClick={() => setStep('inbound-search')} className="w-full text-xs font-black text-slate-400 py-2 flex items-center justify-center gap-1"><ChevronLeft size={14}/> {labels.back}</button>
             </div>
           )}
           {step === 'review' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.review}</h3></div>
                <div className="space-y-2">
                   <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent font-black text-sm flex justify-between"><span>{outboundFlight?.flightNumber}</span><span>{outboundFlight?.departureAirport} → {outboundFlight?.arrivalAirport}</span></div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent font-black text-sm flex justify-between"><span>{inboundFlight?.flightNumber}</span><span>{inboundFlight?.departureAirport} → {inboundFlight?.arrivalAirport}</span></div>
                </div>
                <button onClick={handleCreateTrip} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2">{labels.confirmBtn} <ArrowRight size={18}/></button>
                <button onClick={() => setStep('inbound-select')} className="w-full text-xs font-black text-slate-400 py-2 flex items-center justify-center gap-1"><ChevronLeft size={14}/> {labels.back}</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};