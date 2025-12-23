
import React, { useState, useEffect, useRef } from 'react';
import { Trip, DayPlan, ItineraryItem, TransportType } from '../types';
import { 
  MapPin, Coffee, Trash2, Map, Plane, Clock, 
  Car, Bike, Footprints, TrainFront, Plus,
  Loader2, Check, X, Edit2
} from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { GoogleGenAI } from "@google/genai";
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const TRANSPORT_OPTIONS: { type: TransportType; labelZh: string; labelEn: string; icon: any; color: string }[] = [
  { type: 'Public', labelZh: '大眾運輸', labelEn: 'Public', icon: TrainFront, color: 'text-indigo-600' },
  { type: 'Car', labelZh: '汽車', labelEn: 'Car', icon: Car, color: 'text-slate-700' },
  { type: 'Bicycle', labelZh: '腳踏車', labelEn: 'Bicycle', icon: Bike, color: 'text-emerald-600' },
  { type: 'Walking', labelZh: '步行', labelEn: 'Walking', icon: Footprints, color: 'text-amber-600' },
];

const SafeInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder, className, disabled }) => {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!isComposing.current) {
      onChange(e.target.value);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    onChange(e.currentTarget.value);
  };

  return (
    <input
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={() => onChange(localValue)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

export const Itinerary: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [showTimePickerId, setShowTimePickerId] = useState<string | null>(null);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [tempTransportType, setTempTransportType] = useState<TransportType>('Public');
  const editRef = useRef<HTMLDivElement>(null);

  const labels = {
    plan: language === 'zh' ? '行程規劃' : 'Planning',
    addPlace: language === 'zh' ? '新增景點' : 'Add Place',
    addFood: language === 'zh' ? '新增餐廳' : 'Add Food',
    newPlace: language === 'zh' ? '新景點' : 'New Place',
    newFood: language === 'zh' ? '新餐廳' : 'New Food',
    calculating: language === 'zh' ? '正在計算...' : 'Calculating...',
    noData: language === 'zh' ? '暫無資料' : 'No Data',
    selectTransport: language === 'zh' ? '選擇交通工具' : 'Select Transport',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    confirm: language === 'zh' ? '確認' : 'Confirm',
    confirmCalc: language === 'zh' ? '確認並計算' : 'Confirm & Calculate',
    setTransport: language === 'zh' ? '設定交通方式' : 'Set Transport',
    moving: language === 'zh' ? '移動中' : 'Transporting',
    flight: language === 'zh' ? '飛行航程' : 'Flight Duration'
  };

  useEffect(() => {
    if (!trip.startDate || !trip.endDate) return;
    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let currentItinerary = [...(trip.itinerary || [])];
    if (currentItinerary.length !== diffDays) {
      const newPlan: DayPlan[] = [];
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = DateTimeUtils.formatDate(d);
        const existing = currentItinerary.find(p => p.date === dateStr);
        newPlan.push(existing ? existing : { date: dateStr, items: [] });
      }
      currentItinerary = newPlan;
      onUpdate({ ...trip, itinerary: currentItinerary });
    }
    setDays(currentItinerary);
  }, [trip.startDate, trip.endDate]);

  useEffect(() => {
    setDays(trip.itinerary || []);
  }, [trip.itinerary]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) setInsertingAt(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveItineraryUpdate = (newItems: ItineraryItem[]) => {
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...newDays[selectedDayIndex], items: newItems };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const addActivity = (type: 'Place' | 'Food') => {
    const currentItems = [...days[selectedDayIndex].items];
    let defaultTime = '09:00';
    if (currentItems.length > 0) {
      const lastItem = currentItems[currentItems.length - 1];
      const [h, m] = lastItem.time.split(':').map(Number);
      const nextM = m + 30;
      defaultTime = `${(h + Math.floor(nextM/60)).toString().padStart(2, '0')}:${(nextM%60).toString().padStart(2, '0')}`;
    }
    const newItem: ItineraryItem = {
      id: `manual-${Date.now()}`,
      time: defaultTime,
      placeName: type === 'Place' ? labels.newPlace : labels.newFood,
      type,
      note: ''
    };
    saveItineraryUpdate([...currentItems, newItem].sort((a,b) => a.time.localeCompare(b.time)));
  };

  const confirmInsertTransport = async (index: number, isEditing: boolean = false, customItems?: ItineraryItem[]) => {
    const currentItems = customItems || [...days[selectedDayIndex].items];
    const prev = currentItems[isEditing ? index - 1 : index];
    const next = currentItems[isEditing ? index + 1 : index + 1];
    if (!prev || !next) return;
    const [h1, m1] = prev.time.split(':').map(Number);
    const [h2, m2] = next.time.split(':').map(Number);
    const midMin = Math.floor(((h1 * 60 + m1) + (h2 * 60 + m2)) / 2);
    const midTime = `${Math.floor(midMin/60).toString().padStart(2, '0')}:${(midMin%60).toString().padStart(2, '0')}`;
    const newTransportId = isEditing ? currentItems[index].id : `trans-${Date.now()}`;
    const newTransport: ItineraryItem = {
      ...(isEditing ? currentItems[index] : {}),
      id: newTransportId,
      time: midTime,
      placeName: labels.moving,
      type: 'Transport',
      transportType: isEditing ? (currentItems[index].transportType || tempTransportType) : tempTransportType,
      note: labels.calculating
    };
    const newItems = [...currentItems];
    if (isEditing) newItems[index] = newTransport;
    else newItems.splice(index + 1, 0, newTransport);
    setInsertingAt(null);
    setCalculatingId(newTransportId);
    const tempDays = [...days];
    tempDays[selectedDayIndex] = { ...tempDays[selectedDayIndex], items: newItems };
    setDays(tempDays);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Estimate transport time from "${prev.placeName}" to "${next.placeName}" by "${newTransport.transportType}". Return ONLY "XX mins" or "XX hours", NO "approx" or "about". Response in ${language === 'zh' ? 'Traditional Chinese' : 'English'}.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
      const resultText = response.text?.trim().replace(/^約\s*/, '');
      const finalItems = newItems.map(it => it.id === newTransportId ? { ...it, note: resultText || labels.noData } : it);
      saveItineraryUpdate(finalItems);
    } catch (error) {
      const duration = DateTimeUtils.getDuration(prev.time, next.time);
      const finalItems = newItems.map(it => it.id === newTransportId ? { ...it, note: duration || labels.noData } : it);
      saveItineraryUpdate(finalItems);
    } finally {
      setCalculatingId(null);
    }
  };

  const updateItem = (itemIdx: number, field: keyof ItineraryItem, value: any) => {
    let newItems = [...days[selectedDayIndex].items];
    const originalItem = newItems[itemIdx];
    newItems[itemIdx] = { ...originalItem, [field]: value };
    if (field === 'time') {
      newItems.sort((a, b) => a.time.localeCompare(b.time));
      const updatedIdx = newItems.findIndex(item => item.id === originalItem.id);
      saveItineraryUpdate(newItems);
      if (updatedIdx > 0 && newItems[updatedIdx - 1].type === 'Transport') confirmInsertTransport(updatedIdx - 1, true, newItems);
      if (updatedIdx < newItems.length - 1 && newItems[updatedIdx + 1].type === 'Transport') confirmInsertTransport(updatedIdx + 1, true, newItems);
    } else saveItineraryUpdate(newItems);
  };

  const deleteItem = (itemIdx: number) => {
    const newItems = [...days[selectedDayIndex].items];
    newItems.splice(itemIdx, 1);
    saveItineraryUpdate(newItems);
  };

  if (days.length === 0) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">{labels.noData}</div>;
  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-160px)] animate-in fade-in duration-500">
      <div className="lg:w-36 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + 'T00:00:00');
          return (
            <button
              key={idx}
              onClick={() => { setSelectedDayIndex(idx); setInsertingAt(null); }}
              className={`flex-shrink-0 lg:w-full p-4 rounded-[24px] text-center transition-all duration-300 border ${
                isSelected 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl border-slate-900 dark:border-white' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-gray-100 dark:border-slate-700 shadow-sm'
              }`}
            >
              <div className={`text-[10px] font-black uppercase mb-1 ${isSelected ? 'opacity-60' : 'text-slate-300 dark:text-slate-600'}`}>Day {idx + 1}</div>
              <div className="font-bold text-base leading-tight">{d.toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'numeric', day: 'numeric' })}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300">
        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Day {selectedDayIndex + 1} {labels.plan}</h2>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-700">
            <button onClick={() => addActivity('Place')} className="p-2.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-xl text-primary transition-all flex items-center gap-2 font-bold text-xs"><MapPin size={16}/> <span className="hidden sm:inline">{labels.addPlace}</span></button>
            <button onClick={() => addActivity('Food')} className="p-2.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-xl text-orange-500 transition-all flex items-center gap-2 font-bold text-xs"><Coffee size={16}/> <span className="hidden sm:inline">{labels.addFood}</span></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-0 relative custom-scrollbar">
          {currentDay?.items.map((item, idx) => {
            const isFlightPoint = item.id.includes('flight');
            const isManualTransport = item.type === 'Transport' && !isFlightPoint;
            const isFood = item.type === 'Food';
            const isPlace = item.type === 'Place';
            const nextItem = currentDay.items[idx + 1];
            const isBetweenFlight = isFlightPoint && item.id.endsWith('-dep') && nextItem && nextItem.id.endsWith('-arr') && nextItem.id.replace('-arr', '') === item.id.replace('-dep', '');
            const canInsertManualTransport = nextItem && !isManualTransport && nextItem.type !== 'Transport' && !isBetweenFlight;
            const transportOpt = isManualTransport ? TRANSPORT_OPTIONS.find(o => o.type === item.transportType) : null;

            return (
              <React.Fragment key={item.id}>
                <div className={`relative pl-14 ${isManualTransport ? 'pb-4' : 'pb-12'}`}>
                  {!isManualTransport && (
                    <div className={`absolute -left-[14px] top-2 w-7 h-7 rounded-full border-4 bg-white dark:bg-slate-900 z-10 flex items-center justify-center shadow-sm transition-all ${
                       isPlace ? 'border-primary/20' : isFood ? 'border-orange-500/20' : 'border-blue-500/20'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isPlace ? 'bg-primary' : isFood ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    </div>
                  )}
                  <div className={`absolute left-0 top-9 bottom-0 w-0.5 ${
                    isManualTransport || isBetweenFlight || (nextItem && nextItem.type === 'Transport') 
                    ? 'border-l-2 border-dashed border-slate-200 dark:border-slate-800' 
                    : 'bg-slate-100 dark:bg-slate-800'
                  } last:hidden`} />

                  {isManualTransport ? (
                    <div className="relative flex items-center justify-center group/card">
                       <div className={`w-full bg-slate-50 dark:bg-slate-800/40 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-700 transition-all h-[60px] flex items-center justify-center relative overflow-hidden ${calculatingId === item.id ? 'opacity-60 grayscale' : ''}`}>
                          {insertingAt === idx ? (
                            <div ref={editRef} className="absolute inset-0 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 shadow-xl rounded-[20px] p-1 flex flex-col gap-1 z-50 animate-in zoom-in-95 duration-200 h-full">
                               <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl flex-1 items-center">
                                  {TRANSPORT_OPTIONS.map(opt => (
                                    <button key={opt.type} onClick={() => setTempTransportType(opt.type)} className={`flex flex-col items-center justify-center h-full rounded-lg transition-all flex-1 ${tempTransportType === opt.type ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-400 hover:text-slate-600'}`}>
                                      <opt.icon size={16} className={tempTransportType === opt.type ? opt.color : 'text-slate-300 dark:text-slate-600'} />
                                    </button>
                                  ))}
                               </div>
                               <div className="flex gap-1 h-6 shrink-0 px-1 mb-1">
                                  <button onClick={() => setInsertingAt(null)} className="flex-1 text-slate-400 dark:text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 flex items-center justify-center gap-1"><X size={12} /><span>{labels.cancel}</span></button>
                                  <button onClick={() => confirmInsertTransport(idx, true)} className="flex-[1.5] bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black shadow-sm flex items-center justify-center gap-1"><Check size={12}/><span>{labels.confirm}</span></button>
                               </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 w-full justify-center">
                               <div className="flex items-center gap-2">
                                 {transportOpt && <transportOpt.icon size={16} className={transportOpt.color} />}
                                 <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-400 tracking-tight">{item.note}</span>
                                 {calculatingId === item.id && <Loader2 size={14} className="animate-spin text-primary" />}
                               </div>
                               <div className="absolute right-4 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setInsertingAt(idx); setTempTransportType(item.transportType || 'Public'); }} className="p-2 text-slate-300 hover:text-primary dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600"><Edit2 size={14}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteItem(idx); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600"><Trash2 size={14}/></button>
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                  ) : (
                    <div className={`rounded-[28px] p-6 group transition-all border shadow-sm ${
                      isFlightPoint 
                        ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' 
                        : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:shadow-xl hover:shadow-black/5 transform hover:-translate-y-0.5'
                    }`}>
                      <div className="flex items-start gap-5">
                        <div className="flex flex-col items-center min-w-[70px] relative">
                          <button onClick={() => !isFlightPoint && setShowTimePickerId(showTimePickerId === item.id ? null : item.id)} className={`font-mono text-base font-black px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${isFlightPoint ? 'text-blue-600 dark:text-blue-400 cursor-default' : 'text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            {!isFlightPoint && <Clock size={14} className="opacity-40" />}
                            {item.time}
                          </button>
                          {showTimePickerId === item.id && (
                             <div className="absolute top-full left-0 mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[32px] shadow-2xl z-50 p-4 flex gap-4 animate-in fade-in zoom-in-95">
                                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
                                  {Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0')).map(h => (
                                    <button key={h} onClick={() => updateItem(idx, 'time', `${h}:${item.time.split(':')[1]}`)} className={`w-10 h-10 rounded-xl text-xs font-mono font-black ${item.time.split(':')[0] === h ? 'bg-primary text-white shadow-lg' : 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200'}`}>{h}</button>
                                  ))}
                                </div>
                                <div className="w-px bg-slate-100 dark:bg-slate-700 my-2"></div>
                                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
                                  {Array.from({length: 12}, (_, i) => (i*5).toString().padStart(2, '0')).map(m => (
                                    <button key={m} onClick={() => { updateItem(idx, 'time', `${item.time.split(':')[0]}:${m}`); setShowTimePickerId(null); }} className={`w-10 h-10 rounded-xl text-xs font-mono font-black ${item.time.split(':')[1] === m ? 'bg-primary text-white shadow-lg' : 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200'}`}>{m}</button>
                                  ))}
                                </div>
                             </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-hidden">
                          <div className="flex items-center gap-2.5">
                             {isFood && <Coffee size={18} className="text-orange-500 shrink-0" />}
                             {isPlace && <MapPin size={18} className="text-primary shrink-0" />}
                             {isFlightPoint && <Plane size={18} className="text-blue-500 shrink-0" />}
                             {isFlightPoint ? (
                               <div className="font-bold tracking-tight text-lg text-blue-900 dark:text-blue-300 truncate">{item.placeName}</div>
                             ) : (
                               <SafeInput value={item.placeName} onChange={(val) => updateItem(idx, 'placeName', val)} placeholder="..." className={`font-black tracking-tight text-lg bg-transparent border-none focus:ring-0 p-0 w-full ${isFood ? 'text-orange-900 dark:text-orange-300' : 'text-slate-900 dark:text-slate-50'}`} />
                             )}
                          </div>
                          <SafeInput value={item.note || ''} onChange={(val) => !isFlightPoint && updateItem(idx, 'note', val)} disabled={isFlightPoint} placeholder={isFlightPoint ? "" : "..."} className={`text-sm font-semibold bg-transparent border-none focus:ring-0 p-0 w-full ${isFlightPoint ? 'text-blue-400/80' : 'text-slate-400 dark:text-slate-500'}`} />
                        </div>
                        <div className="flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className={`p-2.5 bg-white dark:bg-slate-700 rounded-2xl shadow-sm border ${isFood ? 'text-orange-500 border-orange-100 dark:border-orange-900/50' : 'text-primary border-blue-100 dark:border-blue-900/50'}`} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}><Map size={18} /></button>
                           {!isFlightPoint && <button onClick={() => deleteItem(idx)} className="p-2.5 bg-white dark:bg-slate-700 text-slate-300 dark:text-slate-600 hover:text-red-500 rounded-2xl shadow-sm border border-slate-50 dark:border-slate-600 transition-colors"><Trash2 size={18} /></button>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isBetweenFlight && (
                  <div className="relative pl-14 pb-4">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-200 dark:border-blue-900/30" />
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 rounded-[20px] p-4 border border-dashed border-blue-100 dark:border-blue-900/30 flex items-center justify-center h-[60px]">
                       <div className="flex items-center gap-3 text-blue-500 dark:text-blue-400">
                          <Plane size={16} />
                          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{labels.flight}</span>
                          <span className="text-sm font-mono font-bold">{DateTimeUtils.getDuration(item.time, nextItem.time)}</span>
                       </div>
                    </div>
                  </div>
                )}

                {canInsertManualTransport && (
                  <div className="relative flex items-center justify-center py-4 group/btn min-h-[48px]">
                    <div className="absolute left-0 w-0.5 bg-slate-100 dark:bg-slate-800 h-full" />
                    {insertingAt === idx ? (
                      <div ref={editRef} className="z-10 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 shadow-2xl rounded-[28px] p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-200 min-w-[260px] sm:min-w-[300px]">
                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 text-center">{labels.selectTransport}</div>
                        <div className="flex gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl">
                          {TRANSPORT_OPTIONS.map(opt => (
                            <button key={opt.type} onClick={() => setTempTransportType(opt.type)} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all flex-1 ${tempTransportType === opt.type ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-400 hover:text-slate-600'}`}>
                              <opt.icon size={18} className={tempTransportType === opt.type ? opt.color : 'text-slate-300 dark:text-slate-600'} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-3">
                           <button onClick={() => setInsertingAt(null)} className="flex-1 py-2.5 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all"><X size={16} /><span>{labels.cancel}</span></button>
                           <button onClick={() => confirmInsertTransport(idx)} className="flex-[2] py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xl hover:opacity-90 transition-all"><Check size={16} /><span>{labels.confirmCalc}</span></button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setInsertingAt(idx); setTempTransportType('Public'); }} className="z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900 px-5 py-2 rounded-full text-[11px] font-black flex items-center gap-2 transition-all opacity-0 group-hover/btn:opacity-100 shadow-sm hover:shadow-xl hover:scale-105 active:scale-95">
                        <Plus size={14} /> <span>{labels.setTransport}</span>
                      </button>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
