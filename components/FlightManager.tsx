
import React, { useState } from 'react';
import { Trip, FlightInfo, FlightSegment, Currency, Expense } from '../types';
import { 
  Plane, Save, Edit2, DollarSign, RefreshCw, X, Search, Loader2, Check, ChevronLeft, ShoppingBag
} from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { BoardingPass } from './BoardingPass';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from '../App';

interface FlightSelectorModalProps {
  onClose: () => void;
  onConfirm: (outbound: FlightSegment, inbound: FlightSegment) => void;
  initialOrigin: string;
  initialDestination: string;
}

type ModalStep = 'outbound-search' | 'outbound-select' | 'inbound-search' | 'inbound-select' | 'review';

const FlightSelectorModal: React.FC<FlightSelectorModalProps> = ({ onClose, onConfirm, initialOrigin, initialDestination }) => {
  const { language } = useTranslation();
  const [step, setStep] = useState<ModalStep>('outbound-search');
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [outDate, setOutDate] = useState('');
  const [inDate, setInDate] = useState('');
  const [outFlightNo, setOutFlightNo] = useState('');
  const [inFlightNo, setInFlightNo] = useState('');
  const [options, setOptions] = useState<FlightSegment[]>([]);
  const [tempOutbound, setTempOutbound] = useState<FlightSegment | null>(null);
  const [tempInbound, setTempInbound] = useState<FlightSegment | null>(null);

  const labels = {
    searchOut: language === 'zh' ? '搜尋去程航班' : 'Search Outbound',
    searchIn: language === 'zh' ? '搜尋回程航班' : 'Search Inbound',
    selectOut: language === 'zh' ? '請選擇去程航班' : 'Select Outbound',
    selectIn: language === 'zh' ? '請選擇回程航班' : 'Select Inbound',
    origin: language === 'zh' ? '出發地' : 'Origin',
    destination: language === 'zh' ? '目的地' : 'Destination',
    date: language === 'zh' ? '日期' : 'Date',
    flightNo: language === 'zh' ? '航班代號' : 'Flight No.',
    search: language === 'zh' ? '搜尋航班' : 'Search Flights',
    review: language === 'zh' ? '確認變更' : 'Review Changes',
    confirm: language === 'zh' ? '更新航班資訊' : 'Update Flight',
    back: language === 'zh' ? '返回' : 'Back'
  };

  const handleSearch = async (type: 'out' | 'in') => {
    const fNo = type === 'out' ? outFlightNo : inFlightNo;
    const date = type === 'out' ? outDate : inDate;
    if (!fNo.trim()) return;
    setLoading(true);
    try {
      const from = type === 'out' ? origin : destination;
      const to = type === 'out' ? destination : origin;
      const res = await fetchTdxFlights(from, to, date, fNo);
      setOptions(res);
      setStep(type === 'out' ? 'outbound-select' : 'inbound-select');
    } catch (e) { alert("Search failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-black text-xl text-slate-800 dark:text-white">
            {step.includes('outbound') ? labels.searchOut : step.includes('inbound') ? labels.searchIn : labels.review}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {(step === 'outbound-search' || step === 'inbound-search') ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.origin}</label><input value={step === 'outbound-search' ? origin : destination} onChange={e => step === 'outbound-search' ? setOrigin(e.target.value.toUpperCase()) : setDestination(e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.destination}</label><input value={step === 'outbound-search' ? destination : origin} onChange={e => step === 'outbound-search' ? setDestination(e.target.value.toUpperCase()) : setOrigin(e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.date}</label><input type="date" value={step === 'outbound-search' ? outDate : inDate} onChange={e => step === 'outbound-search' ? setOutDate(e.target.value) : setInDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.flightNo}</label><input value={step === 'outbound-search' ? outFlightNo : inFlightNo} onChange={e => step === 'outbound-search' ? setOutFlightNo(e.target.value.toUpperCase()) : setInFlightNo(e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold font-mono outline-none" /></div>
              </div>
              <button onClick={() => handleSearch(step === 'outbound-search' ? 'out' : 'in')} disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <><Search size={20}/> {labels.search}</>}
              </button>
              {step === 'inbound-search' && <button onClick={() => setStep('outbound-select')} className="w-full text-slate-400 font-bold text-xs py-2 flex items-center justify-center gap-1"><ChevronLeft size={14} /> {labels.back}</button>}
            </div>
          ) : (step === 'outbound-select' || step === 'inbound-select') ? (
            <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{step === 'outbound-select' ? labels.selectOut : labels.selectIn}</div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                {options.length > 0 ? options.map((f, i) => (
                  <div key={i} onClick={() => { if (step === 'outbound-select') { setTempOutbound(f); setStep('inbound-search'); setOptions([]); } else { setTempInbound(f); setStep('review'); } }} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent hover:border-primary cursor-pointer transition-all">
                    <div className="flex justify-between items-center font-black text-sm dark:text-white">
                      <div className="flex flex-col"><span className="text-[10px] text-slate-400">{(f.airlineNameZh || f.airline)}</span><span>{f.flightNumber}</span></div>
                      <div className="flex items-center gap-2 text-right"><span className="text-xs">{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span><Plane size={12} className="text-slate-300 shrink-0" /><span className="text-xs">{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span></div>
                    </div>
                  </div>
                )) : <div className="text-center py-10 text-slate-400 font-bold">No flights found</div>}
              </div>
              <button onClick={() => setStep(step === 'outbound-select' ? 'outbound-search' : 'inbound-search')} className="w-full text-slate-400 font-bold text-xs py-2 flex items-center justify-center gap-1"><ChevronLeft size={14} /> {labels.back}</button>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="space-y-3">
                 <div className="p-5 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800"><div className="text-[10px] font-black text-blue-400 uppercase mb-2">Outbound</div><div className="font-black dark:text-white">{tempOutbound?.flightNumber} ({tempOutbound?.departureAirport} → {tempOutbound?.arrivalAirport})</div></div>
                 <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800"><div className="text-[10px] font-black text-indigo-400 uppercase mb-2">Inbound</div><div className="font-black dark:text-white">{tempInbound?.flightNumber} ({tempInbound?.departureAirport} → {tempInbound?.arrivalAirport})</div></div>
               </div>
               <button onClick={() => onConfirm(tempOutbound!, tempInbound!)} className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-2 transition-transform active:scale-95"><Check size={20} /> {labels.confirm}</button>
               <button onClick={() => setStep('inbound-select')} className="w-full text-slate-400 font-bold text-xs py-2 flex items-center justify-center gap-1"><ChevronLeft size={14} /> {labels.back}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const FlightManager: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  
  const defaultBaggage = {
    carryOn: { count: 1, weight: '7kg' },
    checked: { count: 0, weight: '23kg' }
  };

  const [flightData, setFlightData] = useState<FlightInfo>(trip.flight || { 
    price: 0, currency: Currency.TWD, cabinClass: 'Economy', 
    outbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: { ...defaultBaggage } }, 
    inbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: { ...defaultBaggage } }, 
    baggage: { ...defaultBaggage } 
  });

  const isPriceInvalid = flightData.price === 0;

  const labels = {
    title: language === 'zh' ? '航班機票' : 'Flight Tickets',
    edit: language === 'zh' ? '編輯航班' : 'Edit Flight',
    save: language === 'zh' ? '儲存' : 'Save',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    changeFlight: language === 'zh' ? '變更航班資訊' : 'Change Flight',
    pricing: language === 'zh' ? '費用設定' : 'Pricing',
    baggage: language === 'zh' ? '行李規範' : 'Baggage',
    totalPrice: language === 'zh' ? '總票價 (必填)' : 'Price (Required)',
    cabin: language === 'zh' ? '艙等' : 'Cabin',
    checked: language === 'zh' ? '托運行李' : 'Checked',
    carryOn: language === 'zh' ? '手提行李' : 'Carry-on',
    pcs: language === 'zh' ? '件數 (Pcs)' : 'Pcs',
    weight: language === 'zh' ? '重量 (kg)' : 'Weight',
    flightExpenseNoteZh: '機票 (Flight Ticket)',
    flightExpenseNoteEn: 'Flight Ticket'
  };

  const handleFlightSelect = (outbound: FlightSegment, inbound: FlightSegment) => {
    setFlightData(prev => ({
      ...prev,
      outbound: { ...outbound, baggage: prev.outbound.baggage || defaultBaggage },
      inbound: { ...inbound, baggage: prev.inbound.baggage || defaultBaggage }
    }));
    setIsSelectorOpen(false);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (isPriceInvalid) return;

    let currentExpenses = [...trip.expenses];
    /**
     * BUG FIX: 修復機票重複產生 Bug。
     * 同時比對中英兩種預設名稱，確保無論語系為何，都能正確定位同一筆支出紀錄並更新之。
     */
    const flightExpenseIndex = currentExpenses.findIndex(e => 
      e.category === 'Tickets' && 
      (e.note === labels.flightExpenseNoteZh || e.note === labels.flightExpenseNoteEn)
    );
    
    const rates: Record<string, number> = { 'TWD': 1, 'USD': 31.5, 'JPY': 0.21, 'EUR': 34.2, 'KRW': 0.024 };
    const updatedExpense: Expense = {
      id: flightExpenseIndex > -1 ? currentExpenses[flightExpenseIndex].id : `flight-${Date.now()}`,
      amount: flightData.price,
      currency: flightData.currency,
      category: 'Tickets',
      date: trip.startDate,
      note: language === 'zh' ? labels.flightExpenseNoteZh : labels.flightExpenseNoteEn,
      exchangeRate: rates[flightData.currency] || 1,
      createdAt: flightExpenseIndex > -1 ? currentExpenses[flightExpenseIndex].createdAt : new Date().toISOString()
    };

    if (flightExpenseIndex > -1) {
      currentExpenses[flightExpenseIndex] = updatedExpense;
    } else {
      currentExpenses.push(updatedExpense);
    }

    onUpdate({ ...trip, flight: flightData, expenses: currentExpenses });
    setIsEditing(false);
  };

  const handleBaggageChange = (segKey: 'outbound' | 'inbound', type: 'carryOn' | 'checked', field: 'count' | 'weight', value: any) => {
    setFlightData(prev => {
      const segment = prev[segKey]!;
      const baggage = { ...(segment.baggage || { ...defaultBaggage }) };
      const currentConfig = { ...baggage[type] };

      if (field === 'count') {
        currentConfig.count = parseInt(value) || 0;
        if (currentConfig.count === 0) currentConfig.weight = '';
        else if (!currentConfig.weight) currentConfig.weight = type === 'carryOn' ? '7kg' : '23kg';
      } else {
        const num = value.replace(/[^0-9]/g, '');
        currentConfig.weight = num ? `${num}kg` : '';
      }

      baggage[type] = currentConfig;
      return { ...prev, [segKey]: { ...segment, baggage } };
    });
  };

  const getWeightNumeric = (weightStr: string) => weightStr.replace(/[^0-9]/g, '');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4 sm:px-0">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">{labels.title}</h2>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button onClick={() => { setFlightData(trip.flight || flightData); setIsEditing(false); }} className="px-6 py-2.5 rounded-2xl font-black text-sm text-slate-400 hover:text-slate-600 transition-colors">{labels.cancel}</button>
              <button 
                onClick={handleSave} 
                disabled={isPriceInvalid}
                className={`px-8 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg ${isPriceInvalid ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-primary text-white hover:opacity-90'}`}
              >
                <Save size={18}/> {labels.save}
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-6 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"><Edit2 size={16}/> {labels.edit}</button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`p-8 rounded-[32px] border transition-all duration-300 shadow-ios ${isPriceInvalid ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                 <h3 className={`font-black flex items-center gap-2 mb-6 text-xs uppercase tracking-widest ${isPriceInvalid ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                    <DollarSign size={16} className={isPriceInvalid ? 'text-red-500' : 'text-primary'}/> {labels.pricing}
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <label className={`text-[10px] font-black uppercase tracking-widest ${isPriceInvalid ? 'text-red-400' : 'text-slate-400'}`}>{labels.totalPrice}</label>
                       <div className="flex gap-2">
                          <select value={flightData.currency} onChange={e => setFlightData(p => ({ ...p, currency: e.target.value as Currency }))} className="bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-sm outline-none">
                             {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input 
                            type="number" 
                            value={flightData.price || ''} 
                            onChange={e => setFlightData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} 
                            className={`flex-1 min-w-0 p-3 rounded-xl border-none font-black text-sm outline-none transition-all bg-slate-50 dark:bg-slate-900 dark:text-white ${isPriceInvalid ? 'ring-2 ring-red-500 shadow-lg shadow-red-500/10' : ''}`} 
                            placeholder="0" 
                          />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.cabin}</label>
                       <select value={flightData.cabinClass} onChange={e => setFlightData(p => ({ ...p, cabinClass: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-sm outline-none">
                          <option value="Economy">Economy</option><option value="Business">Business</option><option value="First">First Class</option>
                       </select>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 text-center">
                 <RefreshCw size={24} className="text-slate-400" />
                 <h3 className="font-black text-slate-800 dark:text-white text-[11px] uppercase tracking-widest">{labels.changeFlight}</h3>
                 <button onClick={() => setIsSelectorOpen(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-2xl font-black text-[10px] hover:scale-105 shadow-md transition-all">{labels.changeFlight}</button>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(['outbound', 'inbound'] as const).map(key => {
                 const data = flightData[key];
                 if (!data || !data.flightNumber) return null;
                 const baggage = data.baggage || { ...defaultBaggage };

                 return (
                    <div key={key} className="p-8 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-ios">
                       <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 mb-8 text-xs uppercase tracking-widest">
                         <ShoppingBag size={18} className="text-secondary"/> {key === 'outbound' ? (language === 'zh' ? '去程' : 'Outbound') : (language === 'zh' ? '回程' : 'Inbound')} {labels.baggage}
                       </h3>
                       <div className="space-y-8 sm:space-y-10">
                          <div className="space-y-4">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{labels.carryOn}</div>
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                              <div className="flex-1 space-y-2">
                                <label className="text-[10px] text-slate-400 font-bold ml-1">{labels.weight}</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={getWeightNumeric(baggage.carryOn.weight)} 
                                    onChange={e => handleBaggageChange(key, 'carryOn', 'weight', e.target.value)} 
                                    disabled={baggage.carryOn.count === 0} 
                                    className={`w-full p-3 rounded-2xl border-none font-bold text-sm outline-none transition-all ${baggage.carryOn.count === 0 ? 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-400/40 opacity-60 backdrop-blur-sm' : 'bg-slate-50 dark:bg-slate-900 dark:text-white'} ${baggage.carryOn.count > 0 && !baggage.carryOn.weight ? 'ring-1 ring-red-500 bg-red-50/50' : 'focus:ring-1 focus:ring-primary/20'}`} 
                                    placeholder="7" 
                                  />
                                  {baggage.carryOn.count > 0 && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">kg</span>}
                                </div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <label className="text-[10px] text-slate-400 font-bold ml-1">{labels.pcs}</label>
                                <input type="number" min="0" value={baggage.carryOn.count} onChange={e => handleBaggageChange(key, 'carryOn', 'count', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-2xl border-none font-bold text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary/20" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{labels.checked}</div>
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                              <div className="flex-1 space-y-2">
                                <label className="text-[10px] text-slate-400 font-bold ml-1">{labels.weight}</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={getWeightNumeric(baggage.checked.weight)} 
                                    onChange={e => handleBaggageChange(key, 'checked', 'weight', e.target.value)} 
                                    disabled={baggage.checked.count === 0} 
                                    className={`w-full p-3 rounded-2xl border-none font-bold text-sm outline-none transition-all ${baggage.checked.count === 0 ? 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-400/40 opacity-60 backdrop-blur-sm' : 'bg-slate-50 dark:bg-slate-900 dark:text-white'} ${baggage.checked.count > 0 && !baggage.checked.weight ? 'ring-1 ring-red-500 bg-red-50/50' : 'focus:ring-1 focus:ring-primary/20'}`} 
                                    placeholder="23" 
                                  />
                                  {baggage.checked.count > 0 && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">kg</span>}
                                </div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <label className="text-[10px] text-slate-400 font-bold ml-1">{labels.pcs}</label>
                                <input type="number" min="0" value={baggage.checked.count} onChange={e => handleBaggageChange(key, 'checked', 'count', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-2xl border-none font-bold text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary/20" />
                              </div>
                            </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {flightData.outbound.flightNumber ? (
            <div className="space-y-6">
              <BoardingPass segment={flightData.outbound} cabinClass={flightData.cabinClass} />
              {flightData.inbound?.flightNumber && <BoardingPass segment={flightData.inbound} cabinClass={flightData.cabinClass} />}
            </div>
          ) : (
            <div className="py-24 bg-white dark:bg-slate-800 rounded-[40px] border-2 border-dashed border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center gap-6 text-slate-300">
              <Plane size={48} />
              <button onClick={() => setIsSelectorOpen(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-black text-sm shadow-lg">{labels.changeFlight}</button>
            </div>
          )}
        </div>
      )}

      {isSelectorOpen && <FlightSelectorModal onClose={() => setIsSelectorOpen(false)} onConfirm={handleFlightSelect} initialOrigin={flightData.outbound.departureAirport || 'TPE'} initialDestination={flightData.outbound.arrivalAirport || ''} />}
    </div>
  );
};
