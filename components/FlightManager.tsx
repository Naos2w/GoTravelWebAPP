import React, { useState } from 'react';
import { Trip, FlightInfo, FlightSegment, Currency } from '../types';
import { Plane, Calendar, Clock, MapPin, Save, Edit2, Sparkles, Loader2 } from 'lucide-react';
import { fetchFlightDetails } from '../services/geminiService';
import { BoardingPass } from './BoardingPass';

interface FlightSegmentInputProps {
  title: string;
  data: FlightSegment;
  date: string; // Passed explicitly
  loading: boolean;
  onAutoFill: () => void;
  onChange: (field: keyof FlightSegment, val: string) => void;
}

const FlightSegmentInput: React.FC<FlightSegmentInputProps> = ({ 
  title, 
  data, 
  date,
  loading,
  onAutoFill,
  onChange 
}) => (
  <div className="bg-gray-50 p-6 rounded-2xl space-y-4 relative">
    <div className="flex justify-between items-center">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <Plane className="rotate-[-45deg]" size={18} /> {title}
      </h3>
      <div className="text-xs text-slate-400 bg-white px-2 py-1 rounded-md border border-gray-100">
        Date: {date}
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {/* Flight Number & Auto-fill */}
      <div className="space-y-1 col-span-2 md:col-span-1">
        <label className="text-xs text-slate-500 font-medium">Flight No.</label>
        <div className="flex gap-2">
          <input 
            value={data.flightNumber} 
            onChange={e => onChange('flightNumber', e.target.value.toUpperCase())}
            placeholder="e.g. JX800"
            className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold uppercase"
          />
          <button 
            onClick={onAutoFill}
            disabled={loading || !data.flightNumber}
            className="bg-secondary/10 text-secondary hover:bg-secondary/20 disabled:opacity-50 p-2 rounded-lg transition-colors"
            title="Auto-fill with AI"
          >
            {loading ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
          </button>
        </div>
      </div>

      <div className="space-y-1 col-span-2 md:col-span-1">
        <label className="text-xs text-slate-500 font-medium">Airline</label>
        <input 
          value={data.airline} 
          onChange={e => onChange('airline', e.target.value)}
          placeholder="Airline Name"
          className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div className="hidden md:block"></div>

      <div className="space-y-1">
         <label className="text-xs text-slate-500 font-medium">Dep. Airport</label>
         <input 
           value={data.departureAirport} 
           onChange={e => onChange('departureAirport', e.target.value)}
           placeholder="TPE"
           className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
         />
      </div>
      <div className="space-y-1">
         <label className="text-xs text-slate-500 font-medium">Dep. Time</label>
         <input 
           type="datetime-local"
           value={data.departureTime} 
           onChange={e => onChange('departureTime', e.target.value)}
           className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm"
         />
      </div>
      <div className="hidden md:block"></div>

      <div className="space-y-1">
         <label className="text-xs text-slate-500 font-medium">Arr. Airport</label>
         <input 
           value={data.arrivalAirport} 
           onChange={e => onChange('arrivalAirport', e.target.value)}
           placeholder="NRT"
           className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
         />
      </div>
      <div className="space-y-1">
         <label className="text-xs text-slate-500 font-medium">Arr. Time</label>
         <input 
           type="datetime-local"
           value={data.arrivalTime} 
           onChange={e => onChange('arrivalTime', e.target.value)}
           className="w-full bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm"
         />
      </div>
    </div>
  </div>
);

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const FlightManager: React.FC<Props> = ({ trip, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loadingField, setLoadingField] = useState<'outbound' | 'inbound' | null>(null);

  // Clone current flight info or set defaults
  const [flightData, setFlightData] = useState<FlightInfo>(trip.flight || {
    price: 0,
    currency: Currency.TWD,
    cabinClass: 'Economy',
    outbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '' },
    inbound: { airline: '', flightNumber: '', departureTime: '', arrivalTime: '', departureAirport: '', arrivalAirport: '' },
    baggage: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' }, note: '' }
  });

  const handleSave = () => {
    onUpdate({ ...trip, flight: flightData });
    setIsEditing(false);
  };

  const handleChange = (
    section: 'outbound' | 'inbound' | 'baggage' | 'root', 
    field: string, 
    value: any
  ) => {
    if (section === 'root') {
      setFlightData(prev => ({ ...prev, [field]: value }));
    } else if (section === 'baggage') {
        // Handle nested baggage update if needed
    } else {
      setFlightData(prev => ({
        ...prev,
        [section]: { ...prev[section as 'outbound' | 'inbound']!, [field]: value }
      }));
    }
  };

  const handleAutoFill = async (type: 'outbound' | 'inbound') => {
    const segment = type === 'outbound' ? flightData.outbound : flightData.inbound;
    const date = type === 'outbound' ? trip.startDate : trip.endDate;

    if (!segment?.flightNumber) {
      alert("Please enter a Flight Number first (e.g., BR198).");
      return;
    }

    setLoadingField(type);
    try {
      const result = await fetchFlightDetails(segment.flightNumber, date);
      if (result) {
        setFlightData(prev => ({
          ...prev,
          [type]: { ...prev[type === 'outbound' ? 'outbound' : 'inbound']!, ...result }
        }));
      } else {
        alert("Could not find flight details. Please check the flight number or enter manually.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching details.");
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Flight Tickets</h2>
          <p className="text-slate-500 text-sm">Manage your boarding passes</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors ${
            isEditing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {isEditing ? <><Save size={18}/> Save Changes</> : <><Edit2 size={18}/> Edit Flights</>}
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
           {/* Tips */}
           <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <Sparkles className="mt-0.5 flex-shrink-0" size={16} />
              <p>Enter your Flight Number (e.g., JX800) and click the magic wand button to automatically retrieve flight times and airport codes using AI.</p>
           </div>

           <FlightSegmentInput 
             title="Outbound Flight" 
             data={flightData.outbound} 
             date={trip.startDate}
             loading={loadingField === 'outbound'}
             onAutoFill={() => handleAutoFill('outbound')}
             onChange={(f, v) => handleChange('outbound', f, v)} 
           />
           <FlightSegmentInput 
             title="Return Flight" 
             data={flightData.inbound!} 
             date={trip.endDate}
             loading={loadingField === 'inbound'}
             onAutoFill={() => handleAutoFill('inbound')}
             onChange={(f, v) => handleChange('inbound', f, v)} 
           />
           
           <div className="bg-gray-50 p-6 rounded-2xl">
              <h3 className="font-semibold text-slate-700 mb-4">Ticket Info</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs text-slate-500 font-medium">Price</label>
                   <div className="flex gap-2">
                     <select 
                       value={flightData.currency}
                       onChange={e => handleChange('root', 'currency', e.target.value)}
                       className="bg-white p-2 rounded-lg border border-gray-200 text-sm"
                     >
                       {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <input 
                        type="number"
                        value={flightData.price}
                        onChange={e => handleChange('root', 'price', Number(e.target.value))}
                        className="flex-1 bg-white p-2 rounded-lg border border-gray-200 text-sm"
                     />
                   </div>
                 </div>
                 <div>
                    <label className="text-xs text-slate-500 font-medium">Cabin Class</label>
                    <select 
                      value={flightData.cabinClass}
                      onChange={e => handleChange('root', 'cabinClass', e.target.value)}
                      className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm h-[38px]"
                    >
                      <option value="Economy">Economy</option>
                      <option value="Business">Business</option>
                      <option value="First">First Class</option>
                    </select>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8">
           {(!trip.flight?.outbound.flightNumber && !trip.flight?.inbound?.flightNumber) ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
                <Plane className="mx-auto text-slate-300 mb-2" size={48} />
                <p className="text-slate-500">No flight details added yet.</p>
                <button onClick={() => setIsEditing(true)} className="mt-4 text-primary font-medium hover:underline">Add Flights</button>
             </div>
           ) : (
             <>
               <div>
                  <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-4 ml-2">Outbound Ticket</h3>
                  <BoardingPass 
                    segment={trip.flight.outbound} 
                    cabinClass={trip.flight.cabinClass} 
                    seat={trip.flight.seat} 
                  />
               </div>

               {trip.flight.inbound && trip.flight.inbound.flightNumber && (
                 <div>
                    <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-4 ml-2">Inbound Ticket</h3>
                    <BoardingPass 
                      segment={trip.flight.inbound} 
                      cabinClass={trip.flight.cabinClass} 
                      seat={trip.flight.seat} 
                    />
                 </div>
               )}
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-white p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-2">Total Cost</h4>
                    <div className="text-2xl font-bold text-slate-800">
                      {trip.flight?.currency} {trip.flight?.price.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-400">{trip.flight?.cabinClass}</div>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-2">Baggage</h4>
                    <div className="flex gap-4 text-slate-700">
                      <div>
                        <span className="block text-xs text-slate-400">Carry On</span>
                        <span className="font-semibold">{trip.flight?.baggage.carryOn.count}x / {trip.flight?.baggage.carryOn.weight}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-400">Checked</span>
                        <span className="font-semibold">{trip.flight?.baggage.checked.count}x / {trip.flight?.baggage.checked.weight}</span>
                      </div>
                    </div>
                 </div>
               </div>
             </>
           )}
        </div>
      )}
    </div>
  );
};
