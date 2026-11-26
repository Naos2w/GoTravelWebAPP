import React, { useState, useEffect } from 'react';
import { FlightSegment } from '../types';
import { Plane, QrCode, Briefcase, ShoppingBag, MapPin } from 'lucide-react';
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
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

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
      <div className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-white/[0.08] px-2.5 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.1] text-slate-600 dark:text-slate-300 font-semibold font-mono tabular-nums whitespace-nowrap">
        <Icon size={10} /> {finalLabel}
      </div>
    );
  };

  return (
    <div className="w-full ios27-card rounded-[28px] overflow-hidden flex flex-col lg:flex-row transition-all duration-300 relative group">
      {/* Main Boarding Pass Section */}
      <div className="flex-1 p-6 sm:p-8 relative">
        {/* Top Airline Bar */}
        <div className="flex justify-between items-start mb-6 sm:mb-8 border-b border-black/[0.05] dark:border-white/[0.07] pb-5">
           <div className="flex items-center gap-3.5">
             <div
               data-testid="airline-logo-container"
               className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm overflow-hidden shrink-0 ${
                 !logoUrl || logoError
                   ? 'p-2 bg-slate-100 dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.12]'
                   : 'p-1.5 bg-white dark:bg-white/95 border border-black/10 dark:border-white/20'
               }`}
             >
                {!logoUrl || logoError ? (
                  <div className="flex flex-col items-center justify-center gap-0.5 text-primary">
                    <Plane size={15} className="opacity-80" />
                    <span className="font-mono font-bold text-[10px] leading-none tracking-tight">
                      {segment.airlineID || 'AIR'}
                    </span>
                  </div>
                ) : (
                  <img 
                    src={logoUrl} 
                    alt={segment.airline} 
                    className="w-full h-full object-contain" 
                    onError={() => setLogoError(true)} 
                  />
                )}
             </div>
             <div>
               <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-0.5">
                 {t('airline')}
               </div>
               <div className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white leading-tight tracking-tight">
                 {airlineName}
               </div>
             </div>
           </div>
           
           <div className="flex flex-col items-end gap-1.5">
             <div className="text-right">
               <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-0.5">
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
              <div className="text-3xl sm:text-5xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {segment.departureAirport}
              </div>
              <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-primary dark:text-sky-400 mt-1">
                {DateTimeUtils.formatTime24(segment.departureTime)}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                {DateTimeUtils.formatDateFriendly(segment.departureTime, language)}
              </div>
           </div>

           <div className="flex-1 px-4 sm:px-8 flex flex-col items-center">
              <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-white/[0.14] relative h-0">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/[0.14] flex items-center justify-center text-primary shadow-sm">
                   <Plane size={15} className="rotate-90" />
                 </div>
              </div>
              <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-4 tracking-widest uppercase tabular-nums">
                {segment.flightNumber}
              </div>
           </div>

           <div className="text-right">
              <div className="text-3xl sm:text-5xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {segment.arrivalAirport}
              </div>
              <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-primary dark:text-sky-400 mt-1">
                {DateTimeUtils.formatTime24(segment.arrivalTime)}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                {DateTimeUtils.formatDateFriendly(segment.arrivalTime, language)}
              </div>
           </div>
        </div>

        {/* Bottom Passenger, Terminal & Gate Bar */}
        <div className="flex justify-between items-end gap-4 bg-slate-50/70 dark:bg-white/[0.03] -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6 sm:p-7 border-t border-black/[0.04] dark:border-white/[0.06]">
           <div className="min-w-0">
             <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-0.5">
               {t('traveler')}
             </div>
             <div className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
               {passengerName}
             </div>
           </div>

           <div className="flex items-center gap-5 sm:gap-7 shrink-0">
             <div>
               <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-0.5">
                 {t('terminal')}
               </div>
               <div className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1 tabular-nums">
                 <MapPin size={14} className="text-primary shrink-0" />
                 <span>{segment.terminal ? `T${segment.terminal}` : 'TBA'}</span>
               </div>
             </div>

             <div>
               <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-0.5">
                 {t('gateLabel')}
               </div>
               <div className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white tabular-nums">
                 {segment.gate || 'TBA'}
               </div>
             </div>
           </div>

           <div className="bg-white dark:bg-white/[0.08] p-2.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.12] shadow-sm shrink-0">
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-slate-500 dark:text-slate-400 tracking-wide truncate">
                {airlineName}
              </span>
              <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 shrink-0">
                PASS
              </span>
            </div>

            <div className="space-y-4">
               <div>
                 <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-[0.14em] mb-0.5">
                   {t('flight')}
                 </div>
                 <div className="font-mono font-extrabold text-base text-slate-900 dark:text-white tabular-nums">
                   {segment.flightNumber}
                 </div>
               </div>

               <div className="flex justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-[0.14em] mb-0.5">
                      {t('dep')}
                    </div>
                    <div className="font-mono font-extrabold text-base text-slate-900 dark:text-white tabular-nums">
                      {segment.departureAirport}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-[0.14em] mb-0.5">
                      {t('arr')}
                    </div>
                    <div className="font-mono font-extrabold text-base text-slate-900 dark:text-white tabular-nums">
                      {segment.arrivalAirport}
                    </div>
                  </div>
               </div>

               <div className="flex justify-between">
                 <div>
                   <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-[0.14em] mb-0.5">
                     {t('terminal')}
                   </div>
                   <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 tabular-nums">
                     {segment.terminal ? `T${segment.terminal}` : 'TBA'}
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-[0.14em] mb-0.5">
                     {t('gateLabel')}
                   </div>
                   <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 tabular-nums">
                     {segment.gate || 'TBA'}
                   </div>
                 </div>
               </div>
            </div>
         </div>

         <div className="text-center pt-6 border-t border-slate-200 dark:border-white/[0.08]">
            <div className="font-mono text-2xl font-extrabold tracking-widest text-primary dark:text-sky-400 tabular-nums">
              {DateTimeUtils.formatTime24(segment.departureTime).replace(':','')}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase mt-1 tracking-[0.14em]">
              {t('boardingTime')}
            </div>
         </div>
      </div>
    </div>
  );
};