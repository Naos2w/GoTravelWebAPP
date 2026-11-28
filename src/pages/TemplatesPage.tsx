import React, { useState } from "react";
import {
  ArrowRight,
  CheckSquare,
  MapPin,
  Plane,
  TrainFront,
  Utensils,
  Wallet,
} from "lucide-react";
import { Language } from "../types";
import {
  CURATED_TRIP_TEMPLATES,
  TemplateStop,
  TripTemplate,
} from "../shared/data/demoTemplates";
import { PublicPageShell } from "./LegalPages";

export interface TemplatesPageProps {
  language: Language;
  onBack: () => void;
  onNavigate: (path: string) => void;
  onUseTemplate: (templateId: string) => void;
  bottomSlot?: React.ReactNode;
}

const ACCENT_PILL_MAP: Record<TripTemplate["accentTone"], string> = {
  blue: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
  amber: "bg-ns-amber/12 text-ns-amber border-ns-amber/20",
  green: "bg-ns-green/12 text-ns-green border-ns-green/20",
};

const StopTypeIcon: React.FC<{ type: TemplateStop["type"] }> = ({ type }) => {
  if (type === "Food") {
    return (
      <span className="w-7 h-7 rounded-lg bg-ns-amber/12 text-ns-amber border border-ns-amber/20 flex items-center justify-center shrink-0">
        <Utensils size={13} />
      </span>
    );
  }
  if (type === "Transport") {
    return (
      <span className="w-7 h-7 rounded-lg bg-ns-indigo/12 text-ns-indigo border border-ns-indigo/20 flex items-center justify-center shrink-0">
        <TrainFront size={13} />
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-lg bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
      <MapPin size={13} />
    </span>
  );
};

interface TemplatePreviewCardProps {
  template: TripTemplate;
  language: Language;
  onUseTemplate: (templateId: string) => void;
}

const TemplatePreviewCard: React.FC<TemplatePreviewCardProps> = ({
  template,
  language,
  onUseTemplate,
}) => {
  const isEn = language === "en";
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const activeDay =
    template.itinerary[selectedDayIndex] ?? template.itinerary[0];
  const totalStops = template.itinerary.reduce(
    (sum, day) => sum + day.stops.length,
    0
  );

  return (
    <article
      data-testid={`template-card-${template.id}`}
      className="ios27-card rounded-[28px] p-5 sm:p-7 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 h-6 rounded-full border text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 ${ACCENT_PILL_MAP[template.accentTone]}`}
            >
              {isEn
                ? `${template.days}D${template.nights}N`
                : `${template.days} 天 ${template.nights} 夜`}
            </span>
            <span className="text-xs font-semibold text-[#68707D] dark:text-[#8B93A1]">
              {template.region[language]}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1A1D23] dark:text-[#ECEFF4]">
            {template.name[language]}
          </h2>

          <p className="text-sm text-[#68707D] dark:text-[#8B93A1] leading-relaxed max-w-2xl">
            {template.subtitle[language]}
          </p>

          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {template.tags[language].map((tag) => (
              <span
                key={tag}
                className="px-2.5 h-6 inline-flex items-center rounded-full bg-[#F0F2F5] dark:bg-[#1B1F2A] border border-black/[0.05] dark:border-white/[0.08] text-[11px] font-semibold text-[#68707D] dark:text-[#8B93A1] whitespace-nowrap shrink-0"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          data-testid={`use-template-btn-${template.id}`}
          onClick={() => onUseTemplate(template.id)}
          className="h-11 px-5 rounded-2xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{isEn ? "Use This Template" : "一鍵套用此範本"}</span>
          <ArrowRight size={15} className="shrink-0" />
        </button>
      </div>

      {/* Flight Leg & Budget Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Flight Leg Card */}
        <div className="md:col-span-7 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#68707D] dark:text-[#8B93A1]">
              {isEn ? template.flight.airlineNameEn : template.flight.airlineNameZh}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-mono font-extrabold tabular-nums text-[#1A1D23] dark:text-[#ECEFF4]">
                {template.flight.departureAirport}
              </span>
              <span className="text-xs font-mono font-bold tabular-nums text-ns-blue">
                {template.flight.outboundDepTime}
              </span>
            </div>
          </div>

          <div className="flex-1 px-2 flex flex-col items-center min-w-[84px]">
            <div className="w-full border-t border-dashed border-black/20 dark:border-white/20 relative">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-[#14171F] border border-black/[0.08] dark:border-white/[0.12] flex items-center justify-center text-ns-blue">
                <Plane size={11} className="rotate-90" />
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold tabular-nums text-[#68707D] dark:text-[#8B93A1] mt-2.5 whitespace-nowrap">
              {template.flight.outboundFlightNumber} /{" "}
              {template.flight.inboundFlightNumber}
            </span>
          </div>

          <div className="text-right min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#68707D] dark:text-[#8B93A1]">
              {template.flight.cabinClass}
            </div>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="text-xs font-mono font-bold tabular-nums text-ns-blue">
                {template.flight.outboundArrTime}
              </span>
              <span className="text-lg font-mono font-extrabold tabular-nums text-[#1A1D23] dark:text-[#ECEFF4]">
                {template.flight.arrivalAirport}
              </span>
            </div>
          </div>
        </div>

        {/* Budget & Content Overview */}
        <div className="md:col-span-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#68707D] dark:text-[#8B93A1]">
              <Wallet size={13} className="text-ns-green shrink-0" />
              <span>{isEn ? "Est. Budget" : "參考預算"}</span>
            </div>
            <div className="mt-1">
              <div className="font-mono font-extrabold tabular-nums text-sm sm:text-base text-[#1A1D23] dark:text-[#ECEFF4]">
                NT$ {template.estimatedBudgetTwd.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono font-semibold text-[#68707D] dark:text-[#8B93A1]">
                {template.currency} · {template.expenses.length}{" "}
                {isEn ? "sample logs" : "筆範例帳目"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#68707D] dark:text-[#8B93A1]">
              <CheckSquare size={13} className="text-ns-indigo shrink-0" />
              <span>{isEn ? "Included" : "內含項目"}</span>
            </div>
            <div className="mt-1">
              <div className="font-mono font-extrabold tabular-nums text-sm sm:text-base text-[#1A1D23] dark:text-[#ECEFF4]">
                {totalStops} {isEn ? "Stops" : "個站點"}
              </div>
              <div className="text-[11px] font-mono font-semibold tabular-nums text-[#68707D] dark:text-[#8B93A1]">
                {template.checklist.length}{" "}
                {isEn ? "packing items" : "項行李清單"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-Day Selectable Itinerary Preview */}
      <div className="space-y-3 pt-1">
        <div
          role="tablist"
          aria-label={isEn ? "Select preview day" : "切換預覽天數"}
          className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {template.itinerary.map((day, idx) => {
            const active = idx === selectedDayIndex;
            return (
              <button
                key={day.dayNumber}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`template-${template.id}-day-${day.dayNumber}`}
                onClick={() => setSelectedDayIndex(idx)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold font-mono tabular-nums transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer border ${
                  active
                    ? "bg-ns-blue text-white border-ns-blue shadow-sm"
                    : "bg-white dark:bg-[#14171F] text-[#68707D] dark:text-[#8B93A1] border-black/[0.06] dark:border-white/[0.10] hover:text-[#1A1D23] dark:hover:text-[#ECEFF4]"
                }`}
              >
                Day {day.dayNumber}
              </button>
            );
          })}
        </div>

        <div
          data-testid={`template-${template.id}-day-preview`}
          className="rounded-2xl bg-white/80 dark:bg-[#14171F]/80 border border-black/[0.06] dark:border-white/[0.08] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.05] dark:border-white/[0.07]">
            <h3 className="text-sm font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              <span className="font-mono tabular-nums text-ns-blue mr-2">
                DAY {String(activeDay.dayNumber).padStart(2, "0")}
              </span>
              {activeDay.title[language]}
            </h3>
            <span className="text-[11px] font-mono tabular-nums font-semibold text-[#68707D] dark:text-[#8B93A1] whitespace-nowrap shrink-0">
              {activeDay.stops.length} {isEn ? "stops" : "站"}
            </span>
          </div>

          <ol className="space-y-2.5">
            {activeDay.stops.map((stop, idx) => (
              <li
                key={`${activeDay.dayNumber}-${idx}`}
                className="flex items-start gap-3"
              >
                <span className="font-mono tabular-nums text-xs font-bold text-[#68707D] dark:text-[#8B93A1] w-11 pt-1 shrink-0">
                  {stop.time}
                </span>
                <StopTypeIcon type={stop.type} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                    {stop.placeName[language]}
                  </div>
                  {stop.note && (
                    <p className="text-xs text-[#68707D] dark:text-[#8B93A1] leading-relaxed mt-0.5">
                      {stop.note[language]}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
};

export const TemplatesPage: React.FC<TemplatesPageProps> = ({
  language,
  onBack,
  onNavigate,
  onUseTemplate,
  bottomSlot,
}) => {
  const isEn = language === "en";

  return (
    <PublicPageShell
      title={isEn ? "Curated Trip Templates" : "精選旅程範本庫"}
      subtitle={
        isEn
          ? "Preview real flight routes, geocoded daily stops, and starter budgets—then clone any template into your own workspace in one click."
          : "精選含真實航班、經緯度景點座標、多幣別預算與行李清單的經典範本，一鍵套用即可自由微調出發。"
      }
      language={language}
      onBack={onBack}
      onNavigate={onNavigate}
      activePath="/templates"
    >
      <div className="space-y-6">
        {CURATED_TRIP_TEMPLATES.map((template) => (
          <TemplatePreviewCard
            key={template.id}
            template={template}
            language={language}
            onUseTemplate={onUseTemplate}
          />
        ))}

        {bottomSlot && (
          <div data-testid="templates-bottom-slot" className="pt-2">
            {bottomSlot}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
};
