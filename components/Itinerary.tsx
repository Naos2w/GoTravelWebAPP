import React, { useState, useEffect } from 'react';
import { Trip, DayPlan, ItineraryItem } from '../types';
import { MapPin, Clock, Coffee, Bus, Plus, Trash2, Map } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const Itinerary: React.FC<Props> = ({ trip, onUpdate }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);

  useEffect(() => {
    // Generate days based on start/end date if not existing
    if (!trip.startDate || !trip.endDate) return;

    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let currentItinerary = [...(trip.itinerary || [])];

    // Resize array if dates changed
    if (currentItinerary.length !== diffDays) {
      const newPlan: DayPlan[] = [];
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Try to find existing plan for this date
        const existing = currentItinerary.find(p => p.date === dateStr);
        newPlan.push(existing || { date: dateStr, items: [] });
      }
      currentItinerary = newPlan;
      onUpdate({ ...trip, itinerary: currentItinerary });
    }
    setDays(currentItinerary);
  }, [trip.startDate, trip.endDate, trip.itinerary]);

  const addActivity = (type: ItineraryItem['type']) => {
    const newItems = [...days[selectedDayIndex].items];
    newItems.push({
      id: Date.now().toString(),
      time: '09:00',
      placeName: type === 'Place' ? 'New Location' : (type === 'Food' ? 'Restaurant' : 'Travel'),
      type,
      note: ''
    });

    const newDays = [...days];
    newDays[selectedDayIndex] = { ...newDays[selectedDayIndex], items: newItems };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const updateItem = (dayIdx: number, itemIdx: number, field: keyof ItineraryItem, value: string) => {
    const newDays = [...days];
    newDays[dayIdx].items[itemIdx] = { ...newDays[dayIdx].items[itemIdx], [field]: value };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const deleteItem = (dayIdx: number, itemIdx: number) => {
    const newDays = [...days];
    newDays[dayIdx].items.splice(itemIdx, 1);
    onUpdate({ ...trip, itinerary: newDays });
  };

  if (days.length === 0) return <div className="p-8 text-center text-gray-500">Please set trip dates first.</div>;

  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Day Selector (Sidebar on Desktop, Top bar on Mobile) */}
      <div className="lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0">
        {days.map((day, idx) => {
          const dateObj = new Date(day.date);
          const isSelected = idx === selectedDayIndex;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex-shrink-0 lg:w-full p-4 rounded-2xl text-left transition-all ${
                isSelected ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-gray-50'
              }`}
            >
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                Day {idx + 1}
              </div>
              <div className="font-semibold text-lg">
                {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">
             Day {selectedDayIndex + 1} Itinerary
          </h2>
          <div className="flex gap-2">
            <button onClick={() => addActivity('Place')} className="p-2 hover:bg-gray-100 rounded-lg text-primary" title="Add Place"><MapPin size={20}/></button>
            <button onClick={() => addActivity('Food')} className="p-2 hover:bg-gray-100 rounded-lg text-orange-500" title="Add Food"><Coffee size={20}/></button>
            <button onClick={() => addActivity('Transport')} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500" title="Add Transport"><Bus size={20}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentDay && currentDay.items.length === 0 && (
             <div className="text-center py-20 text-gray-400">
               No activities planned yet.
             </div>
          )}
          
          {currentDay?.items.map((item, idx) => (
            <div key={item.id} className="relative pl-8 border-l-2 border-gray-100 last:border-0 pb-6">
              <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white ${
                 item.type === 'Place' ? 'border-primary' : item.type === 'Food' ? 'border-orange-500' : 'border-slate-500'
              }`} />
              
              <div className="bg-gray-50 rounded-xl p-4 group">
                 <div className="flex items-start gap-4">
                   <input 
                     type="time" 
                     value={item.time}
                     onChange={(e) => updateItem(selectedDayIndex, idx, 'time', e.target.value)}
                     className="bg-transparent font-mono text-sm text-slate-500 focus:outline-none"
                   />
                   <div className="flex-1 space-y-2">
                     <input 
                       type="text"
                       value={item.placeName}
                       onChange={(e) => updateItem(selectedDayIndex, idx, 'placeName', e.target.value)}
                       className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none placeholder-slate-400"
                       placeholder="Location Name"
                     />
                     <input 
                       type="text"
                       value={item.note || ''}
                       onChange={(e) => updateItem(selectedDayIndex, idx, 'note', e.target.value)}
                       className="w-full bg-transparent text-sm text-slate-500 focus:outline-none placeholder-slate-300"
                       placeholder="Add notes..."
                     />
                   </div>
                   <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                        className="text-blue-500 hover:text-blue-700" 
                        title="Open Maps"
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}
                      >
                       <Map size={16} />
                     </button>
                     <button onClick={() => deleteItem(selectedDayIndex, idx)} className="text-gray-400 hover:text-red-500">
                       <Trash2 size={16} />
                     </button>
                   </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
