
import React, { useState } from 'react';
import { Trip, FlightInfo, FlightSegment, Currency, BaggageInfo } from '../types';
import { Plane, Save, Edit2, Search, Loader2, DollarSign, Briefcase, ShoppingBag, ReceiptText } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { BoardingPass } from './BoardingPass';

interface FlightSegmentInputProps {
  title: string;
  data: FlightSegment;
  date: string;
  loading: boolean;
  onSearch: () => void;
  onChange: (field: string, val: any) => void;
}

const FlightSegmentInput: React.FC<FlightSegmentInputProps> = ({ 
  title, 
  data, 
  date,
  loading,
  onSearch,
  onChange 
}) => {
  const baggage = data.baggage || { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } };

  return (
    <div className="bg-gray-50 p-6 rounded-2xl space-y-4 relative border border-gray-100">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Plane className={title.includes('回程') ? 'rotate-180' : ''} size={18} /> {title}
        </h3>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">
          日期：{date}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Search Group */}
        <div className="space-y-1 col-span-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">航班號碼 & 搜尋</label>
          <div className="flex gap-2">
            <input 
              value={data.flightNumber} 
              onChange={e => onChange('flightNumber', e.target.value.toUpperCase())}
              placeholder="例如 BR198"
              className="flex-1 bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold uppercase focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
            />
            <button 
              onClick={onSearch}
              disabled={loading || !data.flightNumber}
              className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 p-2 px-4 rounded-xl transition-all flex items-center gap-2 shadow-sm font-bold text-xs"
            >
              {loading ? <Loader2 className="animate-spin" size={16}/> : <><Search size={16}/> 搜尋 TDX</>}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-bold uppercase">出發機場 (IATA)</label>
          <input 
            value={data.departureAirport} 
            onChange={e => onChange('departureAirport', e.target.value.toUpperCase())}
            placeholder="TPE"
            className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-bold uppercase">目的地機場 (IATA)</label>
          <input 
            value={data.arrivalAirport} 
            onChange={e => onChange('arrivalAirport', e.target.value.toUpperCase())}
            placeholder="NRT"
            className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
          />
        </div>

        {/* Time Inputs */}
        <div className="space-y-1 col-span-2">
           <label className="text-[10px] text-slate-500 font-bold uppercase">起飛時間</label>
           <input 
             type="datetime-local"
             value={data.departureTime} 
             onChange={e => onChange('departureTime', e.target.value)}
             className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
           />
        </div>
        <div className="space-y-1 col-span-2">
           <label className="text-[10px] text-slate-500 font-bold uppercase">抵達時間</label>
           <input 
             type="datetime-local"
             value={data.arrivalTime} 
             onChange={e => onChange('arrivalTime', e.target.value)}
             className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
           />
        </div>
      </div>

      {/* Baggage Section per Segment */}
      <div className="pt-4 border-t border-gray-100">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">行李規範 (此航段)</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold">手提重量 (Carry-on)</label>
              <div className="relative">
                <ShoppingBag className="absolute left-3 top-2.5 text-slate-300" size={14} />
                <input 
                  value={baggage.carryOn.weight}
                  onChange={e => onChange('baggage', { ...baggage, carryOn: { ...baggage.carryOn, weight: e.target.value } })}
                  placeholder="e.g. 7kg"
                  className="w-full bg-white pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs font-bold shadow-sm"
                />
              </div>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold">手提件數</label>
              <input 
                type="number"
                value={baggage.carryOn.count}
                onChange={e => onChange('baggage', { ...baggage, carryOn: { ...baggage.carryOn, count: parseInt(e.target.value) || 0 } })}
                className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold shadow-sm"
              />
           </div>
           <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold">托運重量 (Checked)</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 text-slate-300" size={14} />
                <input 
                  value={baggage.checked.weight}
                  onChange={e => onChange('baggage', { ...baggage, checked: { ...baggage.checked, weight: e.target.value } })}
                  placeholder="e.g. 23kg"
                  className="w-full bg-white pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs font-bold shadow-sm"
                />
              </div>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold">托運件數</label>
              <input 
                type="number"
                value={baggage.checked.count}
                onChange={e => onChange('baggage', { ...baggage, checked: { ...baggage.checked, count: parseInt(e.target.value) || 0 } })}
                className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold shadow-sm"
              />
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
  const [isEditing, setIsEditing] = useState(false);
  const [loadingField, setLoadingField] = useState<'outbound' | 'inbound' | null>(null);

  const defaultBaggage: BaggageInfo = { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } };

  const [flightData, setFlightData] = useState<FlightInfo>(trip.flight || {
    price: 0,
    currency: Currency.TWD,
    cabinClass: 'Economy',
    outbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: defaultBaggage },
    inbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', baggage: defaultBaggage },
    baggage: defaultBaggage
  });

  const handleSave = () => {
    onUpdate({ ...trip, flight: flightData });
    setIsEditing(false);
  };

  const updateSegment = (type: 'outbound' | 'inbound', field: string, value: any) => {
    setFlightData(prev => ({
      ...prev,
      [type]: { ...prev[type]!, [field]: value }
    }));
  };

  const handleTdxSearch = async (type: 'outbound' | 'inbound') => {
    const segment = type === 'outbound' ? flightData.outbound : flightData.inbound;
    const date = type === 'outbound' ? trip.startDate : trip.endDate;
    
    const from = segment.departureAirport; 
    const to = segment.arrivalAirport;

    if (!segment?.flightNumber || !from || !to) {
      alert("請填入航班號碼、起飛與目的地機場代碼以進行精準搜尋。");
      return;
    }

    setLoadingField(type);
    try {
      const results = await fetchTdxFlights(from, to, date, segment.flightNumber);
      if (results && results.length > 0) {
        const found = results[0];
        setFlightData(prev => ({
          ...prev,
          [type]: {
            ...prev[type]!,
            airline: found.airline,
            airlineID: found.airlineID,
            airlineNameZh: found.airlineNameZh,
            departureTime: found.departureTime,
            arrivalTime: found.arrivalTime,
            terminal: found.terminal,
            status: found.status
          }
        }));
      } else {
        alert("找不到航班。請檢查航班號碼或機場 IATA 代碼是否正確。");
      }
    } catch (e) {
      console.error(e);
      alert("搜尋失敗。");
    } finally {
      setLoadingField(null);
    }
  };

  const hasCost = flightData.price > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">航班機票</h2>
          <p className="text-slate-500 text-sm">管理您的行程與行李資訊</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all ${
            isEditing ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          {isEditing ? <><Save size={18}/> 儲存變更</> : <><Edit2 size={18}/> 編輯資訊</>}
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-8">
           <FlightSegmentInput 
             title="去程航班" 
             data={flightData.outbound} 
             date={trip.startDate}
             loading={loadingField === 'outbound'}
             onSearch={() => handleTdxSearch('outbound')}
             onChange={(f, v) => updateSegment('outbound', f, v)} 
           />
           <FlightSegmentInput 
             title="回程航班" 
             data={flightData.inbound!} 
             date={trip.endDate}
             loading={loadingField === 'inbound'}
             onSearch={() => handleTdxSearch('inbound')}
             onChange={(f, v) => updateSegment('inbound', f, v)} 
           />
           
           <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><DollarSign size={18}/> 機票預算</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">總票價</label>
                  <div className="flex gap-2">
                    <select 
                      value={flightData.currency}
                      onChange={e => setFlightData(prev => ({ ...prev, currency: e.target.value as Currency }))}
                      className="bg-white p-2 px-3 rounded-xl border border-gray-200 text-sm font-bold shadow-sm outline-none"
                    >
                      {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input 
                      type="number"
                      value={flightData.price}
                      onChange={e => setFlightData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-white p-2 px-3 rounded-xl border border-gray-200 text-sm font-bold shadow-sm outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">艙等</label>
                  <select 
                    value={flightData.cabinClass}
                    onChange={e => setFlightData(prev => ({ ...prev, cabinClass: e.target.value }))}
                    className="w-full bg-white p-2 px-3 rounded-xl border border-gray-200 text-sm font-bold shadow-sm outline-none"
                  >
                    <option value="Economy">經濟艙 (Economy)</option>
                    <option value="Premium Economy">豪華經濟艙</option>
                    <option value="Business">商務艙 (Business)</option>
                    <option value="First">頭等艙 (First Class)</option>
                  </select>
                </div>
             </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
           {(!trip.flight?.outbound.flightNumber && !trip.flight?.inbound?.flightNumber) ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
                <Plane className="mx-auto text-slate-200 mb-2" size={48} />
                <p className="text-slate-400 font-medium">尚未添加航班資訊</p>
             </div>
           ) : (
             <div className="space-y-6">
                <div className="space-y-4">
                  <BoardingPass 
                    segment={trip.flight.outbound} 
                    cabinClass={trip.flight.cabinClass} 
                    seat={trip.flight.seat} 
                  />
                  {trip.flight.inbound && trip.flight.inbound.flightNumber && (
                    <BoardingPass 
                      segment={trip.flight.inbound} 
                      cabinClass={trip.flight.cabinClass} 
                      seat={trip.flight.seat} 
                    />
                  )}
                </div>

                {/* Cost Card - Apple Style */}
                {hasCost && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
                          <ReceiptText size={20} />
                       </div>
                       <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">機票總花費</div>
                          <div className="text-lg font-bold text-slate-800">{flightData.currency} {flightData.price.toLocaleString()}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">艙等</div>
                       <div className="font-bold text-slate-600">{flightData.cabinClass}</div>
                    </div>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
