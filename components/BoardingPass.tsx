
import React from 'react';
import { FlightSegment } from '../types';
import { Plane, QrCode, Briefcase, ShoppingBag, MapPin } from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from '../App';

interface Props {
  segment: FlightSegment;
  passengerName?: string;
  cabinClass?: string;
}

const getAirlineLogo = (id: string | undefined) => id ? `https://pics.avs.io/200/200/${id}.png` : null;

export const BoardingPass: React.FC<Props> = ({ segment, passengerName = "TRAVELER", cabinClass = "Economy" }) => {
  const { language } = useTranslation();
  const logoUrl = getAirlineLogo(segment.airlineID);

  const labels = {
    airline: language === 'zh' ? '航空公司' : 'Airline',
    cabin: language === 'zh' ? '艙等' : 'Cabin',
    Economy: language === 'zh' ? '經濟艙' : 'Economy',
    Business: language === 'zh' ? '商務艙' : 'Business',
    passenger: language === 'zh' ? '旅客姓名' : 'Passenger Name',
    terminal: language === 'zh' ? '航廈' : 'Terminal',
    flight: language === 'zh' ? '航班' : 'Flight',
    dep: language === 'zh' ? '起飛' : 'Dep',
    arr: language === 'zh' ? '目的地' : 'Arr',
    depTime: language === 'zh' ? '起飛時間' : 'Boarding Time'
  };

  const airlineName = language === 'zh' && segment.airlineNameZh ? segment.airlineNameZh : segment.airline;

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-[32px] shadow-ios hover:shadow-ios-lg border border-slate-100/50 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row mb-6 transition-all duration-500">
      <div className="flex-1 p-8 relative">
        <div className="flex justify-between items-start mb-8 border-b border-slate-50 dark:border-slate-700 pb-6">
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-white dark:bg-slate-700 border border-slate-50 dark:border-slate-600 rounded-2xl flex items-center justify-center p-2 shadow-sm overflow-hidden">
                <img src={logoUrl || ''} alt={segment.airline} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x64?text=' + (segment.airlineID || 'AIR'); }} />
             </div>
             <div>
               <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-0.5">{labels.airline}</div>
               <div className="font-black text-xl text-slate-900 dark:text-white leading-tight">{airlineName}</div>
             </div>
           </div>
           <div className="flex flex-col items-end gap-2">
             <div className="text-right">
               <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-0.5">{labels.cabin}</div>
               <div className="font-black text-slate-800 dark:text-slate-200">{(labels as any)[cabinClass] || cabinClass}</div>
             </div>
             {segment.baggage && (
               <div className="flex gap-2">
                  <div className="flex items-center gap-1 text-[10px] bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-black"><ShoppingBag size={10} /> {segment.baggage.carryOn.weight}</div>
                  <div className="flex items-center gap-1 text-[10px] bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-black"><Briefcase size={10} /> {segment.baggage.checked.weight}</div>
               </div>
             )}
           </div>
        </div>
        <div className="flex justify-between items-center mb-10 px-2">
           <div className="text-left">
              <div className="text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tighter">{segment.departureAirport}</div>
              <div className="text-base font-black text-slate-600 dark:text-slate-300 mt-2">{DateTimeUtils.formatTime24(segment.departureTime)}</div>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{DateTimeUtils.formatDateFriendly(segment.departureTime, language)}</div>
           </div>
           <div className="flex-1 px-8 flex flex-col items-center">
              <div className="w-full border-t-2 border-dashed border-slate-100 dark:border-slate-700 relative h-0">
                 <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-primary bg-white dark:bg-slate-800 p-2 rounded-full" size={28} />
              </div>
              <div className="text-[10px] font-mono font-black text-slate-300 dark:text-slate-600 mt-4 tracking-[0.3em]">{segment.flightNumber}</div>
           </div>
           <div className="text-right">
              <div className="text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tighter">{segment.arrivalAirport}</div>
              <div className="text-base font-black text-slate-600 dark:text-slate-300 mt-2">{DateTimeUtils.formatTime24(segment.arrivalTime)}</div>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{DateTimeUtils.formatDateFriendly(segment.arrivalTime, language)}</div>
           </div>
        </div>
        <div className="flex justify-between items-end bg-slate-50/50 dark:bg-slate-900/50 -mx-8 -mb-8 p-8 mt-6">
           <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{labels.passenger}</div><div className="font-black text-lg text-slate-900 dark:text-white">{passengerName}</div></div>
           <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{labels.terminal}</div><div className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-1"><MapPin size={16} className="text-primary" />{segment.terminal ? `T${segment.terminal}` : 'TBA'}</div></div>
           <div className="bg-white dark:bg-slate-700 p-3 rounded-2xl border border-slate-50 dark:border-slate-600 shadow-sm"><QrCode className="text-slate-900 dark:text-white" size={40} /></div>
        </div>
        <div className="absolute top-[65%] -right-4 w-8 h-8 bg-[#FBFBFD] dark:bg-[#1C1C1E] rounded-full hidden md:block transition-colors border-l border-slate-100/50 dark:border-slate-700"></div>
      </div>
      <div className="hidden md:flex w-60 border-l border-dashed border-slate-100 dark:border-slate-700 bg-slate-50/20 dark:bg-slate-900/30 p-8 flex-col justify-between relative transition-colors">
         <div className="absolute top-[65%] -left-4 w-8 h-8 bg-[#FBFBFD] dark:bg-[#1C1C1E] rounded-full transition-colors border-r border-slate-100/50 dark:border-slate-700"></div>
         <div className="space-y-8">
            <div className="flex items-center gap-2"><span className="font-black text-xs text-slate-400 dark:text-slate-500 tracking-widest truncate">{airlineName}</span></div>
            <div className="space-y-5">
               <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{labels.flight}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.flightNumber}</div></div>
               <div className="flex justify-between">
                  <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{labels.dep}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.departureAirport}</div></div>
                  <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{labels.arr}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.arrivalAirport}</div></div>
               </div>
               <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{labels.terminal}</div><div className="font-black text-sm text-slate-900 dark:text-white">{segment.terminal ? `Terminal ${segment.terminal}` : 'TBA'}</div></div>
            </div>
         </div>
         <div className="text-center pt-6 border-t border-slate-100 dark:border-slate-800"><div className="font-mono text-2xl font-black tracking-[0.2em] text-primary">{DateTimeUtils.formatTime24(segment.departureTime).replace(':','')}</div><div className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-[0.2em]">{labels.depTime}</div></div>
      </div>
    </div>
  );
};
