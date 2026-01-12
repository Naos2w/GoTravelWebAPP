
import React from 'react';
import { FlightSegment } from '../types';
import { Plane, QrCode, Briefcase, ShoppingBag, MapPin } from 'lucide-react';

interface Props {
  segment: FlightSegment;
  passengerName?: string;
  cabinClass?: string;
  seat?: string;
}

const getAirlineLogo = (id: string | undefined) => {
  if (!id) return null;
  return `https://pics.avs.io/200/200/${id}.png`;
};

export const BoardingPass: React.FC<Props> = ({ 
  segment, 
  passengerName = "TRAVELER", 
  cabinClass = "Economy",
  seat = "ANY"
}) => {
  const formatDate = (iso: string) => {
    if (!iso) return "DATE";
    return new Date(iso).toLocaleDateString('zh-TW', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  };

  const formatTime = (iso: string) => {
    if (!iso) return "--:--";
    // Force 24-hour format
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const logoUrl = getAirlineLogo(segment.airlineID);

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row mb-6 font-sans">
      {/* Main Ticket Section */}
      <div className="flex-1 p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-white border border-gray-100 rounded-xl flex items-center justify-center p-2 shadow-sm overflow-hidden">
                <img 
                  src={logoUrl || ''} 
                  alt={segment.airline} 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x64?text=' + (segment.airlineID || 'AIR');
                  }}
                />
             </div>
             <div>
               <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">航空公司</div>
               <div className="font-bold text-lg text-slate-800 leading-tight">
                  {segment.airlineNameZh || segment.airline}
               </div>
             </div>
           </div>
           <div className="flex flex-col items-end gap-2">
             <div className="text-right">
               <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">艙等</div>
               <div className="font-bold text-slate-800">{cabinClass === 'Economy' ? '經濟艙' : (cabinClass === 'Business' ? '商務艙' : cabinClass)}</div>
             </div>
             {segment.baggage && (
               <div className="flex gap-2">
                  <div className="flex items-center gap-1 text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-slate-500 font-bold">
                    <ShoppingBag size={10} /> {segment.baggage.carryOn.weight}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-slate-500 font-bold">
                    <Briefcase size={10} /> {segment.baggage.checked.weight}
                  </div>
               </div>
             )}
           </div>
        </div>

        {/* Route Info */}
        <div className="flex justify-between items-center mb-8 px-2">
           <div className="text-left">
              <div className="text-4xl font-mono font-bold text-slate-900 tracking-tighter">{segment.departureAirport}</div>
              <div className="text-sm font-bold text-slate-600 mt-1">{formatTime(segment.departureTime)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(segment.departureTime)}</div>
           </div>

           <div className="flex-1 px-6 flex flex-col items-center">
              <div className="w-full border-t-2 border-dashed border-gray-200 relative h-0">
                 <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-primary bg-white p-1" size={24} />
              </div>
              <div className="text-[10px] font-mono font-bold text-slate-400 mt-2 tracking-widest">{segment.flightNumber}</div>
           </div>

           <div className="text-right">
              <div className="text-4xl font-mono font-bold text-slate-900 tracking-tighter">{segment.arrivalAirport}</div>
              <div className="text-sm font-bold text-slate-600 mt-1">{formatTime(segment.arrivalTime)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(segment.arrivalTime)}</div>
           </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-end bg-slate-50/50 -mx-6 -mb-6 p-6 mt-4">
           <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">旅客姓名</div>
              <div className="font-bold text-slate-800">{passengerName}</div>
           </div>
           <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">航廈</div>
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <MapPin size={14} className="text-slate-400" />
                {segment.terminal ? `TERMINAL ${segment.terminal}` : 'TBA'}
              </div>
           </div>
           <div className="bg-white p-2 rounded-lg border border-gray-100">
               <QrCode className="text-slate-900" size={36} />
           </div>
        </div>

        <div className="absolute top-[68%] -right-3 w-6 h-6 bg-[#F5F5F7] rounded-full hidden md:block"></div>
      </div>

      {/* Stub Section */}
      <div className="hidden md:flex w-52 border-l border-dashed border-gray-200 bg-slate-50/30 p-6 flex-col justify-between relative">
         <div className="absolute top-[68%] -left-3 w-6 h-6 bg-[#F5F5F7] rounded-full"></div>
         
         <div className="space-y-6">
            <div className="flex items-center gap-2">
               <span className="font-bold text-xs text-slate-500 tracking-tighter truncate">{segment.airlineNameZh || segment.airline}</span>
            </div>
            
            <div className="space-y-4">
               <div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold">航班</div>
                  <div className="font-mono font-bold text-sm text-slate-800">{segment.flightNumber}</div>
               </div>
               <div className="flex justify-between">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">起飛</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{segment.departureAirport}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold">目的地</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{segment.arrivalAirport}</div>
                  </div>
               </div>
               <div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold">航廈</div>
                  <div className="font-bold text-xs text-slate-800">{segment.terminal ? `T${segment.terminal}` : 'TBA'}</div>
               </div>
            </div>
         </div>
         
         <div className="text-center pt-4 border-t border-gray-100">
            <div className="font-mono text-xl font-bold tracking-widest text-primary">
              {segment.departureTime ? formatTime(segment.departureTime).replace(':','') : 'GATE'}
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">起飛時間</div>
         </div>
      </div>
    </div>
  );
};
