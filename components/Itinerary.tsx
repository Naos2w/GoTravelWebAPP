
import React, { useState, useEffect, useRef } from 'react';
import { Trip, DayPlan, ItineraryItem, TransportType } from '../types';
import { 
  MapPin, Coffee, Trash2, Map, Plane, Clock, 
  Car, Bike, Footprints, TrainFront, Plus,
  Loader2, Check, X, Lock, ChevronDown, Edit2
} from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
  isGuest?: boolean;
}

const TRANSPORT_OPTIONS: { type: TransportType; labelZh: string; labelEn: string; icon: any; color: string }[] = [
  { type: 'Public', labelZh: '大眾運輸', labelEn: 'Public', icon: TrainFront, color: 'text-indigo-600 dark:text-indigo-400' },
  { type: 'Car', labelZh: '汽車', labelEn: 'Car', icon: Car, color: 'text-slate-600 dark:text-slate-300' },
  { type: 'Bicycle', labelZh: '腳踏車', labelEn: 'Bicycle', icon: Bike, color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'Walking', labelZh: '步行', labelEn: 'Walking', icon: Footprints, color: 'text-amber-600 dark:text-amber-400' },
];

const TimePicker: React.FC<{
  value: string;
  onChange: (newTime: string) => void;
  onClose: () => void;
}> = ({ value, onChange, onClose }) => {
  const [hour, minute] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[28px] shadow-2xl z-[210] p-4 flex gap-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">H</div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1">
          {hours.map(h => (
            <button key={h} onClick={() => onChange(`${h}:${minute}`)} className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${h === hour ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{h}</button>
          ))}
        </div>
      </div>
      <div className="w-px bg-slate-100 dark:bg-slate-700 my-1"></div>
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">M</div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1">
          {minutes.map(m => (
            <button key={m} onClick={() => onChange(`${hour}:${m}`)} className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${m === minute ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{m}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Itinerary: React.FC<Props> = ({ trip, onUpdate, isGuest = false }) => {
  const { language } = useTranslation();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [showTransportPickerId, setShowTransportPickerId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const scrollAnchorRef = useRef<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const labels = {
    addPlace: language === 'zh' ? '景點' : 'Place',
    addFood: language === 'zh' ? '餐廳' : 'Food',
    editActivity: language === 'zh' ? '編輯行程' : 'Edit',
    placeName: language === 'zh' ? '地點名稱' : 'Place Name',
    time: language === 'zh' ? '時間' : 'Time',
    note: language === 'zh' ? '備註' : 'Notes',
    save: language === 'zh' ? '儲存' : 'Save',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    noData: language === 'zh' ? '暫無資料' : 'No Data',
    selectTransport: language === 'zh' ? '選擇交通' : 'Transport',
    moving: language === 'zh' ? '移動' : 'Move',
    readOnly: language === 'zh' ? '僅供檢視' : 'Read Only',
    type: language === 'zh' ? '類型' : 'Type',
    typePlace: language === 'zh' ? '景點' : 'Place',
    typeFood: language === 'zh' ? '餐飲' : 'Food'
  };

  const days = trip.itinerary || [];
  const currentDay = days[selectedDayIndex];

  // Logic to handle auto-scrolling to a specific item ID
  useEffect(() => {
    if (scrollAnchorRef.current) {
      const element = document.getElementById(`item-${scrollAnchorRef.current}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(scrollAnchorRef.current);
        scrollAnchorRef.current = null;
        
        // Remove highlight after animation
        const timer = setTimeout(() => setHighlightedId(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [trip, selectedDayIndex]);

  const maintainListIntegrity = (items: ItineraryItem[]): ItineraryItem[] => {
    const anchors = items.filter(i => i.type !== 'Transport').sort((a, b) => a.time.localeCompare(b.time));
    const result: ItineraryItem[] = [];
    
    for (let i = 0; i < anchors.length; i++) {
      result.push(anchors[i]);
      const nextAnchor = anchors[i+1];
      if (nextAnchor) {
        const originalIndex = items.findIndex(it => it.id === anchors[i].id);
        const potentialTransport = items[originalIndex + 1];
        
        if (potentialTransport && potentialTransport.type === 'Transport') {
          const [h1, m1] = anchors[i].time.split(':').map(Number);
          const [h2, m2] = nextAnchor.time.split(':').map(Number);
          const midMin = Math.floor(((h1 * 60 + m1) + (h2 * 60 + m2)) / 2);
          const midTime = `${Math.floor(midMin/60).toString().padStart(2, '0')}:${(midMin%60).toString().padStart(2, '0')}`;
          
          result.push({
            ...potentialTransport,
            time: midTime,
            note: DateTimeUtils.getDuration(anchors[i].time, nextAnchor.time)
          });
        }
      }
    }
    return result;
  };

  const handleOpenAddForm = (type: 'Place' | 'Food') => {
    if (isGuest) return;
    let defaultTime = '09:00';
    if (currentDay.items.length > 0) {
      const lastItem = currentDay.items[currentDay.items.length - 1];
      const [h, m] = lastItem.time.split(':').map(Number);
      const nextM = m + 30;
      defaultTime = `${(h + Math.floor(nextM/60)).toString().padStart(2, '0')}:${(nextM%60).toString().padStart(2, '0')}`;
    }
    setEditingItem({
      id: crypto.randomUUID(),
      time: defaultTime,
      placeName: '',
      type,
      note: '',
      date: currentDay.date
    });
    setIsFormOpen(true);
  };

  const handleEditItem = (item: ItineraryItem) => {
    if (isGuest || item.type === 'Transport') return;
    setEditingItem({ ...item });
    setIsFormOpen(true);
  };

  const handleSaveItem = () => {
    if (!editingItem || !editingItem.placeName.trim()) return;
    
    let newItems = [...currentDay.items];
    const index = newItems.findIndex(i => i.id === editingItem.id);
    
    if (index > -1) {
      newItems[index] = editingItem;
    } else {
      newItems.push(editingItem);
    }
    
    const updatedItems = maintainListIntegrity(newItems);
    
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: updatedItems };
    
    // Set anchor for automatic scroll after re-render
    scrollAnchorRef.current = editingItem.id;
    
    onUpdate({ ...trip, itinerary: newDays });
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    if (isGuest) return;
    const index = currentDay.items.findIndex(i => i.id === itemId);
    let newItems = [...currentDay.items];
    
    if (index > -1) {
      const target = newItems[index];
      if (target.type !== 'Transport' && newItems[index+1]?.type === 'Transport') {
        newItems.splice(index, 2);
      } else {
        newItems.splice(index, 1);
      }
    }
    
    const updatedItems = maintainListIntegrity(newItems);
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: updatedItems };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const handleChangeTransportType = (transportId: string, type: TransportType) => {
    if (isGuest) return;
    const newItems = currentDay.items.map(it => 
      it.id === transportId ? { ...it, transportType: type } : it
    );
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: newItems };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const handleInsertTransport = (index: number, type: TransportType) => {
    if (isGuest) return;
    const currentItems = [...currentDay.items];
    const prev = currentItems[index];
    const next = currentItems[index + 1];
    if (!prev || !next) return;

    const [h1, m1] = prev.time.split(':').map(Number);
    const [h2, m2] = next.time.split(':').map(Number);
    const midMin = Math.floor(((h1 * 60 + m1) + (h2 * 60 + m2)) / 2);
    const midTime = `${Math.floor(midMin/60).toString().padStart(2, '0')}:${(midMin%60).toString().padStart(2, '0')}`;
    
    const durationNote = DateTimeUtils.getDuration(prev.time, next.time);
    const newId = crypto.randomUUID();
    
    const newTransport: ItineraryItem = {
      id: newId,
      time: midTime,
      placeName: labels.moving,
      type: 'Transport',
      transportType: type,
      note: durationNote,
      date: currentDay.date
    };
    
    const newItems = [...currentItems];
    newItems.splice(index + 1, 0, newTransport);
    setInsertingAt(null);
    
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: newItems };
    
    scrollAnchorRef.current = newId;
    onUpdate({ ...trip, itinerary: newDays });
  };

  if (days.length === 0) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">{labels.noData}</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-[calc(100vh-160px)] sm:h-[calc(100vh-160px)] overflow-hidden animate-in fade-in duration-500">
      {/* Day Selector */}
      <div className="lg:w-28 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-1 lg:pb-0 shrink-0 px-1">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + 'T00:00:00');
          return (
            <button key={idx} onClick={() => { setSelectedDayIndex(idx); setInsertingAt(null); }} className={`flex-shrink-0 lg:w-full p-2.5 lg:p-3.5 rounded-2xl text-center transition-all duration-300 border ${isSelected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg border-slate-900 dark:border-white' : 'bg-white dark:bg-slate-800 text-slate-500 border-gray-100 dark:border-slate-800 hover:bg-slate-50 shadow-sm'}`}>
              <div className="text-[9px] font-black uppercase mb-0.5">Day {idx + 1}</div>
              <div className="font-bold text-xs sm:text-sm leading-tight">{d.toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'numeric', day: 'numeric' })}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white px-2">Day {selectedDayIndex + 1}</h2>
          
          {!isGuest ? (
            <div className="flex bg-slate-100/50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700">
              <button onClick={() => handleOpenAddForm('Place')} className="px-3 sm:px-3.5 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-primary font-black text-[11px] flex items-center gap-1.5 transition-all">
                <MapPin size={12}/> <span className="hidden sm:inline">{labels.addPlace}</span>
              </button>
              <button onClick={() => handleOpenAddForm('Food')} className="px-3 sm:px-3.5 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-orange-500 font-black text-[11px] flex items-center gap-1.5 transition-all ml-0.5">
                <Coffee size={12}/> <span className="hidden sm:inline">{labels.addFood}</span>
              </button>
            </div>
          ) : (
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-1"><Lock size={10} />{labels.readOnly}</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-0 relative custom-scrollbar">
          {currentDay?.items.map((item, idx) => {
            const isTransport = item.type === 'Transport';
            const isFlight = item.transportType === 'Flight';
            const transportOpt = TRANSPORT_OPTIONS.find(o => o.type === item.transportType);
            const nextItem = currentDay.items[idx + 1];
            const canInsertTransport = nextItem && !isTransport && nextItem.type !== 'Transport' && !isGuest;
            const isHighlighted = highlightedId === item.id;

            return (
              <React.Fragment key={item.id}>
                <div id={`item-${item.id}`} className={`relative pl-8 sm:pl-12 scroll-mt-20 ${isTransport ? 'pb-2 sm:pb-3' : 'pb-6 sm:pb-8'}`}>
                  {!isTransport && (
                    <div className={`absolute left-[-9px] sm:left-[-12px] top-2.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[3px] bg-white dark:bg-slate-900 z-10 flex items-center justify-center shadow-sm transition-all ${isFlight ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isFlight ? 'bg-blue-500' : item.type === 'Place' ? 'bg-primary' : 'bg-orange-500'}`} />
                    </div>
                  )}
                  <div className={`absolute left-[-0.5px] top-8 bottom-0 w-0.5 ${isTransport ? 'border-l-2 border-dashed border-slate-100 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'} last:hidden`} />
                  
                  {isTransport ? (
                    <div className={`group bg-slate-50 dark:bg-slate-800/40 rounded-xl px-3 py-1.5 border border-dashed flex items-center justify-center h-auto min-h-[40px] relative transition-all overflow-hidden ${isHighlighted ? 'ring-2 ring-primary bg-primary/5 border-primary shadow-lg' : isFlight ? 'bg-blue-50/20 border-blue-100 dark:border-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                       <div className="flex items-center gap-2 relative max-w-full px-12 sm:px-4 justify-center sm:justify-start">
                          <button 
                            disabled={isFlight || isGuest}
                            onClick={() => !isFlight && !isGuest && setShowTransportPickerId(item.id)}
                            className={`flex items-center gap-2 p-1 rounded-lg transition-colors w-full justify-center sm:justify-start text-center sm:text-left ${isFlight || isGuest ? 'cursor-default' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                          >
                            {transportOpt ? <transportOpt.icon size={13} className={transportOpt.color} /> : isFlight ? <Plane size={13} className="text-blue-500 shrink-0" /> : null}
                            <div className="w-full flex flex-col items-start overflow-hidden">
                               <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${isFlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  <span className="opacity-60">{labels.moving}: </span>
                                  {item.note}
                               </span>
                            </div>
                          </button>
                          
                          {showTransportPickerId === item.id && !isGuest && (
                            <div ref={editRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-2xl p-2 flex gap-1 animate-in zoom-in-95 duration-200">
                               {TRANSPORT_OPTIONS.map(opt => (
                                 <button 
                                    key={opt.type} 
                                    onClick={() => { setShowTransportPickerId(null); handleChangeTransportType(item.id, opt.type); }} 
                                    className={`p-2 rounded-lg transition-all ${item.transportType === opt.type ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700 opacity-40'}`}
                                 >
                                   <opt.icon size={14} className={opt.color} />
                                 </button>
                               ))}
                            </div>
                          )}
                       </div>
                       
                       {!isFlight && !isGuest && (
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 bg-white/80 dark:bg-slate-700 text-red-500/80 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 active:scale-90"><Trash2 size={12}/></button>
                         </div>
                       )}
                    </div>
                  ) : (
                    <div 
                      className={`group bg-white dark:bg-slate-800/80 p-3 sm:p-3.5 rounded-2xl border transition-all relative shadow-ios sm:hover:shadow-ios ${isHighlighted ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-2xl scale-[1.02] z-10' : isFlight ? 'ring-1 ring-blue-500/20 bg-blue-50/5 border-transparent' : 'border-transparent'}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-4">
                        {/* Left: Time */}
                        <div className="shrink-0 w-10 sm:w-14">
                          <div className={`font-mono font-black text-[10px] sm:text-sm ${isFlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                            {item.time}
                          </div>
                        </div>

                        {/* Center: Text Content */}
                        <div 
                           onClick={() => {
                             if (window.innerWidth < 640 && !isFlight && !isGuest) handleEditItem(item);
                           }}
                           className="flex-1 flex flex-col items-start text-left overflow-x-auto sm:overflow-x-visible custom-thin-scrollbar min-w-0 transition-all cursor-pointer sm:cursor-default rounded-xl px-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 sm:hover:bg-transparent"
                        >
                           <div className="flex items-center gap-1.5 w-full justify-start">
                              {isFlight && <Plane size={11} className="text-blue-500 shrink-0" />}
                              <div className={`font-black text-sm sm:text-base whitespace-nowrap sm:whitespace-normal px-1 sm:px-0 ${isFlight ? 'text-blue-900 dark:text-blue-300' : item.type === 'Food' ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`}>
                                 {item.placeName}
                              </div>
                           </div>
                           <div className="text-[9px] sm:text-xs font-medium text-slate-400 whitespace-nowrap sm:whitespace-normal px-1 sm:px-0 w-full text-left">
                             {item.note || '...'}
                           </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="shrink-0 flex flex-col gap-1 w-[72px] sm:w-24 items-end pl-1 sm:pl-3">
                           <button 
                             onClick={() => handleEditItem(item)}
                             disabled={isGuest || isFlight}
                             className={`hidden sm:flex w-full py-1.5 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-700 transition-all active:scale-95 ${isGuest || isFlight ? 'opacity-30 cursor-default' : 'bg-slate-50 dark:bg-slate-700/80 text-slate-500 hover:text-primary'}`}
                           >
                             <Edit2 size={13} />
                           </button>
                           <div className="flex gap-1 w-full transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank'); }} 
                                className="flex-1 py-1.5 flex items-center justify-center bg-slate-50 dark:bg-slate-700/80 text-slate-400 hover:text-primary rounded-lg border border-slate-100 dark:border-slate-700 active:scale-95 transition-all"
                              >
                                <Map size={13} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} 
                                disabled={isGuest || isFlight}
                                className={`flex-1 py-1.5 flex items-center justify-center rounded-lg border border-slate-100 dark:border-slate-700 transition-all active:scale-95 ${isGuest || isFlight ? 'opacity-30 cursor-default' : 'bg-slate-50 dark:bg-slate-700/80 text-red-400 hover:text-red-500'}`}
                              >
                                <Trash2 size={13} />
                              </button>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {canInsertTransport && !isGuest && (
                  <div className="relative flex items-center justify-center py-2 group/btn">
                    <div className="absolute left-[-0.5px] w-0.5 bg-slate-50 dark:bg-slate-800/50 h-full" />
                    {insertingAt === idx ? (
                      <div ref={editRef} className="z-10 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 shadow-xl rounded-2xl p-1.5 flex items-center gap-1 animate-in zoom-in-95 duration-200">
                        {TRANSPORT_OPTIONS.map(opt => (
                          <button key={opt.type} onClick={() => handleInsertTransport(idx, opt.type)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-90 shrink-0">
                            <opt.icon size={16} className={opt.color} />
                          </button>
                        ))}
                        <div className="w-px h-6 bg-slate-100 dark:bg-slate-700 mx-1" />
                        <button onClick={() => setInsertingAt(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-all">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setInsertingAt(idx)} className="z-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-100 p-1.5 rounded-full text-[9px] font-black flex items-center gap-1 transition-all sm:opacity-0 group-hover/btn:opacity-100 shadow-sm hover:shadow-md active:scale-95">
                        <Plus size={14} /> <span className="hidden sm:inline font-black ml-1 uppercase">{labels.selectTransport}</span>
                      </button>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Activity Form Modal */}
      {isFormOpen && editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-[40px] shadow-2xl w-full max-w-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{editingItem.placeName ? labels.editActivity : labels.addPlace}</h3>
                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {/* Type Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{labels.type}</label>
                  <div className="flex bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <button 
                      onClick={() => setEditingItem({ ...editingItem, type: 'Place' })}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${editingItem.type === 'Place' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}
                    >
                      <MapPin size={13}/> {labels.typePlace}
                    </button>
                    <button 
                      onClick={() => setEditingItem({ ...editingItem, type: 'Food' })}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${editingItem.type === 'Food' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-400'}`}
                    >
                      <Coffee size={13}/> {labels.typeFood}
                    </button>
                  </div>
                </div>

                {/* Name and Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{labels.placeName}</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={editingItem.placeName} 
                      onChange={e => setEditingItem({ ...editingItem, placeName: e.target.value })}
                      placeholder="..."
                      className="w-full bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{labels.time}</label>
                    <button 
                      onClick={() => setShowTimePicker(!showTimePicker)}
                      className="w-full bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-mono font-black text-center flex items-center justify-center gap-2 border-none outline-none focus:ring-2 focus:ring-primary/20 dark:text-white shadow-sm"
                    >
                      <Clock size={15} className="text-slate-400" />
                      {editingItem.time}
                    </button>
                    {showTimePicker && (
                      <TimePicker 
                        value={editingItem.time} 
                        onChange={(t) => { setEditingItem({ ...editingItem, time: t }); setShowTimePicker(false); }}
                        onClose={() => setShowTimePicker(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{labels.note}</label>
                  <textarea 
                    value={editingItem.note || ''} 
                    onChange={e => setEditingItem({ ...editingItem, note: e.target.value })}
                    rows={2}
                    placeholder="..."
                    className="w-full bg-slate-50 dark:bg-slate-900 p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 dark:text-white shadow-sm resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                  <button 
                    onClick={handleSaveItem}
                    disabled={!editingItem.placeName.trim()}
                    className="order-1 sm:order-2 flex-1 py-4 sm:py-5 bg-primary text-white rounded-2xl sm:rounded-3xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                  >
                    {labels.save}
                  </button>
                  <button 
                    onClick={() => setIsFormOpen(false)}
                    className="order-2 sm:order-1 flex-1 py-4 sm:py-5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl sm:rounded-3xl font-black hover:bg-slate-200 transition-all active:scale-95"
                  >
                    {labels.cancel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
