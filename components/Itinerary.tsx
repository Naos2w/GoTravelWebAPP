
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
  { type: 'Public', labelZh: '大眾運輸', labelEn: 'Public', icon: TrainFront, color: 'text-indigo-600 dark:text-indigo-400' },
  { type: 'Car', labelZh: '汽車', labelEn: 'Car', icon: Car, color: 'text-slate-600 dark:text-slate-300' },
  { type: 'Bicycle', labelZh: '腳踏車', labelEn: 'Bicycle', icon: Bike, color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'Walking', labelZh: '步行', labelEn: 'Walking', icon: Footprints, color: 'text-amber-600 dark:text-amber-400' },
  { type: 'Flight', labelZh: '飛機', labelEn: 'Flight', icon: Plane, color: 'text-blue-600 dark:text-blue-400' },
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

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!isComposing.current) onChange(e.target.value);
  };

  const handleCompositionStart = () => { isComposing.current = true; };
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
    plan: language === 'zh' ? '行程' : 'Planning',
    addPlace: language === 'zh' ? '景點' : 'Place',
    addFood: language === 'zh' ? '餐廳' : 'Food',
    newPlace: language === 'zh' ? '新景點' : 'New Place',
    newFood: language === 'zh' ? '新餐廳' : 'New Food',
    calculating: language === 'zh' ? '計算中' : 'Calculating...',
    noData: language === 'zh' ? '暫無資料' : 'No Data',
    selectTransport: language === 'zh' ? '選擇交通工具' : 'Select Transport',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    confirm: language === 'zh' ? '確認' : 'Confirm',
    moving: language === 'zh' ? '移動中' : 'Transporting',
    flight: language === 'zh' ? '航程' : 'Flight',
    setTransport: language === 'zh' ? '設定交通' : 'Transport',
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

  useEffect(() => { setDays(trip.itinerary || []); }, [trip.itinerary]);

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
      note: '',
      date: days[selectedDayIndex].date
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
      note: labels.calculating,
      date: days[selectedDayIndex].date
    };
    
    const newItems = [...currentItems];
    if (isEditing) newItems[index] = newTransport;
    else newItems.splice(index + 1, 0, newTransport);
    
    setInsertingAt(null);
    setCalculatingId(newTransportId);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Estimate transport time from "${prev.placeName}" to "${next.placeName}" by "${newTransport.transportType}". Return ONLY "XX mins" or "XX hours".`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      const resultText = response.text?.trim() || labels.noData;
      const finalItems = newItems.map(it => it.id === newTransportId ? { ...it, note: resultText } : it);
      saveItineraryUpdate(finalItems);
    } catch {
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
      saveItineraryUpdate(newItems);
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
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 h-[calc(100vh-160px)] animate-in fade-in duration-500 overflow-hidden">
      <div className="lg:w-32 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0 shrink-0">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + 'T00:00:00');
          return (
            <button key={idx} onClick={() => setSelectedDayIndex(idx)} className={`flex-shrink-0 lg:w-full p-4 rounded-[24px] text-center transition-all duration-300 border ${isSelected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl border-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 border-gray-100 dark:border-slate-800'}`}>
              <div className="text-[10px] font-black uppercase mb-1">Day {idx + 1}</div>
              <div className="font-bold text-base leading-tight">{d.toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'numeric', day: 'numeric' })}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[32px] lg:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Day {selectedDayIndex + 1}</h2>
          <div className="flex bg-slate-100/50 dark:bg-slate-800 p-1 rounded-2xl border border-gray-100 dark:border-slate-700">
            <button onClick={() => addActivity('Place')} className="px-4 py-2 bg-white dark:bg-slate-700 rounded-xl text-primary font-black text-xs flex items-center gap-2 shadow-sm"><MapPin size={14}/> {labels.addPlace}</button>
            <button onClick={() => addActivity('Food')} className="px-4 py-2 bg-white dark:bg-slate-700 rounded-xl text-orange-500 font-black text-xs flex items-center gap-2 shadow-sm"><Coffee size={14}/> {labels.addFood}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-0 relative custom-scrollbar">
          {currentDay?.items.map((item, idx) => {
            const isFlight = item.id.includes('flight') || item.transportType === 'Flight';
            const isTransport = item.type === 'Transport';
            const transportOpt = TRANSPORT_OPTIONS.find(o => o.type === item.transportType);
            const nextItem = currentDay.items[idx + 1];
            const canInsertTransport = nextItem && !isTransport && nextItem.type !== 'Transport' && !isFlight;

            return (
              <React.Fragment key={item.id}>
                <div className={`relative pl-12 ${isTransport ? 'pb-4' : 'pb-12'}`}>
                  {!isTransport && (
                    <div className={`absolute left-[-14px] top-3 w-7 h-7 rounded-full border-4 border-white dark:border-slate-900 z-10 flex items-center justify-center shadow-sm ${item.type === 'Place' ? 'bg-primary border-blue-50/50' : 'bg-orange-500 border-orange-50/50'}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                  <div className="absolute left-[-1px] top-10 bottom-0 w-0.5 bg-slate-50 dark:bg-slate-800/50 last:hidden" />
                  
                  {isTransport ? (
                    <div className={`bg-slate-50 dark:bg-slate-800/40 rounded-[20px] p-4 border border-dashed flex items-center justify-between group ${isFlight ? 'bg-blue-50/20 border-blue-100 dark:border-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                       <div className="flex items-center gap-3">
                         {transportOpt && <transportOpt.icon size={16} className={transportOpt.color} />}
                         <span className={`text-xs font-bold ${isFlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                           {item.note === labels.calculating ? <Loader2 size={12} className="animate-spin" /> : item.note}
                         </span>
                       </div>
                       {!isFlight && (
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => deleteItem(idx)} className="p-2 text-red-500/80 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                         </div>
                       )}
                    </div>
                  ) : (
                    <div className={`bg-white dark:bg-slate-800/80 p-6 rounded-[32px] border border-transparent shadow-ios hover:shadow-ios-lg transition-all group ${isFlight ? 'ring-1 ring-blue-500/30' : ''}`}>
                      <div className="flex gap-6 items-start">
                        <div className="w-20 shrink-0">
                          <button onClick={() => !isFlight && setShowTimePickerId(showTimePickerId === item.id ? null : item.id)} className={`font-mono font-black text-base focus:outline-none transition-colors ${isFlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                            {item.time}
                          </button>
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                             {isFlight && <Plane size={14} className="text-blue-500 shrink-0" />}
                             <SafeInput disabled={isFlight} value={item.placeName} onChange={(val) => updateItem(idx, 'placeName', val)} className={`font-black text-lg bg-transparent border-none w-full p-0 focus:ring-0 ${isFlight ? 'text-blue-900 dark:text-blue-300' : item.type === 'Food' ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`} />
                          </div>
                          <SafeInput disabled={isFlight} value={item.note || ''} onChange={(val) => updateItem(idx, 'note', val)} placeholder="..." className="text-sm font-medium text-slate-400 bg-transparent border-none w-full p-0 focus:ring-0" />
                        </div>
                        {!isFlight && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-primary rounded-xl transition-all"><Map size={16} /></button>
                             <button onClick={() => deleteItem(idx)} className="p-2 bg-slate-50 dark:bg-slate-700 text-red-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {canInsertTransport && (
                  <div className="relative flex items-center justify-center py-4 group/btn">
                    <div className="absolute left-[-1px] w-0.5 bg-slate-50 dark:bg-slate-800/50 h-full" />
                    <button onClick={() => { setInsertingAt(idx); setTempTransportType('Public'); }} className="z-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-300 hover:text-primary px-5 py-2 rounded-full text-[11px] font-black flex items-center gap-2 transition-all opacity-0 group-hover/btn:opacity-100 shadow-sm hover:shadow-xl">
                      <Plus size={14} /> {labels.setTransport}
                    </button>
                    {insertingAt === idx && (
                      <div ref={editRef} className="absolute z-30 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl p-4 flex gap-3 animate-in fade-in zoom-in-95">
                        {TRANSPORT_OPTIONS.slice(0, 4).map(opt => (
                          <button key={opt.type} onClick={() => { setTempTransportType(opt.type); confirmInsertTransport(idx); }} className={`p-3 rounded-xl transition-all ${tempTransportType === opt.type ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}>
                            <opt.icon size={20} />
                          </button>
                        ))}
                      </div>
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
