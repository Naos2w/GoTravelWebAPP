
import React, { useState, useEffect } from 'react';
import { Trip, DayPlan, ItineraryItem } from '../types';
import { MapPin, Coffee, Bus, Trash2, Map, Plane, Clock } from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const Itinerary: React.FC<Props> = ({ trip, onUpdate }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [showTimePickerId, setShowTimePickerId] = useState<string | null>(null);

  useEffect(() => {
    if (!trip.startDate || !trip.endDate) return;

    // Fix: Using local-safe date creation
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
        if (existing) {
          newPlan.push(existing);
        } else {
          newPlan.push({ date: dateStr, items: [] });
        }
      }
      currentItinerary = newPlan;
      onUpdate({ ...trip, itinerary: currentItinerary });
    }
    setDays(currentItinerary);
  }, [trip.startDate, trip.endDate]);

  useEffect(() => {
    setDays(trip.itinerary || []);
  }, [trip.itinerary]);

  const addActivity = (type: ItineraryItem['type']) => {
    const newItems = [...days[selectedDayIndex].items];
    newItems.push({
      id: Date.now().toString(),
      time: '09:00',
      placeName: type === 'Place' ? '新地點' : (type === 'Food' ? '餐廳' : '交通移動'),
      type,
      note: ''
    });

    const newDays = [...days];
    newDays[selectedDayIndex] = { ...newDays[selectedDayIndex], items: newItems.sort((a,b) => a.time.localeCompare(b.time)) };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const updateItem = (dayIdx: number, itemIdx: number, field: keyof ItineraryItem, value: string) => {
    const newDays = [...days];
    newDays[dayIdx].items[itemIdx] = { ...newDays[dayIdx].items[itemIdx], [field]: value };
    if (field === 'time') {
      newDays[dayIdx].items.sort((a, b) => a.time.localeCompare(b.time));
    }
    onUpdate({ ...trip, itinerary: newDays });
  };

  const deleteItem = (dayIdx: number, itemIdx: number) => {
    const newDays = [...days];
    newDays[dayIdx].items.splice(itemIdx, 1);
    onUpdate({ ...trip, itinerary: newDays });
  };

  if (days.length === 0) return <div className="p-8 text-center text-gray-500">請先設定旅程日期。</div>;

  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      <div className="lg:w-28 xl:w-32 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0">
        {days.map((day, idx) => {
          // Use safer local date
          const dateObj = new Date(day.date + 'T00:00:00');
          const isSelected = idx === selectedDayIndex;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex-shrink-0 lg:w-full p-2 rounded-2xl text-center transition-all border ${
                isSelected ? 'bg-slate-800 text-white shadow-md border-slate-800' : 'bg-white text-slate-600 hover:bg-gray-50 border-gray-100'
              }`}
            >
              <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                Day {idx + 1}
              </div>
              <div className="font-bold text-xs md:text-sm leading-tight">
                {dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
              </div>
              <div className="text-[9px] opacity-60">
                {dateObj.toLocaleDateString('zh-TW', { weekday: 'short' })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <h2 className="text-xl font-bold text-slate-800">
             Day {selectedDayIndex + 1} 行程安排
          </h2>
          <div className="flex gap-2">
            <button onClick={() => addActivity('Place')} className="p-2 hover:bg-gray-100 rounded-lg text-primary" title="新增地點"><MapPin size={20}/></button>
            <button onClick={() => addActivity('Food')} className="p-2 hover:bg-gray-100 rounded-lg text-orange-500" title="新增用餐"><Coffee size={20}/></button>
            <button onClick={() => addActivity('Transport')} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500" title="新增交通"><Bus size={20}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-0 relative">
          {currentDay?.items.map((item, idx) => {
            const isFlightDep = item.id.includes('flight-dep');
            const isFlightArr = item.id.includes('flight-arr');
            const isAutoFlight = isFlightDep || isFlightArr;
            
            let duration = null;
            if (isFlightDep) {
               const prefix = item.id.replace('-dep', '');
               const arrItem = currentDay.items.find(i => i.id === `${prefix}-arr`);
               if (arrItem) {
                  duration = DateTimeUtils.getDuration(item.time, arrItem.time);
               }
            }

            return (
              <div key={item.id} className="relative pl-12 border-l-2 border-gray-100 last:border-0 pb-12">
                <div className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 bg-white z-10 ${
                   item.type === 'Place' ? 'border-primary' : item.type === 'Food' ? 'border-orange-500' : 'border-slate-500'
                }`} />

                {duration && (
                  <div className="absolute left-[-1px] top-full -translate-y-[24px] z-30 pointer-events-none flex flex-col items-center">
                    <div className="bg-slate-900 text-white shadow-lg px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap -translate-x-1/2 flex items-center gap-1.5 ring-2 ring-white">
                      <Plane size={9} className="fill-white" />
                      {duration}
                    </div>
                  </div>
                )}
                
                <div className={`rounded-2xl p-4 group transition-all border ${isAutoFlight ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                   <div className="flex items-start gap-4">
                     <div className="flex flex-col items-center min-w-[80px] relative">
                        <button 
                          onClick={() => !isAutoFlight && setShowTimePickerId(showTimePickerId === item.id ? null : item.id)}
                          className={`font-mono text-base font-bold px-2 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${isAutoFlight ? 'text-primary' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                        >
                          {!isAutoFlight && <Clock size={12} className="text-slate-400" />}
                          {item.time}
                        </button>
                        
                        {showTimePickerId === item.id && (
                          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-3xl shadow-2xl z-50 p-3 flex gap-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar pr-1">
                              {Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0')).map(h => (
                                <button
                                  key={h}
                                  onClick={() => {
                                    const [_, currentMin] = item.time.split(':');
                                    updateItem(selectedDayIndex, idx, 'time', `${h}:${currentMin}`);
                                  }}
                                  className={`w-8 h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${item.time.split(':')[0] === h ? 'bg-primary text-white' : 'hover:bg-gray-100 text-slate-600'}`}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                            <div className="w-px bg-gray-100"></div>
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar pr-1">
                              {Array.from({length: 12}, (_, i) => (i*5).toString().padStart(2, '0')).map(m => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    const [currentHour, _] = item.time.split(':');
                                    updateItem(selectedDayIndex, idx, 'time', `${currentHour}:${m}`);
                                    setShowTimePickerId(null);
                                  }}
                                  className={`w-8 h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${item.time.split(':')[1] === m ? 'bg-primary text-white' : 'hover:bg-gray-100 text-slate-600'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                     </div>
                     <div className="flex-1 space-y-0.5">
                       <div className={`font-bold text-lg tracking-tight ${isAutoFlight ? 'text-blue-900' : 'text-slate-800'}`}>
                         {item.placeName}
                       </div>
                       <input 
                         value={item.note || ''}
                         onChange={(e) => updateItem(selectedDayIndex, idx, 'note', e.target.value)}
                         placeholder="新增備註..."
                         className="text-xs text-slate-500 font-medium bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-300"
                       />
                     </div>
                     <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                          className="p-1.5 bg-white text-blue-500 hover:text-blue-700 rounded-lg shadow-sm border border-gray-100" 
                          title="開啟地圖"
                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}
                        >
                         <Map size={16} />
                       </button>
                       {!isAutoFlight && (
                         <button onClick={() => deleteItem(selectedDayIndex, idx)} className="p-1.5 bg-white text-gray-400 hover:text-red-500 rounded-lg shadow-sm border border-gray-100">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
