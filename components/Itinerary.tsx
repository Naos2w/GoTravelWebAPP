
import React, { useState, useEffect, useRef } from 'react';
import { Trip, DayPlan, ItineraryItem, TransportType } from '../types';
import { 
  MapPin, Coffee, Trash2, Map, Plane, Clock, 
  Car, Bike, Footprints, TrainFront, Plus,
  Navigation, Loader2, Check, X, Edit2
} from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { GoogleGenAI } from "@google/genai";

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const TRANSPORT_OPTIONS: { type: TransportType; label: string; icon: any; color: string }[] = [
  { type: 'Public', label: '大眾運輸', icon: TrainFront, color: 'text-indigo-600' },
  { type: 'Car', label: '汽車', icon: Car, color: 'text-slate-700' },
  { type: 'Bicycle', label: '腳踏車', icon: Bike, color: 'text-emerald-600' },
  { type: 'Walking', label: '步行', icon: Footprints, color: 'text-amber-600' },
];

/**
 * 解決 IME (中文輸入法) 在 React 受控組件中重複文字的問題
 */
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [showTimePickerId, setShowTimePickerId] = useState<string | null>(null);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [tempTransportType, setTempTransportType] = useState<TransportType>('Public');
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trip.startDate || !trip.endDate) return;

    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setInsertingAt(null);
      }
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
      placeName: type === 'Place' ? '新景點' : '新餐廳',
      type,
      note: ''
    };

    saveItineraryUpdate([...currentItems, newItem].sort((a,b) => a.time.localeCompare(b.time)));
  };

  const confirmInsertTransport = async (index: number, isEditing: boolean = false) => {
    const currentItems = [...days[selectedDayIndex].items];
    const targetIdx = isEditing ? index : index + 1;
    const prev = currentItems[isEditing ? index - 1 : index];
    const next = currentItems[isEditing ? index + 1 : index + 1];

    if (!prev || !next) return;

    const [h1, m1] = prev.time.split(':').map(Number);
    const [h2, m2] = next.time.split(':').map(Number);
    const midMin = Math.floor(((h1 * 60 + m1) + (h2 * 60 + m2)) / 2);
    const midTime = `${Math.floor(midMin/60).toString().padStart(2, '0')}:${(midMin%60).toString().padStart(2, '0')}`;

    const newTransportId = isEditing ? currentItems[index].id : `trans-${Date.now()}`;
    const newTransport: ItineraryItem = {
      id: newTransportId,
      time: midTime,
      placeName: '移動中',
      type: 'Transport',
      transportType: tempTransportType,
      note: '正在計算...'
    };

    const newItems = [...currentItems];
    if (isEditing) {
      newItems[index] = newTransport;
    } else {
      newItems.splice(index + 1, 0, newTransport);
    }
    
    setInsertingAt(null);
    setCalculatingId(newTransportId);
    
    const tempDays = [...days];
    tempDays[selectedDayIndex] = { ...tempDays[selectedDayIndex], items: newItems };
    setDays(tempDays);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `請幫我查從「${prev.placeName}」到「${next.placeName}」使用「${tempTransportType}」交通工具的預估交通時間。請只回傳「約 XX 分鐘」或「約 XX 小時」這樣的簡短文字。`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });

      const resultText = response.text?.trim() || "暫無資料";
      const finalItems = newItems.map(it => it.id === newTransportId ? { ...it, note: resultText } : it);
      saveItineraryUpdate(finalItems);
    } catch (error) {
      console.error(error);
      const finalItems = newItems.map(it => it.id === newTransportId ? { ...it, note: '暫無資料' } : it);
      saveItineraryUpdate(finalItems);
    } finally {
      setCalculatingId(null);
    }
  };

  const updateItem = (itemIdx: number, field: keyof ItineraryItem, value: any) => {
    const newItems = [...days[selectedDayIndex].items];
    newItems[itemIdx] = { ...newItems[itemIdx], [field]: value };
    if (field === 'time') newItems.sort((a, b) => a.time.localeCompare(b.time));
    saveItineraryUpdate(newItems);
  };

  const deleteItem = (itemIdx: number) => {
    const newItems = [...days[selectedDayIndex].items];
    newItems.splice(itemIdx, 1);
    saveItineraryUpdate(newItems);
  };

  if (days.length === 0) return <div className="p-8 text-center text-gray-500">請設定日期。</div>;

  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Date Navigation */}
      <div className="lg:w-32 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + 'T00:00:00');
          return (
            <button
              key={idx}
              onClick={() => { setSelectedDayIndex(idx); setInsertingAt(null); }}
              className={`flex-shrink-0 lg:w-full p-3 rounded-2xl text-center transition-all border ${
                isSelected ? 'bg-slate-900 text-white shadow-lg border-slate-900' : 'bg-white text-slate-500 hover:bg-gray-50 border-gray-100'
              }`}
            >
              <div className={`text-[9px] font-bold uppercase mb-1 ${isSelected ? 'text-slate-400' : 'text-slate-300'}`}>Day {idx + 1}</div>
              <div className="font-bold text-sm leading-tight">{d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</div>
            </button>
          );
        })}
      </div>

      {/* Main Timeline */}
      <div className="flex-1 bg-white rounded-[32px] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <h2 className="text-xs sm:text-xl font-bold text-slate-800">Day {selectedDayIndex + 1} 行程規劃</h2>
          <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button onClick={() => addActivity('Place')} className="p-2 sm:p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-primary transition-all flex items-center gap-1 sm:gap-1.5 font-bold text-[10px] sm:text-xs"><MapPin size={16}/> <span className="hidden xs:inline">新增景點</span></button>
            <button onClick={() => addActivity('Food')} className="p-2 sm:p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-orange-500 transition-all flex items-center gap-1 sm:gap-1.5 font-bold text-[10px] sm:text-xs"><Coffee size={16}/> <span className="hidden xs:inline">新增餐廳</span></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-0 relative">
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
                <div className={`relative pl-12 ${isManualTransport ? 'pb-4' : 'pb-10'}`}>
                  {!isManualTransport && (
                    <div className={`absolute -left-[11px] top-2 w-5 h-5 rounded-full border-2 bg-white z-10 flex items-center justify-center transition-all ${
                       isPlace ? 'border-primary' : isFood ? 'border-orange-500' : 'border-blue-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isPlace ? 'bg-primary' : isFood ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    </div>
                  )}

                  <div className={`absolute left-0 top-7 bottom-0 w-0.5 ${
                    isManualTransport || isBetweenFlight || (nextItem && nextItem.type === 'Transport') 
                    ? 'border-l-2 border-dashed border-slate-200' 
                    : 'bg-gray-100'
                  } last:hidden`} />

                  {isManualTransport ? (
                    /* --- 手動新增交通卡片 (高度 56px 固定) --- */
                    <div className="relative flex items-center justify-center">
                       <div className={`w-full bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 group transition-all h-[56px] flex items-center justify-center relative overflow-hidden ${calculatingId === item.id ? 'opacity-60 grayscale' : ''}`}>
                          {insertingAt === idx ? (
                            <div ref={editRef} className="absolute inset-0 bg-white border border-indigo-100 shadow-xl rounded-2xl p-1 flex flex-col gap-0.5 z-50 animate-in zoom-in-95 duration-200 h-full">
                               <div className="flex gap-1 bg-slate-50 p-0.5 rounded-lg flex-1 items-center">
                                  {TRANSPORT_OPTIONS.map(opt => (
                                    <button
                                      key={opt.type}
                                      onClick={() => setTempTransportType(opt.type)}
                                      className={`flex flex-col items-center justify-center h-full rounded-md transition-all flex-1 ${
                                        tempTransportType === opt.type ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/10' : 'text-slate-400 hover:text-slate-600'
                                      }`}
                                    >
                                      <opt.icon size={14} className={tempTransportType === opt.type ? opt.color : 'text-slate-300'} />
                                    </button>
                                  ))}
                               </div>
                               <div className="flex gap-1 h-5 shrink-0 px-0.5 mb-0.5">
                                  <button onClick={() => setInsertingAt(null)} className="flex-1 text-slate-400 rounded-md text-[9px] font-bold hover:bg-slate-50 border border-gray-100 flex items-center justify-center gap-0.5">
                                    <X size={10} /><span className="hidden sm:inline">取消</span>
                                  </button>
                                  <button onClick={() => confirmInsertTransport(idx, true)} className="flex-[1.5] bg-slate-900 text-white rounded-md text-[9px] font-bold shadow-sm flex items-center justify-center gap-0.5">
                                    <Check size={10}/><span className="hidden sm:inline">確認</span>
                                  </button>
                               </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 w-full justify-center">
                               <div className="flex items-center gap-2">
                                 {transportOpt && <transportOpt.icon size={14} className={transportOpt.color} />}
                                 <span className="text-xs font-mono font-bold text-slate-600">{item.note}</span>
                                 {calculatingId === item.id && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                               </div>
                               
                               <div className="absolute right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setInsertingAt(idx); setTempTransportType(item.transportType || 'Public'); }} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><Edit2 size={12}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteItem(idx); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"><Trash2 size={12}/></button>
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                  ) : (
                    /* --- 地點或機票卡片 --- */
                    <div className={`rounded-2xl p-4 group transition-all border ${
                      isFlightPoint ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-white border-gray-100 hover:shadow-md'
                    }`}>
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex flex-col items-center min-w-[60px] sm:min-w-[70px] relative">
                          <button 
                            onClick={() => !isFlightPoint && setShowTimePickerId(showTimePickerId === item.id ? null : item.id)}
                            className={`font-mono text-sm sm:text-base font-bold px-1.5 sm:px-2 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 ${isFlightPoint ? 'text-blue-600 cursor-default' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            {!isFlightPoint && <Clock size={12} className="opacity-30" />}
                            {item.time}
                          </button>
                          
                          {showTimePickerId === item.id && (
                             <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 p-3 flex gap-3 animate-in fade-in zoom-in-95">
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar">
                                  {Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0')).map(h => (
                                    <button key={h} onClick={() => updateItem(idx, 'time', `${h}:${item.time.split(':')[1]}`)} className={`w-8 h-8 rounded-lg text-xs font-mono font-bold ${item.time.split(':')[0] === h ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>{h}</button>
                                  ))}
                                </div>
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar">
                                  {Array.from({length: 12}, (_, i) => (i*5).toString().padStart(2, '0')).map(m => (
                                    <button key={m} onClick={() => { updateItem(idx, 'time', `${item.time.split(':')[0]}:${m}`); setShowTimePickerId(null); }} className={`w-8 h-8 rounded-lg text-xs font-mono font-bold ${item.time.split(':')[1] === m ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>{m}</button>
                                  ))}
                                </div>
                             </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                             {isFood && <Coffee size={14} className="text-orange-500 shrink-0" />}
                             {isPlace && <MapPin size={14} className="text-primary shrink-0" />}
                             {isFlightPoint && <Plane size={14} className="text-blue-500 shrink-0" />}
                             
                             {isFlightPoint ? (
                               <div className="font-bold tracking-tight text-base sm:text-lg text-blue-900 truncate">{item.placeName}</div>
                             ) : (
                               <SafeInput 
                                 value={item.placeName} 
                                 onChange={(val) => updateItem(idx, 'placeName', val)} 
                                 placeholder="名稱..." 
                                 className={`font-bold tracking-tight text-base sm:text-lg bg-transparent border-none focus:ring-0 p-0 w-full ${isFood ? 'text-orange-900' : 'text-slate-800'}`} 
                               />
                             )}
                          </div>
                          
                          <SafeInput 
                            value={item.note || ''} 
                            onChange={(val) => !isFlightPoint && updateItem(idx, 'note', val)} 
                            disabled={isFlightPoint}
                            placeholder={isFlightPoint ? "" : "新增筆記..."} 
                            className={`text-xs font-medium bg-transparent border-none focus:ring-0 p-0 w-full ${isFlightPoint ? 'text-blue-400/80 font-bold' : 'text-slate-400'}`} 
                          />
                        </div>

                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className={`p-1.5 sm:p-2 bg-white rounded-xl shadow-sm border ${isFood ? 'text-orange-500 border-orange-100' : 'text-primary border-blue-100'}`} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}><Map size={16} /></button>
                           {!isFlightPoint && (
                             <button onClick={() => deleteItem(idx)} className="p-1.5 sm:p-2 bg-white text-slate-300 hover:text-red-500 rounded-xl shadow-sm border border-gray-50"><Trash2 size={16} /></button>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 自動航班段樣式 (高度 56px 固定) */}
                {isBetweenFlight && (
                  <div className="relative pl-12 pb-4">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-200" />
                    <div className="bg-blue-50/30 rounded-2xl p-3 border border-dashed border-blue-100 flex items-center justify-center h-[56px]">
                       <div className="flex items-center gap-2 text-blue-500">
                          <Plane size={14} />
                          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">飛行航程</span>
                          <span className="text-xs font-mono font-bold">
                             {DateTimeUtils.getDuration(item.time, nextItem.time)}
                          </span>
                       </div>
                    </div>
                  </div>
                )}

                {/* 手動插入按鈕 */}
                {canInsertManualTransport && (
                  <div className="relative flex items-center justify-center py-2 group/btn min-h-[40px]">
                    <div className="absolute left-0 w-0.5 bg-gray-100 h-full" />
                    
                    {insertingAt === idx ? (
                      <div ref={editRef} className="z-10 bg-white border border-indigo-100 shadow-2xl rounded-2xl p-3 flex flex-col gap-2 animate-in zoom-in-95 duration-200 min-w-[220px] sm:min-w-[280px]">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 text-center">選擇交通工具</div>
                        <div className="flex gap-1 bg-slate-50 p-1 rounded-lg">
                          {TRANSPORT_OPTIONS.map(opt => (
                            <button
                              key={opt.type}
                              onClick={() => setTempTransportType(opt.type)}
                              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md transition-all flex-1 ${
                                tempTransportType === opt.type ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/10' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <opt.icon size={16} className={tempTransportType === opt.type ? opt.color : 'text-slate-300'} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setInsertingAt(null)} className="flex-1 py-1.5 text-slate-400 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-transparent hover:border-gray-200">
                             <X size={14} /><span className="hidden sm:inline">取消</span>
                           </button>
                           <button onClick={() => confirmInsertTransport(idx)} className="flex-[2] py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-lg">
                             <Check size={14} /><span className="hidden sm:inline">確認並計算</span>
                           </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setInsertingAt(idx); setTempTransportType('Public'); }} 
                        className="z-10 bg-white border border-gray-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 transition-all opacity-0 group-hover/btn:opacity-100 shadow-sm hover:shadow-md"
                      >
                        <Plus size={12} /> <span>設定交通方式</span>
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
