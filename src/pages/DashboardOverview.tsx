import React, { useMemo } from "react";
import {
  Plane,
  Calendar,
  CheckSquare,
  Edit2,
  Clock,
  MapPin,
  Wallet,
  Trash2,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Trip } from "../types";
import { useTranslation } from "../shared/contexts/LocalizationContext";
import {
  CATEGORY_UI,
  getCategoryName,
} from "../features/expenses/ExpenseCategories";
import {
  getRateToTwd,
  resolveHistoricalFlightRate,
} from "../features/expenses/services/exchangeRateService";
import { MobileHero } from "../features/trips/MobileHero";

export interface DashboardOverviewProps {
  trip: Trip;
  currentUserId?: string;
  isCreator: boolean;
  isGuest: boolean;
  spentTotal: number;
  budgetLimit: number;
  tabTransitionClass: string;
  onEditBudget: () => void;
  onDeleteTripClick: (trip: Trip) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  trip,
  currentUserId,
  isCreator,
  isGuest,
  spentTotal,
  budgetLimit,
  tabTransitionClass,
  onEditBudget,
  onDeleteTripClick,
}) => {
  const { t, language } = useTranslation();

  const budgetPercent = Math.min(100, (spentTotal / budgetLimit) * 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(trip.startDate);
  const daysDiff =
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const countdownPercent =
    daysDiff < 0 ? 0 : daysDiff > 30 ? 100 : (daysDiff / 30) * 100;
  const displayDays = Math.ceil(daysDiff);
  const arrivalCode = trip.flights?.[0]?.outbound?.arrivalAirport || "";

  const packingPercent = useMemo(() => {
    if (!currentUserId) return 0;
    const myItems = trip.checklist.filter((i) => i.user_id === currentUserId);
    if (myItems.length === 0) return 0;
    return Math.round(
      (myItems.filter((i) => i.isCompleted).length / myItems.length) * 100
    );
  }, [trip, currentUserId]);

  const upcomingItems = useMemo(() => {
    if (!trip.itinerary) return [];
    const now = new Date();
    const allItems = [];
    for (const day of trip.itinerary) {
      for (const item of day.items) {
        const itemDate = new Date(`${day.date}T${item.time}`);
        if (itemDate > now && item.type !== "Transport") {
          allItems.push({ ...item, date: day.date });
        }
      }
    }
    return allItems
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime()
      )
      .slice(0, 5);
  }, [trip]);

  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    trip.expenses.forEach((e) => {
      const rate =
        e.exchangeRate && e.exchangeRate > 0
          ? e.exchangeRate
          : getRateToTwd(e.currency);
      dataMap[e.category] = (dataMap[e.category] || 0) + e.amount * rate;
    });
    const flightsSum = (trip.flights || []).reduce(
      (sum, f) => sum + f.price * resolveHistoricalFlightRate(f),
      0
    );
    if (flightsSum > 0) {
      dataMap["Flight"] = (dataMap["Flight"] || 0) + flightsSum;
    }
    return Object.entries(dataMap).map(([key, value]) => ({
      category: key,
      name: key,
      displayName: getCategoryName(key, t),
      value,
    }));
  }, [trip, language, t]);

  const sortedChartData = useMemo(
    () => [...chartData].sort((a, b) => b.value - a.value),
    [chartData]
  );
  const chartTotal = useMemo(
    () => sortedChartData.reduce((sum, item) => sum + item.value, 0),
    [sortedChartData]
  );

  const checklistStats = useMemo(() => {
    if (!currentUserId) return [];
    return ["Documents", "Gear", "Clothing", "Toiletries", "Other"]
      .map((c) => {
        const items = trip.checklist.filter(
          (i) => i.category === c && i.user_id === currentUserId
        );
        const completed = items.filter((i) => i.isCompleted).length;
        return { category: c, total: items.length, completed };
      })
      .filter((c) => c.total > 0);
  }, [trip, currentUserId]);

  return (
    <div className={`space-y-6 ${tabTransitionClass}`}>
      <MobileHero
        trip={trip}
        currentUserId={currentUserId}
        isGuest={isGuest}
        arrivalCode={arrivalCode}
        displayDays={displayDays}
        countdownPercent={countdownPercent}
        spentTotal={spentTotal}
        budgetLimit={budgetLimit}
        budgetPercent={budgetPercent}
        packingPercent={packingPercent}
        upcomingItems={upcomingItems}
        chartData={chartData}
        sortedChartData={sortedChartData}
        chartTotal={chartTotal}
        checklistStats={checklistStats}
        onEditBudget={onEditBudget}
      />

      <div className="hidden md:grid grid-cols-12 gap-5 min-h-[620px]">
        {/* Destination Hero Card */}
        <div className="col-span-12 lg:col-span-6 rounded-[32px] overflow-hidden relative group ios27-card p-8 lg:p-10 flex flex-col justify-between aviation-grid-bg">
          {arrivalCode && (
            <div
              aria-hidden="true"
              className="absolute right-6 top-6 text-7xl lg:text-8xl font-mono font-black tracking-tighter text-slate-900/[0.04] dark:text-white/[0.05] select-none pointer-events-none leading-none"
            >
              {arrivalCode}
            </div>
          )}
          <div className="relative z-10">
            <div className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em] mb-3">
              {arrivalCode ? `Arriving at ${arrivalCode}` : t("destination")}
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 leading-[1.05]">
              {trip.destination}
            </h2>
          </div>
          <div className="relative z-10 pt-6">
            <div className="inline-flex items-center gap-2.5 text-slate-500 dark:text-slate-400 font-mono font-semibold text-xs tabular-nums bg-slate-100/80 dark:bg-white/[0.06] px-3.5 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.08]">
              <Calendar size={13} className="text-primary" />
              <span>
                {trip.startDate} — {trip.endDate}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(trip.flights || [])
                .filter((f) => f.user_id === currentUserId)
                .flatMap((f) => {
                  const nums: Array<{
                    num: string;
                    isReturn: boolean;
                  }> = [];
                  if (f.outbound?.flightNumber) {
                    nums.push({
                      num: f.outbound.flightNumber,
                      isReturn: false,
                    });
                  }
                  if (f.inbound?.flightNumber) {
                    nums.push({
                      num: f.inbound.flightNumber,
                      isReturn: true,
                    });
                  }
                  return nums;
                })
                .map((item, i) => (
                  <div
                    key={i}
                    className={`text-[11px] font-mono font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 border transition-all hover:scale-105 tabular-nums ${
                      item.isReturn
                        ? "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 border-slate-200/60 dark:border-white/10"
                        : "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 shadow-sm"
                    }`}
                  >
                    <Plane
                      size={12}
                      className={item.isReturn ? "rotate-180" : ""}
                    />{" "}
                    {item.num}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Budget Status Card */}
        <div className="col-span-6 lg:col-span-3 ios27-card rounded-[28px] p-6 flex flex-col relative group/budget">
          <div className="flex justify-between items-start mb-4">
            <div
              className={`p-2.5 rounded-2xl ${
                spentTotal > budgetLimit
                  ? "bg-rose-500/10 text-rose-500"
                  : budgetPercent > 80
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-primary/10 dark:bg-primary/20 text-primary"
              }`}
            >
              <Wallet size={20} />
            </div>
            {!isGuest && (
              <button
                type="button"
                onClick={onEditBudget}
                className="p-2 text-slate-400 hover:text-primary rounded-lg transition-all cursor-pointer"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-end space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
              {t("budgetStatus")}
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-3xl font-mono font-extrabold tabular-nums ${
                  spentTotal > budgetLimit
                    ? "text-rose-500"
                    : budgetPercent > 80
                    ? "text-amber-500"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {Math.round(budgetPercent)}
                <span className="text-lg font-bold">%</span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full mt-2 mb-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  spentTotal > budgetLimit
                    ? "bg-rose-500"
                    : budgetPercent > 80
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(budgetPercent, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-white/[0.06]">
              <div>
                <div className="text-slate-400 dark:text-slate-500 mb-0.5">
                  {t("spent")}
                </div>
                <div
                  className={`font-mono font-bold tabular-nums ${
                    spentTotal > budgetLimit
                      ? "text-rose-500"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  NT$ {(spentTotal / 1000).toFixed(1)}k
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 dark:text-slate-500 mb-0.5">
                  {t("limit")}
                </div>
                <div className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200">
                  NT$ {(budgetLimit / 1000).toFixed(1)}k
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spending Breakdown Card */}
        <div className="col-span-6 lg:col-span-3 ios27-card rounded-[28px] p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] flex items-center gap-1.5">
              <PieChartIcon size={13} /> {t("breakdown")}
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={52}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="displayName"
                    >
                      {chartData.map((e, i) => (
                        <Cell
                          key={`cell-${i}`}
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
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
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
            <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-400 dark:text-slate-500">
              {t("noData")}
            </div>
          )}
        </div>

        {/* Upcoming Schedule */}
        <div className="col-span-12 lg:col-span-4 ios27-card rounded-[28px] p-7 flex flex-col overflow-hidden">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-5 flex items-center gap-2">
            <MapPin size={14} className="text-primary" /> {t("upcomingSchedule")}
          </div>
          <div className="flex-1 space-y-3.5 overflow-y-auto no-scrollbar">
            {upcomingItems.map((item, i) => (
              <div
                key={item.id || i}
                className="flex gap-3.5 group cursor-pointer p-2 -mx-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      item.placeName
                    )}`,
                    "_blank"
                  )
                }
              >
                <div className="flex flex-col items-center pt-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      i === 0
                        ? "bg-primary ring-4 ring-primary/15"
                        : "bg-slate-300 dark:bg-white/25"
                    }`}
                  />
                  {i !== upcomingItems.length - 1 && (
                    <div className="w-0.5 flex-1 bg-slate-100 dark:bg-white/10 mt-1.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                      {item.placeName}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-primary dark:text-sky-400 bg-primary/10 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                      {item.time}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-medium text-slate-400 tabular-nums">
                    {item.date}
                  </div>
                </div>
              </div>
            ))}
            {upcomingItems.length === 0 && (
              <div className="text-slate-400 dark:text-slate-600 font-semibold text-xs uppercase text-center py-8">
                {t("noUpcoming")}
              </div>
            )}
          </div>
        </div>

        {/* Packing Progress */}
        <div className="col-span-6 lg:col-span-4 ios27-card rounded-[28px] p-7 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] flex items-center gap-2">
              <CheckSquare size={14} className="text-emerald-500" />{" "}
              {t("checklistSummary")}
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
              {packingPercent}%
            </div>
          </div>
          <div className="space-y-3.5 flex-1 overflow-y-auto no-scrollbar pr-1">
            {checklistStats.map((stat) => (
              <div key={stat.category} className="flex items-center gap-3">
                <div className="w-20 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {stat.category}
                </div>
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(stat.completed / stat.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-400 w-9 text-right tabular-nums">
                  {stat.completed}/{stat.total}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown & Trip Actions */}
        <div className="col-span-6 lg:col-span-4 flex flex-col gap-4">
          <div className="flex-1 ios27-card rounded-[28px] p-7 flex flex-col justify-center relative overflow-hidden group aviation-grid-bg">
            <div className="relative z-10">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-2">
                {t("countdown")}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-mono font-extrabold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                  {displayDays > 0 ? displayDays : 0}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {t("daysLeft")}
                </span>
              </div>
            </div>
            <Clock className="absolute -right-4 -bottom-4 text-slate-200/70 dark:text-white/[0.04] w-32 h-32 rotate-12 transition-transform group-hover:rotate-45 duration-700" />
          </div>
          {isCreator && (
            <button
              type="button"
              onClick={() => onDeleteTripClick(trip)}
              className="h-12 flex items-center justify-center gap-2 text-rose-500/80 hover:text-rose-600 font-semibold text-xs tracking-wide bg-white/70 dark:bg-white/[0.03] border border-rose-200/60 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Trash2 size={14} /> {t("deleteTrip")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
