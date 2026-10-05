import React from 'react';
import { FlightSegment } from '../types';
import { Plane, QrCode, Briefcase, ShoppingBag, MapPin, Sparkles } from 'lucide-react';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { useTranslation } from "../contexts/LocalizationContext";

interface Props {
  segment: FlightSegment;
  passengerName?: string;
  cabinClass?: string;
}

const getAirlineLogo = (id: string | undefined) => id ? `https://pics.avs.io/200/200/${id}.png` : null;

export const BoardingPass: React.FC<Props> = ({ segment, passengerName = "TRAVELER", cabinClass = "Economy" }) => {
  const { t, language } = useTranslation();
  const logoUrl = getAirlineLogo(segment.airlineID);

  const airlineName = language === 'zh' 
    ? (segment.airlineNameZh || segment.airline) 
    : (segment.airlineNameEn || segment.airline);

  const renderBaggagePill = (type: 'carryOn' | 'checked', data: { count: number, weight: string }) => {
    if (!data || data.count === 0) return null;
    
    const Icon = type === 'carryOn' ? ShoppingBag : Briefcase;
    const weightDisplay = data.weight ? data.weight : '';
    
    let finalLabel = '';
    if (weightDisplay) {
      finalLabel = data.count > 1 ? `${weightDisplay} × ${data.count}` : weightDisplay;
    } else {
      finalLabel = `${data.count} ${t('count')}`;
    }
    
    if (!finalLabel) return null;

    return (
      <div className="flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-white/[0.08] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.1] text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
        <Icon size={10} /> {finalLabel}
      </div>
    );
  };

  return (
    <div className="w-full ios27-card rounded-[36px] overflow-hidden flex flex-col lg:flex-row transition-all duration-300 relative group">
      {/* Main Boarding Pass Section */}
      <div className="flex-1 p-6 sm:p-8 relative">
        {/* Top Airline Bar */}
        <div className="flex justify-between items-start mb-6 sm:mb-8 border-b border-black/[0.04] dark:border-white/[0.06] pb-5">
           <div className="flex items-center gap-3.5">
             <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.12] rounded-2xl flex items-center justify-center p-2 shadow-sm overflow-hidden shrink-0">
                <img 
                  src={logoUrl || ''} 
                  alt={segment.airline} 
                  className="w-full h-full object-contain" 
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x64?text=' + (segment.airlineID || 'AIR'); }} 
                />
             </div>
             <div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                 {t('airline')}
               </div>
               <div className="font-black text-lg sm:text-xl text-slate-900 dark:text-white leading-tight">
                 {airlineName}
               </div>
             </div>
           </div>
           
           <div className="flex flex-col items-end gap-1.5">
             <div className="text-right">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                 {t('cabin')}
               </div>
               <div className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">
                 {cabinClass}
               </div>
             </div>
             {segment.baggage && (
               <div className="flex flex-wrap justify-end gap-1.5">
                  {renderBaggagePill('carryOn', segment.baggage.carryOn)}
                  {renderBaggagePill('checked', segment.baggage.checked)}
               </div>
             )}
           </div>
        </div>

        {/* Airport Codes & Flight Path */}
        <div className="flex justify-between items-center mb-8 sm:mb-10 px-1 sm:px-2">
           <div className="text-left">
              <div className="text-3xl sm:text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
                {segment.departureAirport}
              </div>
              <div className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200 mt-1">
                {DateTimeUtils.formatTime24(segment.departureTime)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                {DateTimeUtils.formatDateFriendly(segment.departureTime, language)}
              </div>
           </div>

           <div className="flex-1 px-4 sm:px-8 flex flex-col items-center">
              <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-white/[0.12] relative h-0">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-[#121318] border border-slate-200 dark:border-white/[0.14] flex items-center justify-center text-primary shadow-sm">
                   <Plane size={15} className="rotate-90" />
                 </div>
              </div>
              <div className="text-[10px] font-mono font-black text-slate-400 dark:text-slate-500 mt-4 tracking-widest uppercase">
                {segment.flightNumber}
              </div>
           </div>

           <div className="text-right">
              <div className="text-3xl sm:text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
                {segment.arrivalAirport}
              </div>
              <div className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200 mt-1">
                {DateTimeUtils.formatTime24(segment.arrivalTime)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                {DateTimeUtils.formatDateFriendly(segment.arrivalTime, language)}
              </div>
           </div>
        </div>

        {/* Bottom Passenger & Terminal Bar */}
        <div className="flex justify-between items-end bg-slate-50/70 dark:bg-white/[0.03] -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6 sm:p-7 border-t border-black/[0.04] dark:border-white/[0.06]">
           <div>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
               {t('traveler')}
             </div>
             <div className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
               {passengerName}
             </div>
           </div>

           <div>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
               {t('terminal')}
             </div>
             <div className="font-black text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-1">
               <MapPin size={15} className="text-primary" />
               <span>{segment.terminal ? `T${segment.terminal}` : 'TBA'}</span>
             </div>
           </div>

           <div className="bg-white dark:bg-white/[0.08] p-2.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.12] shadow-sm">
             <QrCode className="text-slate-900 dark:text-white" size={28} />
           </div>
        </div>
      </div>

      {/* Ticket Tear Perforation Holes (Apple Wallet PKPass style matching OLED Canvas) */}
      <div className="hidden lg:block relative w-0">
        <div className="absolute top-0 -left-3 w-6 h-6 rounded-full bg-[#FBFBFD] dark:bg-[#060709] z-10 border-b border-black/[0.06] dark:border-white/[0.08]" />
        <div className="absolute bottom-0 -left-3 w-6 h-6 rounded-full bg-[#FBFBFD] dark:bg-[#060709] z-10 border-t border-black/[0.06] dark:border-white/[0.08]" />
      </div>

      {/* Right Ticket Stub (PKPass Stub) */}
      <div className="hidden lg:flex w-64 border-l border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.02] p-8 flex-col justify-between relative">
         <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-slate-400 dark:text-slate-500 tracking-wider truncate">
                {airlineName}
              </span>
              <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                PASS
              </span>
            </div>

            <div className="space-y-4">
               <div>
                 <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                   {t('flight')}
                 </div>
                 <div className="font-mono font-black text-base text-slate-900 dark:text-white">
                   {segment.flightNumber}
                 </div>
               </div>

               <div className="flex justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                      {t('dep')}
                    </div>
                    <div className="font-mono font-black text-base text-slate-900 dark:text-white">
                      {segment.departureAirport}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                      {t('arr')}
                    </div>
                    <div className="font-mono font-black text-base text-slate-900 dark:text-white">
                      {segment.arrivalAirport}
                    </div>
                  </div>
               </div>

               <div>
                 <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                   {t('terminal')}
                 </div>
                 <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                   {segment.terminal ? `Terminal ${segment.terminal}` : 'TBA'}
                 </div>
               </div>
            </div>
         </div>

         <div className="text-center pt-6 border-t border-slate-200 dark:border-white/[0.08]">
            <div className="font-mono text-2xl font-black tracking-widest text-primary">
              {DateTimeUtils.formatTime24(segment.departureTime).replace(':','')}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
              {t('boardingTime')}
            </div>
         </div>
      </div>
    </div>
  );
};