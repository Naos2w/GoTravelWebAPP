import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowRight, Plane } from 'lucide-react';
import { FlightInfo } from '../types';
import { DateTimeUtils } from '../services/dateTimeUtils';
import { formatBaggageSummary } from '../services/airlineBaggageService';
import { useTranslation } from '../contexts/LocalizationContext';

interface Props {
  flight: FlightInfo;
  onContinue: () => void;
  /** Auto-advance delay in ms (default ~2s). */
  durationMs?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEYFRAMES = `
@keyframes bp-slide-x { 0% { transform: translateX(-104%); } 70% { transform: translateX(2%); } 100% { transform: translateX(0); } }
@keyframes bp-slide-y { 0% { transform: translateY(-104%); } 60% { transform: translateY(4%); } 80% { transform: translateY(-1.5%); } 100% { transform: translateY(0); } }
@keyframes bp-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
@keyframes bp-progress { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
.bp-pass-x { animation: bp-slide-x 900ms cubic-bezier(0.22, 1, 0.36, 1) 150ms both; }
.bp-pass-y { animation: bp-slide-y 1000ms cubic-bezier(0.34, 1.2, 0.64, 1) 150ms both; }
.bp-shimmer { animation: bp-shimmer 1400ms ease-in-out 700ms 1 both; }
.bp-progress { transform-origin: left; animation: bp-progress var(--bp-duration, 2000ms) linear both; }
@media (prefers-reduced-motion: reduce) {
  .bp-pass-x, .bp-pass-y, .bp-shimmer, .bp-progress { animation: none !important; }
}
`;

const PerforatedLine: React.FC<{ vertical?: boolean }> = ({ vertical }) => (
  <div
    aria-hidden="true"
    data-testid="boarding-pass-tear-line"
    className={`relative shrink-0 ${vertical ? 'w-0 self-stretch border-l-2' : 'h-0 w-full border-t-2'} border-dashed border-slate-300 dark:border-white/20`}
  >
    <span className={`absolute w-4 h-4 rounded-full bg-slate-200 dark:bg-[#0b0c10] ${vertical ? '-top-2 -left-2.5' : '-left-2 -top-2.5'}`} />
    <span className={`absolute w-4 h-4 rounded-full bg-slate-200 dark:bg-[#0b0c10] ${vertical ? '-bottom-2 -left-2.5' : '-right-2 -top-2.5'}`} />
  </div>
);

export const BoardingPassIssueModal: React.FC<Props> = ({ flight, onContinue, durationMs = 2000 }) => {
  const { t, language } = useTranslation();
  const doneRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const reduced = prefersReducedMotion();

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onContinueRef.current();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(finish, reduced ? Math.min(durationMs, 1200) : durationMs);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [durationMs, finish, reduced]);

  const seg = flight.outbound;
  const airlineName = (language === 'zh' ? seg.airlineNameZh : seg.airlineNameEn) || seg.airline || seg.airlineID || '';
  const date = seg.departureTime.split('T')[0];
  const dep = DateTimeUtils.formatTime24(seg.departureTime);
  const arr = DateTimeUtils.formatTime24(seg.arrivalTime);
  const baggage = formatBaggageSummary(flight.baggage || seg.baggage, {
    carryOn: t('carryOn'),
    checked: t('checked'),
    none: t('bpNoBaggage'),
  });

  const passFace = (orientation: 'x' | 'y') => {
    const horizontal = orientation === 'x';
    return (
      <div
        data-testid={`boarding-pass-${horizontal ? 'desktop' : 'mobile'}`}
        className={`relative overflow-hidden bg-white dark:bg-[#171922] border border-black/[0.08] dark:border-white/[0.14] rounded-[28px] shadow-2xl ${horizontal ? 'bp-pass-x flex flex-row w-[560px] max-w-full' : 'bp-pass-y flex flex-col w-full max-w-[300px]'}`}
      >
        <div className={`flex-1 min-w-0 p-6 space-y-5 ${horizontal ? '' : 'pb-5'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{airlineName}</div>
              <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums truncate">{seg.flightNumber}</div>
            </div>
            <Plane size={22} className="text-primary shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">{seg.departureAirport}</div>
            <ArrowRight size={20} className="text-slate-300 dark:text-white/30 shrink-0" />
            <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">{seg.arrivalAirport}</div>
          </div>
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-300 tabular-nums">
            <span>{date}</span>
            <span>{dep} → {arr}</span>
          </div>
        </div>
        <PerforatedLine vertical={horizontal} />
        <div className={`${horizontal ? 'w-44 shrink-0' : ''} p-6 flex flex-col justify-center gap-2 bg-slate-50/70 dark:bg-white/[0.03]`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{flight.cabinClass}</div>
          <div data-testid="boarding-pass-baggage" className="text-xs font-black text-slate-700 dark:text-slate-200 leading-relaxed tabular-nums">{baggage}</div>
        </div>
        {!reduced && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="bp-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent -skew-x-12" />
          </div>
        )}
      </div>
    );
  };

  const metalSlot = (horizontal: boolean) => (
    <div
      aria-hidden="true"
      className={`shrink-0 bg-gradient-to-b from-slate-300 via-slate-100 to-slate-400 dark:from-slate-600 dark:via-slate-400 dark:to-slate-700 shadow-lg rounded-full relative z-10 ${horizontal ? 'w-3 h-56 self-center -mr-1' : 'h-3 w-[320px] max-w-full -mb-1'}`}
    >
      <div className={`absolute bg-black/70 rounded-full ${horizontal ? 'inset-y-3 right-0 w-1' : 'inset-x-3 bottom-0 h-1'}`} />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('bpIssued')}
      data-testid="boarding-pass-issue-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-300"
      style={{ ['--bp-duration' as any]: `${durationMs}ms` }}
    >
      <style>{KEYFRAMES}</style>
      <div className="w-full max-w-[640px] flex flex-col items-center gap-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight">{t('bpIssuing')}</h2>
          <p className="text-xs font-bold text-white/60">{t('bpIssued')}</p>
        </div>

        {/* Desktop: horizontal pass slides out of a side printer slot */}
        <div className="hidden sm:flex items-center w-full justify-center">
          {metalSlot(true)}
          <div className="overflow-hidden py-4 pr-4 -my-4">{passFace('x')}</div>
        </div>

        {/* Mobile: vertical pass slides down out of a top dispenser slot */}
        <div className="flex sm:hidden flex-col items-center w-full">
          {metalSlot(false)}
          <div className="overflow-hidden px-4 pb-4 w-full flex justify-center">{passFace('y')}</div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="h-1 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
            <div className="bp-progress h-full w-full rounded-full bg-primary" />
          </div>
          <button
            type="button"
            data-testid="boarding-pass-continue"
            onClick={finish}
            className="w-full bg-white text-slate-900 py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            autoFocus
          >
            {t('bpViewItinerary')}
          </button>
        </div>
      </div>
    </div>
  );
};
