import React, { Suspense } from "react";
import { X } from "lucide-react";
import { Trip, User } from "../../types";
import { useTranslation } from "../../shared/contexts/LocalizationContext";
import { DashboardOverview } from "../../pages/DashboardOverview";
import { ErrorBoundary } from "./ErrorBoundary";
import { DetailTabId } from "./FloatingDock";

const Checklist = React.lazy(() =>
  import("../../features/checklist/Checklist").then((m) => ({
    default: m.Checklist,
  }))
);
const Itinerary = React.lazy(() =>
  import("../../features/itinerary/Itinerary").then((m) => ({
    default: m.Itinerary,
  }))
);
const Expenses = React.lazy(() =>
  import("../../features/expenses/Expenses").then((m) => ({
    default: m.Expenses,
  }))
);
const FlightManager = React.lazy(() =>
  import("../../features/flights/FlightManager").then((m) => ({
    default: m.FlightManager,
  }))
);

export const TabSkeleton: React.FC = () => (
  <div
    role="status"
    aria-busy="true"
    data-testid="tab-suspense-skeleton"
    className="space-y-5 py-4"
  >
    <div className="ios27-card rounded-[28px] p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.1] space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-36 rounded-full bg-slate-200/80 dark:bg-white/10" />
        <div className="h-8 w-24 rounded-full bg-slate-200/70 dark:bg-white/10" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="h-24 rounded-2xl bg-slate-100/90 dark:bg-white/[0.05]" />
        <div className="h-24 rounded-2xl bg-slate-100/90 dark:bg-white/[0.05]" />
        <div className="h-24 rounded-2xl bg-slate-100/90 dark:bg-white/[0.05]" />
      </div>
    </div>
    <div className="ios27-card rounded-[28px] p-6 border border-black/[0.06] dark:border-white/[0.1] space-y-3">
      <div className="h-4 w-48 rounded-full bg-slate-200/80 dark:bg-white/10" />
      <div className="h-14 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04]" />
      <div className="h-14 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04]" />
    </div>
  </div>
);

export interface TripDetailTabsProps {
  trip: Trip;
  user: User | null;
  activeTab: DetailTabId;
  isCreator: boolean;
  isGuest: boolean;
  spentTotal: number;
  budgetLimit: number;
  screenFollowOffsetPx: number;
  isDockDragging: boolean;
  tabTransitionClass: string;
  showItineraryGuideBanner: boolean;
  autoEditFlightId: string | null;
  onUpdateTrip: (updatedTrip: Trip, action?: string, payload?: any) => void;
  onEditBudget: () => void;
  onDeleteTripClick: (trip: Trip) => void;
  onGuideGoToPrice: () => void;
  onDismissItineraryGuide: () => void;
  onGuidedPriceSaved: () => void;
}

export const TripDetailTabs: React.FC<TripDetailTabsProps> = ({
  trip,
  user,
  activeTab,
  isCreator,
  isGuest,
  spentTotal,
  budgetLimit,
  screenFollowOffsetPx,
  isDockDragging,
  tabTransitionClass,
  showItineraryGuideBanner,
  autoEditFlightId,
  onUpdateTrip,
  onEditBudget,
  onDeleteTripClick,
  onGuideGoToPrice,
  onDismissItineraryGuide,
  onGuidedPriceSaved,
}) => {
  const { t } = useTranslation();

  const tabBoundaryProps = {
    scope: "tab" as const,
    title: t("errorBoundaryTitle"),
    description: t("errorBoundaryDesc"),
    retryLabel: t("errorBoundaryRetry"),
    detailsLabel: t("errorBoundaryDetails"),
  };

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1 overflow-x-hidden">
      <div
        data-testid="tab-screen-follow-wrapper"
        style={{
          transform: screenFollowOffsetPx
            ? `translate3d(${screenFollowOffsetPx.toFixed(1)}px, 0, 0)`
            : undefined,
          transition: isDockDragging
            ? "transform 45ms linear"
            : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {activeTab === "dashboard" && (
          <ErrorBoundary
            {...tabBoundaryProps}
            resetKey={`${trip.id}-dashboard`}
          >
            <DashboardOverview
              trip={trip}
              currentUserId={user?.id}
              isCreator={isCreator}
              isGuest={isGuest}
              spentTotal={spentTotal}
              budgetLimit={budgetLimit}
              tabTransitionClass={tabTransitionClass}
              onEditBudget={onEditBudget}
              onDeleteTripClick={onDeleteTripClick}
            />
          </ErrorBoundary>
        )}

        {activeTab === "itinerary" && (
          <ErrorBoundary
            {...tabBoundaryProps}
            resetKey={`${trip.id}-itinerary`}
          >
            <Suspense fallback={<TabSkeleton />}>
              <div key="itinerary" className={tabTransitionClass}>
                {showItineraryGuideBanner && (
                  <div
                    role="status"
                    data-testid="guide-itinerary-banner"
                    className="mb-5 hidden sm:flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 animate-in slide-in-from-top-4 fade-in duration-500"
                  >
                    <div className="flex-1 min-w-0 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      ✈️ {t("guideBannerText")} ➔
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={onGuideGoToPrice}
                        className="bg-primary hover:bg-primary/90 text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t("guideBannerCta")}
                      </button>
                      <button
                        type="button"
                        onClick={onDismissItineraryGuide}
                        aria-label={t("guideBannerDismiss")}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
                <Itinerary
                  trip={trip}
                  currentUser={user!}
                  onUpdate={onUpdateTrip}
                  isGuest={isGuest}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === "checklist" && (
          <ErrorBoundary
            {...tabBoundaryProps}
            resetKey={`${trip.id}-checklist`}
          >
            <Suspense fallback={<TabSkeleton />}>
              <div key="checklist" className={tabTransitionClass}>
                <Checklist
                  trip={trip}
                  currentUser={user!}
                  onUpdate={onUpdateTrip}
                  isGuest={isGuest}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === "expenses" && (
          <ErrorBoundary
            {...tabBoundaryProps}
            resetKey={`${trip.id}-expenses`}
          >
            <Suspense fallback={<TabSkeleton />}>
              <div key="expenses" className={tabTransitionClass}>
                <Expenses
                  trip={trip}
                  currentUser={user!}
                  onUpdate={onUpdateTrip}
                  isGuest={isGuest}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === "flights" && (
          <ErrorBoundary
            {...tabBoundaryProps}
            resetKey={`${trip.id}-flights`}
          >
            <Suspense fallback={<TabSkeleton />}>
              <div key="flights" className={tabTransitionClass}>
                <FlightManager
                  trip={trip}
                  currentUser={user!}
                  onUpdate={onUpdateTrip}
                  isGuest={isGuest}
                  autoEditFlightId={autoEditFlightId}
                  onGuidedPriceSaved={onGuidedPriceSaved}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </main>
  );
};
