import React from "react";
import {
  Calendar,
  Plane,
  Edit2,
  MapPin,
  Map,
  PieChart as PieChartIcon,
  CheckSquare,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Trip, ItineraryItem } from "../types";
import { useTranslation } from "../contexts/LocalizationContext";
import { CATEGORY_UI } from "./ExpenseCategories";

export interface ChartEntry {
  category: string;
  name: string;
  displayName: string;
  value: number;
  [key: string]: string | number;
}

export interface ChecklistStat {
  category: string;
  total: number;
  completed: number;
}

export interface MobileHeroProps {
  trip: Trip;
  currentUserId?: string;
  isGuest: boolean;
  arrivalCode: string;
  displayDays: number;
  countdownPercent: number;
  spentTotal: number;
  budgetLimit: number;
  budgetPercent: number;
  packingPercent: number;
  upcomingItems: Array<ItineraryItem & { date: string }>;
  chartData: ChartEntry[];
  sortedChartData: ChartEntry[];
  chartTotal: number;
  checklistStats: ChecklistStat[];
  onEditBudget: () => void;
}

export const MobileHero: React.FC<MobileHeroProps> = ({
  trip,
  currentUserId,
  isGuest,
  arrivalCode,
  displayDays,
  countdownPercent,
  spentTotal,
  budgetLimit,
  budgetPercent,
  packingPercent,
  upcomingItems,
  chartData,
  sortedChartData,
  chartTotal,
  checklistStats,
  onEditBudget,
}) => {
  const { t } = useTranslation();

  const allFlights = trip.flights || [];
  const departureCode = allFlights[0]?.outbound?.departureAirport || "";
  const routeBadgeLabel =
    departureCode && arrivalCode
      ? `${departureCode} ✈ ${arrivalCode}`
      : arrivalCode || t("destination");
  const statusPillLabel =
    displayDays > 0 ? `${displayDays} ${t("daysLeft")}` : t("statusOngoing");

  const userFlightNumbers = allFlights
    .filter((f) => f.user_id === currentUserId)
    .flatMap((f) => {
      const numbers: Array<{ num: string; isReturn: boolean }> = [];
      if (f.outbound?.flightNumber) {
        numbers.push({ num: f.outbound.flightNumber, isReturn: false });
      }
      if (f.inbound?.flightNumber) {
        numbers.push({ num: f.inbound.flightNumber, isReturn: true });
      }
      return numbers;
    });

  return (
    <div className="md:hidden space-y-4 mb-6">
      {/* Aviation Destination Hero Card */}
      <div className="w-full rounded-[28px] p-7 shadow-ios ios27-card relative overflow-hidden aviation-grid-bg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        {arrivalCode && (
          <div
            aria-hidden="true"
            className="absolute right-4 top-4 text-6xl font-mono font-black tracking-tighter text-slate-900/[0.05] dark:text-white/[0.06] select-none pointer-events-none leading-none"
          >
            {arrivalCode}
          </div>
        )}
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2 mb-1">
            <div className="text-[10px] font-mono font-semibold text-primary uppercase tracking-[0.18em] min-w-0 truncate">
              {routeBadgeLabel}
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 tabular-nums whitespace-nowrap shrink-0">
              {statusPillLabel}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {trip.destination}
          </h2>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-mono font-semibold tracking-wide mt-1 tabular-nums">
            <Calendar size={12} className="text-primary shrink-0" />{" "}
            {trip.startDate} — {trip.endDate}
          </div>

          {/* Mobile Flight Numbers */}
          <div className="flex flex-wrap gap-2 mt-3">
            {userFlightNumbers.map((item, idx) => (
              <div
                key={idx}
                className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all tabular-nums whitespace-nowrap shrink-0 ${
                  item.isReturn
                    ? "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 border-slate-200/60 dark:border-white/10"
                    : "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20"
                }`}
              >
                <Plane
                  size={10}
                  className={item.isReturn ? "rotate-180" : ""}
                />{" "}
                {item.num}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Countdown, Budget & Packing Progress Card */}
      <div className="ios27-card rounded-[28px] p-6 shadow-ios space-y-5">
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
              {t("countdown")}
            </span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {displayDays > 0 ? displayDays : 0} {t("daysLeft")}
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${countdownPercent}%` }}
            />
          </div>
        </div>

        <div
          onClick={() => !isGuest && onEditBudget()}
          className={
            !isGuest
              ? "cursor-pointer active:opacity-70 transition-opacity"
              : ""
          }
        >
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] flex items-center gap-1">
              {t("budgetStatus")} {!isGuest && <Edit2 size={10} />}
            </span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {(spentTotal / 1000).toFixed(1)}k /{" "}
              {(budgetLimit / 1000).toFixed(1)}k ({Math.round(budgetPercent)}%)
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                spentTotal > budgetLimit
                  ? "bg-rose-500"
                  : budgetPercent > 80
                  ? "bg-amber-500"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
              {t("packingProgress")}
            </span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {packingPercent}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${packingPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Upcoming Next 5 Stops */}
      {upcomingItems.length > 0 && (
        <div className="space-y-3">
          <div className="px-2 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {t("nextStops")}
            </span>
          </div>
          <div className="space-y-2">
            {upcomingItems.map((item, i) => (
              <div
                key={item.id || i}
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      item.placeName
                    )}`,
                    "_blank"
                  )
                }
                className="ios27-card rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    i === 0
                      ? "bg-primary/10 dark:bg-primary/20 text-primary"
                      : "bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300"
                  }`}
                >
                  <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest mb-0.5 tabular-nums">
                    {item.time}
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {item.placeName}
                  </div>
                </div>
                <div className="text-slate-300 dark:text-slate-500 shrink-0">
                  <Map size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Spending Breakdown & Packing Progress Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="ios27-card rounded-[28px] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] flex items-center gap-1.5">
              <PieChartIcon size={12} /> {t("breakdown")}
            </span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
              NT$ {Math.round(spentTotal).toLocaleString()}
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-28 w-28 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={44}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="displayName"
                    >
                      {chartData.map((e, i) => (
                        <Cell
                          key={`cell-m-${i}`}
                          fill={
                            CATEGORY_UI[e.category]?.hexColor ||
                            CATEGORY_UI["Other"].hexColor
                          }
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) =>
                        `NT$ ${Math.round(value).toLocaleString()}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {sortedChartData.slice(0, 4).map((entry) => {
                  const pct =
                    chartTotal > 0
                      ? Math.round((entry.value / chartTotal) * 100)
                      : 0;
                  const color =
                    CATEGORY_UI[entry.category]?.hexColor ||
                    CATEGORY_UI["Other"].hexColor;
                  return (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {entry.displayName}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-28 w-full flex items-center justify-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {t("noData")}
            </div>
          )}
        </div>

        <div className="ios27-card rounded-[28px] p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] flex items-center gap-1.5">
              <CheckSquare size={12} /> {t("checklistSummary")}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-500 tabular-nums">
              {packingPercent}%
            </span>
          </div>
          <div className="space-y-2.5">
            {checklistStats.slice(0, 3).map((stat) => (
              <div key={stat.category} className="flex items-center gap-2">
                <div className="w-16 text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate uppercase">
                  {stat.category}
                </div>
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${(stat.completed / stat.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-400 w-7 text-right tabular-nums">
                  {stat.completed}/{stat.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
