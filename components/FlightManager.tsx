
import React, { useState } from 'react';
import { Trip, FlightInfo, FlightSegment, Currency, BaggageInfo } from '../types';
import { 
  Plane, Save, Edit2, DollarSign, Briefcase, 
  ShoppingBag, ReceiptText, RefreshCw, X, Search, Loader2, Check, ArrowRight, AlertCircle, ChevronLeft
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
    flightNo: language === 'zh' ? '航班代號 (必填)' : 'Flight No. (Req)',
    search: language === 'zh' ? '搜尋航班' : 'Search Flights',
    review: language === 'zh' ? '確認變更' : 'Review Changes',
    confirm: language === 'zh' ? '更新航班資訊' : 'Update Flight',
    back: language === 'zh' ? '返回上一步' : 'Back',
    datePlaceholder: 'YYYY/MM/DD'
  };

  const handleSearch = async (type: 'out' | 'in') => {
    const fNo = type === 'out' ? outFlightNo : inFlightNo;
    const date = type === 'out' ? outDate : inDate;
    if (!fNo.trim()) {
      alert(language === 'zh' ? "請輸入航班代號" : "Flight No. required");
      return;
    }
    setLoading(true);
    try {
      // 關鍵修正：回程搜尋時將 origin/destination 對調
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
          {step === 'outbound-search' || step === 'inbound-search' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {step === 'outbound-search' ? labels.origin : labels.destination}
                   </label>
                   <input 
                     value={step === 'outbound-search' ? origin : destination} 
                     onChange={e => step === 'outbound-search' ? setOrigin(e.target.value.toUpperCase()) : setDestination(e.target.value.toUpperCase())} 
                     className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold" 
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {step === 'outbound-search' ? labels.destination : labels.origin}
                   </label>
                   <input 
                     value={step === 'outbound-search' ? destination : origin} 
                     onChange={e => step === 'outbound-search' ? setDestination(e.target.value.toUpperCase()) : setOrigin(e.target.value.toUpperCase())} 
                     className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold" 
                   />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.date}</label>
                  <div className="relative h-[52px]">
                    <input type="date" value={step === 'outbound-search' ? outDate : inDate} onChange={e => step === 'outbound-search' ? setOutDate(e.target.value) : setInDate(e.target.value)} className="absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-medium outline-none border-none opacity-0 focus:opacity-100 z-20 transition-opacity" />
                    <div className={`absolute inset-0 w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl font-bold flex items-center z-10 ${(step === 'outbound-search' ? outDate : inDate) ? 'text-slate-900 dark:text-white' : 'text-slate-300'}`}>
                       {(step === 'outbound-search' ? outDate : inDate) || labels.datePlaceholder}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.flightNo}</label>
                  <input 
                    value={step === 'outbound-search' ? outFlightNo : inFlightNo} 
                    onChange={e => step === 'outbound-search' ? setOutFlightNo(e.target.value.toUpperCase()) : setInFlightNo(e.target.value.toUpperCase())} 
                    className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold font-mono" 
                  />
                </div>
              </div>
              <button onClick={() => handleSearch(step === 'outbound-search' ? 'out' : 'in')} disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <><Search size={20}/> {labels.search}</>}
              </button>
              {step === 'inbound-search' && (
                <button onClick={() => setStep('outbound-select')} className="w-full text-xs font-bold text-slate-400 py-2 flex items-center justify-center gap-1 hover:text-slate-600">
                  <ChevronLeft size={14}/> {labels.back}
                </button>
              )}
            </div>
          ) : (step === 'outbound-select' || step === 'inbound-select') ? (
            <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{step === 'outbound-select' ? labels.selectOut : labels.selectIn}</div>
              {options.length > 0 ? options.map((f, i) => (
                <div key={i} onClick={() => { if (step === 'outbound-select') { setTempOutbound(f); setStep('inbound-search'); setOptions([]); } else { setTempInbound(f); setStep('review'); } }} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent hover:border-primary cursor-pointer transition-all">
                  <div className="flex justify-between items-center font-black text-sm dark:text-white">
                    <div className="flex flex-col">
                       <span className="text-[10px] text-slate-400">{language === 'zh' ? (f.airlineNameZh || f.airline) : (f.airlineNameEn || f.airline)}</span>
                       <span>{f.flightNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="block whitespace-nowrap text-xs">{DateTimeUtils.formatTime24(f.departureTime)} {f.departureAirport}</span>
                      <Plane size={12} className="text-slate-300 shrink-0" />
                      <span className="block whitespace-nowrap text-xs">{DateTimeUtils.formatTime24(f.arrivalTime)} {f.arrivalAirport}</span>
                    </div>
                  </div>
                </div>
              )) : <div className="text-center py-10 text-slate-400 font-bold">No results found.</div>}
              <button onClick={() => setStep(step === 'outbound-select' ? 'outbound-search' : 'inbound-search')} className="w-full text-xs font-bold text-slate-400 py-2 flex items-center justify-center gap-1 hover:text-slate-600">
                <ChevronLeft size={14}/> {labels.back}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="p-5 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <div className="text-[10px] font-black text-blue-400 uppercase mb-2">Outbound</div>
                  <div className="font-black dark:text-white">{tempOutbound?.flightNumber} ({tempOutbound?.departureAirport} → {tempOutbound?.arrivalAirport})</div>
               </div>
               <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <div className="text-[10px] font-black text-indigo-400 uppercase mb-2">Inbound</div>
                  <div className="font-black dark:text-white">{tempInbound?.flightNumber} ({tempInbound?.departureAirport} → {tempInbound?.arrivalAirport})</div>
               </div>
               <button onClick={() => onConfirm(tempOutbound!, tempInbound!)} className="w-full mt-6 bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-2">
                 <Check size={20} /> {labels.confirm}
               </button>
               <button onClick={() => setStep('inbound-select')} className="w-full text-xs font-bold text-slate-400 py-2 flex items-center justify-center gap-1 hover:text-slate-600">
                  <ChevronLeft size={14}/> {labels.back}
                </button>
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
  const [flightData, setFlightData] = useState<FlightInfo>(trip.flight || { price: 0, currency: Currency.TWD, cabinClass: 'Economy', outbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '' }, inbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '' }, baggage: { carryOn: { count: 1, weight: '' }, checked: { count: 0, weight: '' } } });

  const labels = {
    title: language === 'zh' ? '航班機票' : 'Flight Tickets',
    edit: language === 'zh' ? '編輯航班' : 'Edit Flight',
    save: language === 'zh' ? '儲存' : 'Save',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    changeFlight: language === 'zh' ? '變更航班資訊' : 'Change Flight',
    pricing: language === 'zh' ? '費用設定' : 'Pricing',
    baggage: language === 'zh' ? '行李規範' : 'Baggage',
    totalPrice: language === 'zh' ? '總票價' : 'Price',
    cabin: language === 'zh' ? '艙等' : 'Cabin',
    checked: language === 'zh' ? '托運行李' : 'Checked',
    carryOn: language === 'zh' ? '手提行李' : 'Carry-on',
    pcs: language === 'zh' ? '件數' : 'Pcs',
    fillBaggage: language === 'zh' ? '請填寫行李重量' : 'Please fill weight',
    outbound: language === 'zh' ? '去程' : 'Outbound',
    inbound: language === 'zh' ? '回程' : 'Inbound'
  };

  const handleFlightSelect = (outbound: FlightSegment, inbound: FlightSegment) => {
    const updatedData = { ...flightData, outbound, inbound };
    setFlightData(updatedData);
    setIsSelectorOpen(false);
    if (!isEditing) {
      onUpdate({ ...trip, flight: updatedData });
    }
  };

  const handleSave = () => {
    const validate = (seg: FlightSegment | undefined) => {
      if (!seg || !seg.flightNumber) return true;
      const baggage = seg.baggage || { carryOn: { count: 1, weight: '' }, checked: { count: 0, weight: '' } };
      if (!baggage.carryOn.weight) return false;
      if (baggage.checked.count > 0 && !baggage.checked.weight) return false;
      return true;
    };

    if (!validate(flightData.outbound) || !validate(flightData.inbound)) {
      alert(labels.fillBaggage);
      return;
    }

    onUpdate({ ...trip, flight: flightData });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFlightData(trip.flight || flightData);
    setIsEditing(false);
  };

  const handleWeightChange = (segKey: 'outbound' | 'inbound', type: 'carryOn' | 'checked', val: string) => {
    const numericVal = val.replace(/[^0-9]/g, '');
    const finalStr = numericVal ? `${numericVal}kg` : '';
    setFlightData(p => {
      const seg = p[segKey]!;
      const baggage = seg.baggage || { carryOn: { count: 1, weight: '' }, checked: { count: 0, weight: '' } };
      return {
        ...p,
        [segKey]: {
          ...seg,
          baggage: {
            ...baggage,
            [type]: { ...baggage[type], weight: finalStr }
          }
        }
      };
    });
  };

  const handleCountChange = (segKey: 'outbound' | 'inbound', type: 'carryOn' | 'checked', val: number) => {
    let finalVal = val;
    if (type === 'carryOn') finalVal = Math.max(1, val);
    else finalVal = Math.max(0, val);

    setFlightData(p => {
      const seg = p[segKey]!;
      const baggage = seg.baggage || { carryOn: { count: 1, weight: '' }, checked: { count: 0, weight: '' } };
      return {
        ...p,
        [segKey]: {
          ...seg,
          baggage: {
            ...baggage,
            [type]: { ...baggage[type], count: finalVal }
          }
        }
      };
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4 sm:px-0">
      {/* 行動端頂部控制列：修正 sticky 位置與 z-index，統一按鈕名稱 */}
      <div className="lg:hidden flex justify-between items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl shadow-ios border border-slate-100 dark:border-slate-700 sticky top-20 z-20 transition-all w-full">
         <div className="flex flex-col min-w-0 flex-1 mr-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{labels.title}</h2>
            <div className="text-sm font-black text-slate-900 dark:text-white truncate">
               {flightData.currency} {flightData.price.toLocaleString()}
            </div>
         </div>
         <div className="flex gap-2 shrink-0">
            {isEditing ? (
              <>
                 <button onClick={handleCancel} className="px-4 py-1.5 rounded-xl font-black text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500">{labels.cancel}</button>
                 <button onClick={handleSave} className="px-4 py-1.5 rounded-xl font-black text-[10px] bg-primary text-white shadow-lg shadow-primary/20">{labels.save}</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 rounded-xl font-black text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Edit2 size={12} /> {labels.edit}
              </button>
            )}
         </div>
      </div>

      {isEditing ? (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
           {/* 電腦版控制列 */}
           <div className="hidden lg:flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-[32px] border border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">{labels.edit}</h2>
              <div className="flex gap-3">
                 <button onClick={handleCancel} className="px-6 py-2.5 rounded-2xl font-black text-sm text-slate-400 hover:bg-slate-50 transition-all">{labels.cancel}</button>
                 <button onClick={handleSave} className="bg-primary text-white px-8 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20">
                   <Save size={18}/> {labels.save}
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-8 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-ios">
                 <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 mb-6 text-xs uppercase tracking-widest"><DollarSign size={16} className="text-primary"/> {labels.pricing}</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.totalPrice}</label>
                       <div className="flex gap-2">
                          <select value={flightData.currency} onChange={e => setFlightData(p => ({ ...p, currency: e.target.value as Currency }))} className="bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-sm">
                             {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input type="number" value={flightData.price || ''} onChange={e => setFlightData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-black text-sm" placeholder="0" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.cabin}</label>
                       <select value={flightData.cabinClass} onChange={e => setFlightData(p => ({ ...p, cabinClass: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-sm">
                          <option value="Economy">Economy</option><option value="Premium Economy">Premium Economy</option><option value="Business">Business</option><option value="First">First Class</option>
                       </select>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 text-center">
                 <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md"><RefreshCw size={20} /></div>
                 <h3 className="font-black text-slate-800 dark:text-white text-[11px] uppercase tracking-widest">{labels.changeFlight}</h3>
                 <button onClick={() => setIsSelectorOpen(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-2xl font-black text-[10px] hover:scale-105 transition-all">
                    {labels.changeFlight}
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[ {key: 'outbound', label: labels.outbound}, {key: 'inbound', label: labels.inbound} ].map(seg => {
                 const data = flightData[seg.key as 'outbound' | 'inbound'];
                 if (!data || !data.flightNumber) return null;
                 const baggage = data.baggage || { carryOn: { count: 1, weight: '' }, checked: { count: 0, weight: '' } };
                 const isMissing = !baggage.carryOn.weight || (baggage.checked.count > 0 && !baggage.checked.weight);

                 return (
                    <div key={seg.key} className={`p-8 bg-white dark:bg-slate-800 rounded-[32px] border transition-all duration-300 ${isMissing ? 'border-red-500/30 ring-1 ring-red-500/10' : 'border-slate-100 dark:border-slate-700'}`}>
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-xs uppercase tracking-widest"><ShoppingBag size={18} className="text-secondary"/> {seg.label}{labels.baggage}</h3>
                          {isMissing && <div className="text-[9px] font-black text-red-500 animate-pulse uppercase tracking-widest"><AlertCircle size={12} className="inline mr-1"/>{labels.fillBaggage}</div>}
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.carryOn}</div>
                             <div className="flex gap-2">
                                <input type="number" value={baggage.carryOn.weight.replace('kg','')} onChange={e => handleWeightChange(seg.key as any, 'carryOn', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-xs" placeholder="7 (kg)" />
                                <input type="number" min="1" value={baggage.carryOn.count} onChange={e => handleCountChange(seg.key as any, 'carryOn', parseInt(e.target.value) || 1)} className="w-16 bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-xs" />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labels.checked}</div>
                             <div className="flex gap-2">
                                <input type="number" disabled={baggage.checked.count === 0} value={baggage.checked.weight.replace('kg','')} onChange={e => handleWeightChange(seg.key as any, 'checked', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-xs ${baggage.checked.count === 0 ? 'opacity-30' : ''}`} placeholder="23 (kg)" />
                                <input type="number" min="0" value={baggage.checked.count} onChange={e => handleCountChange(seg.key as any, 'checked', parseInt(e.target.value) || 0)} className="w-16 bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold text-xs" />
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 w-full">
           <div className="lg:col-span-2 space-y-6">
              {!flightData.outbound.flightNumber ? (
                <div className="py-24 bg-white dark:bg-slate-800 rounded-[40px] border-2 border-dashed border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center gap-6">
                   <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-200"><Plane size={32} /></div>
                   <button onClick={() => setIsSelectorOpen(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-all">{labels.changeFlight}</button>
                </div>
              ) : (
                <div className="space-y-6">
                   <BoardingPass segment={flightData.outbound} cabinClass={flightData.cabinClass} />
                   {flightData.inbound?.flightNumber && <BoardingPass segment={flightData.inbound} cabinClass={flightData.cabinClass} />}
                </div>
              )}
           </div>
           {/* 費用摘要卡片：行動端與平板寬度（lg以下）隱藏 */}
           <div className="hidden lg:block bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-ios h-fit w-full">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">{labels.pricing}</h3>
                 <button onClick={() => setIsEditing(true)} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                    <Edit2 size={18} />
                 </button>
              </div>
              <div className="space-y-6">
                 <div className="flex flex-col gap-1 min-w-0 overflow-hidden">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Price</span>
                    <span className="text-2xl sm:text-3xl font-black text-primary break-all leading-tight">
                       {flightData.currency} {flightData.price.toLocaleString()}
                    </span>
                    {flightData.price === 0 && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-1">Pending Costs</span>}
                 </div>
                 <div className="pt-6 border-t border-slate-50 dark:border-slate-700 grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cabin</span>
                       <div className="font-black text-slate-700 dark:text-slate-200 text-sm truncate uppercase tracking-tight">{flightData.cabinClass}</div>
                    </div>
                    <div className="min-w-0">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                       <div className="font-black text-green-500 text-sm truncate flex items-center gap-1"><Check size={14}/> OK</div>
                    </div>
                 </div>
                 <div className="pt-6 border-t border-slate-50 dark:border-slate-700">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">{labels.baggage}</span>
                    <div className="space-y-4">
                       {[flightData.outbound, flightData.inbound].map((seg, i) => {
                          if (!seg || !seg.flightNumber) return null;
                          return (
                             <div key={i} className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                   <Plane size={14} className={`text-slate-300 shrink-0 ${i === 1 ? 'rotate-180' : ''}`} />
                                   <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase truncate">{i === 0 ? labels.outbound : labels.inbound}</span>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                   <div className={`p-1.5 rounded-lg text-[9px] font-black flex items-center gap-1 border ${!seg.baggage?.carryOn.weight ? 'bg-red-50 border-red-100 text-red-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                      <ShoppingBag size={10} /> {seg.baggage?.carryOn.weight || '?'}
                                   </div>
                                   <div className={`p-1.5 rounded-lg text-[9px] font-black flex items-center gap-1 border ${seg.baggage?.checked.count === 0 ? 'opacity-30' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                      <Briefcase size={10} /> {seg.baggage?.checked.weight || '0kg'}
                                   </div>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 </div>
                 <button onClick={() => setIsSelectorOpen(true)} className="w-full mt-4 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[24px] font-black text-xs hover:scale-[1.02] transition-all shadow-xl shadow-slate-200 dark:shadow-none">
                    <RefreshCw size={14} className="inline mr-2" /> {labels.changeFlight}
                 </button>
              </div>
           </div>
        </div>
      )}

      {isSelectorOpen && (
        <FlightSelectorModal 
          onClose={() => setIsSelectorOpen(false)} 
          onConfirm={handleFlightSelect} 
          initialOrigin={flightData.outbound.departureAirport || 'TPE'} 
          initialDestination={flightData.outbound.arrivalAirport || ''}
        />
      )}
    </div>
  );
};
