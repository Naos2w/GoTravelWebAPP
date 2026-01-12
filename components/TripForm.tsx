
import React, { useState } from 'react';
import { X, Calendar, MapPin, Plane, ArrowRight, Loader2, Check, Info, ChevronLeft } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { FlightSegment, Trip, Currency, ItineraryItem, DayPlan, ChecklistItem } from '../types';
import { createNewTrip } from '../services/storageService';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from '../App';

interface Props {
  onClose: () => void;
  onSubmit: (tripData: any) => void;
}

type Step = 'outbound-search' | 'outbound-select' | 'inbound-search' | 'inbound-select' | 'review';

const getAirlineLogo = (id: string | undefined) => id ? `https://pics.avs.io/120/120/${id}.png` : null;

export const TripForm: React.FC<Props> = ({ onClose, onSubmit }) => {
  const { language } = useTranslation();
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

  const labels = {
    title: language === 'zh' ? '開始一段新旅程' : 'Start a New Journey',
    outboundSearch: language === 'zh' ? '目的地在哪裡？' : 'Where to?',
    inboundSearch: language === 'zh' ? '什麼時候回來？' : 'When back?',
    outboundSub: language === 'zh' ? '搜尋您的出發航班' : 'Find your outbound flight',
    inboundSub: (dest: string, orig: string) => language === 'zh' ? `從 ${dest} 飛回 ${orig}` : `Fly from ${dest} back to ${orig}`,
    origin: language === 'zh' ? '出發地' : 'Origin',
    destination: language === 'zh' ? '目的地' : 'Destination',
    date: language === 'zh' ? '日期' : 'Date',
    flightNo: language === 'zh' ? '航班代號' : 'Flight No.',
    searchBtn: language === 'zh' ? '搜尋即時航班' : 'Search Flights',
    back: language === 'zh' ? '返回' : 'Back',
    selectOut: language === 'zh' ? '選擇去程航班' : 'Select Outbound',
    selectIn: language === 'zh' ? '選擇回程航班' : 'Select Inbound',
    noFlights: language === 'zh' ? '找不到航班資訊' : 'No flights found.',
    review: language === 'zh' ? '確認行程' : 'Review Trip',
    reviewSub: language === 'zh' ? '系統將自動生成基礎行程與清單' : 'System will generate base itinerary',
    confirmBtn: language === 'zh' ? '完成並建立' : 'Create Trip',
    airport: language === 'zh' ? '機場' : 'Airport',
    flight: language === 'zh' ? '航班' : 'Flight',
    terminal: language === 'zh' ? '航廈' : 'Terminal',
    datePlaceholder: 'YYYY-MM-DD'
  };

  const getDefaultChecklist = (): ChecklistItem[] => {
    const items = language === 'zh' 
      ? [
          { text: '護照與簽證', cat: 'Documents' },
          { text: '行動電源與線材', cat: 'Gear' },
          { text: '個人藥物', cat: 'Toiletries' },
          { text: '外幣現金', cat: 'Other' }
        ]
      : [
          { text: 'Passport & Visa', cat: 'Documents' },
          { text: 'Power Bank & Cables', cat: 'Gear' },
          { text: 'Medicine', cat: 'Toiletries' },
          { text: 'Currency / Cash', cat: 'Other' }
        ];

    return items.map((item) => ({
      id: crypto.randomUUID(),
      text: item.text,
      isCompleted: false,
      category: item.cat as any
    }));
  };

  const handleSearch = async (type: 'outbound' | 'inbound') => {
    const fNo = type === 'outbound' ? outboundFlightNumber : inboundFlightNumber;
    const date = type === 'outbound' ? outboundDate : inboundDate;
    if (!fNo.trim() || !date) return;

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

  const handleCreateTrip = () => {
    if (!outboundFlight || !inboundFlight) return;
    const startStr = outboundFlight.departureTime.split('T')[0];
    const endStr = inboundFlight.departureTime.split('T')[0];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const totalDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const generatedItinerary: DayPlan[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start); 
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const items: ItineraryItem[] = [];

      if (i === 0) {
        items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(outboundFlight.departureTime), 
          placeName: `${labels.airport} ${outboundFlight.departureAirport}`, 
          type: 'Place', 
          transportType: 'Flight',
          note: `${labels.flight}: ${outboundFlight.flightNumber}`, 
          date: dateStr 
        });
      }
      
      if (i === totalDays - 1) {
        items.push({ 
          id: crypto.randomUUID(), 
          time: DateTimeUtils.formatTime24(inboundFlight.departureTime), 
          placeName: `${labels.airport} ${inboundFlight.departureAirport}`, 
          type: 'Place', 
          transportType: 'Flight',
          note: `${labels.flight}: ${inboundFlight.flightNumber}`, 
          date: dateStr 
        });
      }
      generatedItinerary.push({ date: dateStr, items: items });
    }

    const newTrip = createNewTrip({ destination, startDate: startStr, endDate: endStr });
    newTrip.itinerary = generatedItinerary;
    newTrip.checklist = getDefaultChecklist();
    // 使用漸層色背景作為預算封面，移除隨機 Picsum 圖
    newTrip.coverImage = `https://images.unsplash.com/photo-1436491865332-7a61a109c0f3?auto=format&fit=crop&q=80&w=800`;
    newTrip.flight = { 
      price: 0, 
      currency: Currency.TWD, 
      cabinClass: 'Economy', 
      outbound: { ...outboundFlight, baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } } }, 
      inbound: { ...inboundFlight, baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } } }, 
      baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } },
      budget: 50000
    };

    onSubmit(newTrip);
  };

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
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.outboundSearch}</h3><p className="text-slate-500 text-sm">{labels.outboundSub}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.origin}</label><input value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black text-lg border-none outline-none" placeholder="TPE" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.destination}</label><input value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black text-lg border-none outline-none" placeholder="KIX" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.date}</label><input type="date" value={outboundDate} onChange={e => setOutboundDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-none outline-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.flightNo}</label><input value={outboundFlightNumber} onChange={e => setOutboundFlightNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-none outline-none" placeholder="BR198" /></div>
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
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.inboundSearch}</h3><p className="text-slate-500 text-sm">{labels.inboundSub(destination, origin)}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.date}</label><input type="date" value={inboundDate} onChange={e => setInboundDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-none outline-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.flightNo}</label><input value={inboundFlightNumber} onChange={e => setInboundFlightNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-black border-none outline-none" placeholder="BR197" /></div>
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
                <div className="text-center mb-6"><h3 className="text-xl font-black text-slate-800 dark:text-white">{labels.review}</h3><p className="text-slate-500 text-sm">{labels.reviewSub}</p></div>
                <div className="space-y-2">
                   <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent font-black text-sm flex justify-between"><span>去程：{outboundFlight?.flightNumber}</span><span>{outboundFlight?.departureAirport} → {outboundFlight?.arrivalAirport}</span></div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent font-black text-sm flex justify-between"><span>回程：{inboundFlight?.flightNumber}</span><span>{inboundFlight?.departureAirport} → {inboundFlight?.arrivalAirport}</span></div>
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
