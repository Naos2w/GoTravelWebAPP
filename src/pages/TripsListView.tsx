import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Check,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  Compass,
  X as CloseIcon,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Trip } from "../types";
import { useTranslation } from "../shared/contexts/LocalizationContext";
import { APP_VERSION } from "../shared/services/version";
import { TripCard, getTripTiming } from "../features/trips/TripCard";
import { TripForm } from "../features/trips/TripForm";
import { AdSlot } from "../shared/components/AdSlot";
import { SiteFooter } from "./LegalPages";

export interface TripsListViewProps {
  trips: Trip[];
  currentUserId?: string;
  syncStatus: "synced" | "syncing" | "offline" | "error";
  error: string | null;
  showCreateForm: boolean;
  headerProfile: React.ReactNode;
  onManualResync: () => void;
  onOpenCreateForm: () => void;
  onCloseCreateForm: () => void;
  onCreateTripSubmit: (tripData: Trip) => Promise<void>;
  onSelectTrip: (tripId: string) => void;
  onDeleteTripClick: (trip: Trip) => void;
  calculateTripTotal: (trip: Trip) => number;
  getGradient: (str: string) => string;
  onTryDemoTrip?: () => void;
  onNavigatePublic?: (path: string) => void;
}

export const TripsListView: React.FC<TripsListViewProps> = ({
  trips,
  currentUserId,
  syncStatus,
  error,
  showCreateForm,
  headerProfile,
  onManualResync,
  onOpenCreateForm,
  onCloseCreateForm,
  onCreateTripSubmit,
  onSelectTrip,
  onDeleteTripClick,
  calculateTripTotal,
  getGradient,
  onTryDemoTrip,
  onNavigatePublic,
}) => {
  const { t, language } = useTranslation();
  const [tripSearchQuery, setTripSearchQuery] = useState("");
  const [tripFilter, setTripFilter] = useState<"all" | "upcoming" | "past">(
    "all"
  );
  const [isEditMode, setIsEditMode] = useState(false);

  // Automatically reset edit mode if all trips are deleted
  useEffect(() => {
    if (trips.length === 0 && isEditMode) {
      setIsEditMode(false);
    }
  }, [trips.length, isEditMode]);

  const { filteredTrips, tripCounts } = useMemo(() => {
    let all = 0;
    let upcoming = 0;
    let past = 0;

    trips.forEach((trip) => {
      all++;
      const timing = getTripTiming(trip.startDate, trip.endDate);
      if (timing.status === "past") {
        past++;
      } else {
        upcoming++;
      }
    });

    const query = tripSearchQuery.trim().toLowerCase();
    const result = trips.filter((trip) => {
      if (tripFilter !== "all") {
        const timing = getTripTiming(trip.startDate, trip.endDate);
        if (tripFilter === "upcoming" && timing.status === "past") return false;
        if (tripFilter === "past" && timing.status !== "past") return false;
      }

      if (query) {
        const matchName = trip.name?.toLowerCase().includes(query);
        const matchDest = trip.destination?.toLowerCase().includes(query);
        if (!matchName && !matchDest) return false;
      }

      return true;
    });

    return {
      filteredTrips: result,
      tripCounts: { all, upcoming, past },
    };
  }, [trips, tripSearchQuery, tripFilter]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-4 sm:p-10 pb-16 max-w-7xl w-full mx-auto relative">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-lg font-bold text-primary tracking-tight whitespace-nowrap shrink-0">
            {t("appName")}
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.08] whitespace-nowrap shrink-0 tabular-nums">
            v{APP_VERSION}
          </span>
          {syncStatus === "offline" && (
            <span
              role="status"
              data-testid="sync-status-pill"
              data-sync-status="offline"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 whitespace-nowrap shrink-0"
            >
              <WifiOff size={10} className="shrink-0" />
              <span>{t("syncOffline")}</span>
            </span>
          )}
          {syncStatus === "error" && (
            <button
              type="button"
              data-testid="sync-retry-btn"
              data-sync-status="error"
              onClick={onManualResync}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
              title={t("syncRetry")}
            >
              <RefreshCw size={10} className="shrink-0" />
              <span>
                {t("syncError")} · {t("syncRetry")}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">{headerProfile}</div>
      </header>

      {error && (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-3xl flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <div>
            <h3 className="font-black text-red-600">{t("errorTitle")}</h3>
            <p className="text-xs font-bold text-red-400">
              {t("errorDesc")} ({error})
            </p>
          </div>
        </div>
      )}

      {/* Header section with Title, Subtitle, Search/Filter Toolbar & New Trip CTA */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {t("yourTrips")}
            </h2>
            <p className="text-slate-400 font-semibold text-xs sm:text-sm mt-1 tabular-nums">
              {trips.length > 0
                ? language === "zh"
                  ? `${trips.length} 個旅程 • ${tripCounts.upcoming} 個即將到來`
                  : `${trips.length} trips • ${tripCounts.upcoming} upcoming`
                : language === "zh"
                ? "尚無已建立的旅程"
                : "No trips created yet"}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {trips.length > 0 && (
              <button
                type="button"
                onClick={() => setIsEditMode((prev) => !prev)}
                data-testid="toggle-edit-mode-btn"
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
                  isEditMode
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                    : "bg-white/80 hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-white/10"
                }`}
              >
                {isEditMode ? (
                  <>
                    <Check size={16} />
                    <span>{t("done")}</span>
                  </>
                ) : (
                  <>
                    <Edit2 size={16} />
                    <span>{t("edit")}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCreateForm}
              className="hidden sm:inline-flex bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-2xl items-center gap-2 font-bold text-sm shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus size={18} /> {t("newTrip")}
            </button>
          </div>
        </div>

        {/* Edit Mode Notice Banner */}
        {isEditMode && trips.length > 0 && (
          <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 size={15} className="shrink-0" />
              <span className="truncate">{t("manageTripsHint")}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="text-xs font-bold underline hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t("done")}
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar (shown when trips exist) */}
        {trips.length > 0 && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={tripSearchQuery}
                onChange={(e) => setTripSearchQuery(e.target.value)}
                placeholder={t("searchTripsPlaceholder")}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.10] rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {tripSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTripSearchQuery("")}
                  aria-label={t("clearFilter")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-2xl border border-slate-200/60 dark:border-white/[0.08] self-start md:self-auto overflow-x-auto max-w-full no-scrollbar">
              <button
                type="button"
                onClick={() => setTripFilter("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  tripFilter === "all"
                    ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <span>{t("filterAll")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    tripFilter === "all"
                      ? "bg-slate-100 dark:bg-white/20 text-slate-700 dark:text-slate-200"
                      : "bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tripCounts.all}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTripFilter("upcoming")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  tripFilter === "upcoming"
                    ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <span>{t("filterUpcoming")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    tripFilter === "upcoming"
                      ? "bg-primary/10 dark:bg-primary/20 text-primary"
                      : "bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tripCounts.upcoming}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTripFilter("past")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  tripFilter === "past"
                    ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <span>{t("filterPast")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    tripFilter === "past"
                      ? "bg-slate-100 dark:bg-white/20 text-slate-700 dark:text-slate-200"
                      : "bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tripCounts.past}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zero State: No trips at all */}
      {trips.length === 0 && (
        <div className="py-16 sm:py-24 px-6 text-center max-w-lg mx-auto flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent flex items-center justify-center text-primary mb-6 shadow-sm ring-8 ring-primary/5">
            <Compass size={44} className="stroke-[1.75]" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            {t("emptyTripsTitle")}
          </h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
            {t("emptyTripsDesc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={onOpenCreateForm}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-7 py-4 rounded-2xl font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus size={18} /> {t("createFirstTrip")}
            </button>
            {onTryDemoTrip && (
              <button
                type="button"
                data-testid="try-demo-trip-btn"
                onClick={onTryDemoTrip}
                className="w-full sm:w-auto bg-white dark:bg-[#14171F] hover:bg-[#F0F2F5] dark:hover:bg-[#1B1F2A] text-[#1A1D23] dark:text-[#ECEFF4] border border-black/[0.08] dark:border-white/[0.12] px-6 py-4 rounded-2xl font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Compass size={17} className="text-ns-blue shrink-0" />
                <span>{t("tryDemoTripBtn")}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Empty State: Search or filter has 0 results */}
      {trips.length > 0 && filteredTrips.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center text-slate-400 mb-4 border border-black/[0.04] dark:border-white/[0.08]">
            <Search size={28} />
          </div>
          <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
            {t("noTripsFound")}
          </h4>
          <p className="text-xs text-slate-400 mb-6 max-w-xs">
            {t("noTripsFoundDesc")}
          </p>
          <button
            type="button"
            onClick={() => {
              setTripSearchQuery("");
              setTripFilter("all");
            }}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            {t("clearFilter")}
          </button>
        </div>
      )}

      {/* Trips Grid */}
      {filteredTrips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              currentUserId={currentUserId}
              isEditMode={isEditMode}
              onSelect={onSelectTrip}
              onDeleteClick={onDeleteTripClick}
              calculateTripTotal={calculateTripTotal}
              getGradient={getGradient}
            />
          ))}
        </div>
      )}

      {showCreateForm && (
        <TripForm
          onClose={onCloseCreateForm}
          onSubmit={onCreateTripSubmit}
        />
      )}

      {/* Mobile Floating Action Button (FAB) for New Trip */}
      <div className="sm:hidden fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40">
        <button
          type="button"
          onClick={onOpenCreateForm}
          aria-label={t("newTrip")}
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform duration-200 cursor-pointer"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>
      </div>

      {/* Safe AdSlot + SiteFooter well away from interactive trip cards */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-10 pb-8">
        <AdSlot slot="trips-list-bottom" language={language} />
      </div>
      <div className="pb-20 sm:pb-0">
        <SiteFooter
          language={language}
          onNavigate={(path) => onNavigatePublic?.(path)}
        />
      </div>
    </div>
  );
};
