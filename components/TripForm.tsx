
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
    title: language === 'zh' ? '行程小幫手' : 'Travel Assistant',
    outboundSearch: language === 'zh' ? '要去哪裡旅行？' : 'Where are you going?',
    inboundSearch: language === 'zh' ? '什麼時候回來？' : 'When are you back?',
    outboundSub: language === 'zh' ? '搜尋您的出發航班 (航班號碼為必填)' : 'Find your outbound flight (Flight No. required)',
    inboundSub: (dest: string, orig: string) => language === 'zh' ? `從 ${dest} 飛回 ${orig}` : `Fly from ${dest} back to ${orig}`,
    origin: language === 'zh' ? '出發地' : 'Origin',
    destination: language === 'zh' ? '目的地' : 'Destination',
    date: language === 'zh' ? '日期' : 'Date',
    flightNo: language === 'zh' ? '航班代號 (必填)' : 'Flight No. (Required)',
    searchBtn: language === 'zh' ? '搜尋即時航班' : 'Search Live Flights',
    back: language === 'zh' ? '返回上一步' : 'Back',
    selectOut: language === 'zh' ? '選擇去程航班' : 'Select Outbound',
    selectIn: language === 'zh' ? '選擇回程航班' : 'Select Inbound',
    noFlights: language === 'zh' ? '找不到航班資訊，請確認號碼與日期。' : 'No flights found. Check number/date.',
    review: language === 'zh' ? '確認您的旅程' : 'Confirm Your Trip',
    reviewSub: language === 'zh' ? '航班資訊與預設待辦事項將自動同步' : 'Flights and default checklist will sync',
    confirmBtn: language === 'zh' ? '建立我的行程' : 'Create My Trip',
    airport: language === 'zh' ? '機場' : 'Airport',
    datePlaceholder: 'YYYY/MM/DD'
  };

  const getDefaultChecklist = (): ChecklistItem[] => {
    const items = language === 'zh' 
      ? [
          { text: '護照與簽證', cat: 'Documents' },
          { text: '旅遊保險單', cat: 'Documents' },
          { text: '萬國轉接頭', cat: 'Gear' },
          { text: '行動電源與充電線', cat: 'Gear' },
          { text: '個人常備藥品', cat: 'Toiletries' },
          { text: '換洗衣物', cat: 'Clothing' },
          { text: '當地貨幣/信用卡', cat: 'Other' }
        ]
      : [
          { text: 'Passport & Visa', cat: 'Documents' },
          { text: 'Travel Insurance', cat: 'Documents' },
          { text: 'Power Adapter', cat: 'Gear' },
          { text: 'Power Bank & Cables', cat: 'Gear' },
          { text: 'Medicine', cat: 'Toiletries' },
          { text: 'Clothing', cat: 'Clothing' },
          { text: 'Cash & Credit Cards', cat: 'Other' }
        ];

    return items.map((item, idx) => ({
      id: `default-${idx}-${Date.now()}`,
      text: item.text,
      isCompleted: false,
      category: item.cat as any
    }));
  };

  const handleSearch = async (type: 'outbound' | 'inbound') => {
    const fNo = type === 'outbound' ? outboundFlightNumber : inboundFlightNumber;
    const date = type === 'outbound' ? outboundDate : inboundDate;
    
    if (!fNo.trim()) {
      alert(language === 'zh' ? "請輸入航班代號" : "Flight number is required");
      return;
    }
    if (!date) {
      alert(language === 'zh' ? "請選擇日期" : "Please select a date");
      return;
    }

    setLoading(true);
    try {
      const from = type === 'outbound' ? origin : destination;
      const to = type === 'outbound' ? destination : origin;
      const results = await fetchTdxFlights(from, to, date, fNo);
      setFlightOptions(results);
      setStep(type === 'outbound' ? 'outbound-select' : 'inbound-select');
    } catch (e) { alert(language === 'zh' ? "搜尋失敗" : "Search failed"); }
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

      // 第一天：自動加入去程機場資訊
      if (i === 0) {
        items.push({ 
          id: `outbound-flight-dep-${Date.now()}`, 
          time: DateTimeUtils.formatTime24(outboundFlight.departureTime), 
          placeName: `${labels.airport} ${outboundFlight.departureAirport}`, 
          type: 'Transport', 
          transportType: 'Flight',
          note: `Flight: ${outboundFlight.flightNumber} (Departure)`, 
          date: dateStr 
        });
        items.push({ 
          id: `outbound-flight-arr-${Date.now()}`, 
          time: DateTimeUtils.formatTime24(outboundFlight.arrivalTime), 
          placeName: `${labels.airport} ${outboundFlight.arrivalAirport}`, 
          type: 'Transport', 
          transportType: 'Flight',
          note: `Arrival at Destination`,
          date: dateStr 
        });
      }
      
      // 最後一天：自動加入回程機場資訊
      if (i === totalDays - 1) {
        items.push({ 
          id: `inbound-flight-dep-${Date.now()}`, 
          time: DateTimeUtils.formatTime24(inboundFlight.departureTime), 
          placeName: `${labels.airport} ${inboundFlight.departureAirport}`, 
          type: 'Transport', 
          transportType: 'Flight',
          note: `Flight: ${inboundFlight.flightNumber} (Return)`, 
          date: dateStr 
        });
        items.push({ 
          id: `inbound-flight-arr-${Date.now()}`, 
          time: DateTimeUtils.formatTime24(inboundFlight.arrivalTime), 
          placeName: `${labels.airport} ${inboundFlight.arrivalAirport}`, 
          type: 'Transport', 
          transportType: 'Flight',
          note: `Back Home`,
          date: dateStr 
        });
      }
      
      generatedItinerary.push({ 
        date: dateStr, 
        items: items.sort((a,b) => a.time.localeCompare(b.time)) 
      });
    }

    const defaultBaggage = {
      carryOn: { count: 1, weight: '7kg' },
      checked: { count: 0, weight: '23kg' }
    };

    const newTrip = createNewTrip({ 
      destination, 
      startDate: startStr, 
      endDate: endStr 
    });

    newTrip.itinerary = generatedItinerary;
    newTrip.checklist = getDefaultChecklist();
    newTrip.flight = { 
      price: 0, 
      currency: Currency.TWD, 
      cabinClass: 'Economy', 
      outbound: { ...outboundFlight, baggage: defaultBaggage }, 
      inbound: { ...inboundFlight, baggage: defaultBaggage }, 
      baggage: defaultBaggage 
    };

    onSubmit(newTrip);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{labels.title}</h2>
            <div className="flex gap-1.5 mt-2">
               <div className={`h-1.5 w-10 rounded-full ${step.includes('outbound') ? 'bg-primary' : 'bg-gray-100 dark:bg-slate-700'}`} />
               <div className={`h-1.5 w-10 rounded-full ${step.includes('inbound') ? 'bg-primary' : (step === 'review' ? 'bg-primary/40' : 'bg-gray-100 dark:bg-slate-700')}`} />
               <div className={`h-1.5 w-10 rounded-full ${step === 'review' ? 'bg-primary' : 'bg-gray-100 dark:border-slate-700'}`} />
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar dark:text-slate-200">
           {step === 'outbound-search' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-6"><div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-primary rounded-full flex items-center justify-center mx-auto mb-3"><Plane /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">{labels.outboundSearch}</h3><p className="text-slate-500 text-sm">{labels.outboundSub}</p></div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{labels.origin}</label><input value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-mono font-bold text-lg border-none outline-none focus:ring-1 focus:ring-primary/20" placeholder="TPE" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{labels.destination}</label><input value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-mono font-bold text-lg border-none outline-none focus:ring-1 focus:ring-primary/20" placeholder="KIX" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{labels.date}</label>
                      <div className="relative h-[52px]">
                        <input type="date" value={outboundDate} onChange={e => setOutboundDate(e.target.value)} className="absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-medium outline-none border-none opacity-0 focus:opacity-100 z-20 transition-opacity" />
                        <div className={`absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-bold flex items-center z-10 ${outboundDate ? 'text-slate-900 dark:text-white' : 'text-slate-300'}`}>
                           {outboundDate || labels.datePlaceholder}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{labels.flightNo}</label><input value={outboundFlightNumber} onChange={e => setOutboundFlightNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-mono font-bold outline-none border-none focus:ring-1 focus:ring-primary/20" placeholder="BR198" /></div>
                  </div>
                  <button onClick={() => handleSearch('outbound')} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto" /> : labels.searchBtn}</button>
                </div>
             </div>
           )}
           {(step === 'outbound-select' || step === 'inbound-select') && (
             <div className="space-y-4 h-[450px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
               <h3 className="font-bold text-slate-800 dark:text-white">{step === 'outbound-select' ? labels.selectOut : labels.selectIn}</h3>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                 {flightOptions.length === 0 ? <div className="text-center py-20 text-slate-400">{labels.noFlights}</div> : flightOptions.map((f, i) => (
                   <div key={i} onClick={() => { if (step === 'outbound-select') { setOutboundFlight(f); setStep('inbound-search'); setFlightOptions([]); } else { setInboundFlight(f); setStep('review'); } }} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-primary shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-2"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded p-1 bg-white dark:bg-slate-800 border dark:border-slate-700"><img src={getAirlineLogo(f.airlineID) || ''} className="w-full h-full object-contain" onError={e=>(e.target as any).src='https://via.placeholder.com/32'} /></div><span className="font-bold text-sm dark:text-slate-200">{language === 'zh' ? (f.airlineNameZh || f.airline) : (f.airlineNameEn || f.airline)}</span></div><span className="text-xs font-mono font-bold text-slate-400">{f.flightNumber}</span></div>
                      <div className="flex justify-between items-center text-sm font-bold dark:text-white"><span>{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span><Plane size={14} className="text-slate-300 mx-2" /><span>{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span></div>
                   </div>
                 ))}
               </div>
               <button onClick={() => setStep(step === 'outbound-select' ? 'outbound-search' : 'inbound-search')} className="text-sm text-slate-400 flex items-center justify-center gap-1 hover:text-slate-600 py-2 transition-colors"><ChevronLeft size={14} /> {labels.back}</button>
             </div>
           )}
           {step === 'inbound-search' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-6"><div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-primary rounded-full flex items-center justify-center mx-auto mb-3"><Plane className="rotate-180" /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">{labels.inboundSearch}</h3><p className="text-slate-500 text-sm">{labels.inboundSub(destination, origin)}</p></div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{labels.date}</label>
                      <div className="relative h-[52px]">
                        <input type="date" value={inboundDate} onChange={e => setInboundDate(e.target.value)} className="absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-medium outline-none border-none opacity-0 focus:opacity-100 z-20 transition-opacity" />
                        <div className={`absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-bold flex items-center z-10 ${inboundDate ? 'text-slate-900 dark:text-white' : 'text-slate-300'}`}>
                           {inboundDate || labels.datePlaceholder}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{labels.flightNo}</label><input value={inboundFlightNumber} onChange={e => setInboundFlightNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-mono font-bold outline-none border-none focus:ring-1 focus:ring-primary/20" placeholder="BR197" /></div>
                  </div>
                  <button onClick={() => handleSearch('inbound')} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-bold hover:scale-[1.02] transition-transform">{loading ? <Loader2 className="animate-spin mx-auto" /> : labels.searchBtn}</button>
                  <button onClick={() => setStep('outbound-select')} className="w-full text-sm text-slate-400 hover:text-slate-600 text-center py-2 flex items-center justify-center gap-1 transition-colors"><ChevronLeft size={14}/> {labels.back}</button>
                </div>
             </div>
           )}
           {step === 'review' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center"><div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3"><Check size={24} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">{labels.review}</h3><p className="text-slate-500 text-sm">{labels.reviewSub}</p></div>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-slate-700"><div className="font-bold text-slate-800 dark:text-white">{outboundFlight?.flightNumber}</div><div className="text-right text-xs text-slate-500">{outboundFlight?.departureAirport} → {outboundFlight?.arrivalAirport}</div></div>
                  <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-slate-700"><div className="font-bold text-slate-800 dark:text-white">{inboundFlight?.flightNumber}</div><div className="text-right text-xs text-slate-500">{inboundFlight?.departureAirport} → {inboundFlight?.arrivalAirport}</div></div>
                </div>
                <button onClick={handleCreateTrip} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg">{labels.confirmBtn} <ArrowRight size={18} /></button>
                <button onClick={() => setStep('inbound-select')} className="w-full text-sm text-slate-400 hover:text-slate-600 text-center py-2 flex items-center justify-center gap-1 transition-colors"><ChevronLeft size={14}/> {labels.back}</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
