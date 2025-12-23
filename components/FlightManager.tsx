
import React, { useState } from 'react';
import { Trip, FlightInfo, FlightSegment, Currency, BaggageInfo, ItineraryItem } from '../types';
import { Plane, Save, Edit2, Search, Loader2, DollarSign, Briefcase, ShoppingBag, ReceiptText } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { BoardingPass } from './BoardingPass';
import { CustomDateTimeInput } from './CustomDateTimeInput';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from '../App';

interface FlightSegmentInputProps {
  title: string;
  isOutbound: boolean;
  data: FlightSegment;
  date: string;
  loading: boolean;
  onSearch: () => void;
  onChange: (field: string, val: any) => void;
  lang: 'zh' | 'en';
}

const FlightSegmentInput: React.FC<FlightSegmentInputProps> = ({ title, isOutbound, data, date, loading, onSearch, onChange, lang }) => {
  const baggage = data.baggage || { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } };
  const labels = {
    date: lang === 'zh' ? '日期：' : 'Date: ',
    flightNo: lang === 'zh' ? '航班號碼' : 'Flight No.',
    depAirport: lang === 'zh' ? '起飛機場' : 'Departure',
    arrAirport: lang === 'zh' ? '目的地機場' : 'Arrival',
    depTime: lang === 'zh' ? '起飛時間' : 'Departure Time',
    arrTime: lang === 'zh' ? '抵達時間' : 'Arrival Time',
    terminal: lang === 'zh' ? '航廈 (Terminal)' : 'Terminal',
    search: lang === 'zh' ? '搜尋' : 'Search',
    baggage: lang === 'zh' ? '行李規範' : 'Baggage',
    carryOn: lang === 'zh' ? '手提重量' : 'Carry-on Weight',
    checked: lang === 'zh' ? '托運重量' : 'Checked Weight',
    count: lang === 'zh' ? '件數' : 'Pcs'
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl space-y-4 relative border border-gray-100 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Plane className={!isOutbound ? 'rotate-180' : ''} size={18} /> {title}
        </h3>
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-100 dark:border-slate-700 shadow-sm">
          {labels.date}{date}
        </div>
      </div>
      
      {/* 優化過的 Grid：增加時間欄位的空間比例 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="space-y-1 md:col-span-6">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{labels.flightNo}</label>
          <div className="flex gap-2">
            <input value={data.flightNumber} onChange={e => onChange('flightNumber', e.target.value.toUpperCase())} placeholder="BR198" className="flex-1 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold uppercase focus:ring-2 focus:ring-primary/20 outline-none shadow-sm" />
            <button onClick={onSearch} disabled={loading || !data.flightNumber} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90 disabled:opacity-50 p-2 px-4 rounded-xl transition-all flex items-center gap-2 shadow-sm font-bold text-xs">
              {loading ? <Loader2 className="animate-spin" size={16}/> : <><Search size={16}/> {labels.search}</>}
            </button>
          </div>
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-[10px] text-slate-500 font-bold uppercase">{labels.depAirport}</label>
          <input value={data.departureAirport} onChange={e => onChange('departureAirport', e.target.value.toUpperCase())} placeholder="TPE" className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold font-mono outline-none shadow-sm" />
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-[10px] text-slate-500 font-bold uppercase">{labels.arrAirport}</label>
          <input value={data.arrivalAirport} onChange={e => onChange('arrivalAirport', e.target.value.toUpperCase())} placeholder="NRT" className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold font-mono outline-none shadow-sm" />
        </div>
        
        {/* 時間與航廈 */}
        <div className="md:col-span-5"><CustomDateTimeInput label={labels.depTime} value={data.departureTime} onChange={(val) => onChange('departureTime', val)} /></div>
        <div className="md:col-span-5"><CustomDateTimeInput label={labels.arrTime} value={data.arrivalTime} onChange={(val) => onChange('arrivalTime', val)} /></div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase">{labels.terminal}</label>
          <input value={data.terminal || ''} onChange={e => onChange('terminal', e.target.value)} placeholder="2" className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10" />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">{labels.baggage}</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
           <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><ShoppingBag size={10}/> {labels.carryOn}</label>
              <input value={baggage.carryOn.weight} onChange={e => onChange('baggage', { ...baggage, carryOn: { ...baggage.carryOn, weight: e.target.value } })} placeholder="e.g. 7kg" className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold shadow-sm" />
           </div>
           <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold">{labels.count}</label>
              <input type="number" value={baggage.carryOn.count} onChange={e => onChange('baggage', { ...baggage, carryOn: { ...baggage.carryOn, count: parseInt(e.target.value) || 0 } })} className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold shadow-sm" />
           </div>
           <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Briefcase size={10}/> {labels.checked}</label>
              <input value={baggage.checked.weight} onChange={e => onChange('baggage', { ...baggage, checked: { ...baggage.checked, weight: e.target.value } })} placeholder="e.g. 23kg" className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold shadow-sm" />
           </div>
           <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold">{labels.count}</label>
              <input type="number" value={baggage.checked.count} onChange={e => onChange('baggage', { ...baggage, checked: { ...baggage.checked, count: parseInt(e.target.value) || 0 } })} className="w-full bg-white dark:bg-slate-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold shadow-sm" />
           </div>
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
  const [loadingField, setLoadingField] = useState<'outbound' | 'inbound' | null>(null);
  const defaultBaggage: BaggageInfo = { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } };
  const [flightData, setFlightData] = useState<FlightInfo>(trip.flight || { price: 0, currency: Currency.TWD, cabinClass: 'Economy', outbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: defaultBaggage }, inbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: defaultBaggage }, baggage: defaultBaggage });

  const labels = {
    title: language === 'zh' ? '航班機票' : 'Flight Tickets',
    subtitle: language === 'zh' ? '變更後將自動同步至行程規劃表' : 'Syncs automatically to your itinerary',
    edit: language === 'zh' ? '編輯資訊' : 'Edit Info',
    save: language === 'zh' ? '儲存並同步行程' : 'Save & Sync',
    outbound: language === 'zh' ? '去程航班' : 'Outbound Flight',
    inbound: language === 'zh' ? '回程航班' : 'Inbound Flight',
    costSettings: language === 'zh' ? '機票費用設定' : 'Pricing Settings',
    totalPrice: language === 'zh' ? '總票價' : 'Total Price',
    cabin: language === 'zh' ? '艙等' : 'Cabin Class',
    noFlights: language === 'zh' ? '尚未添加航班資訊' : 'No flight information added',
    priceSummary: language === 'zh' ? '機票總計費用' : 'Total Flight Cost',
    currentCabin: language === 'zh' ? '目前艙等' : 'Cabin',
    pending: language === 'zh' ? '尚未填寫費用' : 'Price Pending'
  };

  const handleSave = () => {
    let newItinerary = [...(trip.itinerary || [])];
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (newItinerary.length === 0) {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        newItinerary.push({ date: d.toISOString().split('T')[0], items: [] });
      }
    }
    const outbound = flightData.outbound;
    if (outbound.flightNumber && outbound.departureAirport) {
      const day1 = { ...newItinerary[0] };
      const filtered = day1.items.filter(item => !item.id.includes('outbound-flight'));
      day1.items = [
        { id: 'outbound-flight-dep', time: DateTimeUtils.formatTime24(outbound.departureTime), placeName: `Airport ${outbound.departureAirport}`, type: 'Transport' as const, note: `Flight: ${outbound.flightNumber}` },
        { id: 'outbound-flight-arr', time: DateTimeUtils.formatTime24(outbound.arrivalTime), placeName: `Airport ${outbound.arrivalAirport}`, type: 'Transport' as const, note: `Terminal: ${outbound.terminal || 'TBA'}` },
        ...filtered
      ].sort((a,b) => a.time.localeCompare(b.time));
      newItinerary[0] = day1;
    }
    const inbound = flightData.inbound;
    if (inbound && inbound.flightNumber && inbound.departureAirport) {
      const lastDay = { ...newItinerary[newItinerary.length - 1] };
      const filtered = lastDay.items.filter(item => !item.id.includes('inbound-flight'));
      lastDay.items = [
        ...filtered,
        { id: 'inbound-flight-dep', time: DateTimeUtils.formatTime24(inbound.departureTime), placeName: `Airport ${inbound.departureAirport}`, type: 'Transport' as const, note: `Flight: ${inbound.flightNumber}` },
        { id: 'inbound-flight-arr', time: DateTimeUtils.formatTime24(inbound.arrivalTime), placeName: `Airport ${inbound.arrivalAirport}`, type: 'Transport' as const, note: `Terminal: ${inbound.terminal || 'TBA'}` }
      ].sort((a,b) => a.time.localeCompare(b.time));
      newItinerary[newItinerary.length - 1] = lastDay;
    }
    onUpdate({ ...trip, itinerary: newItinerary, flight: flightData });
    setIsEditing(false);
  };

  const handleTdxSearch = async (type: 'outbound' | 'inbound') => {
    const seg = type === 'outbound' ? flightData.outbound : flightData.inbound!;
    const date = type === 'outbound' ? trip.startDate : trip.endDate;
    if (!seg.flightNumber || !seg.departureAirport || !seg.arrivalAirport) return alert("請填入必要資訊以搜尋。");
    setLoadingField(type);
    try {
      const results = await fetchTdxFlights(seg.departureAirport, seg.arrivalAirport, date, seg.flightNumber);
      if (results && results.length > 0) {
        setFlightData(prev => ({ ...prev, [type]: { ...prev[type]!, ...results[0] } }));
      } else alert("找不到航班資訊。");
    } catch (e) { alert("搜尋失敗。"); } finally { setLoadingField(null); }
  };

  const isPricePending = flightData.price === 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-white">{labels.title}</h2><p className="text-slate-500 dark:text-slate-400 text-sm">{labels.subtitle}</p></div>
        <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all ${isEditing ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:opacity-80'}`}>
          {isEditing ? <><Save size={18}/> {labels.save}</> : <><Edit2 size={18}/> {labels.edit}</>}
        </button>
      </div>
      {isEditing ? (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-8">
           <FlightSegmentInput lang={language} title={labels.outbound} isOutbound={true} data={flightData.outbound} date={trip.startDate} loading={loadingField === 'outbound'} onSearch={() => handleTdxSearch('outbound')} onChange={(f, v) => setFlightData(p => ({ ...p, outbound: { ...p.outbound, [f]: v } }))} />
           <FlightSegmentInput lang={language} title={labels.inbound} isOutbound={false} data={flightData.inbound!} date={trip.endDate} loading={loadingField === 'inbound'} onSearch={() => handleTdxSearch('inbound')} onChange={(f, v) => setFlightData(p => ({ ...p, inbound: { ...p.inbound!, [f]: v } }))} />
           
           {/* 機票費用設定：加入動態邊框提醒樣式 */}
           <div className={`transition-all duration-500 p-6 rounded-2xl border ${
             isPricePending 
               ? 'bg-red-50/20 dark:bg-red-900/10 border-red-400/60 dark:border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)] ring-1 ring-red-400/10' 
               : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
           }`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className={`font-bold mb-0 flex items-center gap-2 text-sm ${isPricePending ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                 <DollarSign size={18}/> {labels.costSettings}
               </h3>
               {isPricePending && (
                 <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-[9px] font-black text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/30 animate-pulse">
                   {labels.pending}
                 </span>
               )}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">{labels.totalPrice}</label>
                  <div className="flex gap-2">
                    <select value={flightData.currency} onChange={e => setFlightData(p => ({ ...p, currency: e.target.value as Currency }))} className="bg-white dark:bg-slate-800 dark:text-white p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold shadow-sm outline-none">
                      {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" value={flightData.price === 0 ? '' : flightData.price} onChange={e => setFlightData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="flex-1 bg-white dark:bg-slate-800 dark:text-white p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">{labels.cabin}</label>
                  <select value={flightData.cabinClass} onChange={e => setFlightData(p => ({ ...p, cabinClass: e.target.value }))} className="w-full bg-white dark:bg-slate-800 dark:text-white p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary/10">
                    <option value="Economy">Economy</option><option value="Premium Economy">Premium Economy</option><option value="Business">Business</option><option value="First">First Class</option>
                  </select>
                </div>
             </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6">
           {(!trip.flight?.outbound.flightNumber && !trip.flight?.inbound?.flightNumber) ? (
             <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 border-dashed"><Plane className="mx-auto text-slate-200 dark:text-slate-700 mb-2" size={48} /><p className="text-slate-400 font-medium">{labels.noFlights}</p></div>
           ) : (
             <div className="space-y-6">
                <div className="space-y-4">
                  <BoardingPass segment={trip.flight!.outbound} cabinClass={trip.flight!.cabinClass} />
                  {trip.flight!.inbound && trip.flight!.inbound.flightNumber && <BoardingPass segment={trip.flight!.inbound} cabinClass={trip.flight!.cabinClass} />}
                </div>
                {flightData.price > 0 && (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between border-l-4 border-l-primary">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-primary/5 dark:bg-primary/20 text-primary rounded-2xl flex items-center justify-center"><ReceiptText size={24} /></div>
                       <div><div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.priceSummary}</div><div className="text-xl font-bold text-slate-800 dark:text-white">{flightData.currency} {flightData.price.toLocaleString()}</div></div>
                    </div>
                    <div className="text-right"><div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.currentCabin}</div><div className="font-bold text-slate-600 dark:text-slate-300">{flightData.cabinClass}</div></div>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
