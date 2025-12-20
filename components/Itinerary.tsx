
import React, { useState, useEffect } from 'react';
import { Trip, DayPlan, ItineraryItem } from '../types';
import { MapPin, Coffee, Bus, Trash2, Map, Plane } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const Itinerary: React.FC<Props> = ({ trip, onUpdate }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);

  useEffect(() => {
    if (!trip.startDate || !trip.endDate) return;

    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let currentItinerary = [...(trip.itinerary || [])];

    if (currentItinerary.length !== diffDays) {
      const newPlan: DayPlan[] = [];
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
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

  const getDurationString = (startTime: string, endTime: string) => {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    
    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (days.length === 0) return <div className="p-8 text-center text-gray-500">請先設定旅程日期。</div>;

  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Optimized Sidebar: Narrower width for desktop */}
      <div className="lg:w-40 xl:w-48 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0">
        {days.map((day, idx) => {
          const dateObj = new Date(day.date);
          const isSelected = idx === selectedDayIndex;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex-shrink-0 lg:w-full p-3 md:p-4 rounded-2xl text-left transition-all border ${
                isSelected ? 'bg-slate-800 text-white shadow-md border-slate-800' : 'bg-white text-slate-600 hover:bg-gray-50 border-gray-100'
              }`}
            >
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                Day {idx + 1}
              </div>
              <div className="font-semibold text-sm md:text-base leading-tight">
                {dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                <span className="ml-1 opacity-60 text-xs">({dateObj.toLocaleDateString('zh-TW', { weekday: 'short' })})</span>
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
          {currentDay && currentDay.items.length === 0 && (
             <div className="text-center py-20 text-gray-400">
               目前尚未規劃任何行程。
             </div>
          )}
          
          {currentDay?.items.map((item, idx) => {
            const isFlightDep = item.id.includes('flight-dep');
            const isFlightArr = item.id.includes('flight-arr');
            const isAutoFlight = isFlightDep || isFlightArr;
            
            let duration = null;
            if (isFlightDep) {
               const prefix = item.id.replace('-dep', '');
               const arrItem = currentDay.items.find(i => i.id === `${prefix}-arr`);
               if (arrItem) {
                  duration = getDurationString(item.time, arrItem.time);
               }
            }

            return (
              <div key={item.id} className="relative pl-12 border-l-2 border-gray-100 last:border-0 pb-12">
                {/* Timeline Icon */}
                <div className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 bg-white z-10 ${
                   item.type === 'Place' ? 'border-primary' : item.type === 'Food' ? 'border-orange-500' : 'border-slate-500'
                }`} />

                {/* Duration Badge: Centered on the timeline line between two items */}
                {duration && (
                  <div className="absolute left-[-1px] top-full -translate-y-[24px] z-30 pointer-events-none flex flex-col items-center">
                    <div className="bg-slate-900 text-white shadow-lg px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap -translate-x-1/2 flex items-center gap-1.5 ring-2 ring-white">
                      <Plane size={10} className="fill-white" />
                      {duration}
                    </div>
                  </div>
                )}
                
                <div className={`rounded-2xl p-4 group transition-all border ${isAutoFlight ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                   <div className="flex items-start gap-4">
                     <div className="flex flex-col items-center min-w-[65px]">
                        <input 
                          type="time" 
                          value={item.time}
                          readOnly={isAutoFlight}
                          step="60"
                          onChange={(e) => updateItem(selectedDayIndex, idx, 'time', e.target.value)}
                          className={`bg-transparent font-mono text-base focus:outline-none w-full text-center tracking-tight cursor-default ${isAutoFlight ? 'text-primary font-bold' : 'text-slate-500'}`}
                          style={{ colorScheme: 'light' }}
                        />
                     </div>
                     <div className="flex-1 space-y-0.5">
                       <div className={`font-bold text-lg tracking-tight ${isAutoFlight ? 'text-blue-900' : 'text-slate-800'}`}>
                         {item.placeName}
                       </div>
                       <div className="text-xs text-slate-500 font-medium">
                         {item.note || '無備註'}
                       </div>
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
