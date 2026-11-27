import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Briefcase, CheckCircle2, Luggage, Plane } from 'lucide-react';
import { BaggageInfo, FlightInfo, FlightSegment } from '../../types';
import { DateTimeUtils } from '../../shared/services/dateTimeUtils';
import { useTranslation } from '../../shared/contexts/LocalizationContext';

export const STAGGER_MS = 850;
export const PRINT_DURATION_MS = 650;
export const DWELL_AFTER_LAST_MS = 2200;

export interface IssuePassItem {
  key: string;
  direction: 'outbound' | 'inbound';
  legIndex: number;
  legCount: number;
  segment: FlightSegment;
}

export const buildIssuePasses = (flight: FlightInfo): IssuePassItem[] => {
  const outboundSegs = flight.outbound.segments?.length
    ? flight.outbound.segments
    : [flight.outbound];
  const inboundSegs = flight.inbound
    ? flight.inbound.segments?.length
      ? flight.inbound.segments
      : [flight.inbound]
    : [];

  const toItems = (segs: FlightSegment[], direction: 'outbound' | 'inbound'): IssuePassItem[] =>
    segs.map((segment, idx) => ({
      key: `${direction}-${idx}-${segment.flightNumber}-${segment.departureTime}`,
      direction,
      legIndex: idx + 1,
      legCount: segs.length,
      segment,
    }));

  return [...toItems(outboundSegs, 'outbound'), ...toItems(inboundSegs, 'inbound')];
};

export const getTotalIssueDurationMs = (passCount: number, reducedMotion = false): number => {
  if (reducedMotion) return DWELL_AFTER_LAST_MS;
  const count = Math.max(1, passCount);
  return (count - 1) * STAGGER_MS + PRINT_DURATION_MS + DWELL_AFTER_LAST_MS;
};

interface Props {
  flight: FlightInfo;
  onContinue: () => void;
  /** Optional override for total auto-advance delay in ms. Defaults to sequential print time + 2200ms dwell. */
  durationMs?: number;
  /** Replay mode (e.g. from the Flights tab): the CTA reads "Close preview" instead of "View itinerary". */
  previewMode?: boolean;
}

interface BaggagePillProps {
  testId: string;
  icon: React.ReactNode;
  label: string;
  allowance?: { count: number; weight: string };
}

/** Apple Wallet-style baggage pill: icon + "count×weight" (muted "0" when nothing is included). */
const BaggagePill: React.FC<BaggagePillProps> = ({ testId, icon, label, allowance }) => {
  const included = !!allowance && allowance.count > 0;
  const text = included ? `${allowance!.count}×${allowance!.weight || ''}`.trim() : '0';
  return (
    <span
      data-testid={testId}
      title={`${label} ${text}`}
      aria-label={`${label} ${text}`}
      className={`inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border text-[11px] font-black leading-none tabular-nums whitespace-nowrap ${
        included
          ? 'bg-slate-900/[0.06] border-slate-900/10 text-slate-800 dark:bg-white/[0.12] dark:border-white/20 dark:text-white'
          : 'bg-transparent border-slate-300/70 text-slate-400 dark:border-white/15 dark:text-slate-500'
      }`}
    >
      <span className="shrink-0 inline-flex" aria-hidden="true">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
};

const BaggageBadges: React.FC<{ baggage?: BaggageInfo; carryOnLabel: string; checkedLabel: string }> = ({
  baggage,
  carryOnLabel,
  checkedLabel,
}) => (
  <div data-testid="boarding-pass-baggage" className="flex flex-wrap items-center gap-1.5 min-w-0">
    <BaggagePill
      testId="bp-baggage-carryon"
      icon={<Briefcase size={11} />}
      label={carryOnLabel}
      allowance={baggage?.carryOn}
    />
    <BaggagePill
      testId="bp-baggage-checked"
      icon={<Luggage size={11} />}
      label={checkedLabel}
      allowance={baggage?.checked}
    />
  </div>
);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEYFRAMES = `
@keyframes bp-slide-x {
  0% { opacity: 0; transform: translateX(-104%); }
  12% { opacity: 1; }
  72% { opacity: 1; transform: translateX(1.5%); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes bp-slide-y {
  0% { opacity: 0; transform: translateY(-104%); }
  12% { opacity: 1; }
  65% { opacity: 1; transform: translateY(3%); }
  84% { opacity: 1; transform: translateY(-1%); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes bp-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}
@keyframes bp-progress {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
.bp-pass-x {
  animation-name: bp-slide-x;
  animation-duration: var(--bp-print-duration, 650ms);
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  animation-fill-mode: both;
}
.bp-pass-y {
  animation-name: bp-slide-y;
  animation-duration: var(--bp-print-duration, 650ms);
  animation-timing-function: cubic-bezier(0.34, 1.15, 0.64, 1);
  animation-fill-mode: both;
}
.bp-shimmer {
  animation-name: bp-shimmer;
  animation-duration: 1100ms;
  animation-timing-function: ease-in-out;
  animation-iteration-count: 1;
  animation-fill-mode: both;
}
.bp-progress {
  transform-origin: left;
  animation: bp-progress var(--bp-duration, 2850ms) linear both;
}
@media (prefers-reduced-motion: reduce) {
  .bp-pass-x, .bp-pass-y, .bp-shimmer, .bp-progress {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`;

const PerforatedLine: React.FC<{ vertical?: boolean }> = ({ vertical }) => (
  <div
    aria-hidden="true"
    data-testid="boarding-pass-tear-line"
    className={`relative shrink-0 ${vertical ? 'w-0 self-stretch border-l-2' : 'h-0 w-full border-t-2'} border-dashed border-slate-300 dark:border-white/20`}
  >
    <span className={`absolute w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-[#0b0c10] ${vertical ? '-top-2 -left-2' : '-left-2 -top-2'}`} />
    <span className={`absolute w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-[#0b0c10] ${vertical ? '-bottom-2 -left-2' : '-right-2 -top-2'}`} />
  </div>
);

export const BoardingPassIssueModal: React.FC<Props> = ({ flight, onContinue, durationMs, previewMode = false }) => {
  const { t, language } = useTranslation();
  const doneRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const reduced = prefersReducedMotion();

  const passes = useMemo(() => buildIssuePasses(flight), [flight]);
  const totalPasses = passes.length;
  const effectiveDurationMs = durationMs ?? getTotalIssueDurationMs(totalPasses, reduced);

  const [currentIssuing, setCurrentIssuing] = useState<number>(reduced ? totalPasses : 1);
  const [allPrinted, setAllPrinted] = useState<boolean>(reduced);

  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopPassRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mobilePassRefs = useRef<Array<HTMLDivElement | null>>([]);
  const prevIssuingRef = useRef<number>(reduced ? totalPasses : 1);
  const userInteractedRef = useRef<boolean>(false);

  desktopPassRefs.current.length = passes.length;
  mobilePassRefs.current.length = passes.length;

  const markUserInteracted = useCallback(() => {
    userInteractedRef.current = true;
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onContinueRef.current();
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    userInteractedRef.current = false;

    if (reduced) {
      prevIssuingRef.current = totalPasses;
      setCurrentIssuing(totalPasses);
      setAllPrinted(true);
    } else {
      prevIssuingRef.current = 1;
      setCurrentIssuing(1);
      setAllPrinted(false);

      for (let i = 1; i < totalPasses; i++) {
        timers.push(
          window.setTimeout(() => {
            setCurrentIssuing(i + 1);
          }, i * STAGGER_MS)
        );
      }

      const lastPrintDoneAt = (totalPasses - 1) * STAGGER_MS + PRINT_DURATION_MS;
      timers.push(
        window.setTimeout(() => {
          setAllPrinted(true);
        }, lastPrintDoneAt)
      );
    }

    timers.push(window.setTimeout(finish, effectiveDurationMs));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('keydown', onKey);
    };
  }, [effectiveDurationMs, finish, reduced, totalPasses]);

  useEffect(() => {
    const prev = prevIssuingRef.current;
    prevIssuingRef.current = currentIssuing;

    if (currentIssuing <= prev || currentIssuing <= 1 || userInteractedRef.current) {
      return;
    }

    const targetIdx = Math.min(currentIssuing - 1, totalPasses - 1);
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';

    const scrollTarget = (passEl: HTMLDivElement | null, containerEl: HTMLDivElement | null) => {
      if (passEl && typeof passEl.scrollIntoView === 'function') {
        passEl.scrollIntoView({ behavior, block: 'end', inline: 'nearest' });
        return;
      }
      if (containerEl && typeof containerEl.scrollTo === 'function') {
        containerEl.scrollTo({ top: containerEl.scrollHeight, behavior });
      }
    };

    scrollTarget(desktopPassRefs.current[targetIdx], desktopScrollRef.current);
    scrollTarget(mobilePassRefs.current[targetIdx], mobileScrollRef.current);
  }, [currentIssuing, reduced, totalPasses]);

  const isMulti = totalPasses >= 2;
  const isDense = totalPasses >= 3;

  const statusText = allPrinted
    ? t('bpAllIssued')
    : t('bpIssuingProgress')
        .replace('{current}', String(currentIssuing))
        .replace('{total}', String(totalPasses));

  const renderPassFace = (item: IssuePassItem, idx: number, orientation: 'x' | 'y') => {
    const horizontal = orientation === 'x';
    const seg = item.segment;
    const airlineName =
      (language === 'zh' ? seg.airlineNameZh : seg.airlineNameEn) ||
      seg.airline ||
      seg.airlineID ||
      '';
    const date = seg.departureTime.split('T')[0];
    const dep = DateTimeUtils.formatTime24(seg.departureTime);
    const arr = DateTimeUtils.formatTime24(seg.arrivalTime);
    const baggage = flight.baggage || seg.baggage;

    const isOutbound = item.direction === 'outbound';
    const dirLabel = isOutbound ? t('outbound') : t('inbound');
    const badgeLabel =
      item.legCount > 1 ? `${dirLabel} · ${t('segmentLeg')} ${item.legIndex}` : dirLabel;

    const delayMs = reduced ? 0 : idx * STAGGER_MS;
    const shimmerDelayMs = reduced ? 0 : delayMs + Math.round(PRINT_DURATION_MS * 0.75);

    const animClass = reduced ? '' : horizontal ? 'bp-pass-x' : 'bp-pass-y';
    const bodyPadding = isDense
      ? horizontal
        ? 'px-4 py-3 space-y-2'
        : 'px-4 py-3 space-y-2.5'
      : isMulti
        ? horizontal
          ? 'px-5 py-3.5 space-y-2.5'
          : 'px-4 py-3.5 space-y-3'
        : horizontal
          ? 'p-6 space-y-5'
          : 'p-5 space-y-4';
    const airportTextSize = isDense ? 'text-xl' : isMulti ? 'text-2xl' : 'text-3xl';
    const stubPadding = isDense
      ? horizontal
        ? 'w-40 shrink-0 px-4 py-3'
        : 'px-4 py-2.5'
      : isMulti
        ? horizontal
          ? 'w-44 shrink-0 px-4 py-3.5'
          : 'px-4 py-3'
        : horizontal
          ? 'w-44 shrink-0 p-6'
          : 'p-5';

    const passRefs = horizontal ? desktopPassRefs : mobilePassRefs;

    return (
      <div
        key={`${orientation}-${item.key}`}
        ref={(el) => {
          passRefs.current[idx] = el;
        }}
        data-pass-index={idx}
        className={`shrink-0 scroll-mb-3 ${horizontal ? 'w-[560px] max-w-full' : 'w-full max-w-[320px]'}`}
      >
        <div
          data-testid={`boarding-pass-${horizontal ? 'desktop' : 'mobile'}`}
          data-direction={item.direction}
          style={reduced ? undefined : { animationDelay: `${delayMs}ms` }}
          className={`relative overflow-hidden bg-white dark:bg-[#171922] border border-black/[0.08] dark:border-white/[0.14] ${isMulti ? 'rounded-2xl shadow-xl' : 'rounded-[28px] shadow-2xl'} ${animClass} ${horizontal ? 'flex flex-row w-full' : 'flex flex-col w-full'}`}
        >
        <div className={`flex-1 min-w-0 ${bodyPadding}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                  isOutbound
                    ? 'bg-primary/12 text-primary dark:bg-primary/20'
                    : 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                }`}
              >
                {badgeLabel}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 truncate">
                {airlineName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                {seg.flightNumber}
              </span>
              <Plane
                size={isDense ? 16 : 18}
                className={isOutbound ? 'text-primary shrink-0' : 'text-emerald-500 shrink-0'}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className={`${airportTextSize} font-black tracking-tight text-slate-900 dark:text-white tabular-nums`}>
              {seg.departureAirport}
            </div>
            <ArrowRight size={isDense ? 16 : 18} className="text-slate-300 dark:text-white/30 shrink-0" />
            <div className={`${airportTextSize} font-black tracking-tight text-slate-900 dark:text-white tabular-nums`}>
              {seg.arrivalAirport}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-300 tabular-nums">
            <span>{date}</span>
            <span>
              {dep} → {arr}
            </span>
          </div>
        </div>
        <PerforatedLine vertical={horizontal} />
        <div
          className={`${stubPadding} flex ${horizontal ? 'flex-col justify-center gap-1.5' : isMulti ? 'flex-row items-center justify-between gap-2' : 'flex-col justify-center gap-1.5'} bg-slate-50/70 dark:bg-white/[0.03]`}
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
            {flight.cabinClass}
          </div>
          <BaggageBadges
            baggage={baggage}
            carryOnLabel={t('carryOn')}
            checkedLabel={t('checked')}
          />
        </div>
        {!reduced && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              style={{ animationDelay: `${shimmerDelayMs}ms` }}
              className="bp-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent -skew-x-12"
            />
          </div>
        )}
        </div>
      </div>
    );
  };

  const metalSlot = (horizontal: boolean) => (
    <div
      aria-hidden="true"
      className={`shrink-0 border shadow-inner rounded-full relative z-10 ${
        horizontal
          ? 'bg-gradient-to-b w-3 self-stretch min-h-[140px] -mr-1'
          : 'bg-gradient-to-r h-3 w-[320px] max-w-full -mb-1'
      } from-slate-200 via-white to-slate-200 border-slate-300/80 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 dark:border-white/20`}
    >
      <div
        className={`absolute bg-black/70 rounded-full ${
          horizontal ? 'inset-y-3 right-0 w-1' : 'inset-x-3 bottom-0 h-1'
        }`}
      />
    </div>
  );

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('bpIssued')}
      data-testid="boarding-pass-issue-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F5F5F7]/90 dark:bg-[#060709]/85 backdrop-blur-2xl p-4 animate-in fade-in duration-300"
      style={{
        ['--bp-duration' as any]: `${effectiveDurationMs}ms`,
        ['--bp-print-duration' as any]: `${PRINT_DURATION_MS}ms`,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div className="w-full max-w-[660px] max-h-[92vh] flex flex-col items-center gap-4 sm:gap-5">
        <div className="text-center space-y-2 shrink-0">
          <div
            data-testid="boarding-pass-status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black tracking-wide border transition-colors duration-300 ${
              allPrinted
                ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25'
                : 'bg-sky-500/12 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-400/25'
            }`}
          >
            {allPrinted ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden="true" />
            )}
            <span>{statusText}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {allPrinted ? t('bpIssued') : t('bpIssuing')}
          </h2>
        </div>

        {/* Desktop: horizontal passes slide out sequentially from a side printer slot */}
        <div
          ref={desktopScrollRef}
          data-testid="boarding-pass-scroll-desktop"
          onWheel={markUserInteracted}
          onTouchStart={markUserInteracted}
          onPointerDown={markUserInteracted}
          className="hidden sm:flex items-start justify-center w-full min-h-0 max-h-[58vh] overflow-y-auto no-scrollbar px-2 py-2"
        >
          <div className="flex items-stretch justify-center w-full max-w-[600px]">
            {metalSlot(true)}
            <div className="flex-1 min-w-0 overflow-x-hidden py-1 pl-1 pr-3 flex flex-col gap-3">
              {passes.map((item, idx) => renderPassFace(item, idx, 'x'))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical passes slide down sequentially from a top dispenser slot */}
        <div className="flex sm:hidden flex-col items-center w-full min-h-0 max-h-[56vh]">
          {metalSlot(false)}
          <div
            ref={mobileScrollRef}
            data-testid="boarding-pass-scroll-mobile"
            onWheel={markUserInteracted}
            onTouchStart={markUserInteracted}
            onPointerDown={markUserInteracted}
            className="w-full overflow-y-auto overflow-x-hidden no-scrollbar px-3 pt-1 pb-3 flex flex-col items-center gap-2.5"
          >
            {passes.map((item, idx) => renderPassFace(item, idx, 'y'))}
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3 shrink-0">
          <div className="h-1 rounded-full bg-slate-200 dark:bg-white/15 overflow-hidden" aria-hidden="true">
            <div className="bp-progress h-full w-full rounded-full bg-primary" />
          </div>
          <button
            type="button"
            data-testid="boarding-pass-continue"
            onClick={finish}
            className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            autoFocus
          >
            {previewMode ? t('bpClosePreview') : t('bpViewItinerary')}
          </button>
        </div>
      </div>
    </div>
  );

  // Portal to <body> so ancestor transforms (tab swipe wrapper) can't trap `fixed` and the dock can't overlap.
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
