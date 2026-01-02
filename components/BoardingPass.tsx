import React from 'react';
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

  const airlineName = language === 'zh' 
    ? (segment.airlineNameZh || segment.airline) 
    : (segment.airlineNameEn || segment.airline);

  const renderBaggagePill = (type: 'carryOn' | 'checked', data: { count: number, weight: string }) => {
    if (!data || data.count === 0) return null;
    
    const Icon = type === 'carryOn' ? ShoppingBag : Briefcase;
    const weightDisplay = data.weight ? data.weight : '';
    
    // 如果有重量，顯示 "重量 × 件數" (件數 > 1 時才顯示乘號)
    // 如果沒有重量，顯示 "件數 PC"
    let finalLabel = '';
    if (weightDisplay) {
      finalLabel = data.count > 1 ? `${weightDisplay} × ${data.count}` : weightDisplay;
    } else {
      finalLabel = `${data.count} ${t('count')}`;
    }
    
    if (!finalLabel) return null;

    return (
      <div className="flex items-center gap-1 text-[9px] bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-black whitespace-nowrap">
        <Icon size={10} /> {finalLabel}
      </div>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-[32px] shadow-ios border border-slate-100/50 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row transition-all duration-500">
      <div className="flex-1 p-6 md:p-8 relative">
        <div className="flex justify-between items-start mb-6 md:mb-8 border-b border-slate-50 dark:border-slate-700 pb-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 md:w-14 md:h-14 bg-white dark:bg-slate-700 border border-slate-50 dark:border-slate-600 rounded-2xl flex items-center justify-center p-2 shadow-sm overflow-hidden">
                <img src={logoUrl || ''} alt={segment.airline} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x64?text=' + (segment.airlineID || 'AIR'); }} />
             </div>
             <div>
               <div className="text-[9px] md:text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-0.5">{t('airline')}</div>
               <div className="font-black text-lg md:text-xl text-slate-900 dark:text-white leading-tight">{airlineName}</div>
             </div>
           </div>
           <div className="flex flex-col items-end gap-2">
             <div className="text-right">
               <div className="text-[9px] md:text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-0.5">{t('cabin')}</div>
               <div className="font-black text-sm md:text-base text-slate-800 dark:text-slate-200">{cabinClass}</div>
             </div>
             {segment.baggage && (
               <div className="flex flex-wrap justify-end gap-1.5">
                  {renderBaggagePill('carryOn', segment.baggage.carryOn)}
                  {renderBaggagePill('checked', segment.baggage.checked)}
               </div>
             )}
           </div>
        </div>
        <div className="flex justify-between items-center mb-8 md:mb-10 px-2">
           <div className="text-left">
              <div className="text-3xl md:text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tighter">{segment.departureAirport}</div>
              <div className="text-sm md:text-base font-black text-slate-600 dark:text-slate-300 mt-2">{DateTimeUtils.formatTime24(segment.departureTime)}</div>
              <div className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{DateTimeUtils.formatDateFriendly(segment.departureTime, language)}</div>
           </div>
           <div className="flex-1 px-4 md:px-8 flex flex-col items-center">
              <div className="w-full border-t-2 border-dashed border-slate-100 dark:border-slate-700 relative h-0">
                 <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-primary bg-white dark:bg-slate-800 p-2 rounded-full" size={24} />
              </div>
              <div className="text-[9px] font-mono font-black text-slate-300 dark:text-slate-600 mt-4 tracking-[0.3em]">{segment.flightNumber}</div>
           </div>
           <div className="text-right">
              <div className="text-3xl md:text-5xl font-mono font-black text-slate-900 dark:text-white tracking-tighter">{segment.arrivalAirport}</div>
              <div className="text-sm md:text-base font-black text-slate-600 dark:text-slate-300 mt-2">{DateTimeUtils.formatTime24(segment.arrivalTime)}</div>
              <div className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{DateTimeUtils.formatDateFriendly(segment.arrivalTime, language)}</div>
           </div>
        </div>
        <div className="flex justify-between items-end bg-slate-50/50 dark:bg-slate-900/50 -mx-6 md:-mx-8 -mb-6 md:-mb-8 p-6 md:p-8 mt-6">
           <div><div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('traveler')}</div><div className="font-black text-base md:text-lg text-slate-900 dark:text-white">{passengerName}</div></div>
           <div><div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('terminal')}</div><div className="font-black text-base md:text-lg text-slate-900 dark:text-white flex items-center gap-1"><MapPin size={16} className="text-primary" />{segment.terminal ? `T${segment.terminal}` : 'TBA'}</div></div>
           <div className="bg-white dark:bg-slate-700 p-2 md:p-3 rounded-2xl border border-slate-50 dark:border-slate-600 shadow-sm"><QrCode className="text-slate-900 dark:text-white" size={32} /></div>
        </div>
      </div>
      <div className="hidden lg:flex w-64 border-l border-dashed border-slate-100 dark:border-slate-700 bg-slate-50/20 dark:bg-slate-900/30 p-8 flex-col justify-between relative transition-colors">
         <div className="space-y-8">
            <div className="flex items-center gap-2"><span className="font-black text-xs text-slate-400 dark:text-slate-500 tracking-widest truncate">{airlineName}</span></div>
            <div className="space-y-5">
               <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('flight')}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.flightNumber}</div></div>
               <div className="flex justify-between">
                  <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('dep')}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.departureAirport}</div></div>
                  <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('arr')}</div><div className="font-mono font-black text-base text-slate-900 dark:text-white">{segment.arrivalAirport}</div></div>
               </div>
               <div><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('terminal')}</div><div className="font-black text-sm text-slate-900 dark:text-white">{segment.terminal ? `Terminal ${segment.terminal}` : 'TBA'}</div></div>
            </div>
         </div>
         <div className="text-center pt-6 border-t border-slate-100 dark:border-slate-800"><div className="font-mono text-2xl font-black tracking-[0.2em] text-primary">{DateTimeUtils.formatTime24(segment.departureTime).replace(':','')}</div><div className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-[0.2em]">{t('boardingTime')}</div></div>
      </div>
    </div>
  );
};