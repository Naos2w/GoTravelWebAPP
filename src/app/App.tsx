import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Trip, FlightInfo, Theme, Language, User } from "../types";
import {
  buildTripShareUrl,
  isPublicContentView,
} from "../shared/services/routerService";
import { isValidUUID } from "../shared/services/storageService";
import { applyPageSeo } from "../shared/services/seoService";
import {
  initThirdPartyScripts,
  trackEvent,
} from "../shared/services/analyticsService";
import { createTripFromTemplate } from "../shared/data/demoTemplates";
import { CookieConsentBanner } from "../shared/components/CookieConsentBanner";
import { AdSlot } from "../shared/components/AdSlot";
import {
  OnboardingTour,
  isOnboardingTourDone,
  resetOnboardingTour,
} from "../shared/components/OnboardingTour";
import {
  fetchLiveRatesToTwd,
  getRateToTwd,
  resolveHistoricalFlightRate,
} from "../features/expenses/services/exchangeRateService";
import {
  LocalizationProvider,
  translations,
} from "../shared/contexts/LocalizationContext";
import { useTripRouter } from "./hooks/useTripRouter";
import { useAuthSession } from "./hooks/useAuthSession";
import {
  useTripRealtime,
  NotificationState,
} from "./hooks/useTripRealtime";
import { useTripActions } from "./hooks/useTripActions";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  FloatingDock,
  DetailTabId,
  FloatingDockTab,
} from "./components/FloatingDock";
import {
  TripHeader,
  HeaderProfileMenu,
  ProfileMenuContent,
} from "./components/TripHeader";
import { TripDetailTabs } from "./components/TripDetailTabs";
import { LandingPage } from "../pages/LandingPage";
import { TripsListView } from "../pages/TripsListView";

const GuidePage = React.lazy(() =>
  import("../pages/GuidePage").then((m) => ({ default: m.GuidePage }))
);
const TemplatesPage = React.lazy(() =>
  import("../pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage }))
);
const LegalPage = React.lazy(() =>
  import("../pages/LegalPages").then((m) => ({ default: m.LegalPage }))
);

const PENDING_TEMPLATE_STORAGE_KEY = "gotravel_pending_template_id";
import { BoardingPassIssueModal } from "../features/flights/BoardingPassIssueModal";
import { NotificationToast } from "../shared/components/NotificationToast";
import { BudgetModal } from "../features/expenses/BudgetModal";
import { ShareModal } from "../features/trips/ShareModal";
import { LoginModal } from "../shared/components/LoginModal";
import { DeleteTripModal } from "../features/trips/DeleteTripModal";
import { ExportModal } from "../features/trips/ExportModal";
import {
  InstallPwaPromptModal,
  usePwaInstall,
} from "../shared/components/InstallPwaPrompt";
import { ShareTargetModal } from "../shared/components/ShareTargetModal";
import {
  cleanPwaLaunchUrl,
  parsePwaLaunchIntent,
  pickBestTripForShortcut,
  PwaLaunchIntent,
} from "../shared/services/pwaService";
import {
  Plane,
  Calendar,
  CheckSquare,
  DollarSign,
  Loader2,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";

const calculateTripTotal = (trip: Trip): number => {
  const expensesSum = trip.expenses.reduce(
    (sum, item) =>
      sum +
      item.amount *
        (item.exchangeRate && item.exchangeRate > 0
          ? item.exchangeRate
          : getRateToTwd(item.currency)),
    0
  );
  const flightsSum = (trip.flights || []).reduce(
    (sum, f) => sum + f.price * resolveHistoricalFlightRate(f),
    0
  );
  return expensesSum + flightsSum;
};

const getGradient = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-[#1E293B] via-[#172030] to-[#0F172A]",
    "from-[#1B2A4A] via-[#13203A] to-[#0B1324]",
    "from-[#27384C] via-[#1D2B3B] to-[#111A26]",
    "from-[#2C2E33] via-[#1F2126] to-[#13151A]",
    "from-[#1E332D] via-[#162722] to-[#0E1916]",
    "from-[#352A24] via-[#261E1A] to-[#171210]",
    "from-[#272940] via-[#1D1F33] to-[#121321]",
  ];
  return colors[Math.abs(hash) % colors.length];
};

type PostCreateGuideStep = "idle" | "issuing" | "itinerary-hint" | "edit-price";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTabId>("dashboard");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [postCreateGuideStep, setPostCreateGuideStep] =
    useState<PostCreateGuideStep>("idle");
  const [guideFlight, setGuideFlight] = useState<FlightInfo | null>(null);
  const [guideTargetFlightId, setGuideTargetFlightId] = useState<string | null>(
    null
  );
  const [dismissedPricePromptTripIds, setDismissedPricePromptTripIds] =
    useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "light"
  );
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("lang") as Language) || "zh"
  );
  const [notification, setNotification] = useState<NotificationState | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isInstallPwaOpen, setIsInstallPwaOpen] = useState(false);
  const [pendingPwaIntent, setPendingPwaIntent] = useState<PwaLaunchIntent>(
    () => parsePwaLaunchIntent()
  );
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const {
    env: pwaEnv,
    isStandalone: isPwaStandalone,
    canNativeInstall,
    triggerNativeInstall,
  } = usePwaInstall();
  const [profileMenuOpen, setProfileMenuOpen] = useState<
    "desktop" | "mobile" | null
  >(null);
  const [dockDragSlot, setDockDragSlot] = useState<number | null>(null);
  const [tabSlideDir, setTabSlideDir] = useState<"left" | "right">("right");

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const prevTabIndexRef = useRef<number>(0);
  const isDockScrubbingRef = useRef<boolean>(false);
  const creatingTripRef = useRef(false);
  const inFlightWritesRef = useRef<number>(0);
  const activeTripVersionRef = useRef<number>(0);

  const userRef = useRef<User | null>(user);
  userRef.current = user;
  const tripsRef = useRef<Trip[]>(trips);
  tripsRef.current = trips;

  const {
    view,
    setView,
    currentTripId,
    setCurrentTripId,
    currentTripIdRef,
    navigateToTrip,
    navigateToList,
    navigateToLanding,
    navigateToPublicPage,
    parseCurrentRoute,
    replaceRouteUrl,
  } = useTripRouter({ isLoading, userRef });

  const {
    isLoggingIn,
    isLoginModalOpen,
    setIsLoginModalOpen,
    pendingTripId,
    loginReason,
    setLoginReason,
    handleLogin,
    handleLogout,
  } = useAuthSession({
    userRef,
    setUser,
    setIsLoading,
    language,
    currentTripId,
    currentTripIdRef,
    setView,
    setCurrentTripId,
    navigateToLanding,
    parseCurrentRoute,
    replaceRouteUrl,
    setTrips,
    setNotification,
  });

  const currentTrip = trips.find((t) => t.id === currentTripId);
  const currentTripRef = useRef<Trip | undefined>(currentTrip);
  currentTripRef.current = currentTrip;

  const commitTripsUpdate = (updater: (prev: Trip[]) => Trip[]) => {
    setTrips((prev) => {
      const next = updater(prev);
      if (next !== prev) {
        tripsRef.current = next;
        const activeId = currentTripIdRef.current;
        currentTripRef.current = activeId
          ? next.find((t) => t.id === activeId)
          : undefined;
      }
      return next;
    });
  };

  const {
    syncStatus,
    setSyncStatus,
    activeChannelRef,
    handleManualResync,
  } = useTripRealtime({
    user,
    userRef,
    currentTripId,
    currentTripIdRef,
    currentTrip,
    language,
    creatingTripRef,
    inFlightWritesRef,
    activeTripVersionRef,
    setTrips,
    commitTripsUpdate,
    setNotification,
    setError,
    navigateToList,
  });

  const t = (key: keyof typeof translations.en) =>
    (translations as any)[language][key] || (translations as any).en[key];

  useEffect(() => {
    if (!isDockScrubbingRef.current) setProfileMenuOpen(null);
  }, [view, currentTripId, activeTab]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop =
        profileMenuRef.current && profileMenuRef.current.contains(target);
      const insideMobile =
        mobileProfileMenuRef.current &&
        mobileProfileMenuRef.current.contains(target);
      if (!insideDesktop && !insideMobile) setProfileMenuOpen(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchLiveRatesToTwd();
    initThirdPartyScripts();
  }, []);

  useEffect(() => {
    applyPageSeo(
      view,
      language,
      view === "detail" ? currentTrip?.name : undefined
    );
  }, [view, language, currentTrip?.name]);

  useEffect(() => {
    if (isLoading) return;
    trackEvent("page_view", { page: view });
  }, [view, isLoading]);

  useEffect(() => {
    if (
      view === "detail" &&
      currentTrip &&
      !isOnboardingTourDone() &&
      postCreateGuideStep === "idle"
    ) {
      setIsOnboardingOpen(true);
    }
  }, [view, currentTrip?.id, postCreateGuideStep]);

  const isCreator = Boolean(
    user &&
      currentTrip &&
      (currentTrip.user_id === user.id || !currentTrip.user_id)
  );

  const isGuest = useMemo(() => {
    if (!user || !currentTrip) return true;
    const isOwner = currentTrip.user_id === user.id || !currentTrip.user_id;
    const isAllowed = currentTrip.allowed_emails?.some(
      (e) => e.toLowerCase() === user.email.toLowerCase()
    );
    return !(isOwner || isAllowed);
  }, [user, currentTrip]);

  const hasMissingFlightInfo = useMemo(() => {
    if (!currentTrip?.flights) return false;
    return currentTrip.flights.some((f) => {
      const hasPrice = f.price > 0;
      const bag = f.baggage || f.outbound.baggage;
      const checkBag = (b: any) => {
        if (!b) return true;
        const w = b.weight
          ? parseFloat(String(b.weight).replace(/[^0-9.]/g, "")) || 0
          : 0;
        const c = b.count || 0;
        return !((c > 0 && w <= 0) || (w > 0 && c <= 0));
      };
      return !hasPrice || !checkBag(bag?.carryOn) || !checkBag(bag?.checked);
    });
  }, [currentTrip]);

  const tabs: FloatingDockTab[] = [
    { id: "dashboard", label: t("overview"), icon: LayoutDashboard },
    { id: "itinerary", label: t("itinerary"), icon: Calendar },
    { id: "checklist", label: t("checklist"), icon: CheckSquare },
    { id: "expenses", label: t("expenses"), icon: DollarSign },
    {
      id: "flights",
      label: t("tickets"),
      icon: Plane,
      alert: hasMissingFlightInfo,
    },
  ];

  const selectTabWithDirection = (nextTabId: DetailTabId) => {
    const nextIdx = tabs.findIndex((tab) => tab.id === nextTabId);
    if (nextIdx !== -1 && nextIdx !== prevTabIndexRef.current) {
      setTabSlideDir(nextIdx > prevTabIndexRef.current ? "right" : "left");
      prevTabIndexRef.current = nextIdx;
    }
    setActiveTab(nextTabId);
  };

  useEffect(() => {
    const idx = tabs.findIndex((tab) => tab.id === activeTab);
    if (idx !== -1) prevTabIndexRef.current = idx;
  }, [activeTab]);

  // Handle PWA launch intents: Home Screen shortcuts (?shortcut=today|expenses|flights)
  useEffect(() => {
    if (isLoading || !pendingPwaIntent) return;

    if (pendingPwaIntent.type === "shortcut") {
      if (!user) return;
      if (trips.length === 0) return;

      const targetTrip = pickBestTripForShortcut(trips, currentTripId);
      if (targetTrip) {
        navigateToTrip(targetTrip.id);
        selectTabWithDirection(pendingPwaIntent.tab);
      }
      cleanPwaLaunchUrl(
        targetTrip ? `/trips/${encodeURIComponent(targetTrip.id)}` : "/trips"
      );
      setPendingPwaIntent(null);
    }
  }, [isLoading, pendingPwaIntent, user, trips, currentTripId, navigateToTrip]);

  const {
    isDeletingTrip,
    updateCurrentTrip,
    handleInvite,
    handleRemoveInvite,
    handleCreateTripSubmit,
    handleConfirmDeleteTrip,
    handleSaveBudget,
  } = useTripActions({
    user,
    currentTrip,
    currentTripId,
    tripsRef,
    language,
    t,
    creatingTripRef,
    inFlightWritesRef,
    activeTripVersionRef,
    activeChannelRef,
    tripToDelete,
    setTripToDelete,
    setTrips,
    commitTripsUpdate,
    setSyncStatus,
    setNotification,
    setError,
    setShowCreateForm,
    setIsEditingBudget,
    navigateToTrip,
    navigateToList,
    onTripCreatedWithFlight: (firstFlight) => {
      setGuideFlight(firstFlight);
      setPostCreateGuideStep("issuing");
    },
    onTripCreatedWithoutFlight: () => {
      setPostCreateGuideStep("idle");
      selectTabWithDirection("dashboard");
    },
  });

  const applyTemplateForUser = useCallback(
    async (
      templateId: string,
      activeUser: User,
      source: "demo" | "template"
    ) => {
      const rawTrip = createTripFromTemplate(
        templateId,
        activeUser.id,
        activeUser.name,
        language
      );
      const tripId = isValidUUID(rawTrip.id) ? rawTrip.id : crypto.randomUUID();
      const normalizedTrip: Trip = {
        ...rawTrip,
        id: tripId,
        flights: (rawTrip.flights || []).map((f) => ({
          ...f,
          id: isValidUUID(f.id) ? f.id : crypto.randomUUID(),
        })),
        checklist: (rawTrip.checklist || []).map((c) => ({
          ...c,
          id: isValidUUID(c.id) ? c.id : crypto.randomUUID(),
          trip_id: tripId,
        })),
        expenses: (rawTrip.expenses || []).map((e) => ({
          ...e,
          id: isValidUUID(e.id) ? e.id : crypto.randomUUID(),
          trip_id: tripId,
        })),
        itinerary: (rawTrip.itinerary || []).map((day) => ({
          ...day,
          items: day.items.map((item) => ({
            ...item,
            id: isValidUUID(item.id) ? item.id : crypto.randomUUID(),
            trip_id: tripId,
          })),
        })),
      };
      if (source === "demo") {
        trackEvent("try_demo_trip", { template_id: templateId });
      }
      trackEvent("use_template", { template_id: templateId });
      await handleCreateTripSubmit(normalizedTrip);
    },
    [language, handleCreateTripSubmit]
  );

  const handleUseTemplate = useCallback(
    async (
      templateId: string = "tokyo-3d",
      source: "demo" | "template" = "template"
    ) => {
      const activeUser = userRef.current;
      if (!activeUser) {
        try {
          sessionStorage.setItem(PENDING_TEMPLATE_STORAGE_KEY, templateId);
        } catch {
          // Ignore storage errors in restricted environments
        }
        setLoginReason(null);
        setIsLoginModalOpen(true);
        return;
      }
      await applyTemplateForUser(templateId, activeUser, source);
    },
    [applyTemplateForUser, setIsLoginModalOpen, setLoginReason, userRef]
  );

  useEffect(() => {
    if (isLoading || !user) return;
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(PENDING_TEMPLATE_STORAGE_KEY);
      if (pendingId) {
        sessionStorage.removeItem(PENDING_TEMPLATE_STORAGE_KEY);
      }
    } catch {
      pendingId = null;
    }
    if (!pendingId) return;
    setIsLoginModalOpen(false);
    void applyTemplateForUser(
      pendingId,
      user,
      pendingId === "tokyo-3d" ? "demo" : "template"
    );
  }, [isLoading, user, applyTemplateForUser, setIsLoginModalOpen]);

  const handleReplayOnboardingTour = useCallback(() => {
    resetOnboardingTour();
    if (view === "detail" && currentTrip) {
      setIsOnboardingOpen(true);
      return;
    }
    if (tripsRef.current.length > 0) {
      navigateToTrip(tripsRef.current[0].id);
      setIsOnboardingOpen(true);
      return;
    }
    setIsOnboardingOpen(true);
  }, [view, currentTrip, navigateToTrip, tripsRef]);

  const myUnpricedFlight =
    !isGuest && currentTrip && user
      ? currentTrip.flights?.find(
          (f) => f.user_id === user.id && (!f.price || f.price <= 0)
        )
      : undefined;

  const showMobilePriceCta =
    (postCreateGuideStep === "itinerary-hint" && activeTab === "itinerary") ||
    (Boolean(myUnpricedFlight) &&
      activeTab !== "flights" &&
      Boolean(currentTrip) &&
      !dismissedPricePromptTripIds[currentTrip!.id]);

  useEffect(() => {
    if (postCreateGuideStep === "idle" || postCreateGuideStep === "issuing")
      return;
    const expectedTab =
      postCreateGuideStep === "itinerary-hint" ? "itinerary" : "flights";
    if (view !== "detail" || activeTab !== expectedTab) {
      setPostCreateGuideStep("idle");
    }
  }, [postCreateGuideStep, activeTab, view]);

  const handleIssueContinue = () => {
    setPostCreateGuideStep("itinerary-hint");
    selectTabWithDirection("itinerary");
  };

  const handleGuideGoToPrice = () => {
    setGuideTargetFlightId(myUnpricedFlight?.id ?? guideFlight?.id ?? null);
    setPostCreateGuideStep("edit-price");
    selectTabWithDirection("flights");
  };

  const handleDismissPricePrompt = () => {
    setPostCreateGuideStep("idle");
    if (currentTrip) {
      const tripId = currentTrip.id;
      setDismissedPricePromptTripIds((prev) => ({ ...prev, [tripId]: true }));
    }
  };

  const handleGuidedPriceSaved = () => {
    setPostCreateGuideStep("idle");
    selectTabWithDirection("dashboard");
    setNotification({ message: t("guidePriceSaved"), type: "success" });
  };

  const screenFollowOffsetPx =
    dockDragSlot !== null
      ? -(dockDragSlot - Math.round(dockDragSlot)) * 56
      : 0;
  const tabTransitionClass =
    tabSlideDir === "right"
      ? "animate-tab-slide-right"
      : "animate-tab-slide-left";

  const spentTotal = currentTrip ? calculateTripTotal(currentTrip) : 0;
  const budgetLimit =
    currentTrip?.flights?.[0]?.budget || currentTrip?.budget || 50000;

  const collaboratorCount = useMemo(() => {
    if (!currentTrip) return 0;
    const allEmails = new Set<string>();
    currentTrip.allowed_emails?.forEach((e) => allEmails.add(e.toLowerCase()));
    return Math.max(1, allEmails.size);
  }, [currentTrip]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "zh" ? "en" : "zh"));
  }, []);

  const profileMenuContent = (
    <ProfileMenuContent
      user={user}
      showDetailOptions={Boolean(view === "detail" && currentTrip)}
      isCreator={isCreator}
      theme={theme}
      language={language}
      onToggleTheme={toggleTheme}
      onToggleLanguage={toggleLanguage}
      onOpenExport={() => setIsExportModalOpen(true)}
      onLogout={handleLogout}
      onOpenLogin={() => setIsLoginModalOpen(true)}
      onCloseMenu={() => setProfileMenuOpen(null)}
      onOpenInstallPwa={() => setIsInstallPwaOpen(true)}
      isPwaStandalone={isPwaStandalone}
      onOpenGuide={() => navigateToPublicPage("guide")}
      onReplayTour={handleReplayOnboardingTour}
    />
  );

  const headerProfileElement = (
    <HeaderProfileMenu
      user={user}
      isOpen={profileMenuOpen === "desktop"}
      menuRef={profileMenuRef}
      menuContent={profileMenuContent}
      onToggle={() =>
        setProfileMenuOpen((prev) => (prev === "desktop" ? null : "desktop"))
      }
      onOpenLogin={() => setIsLoginModalOpen(true)}
    />
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary mb-6" size={48} />
        <div className="font-black text-slate-400 uppercase tracking-widest text-[10px]">
          {t("syncing")}
        </div>
      </div>
    );
  }

  return (
    <LocalizationProvider value={{ t, language, setLanguage }}>
      <ErrorBoundary
        scope="app"
        resetKey={`${view}-${currentTripId || ""}`}
        title={t("errorBoundaryAppTitle")}
        description={t("errorBoundaryDesc")}
        retryLabel={t("errorBoundaryRetry")}
        detailsLabel={t("errorBoundaryDetails")}
      >
        <div
          className={`min-h-screen transition-all duration-500 ${
            theme === "dark"
              ? "dark bg-[#060709] text-slate-100"
              : "bg-[#FBFBFD] text-slate-900"
          }`}
        >
          {notification && (
            <NotificationToast
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification(null)}
            />
          )}

          {view === "landing" && (
            <LandingPage
              isLoggingIn={isLoggingIn}
              pendingTripId={pendingTripId}
              onGoogleLogin={handleLogin}
              onOpenEmailLogin={() => setIsLoginModalOpen(true)}
              onOpenPendingTripLogin={() => {
                setLoginReason("trip_access");
                setIsLoginModalOpen(true);
              }}
              onNavigatePublic={navigateToPublicPage}
            />
          )}

          {isPublicContentView(view) && (
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] dark:bg-[#0B0D11]">
                  <Loader2 className="animate-spin text-ns-blue" size={32} />
                </div>
              }
            >
              {view === "guide" && (
                <GuidePage
                  language={language}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onToggleLanguage={toggleLanguage}
                  onBack={() => (user ? navigateToList() : navigateToLanding())}
                  onNavigate={navigateToPublicPage}
                  onReplayTour={handleReplayOnboardingTour}
                  bottomSlot={<AdSlot slot="guide-bottom" language={language} />}
                />
              )}
              {view === "templates" && (
                <TemplatesPage
                  language={language}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onToggleLanguage={toggleLanguage}
                  onBack={() => (user ? navigateToList() : navigateToLanding())}
                  onNavigate={navigateToPublicPage}
                  onUseTemplate={(templateId) =>
                    void handleUseTemplate(templateId, "template")
                  }
                  bottomSlot={
                    <AdSlot slot="templates-bottom" language={language} />
                  }
                />
              )}
              {(view === "about" ||
                view === "privacy" ||
                view === "terms" ||
                view === "contact") && (
                <LegalPage
                  page={view}
                  language={language}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onToggleLanguage={toggleLanguage}
                  onBack={() => (user ? navigateToList() : navigateToLanding())}
                  onNavigate={navigateToPublicPage}
                />
              )}
            </Suspense>
          )}

          {postCreateGuideStep === "issuing" && guideFlight && (
            <BoardingPassIssueModal
              flight={guideFlight}
              onContinue={handleIssueContinue}
            />
          )}

          {view === "detail" && currentTrip && (
            <div className="min-h-screen flex flex-col pb-28 sm:pb-32 md:pb-0">
              <TripHeader
                trip={currentTrip}
                collaboratorCount={collaboratorCount}
                syncStatus={syncStatus}
                showMobilePriceCta={showMobilePriceCta}
                tabs={tabs}
                activeTab={activeTab}
                isGuest={isGuest}
                headerProfileElement={headerProfileElement}
                onBack={() => (user ? navigateToList() : navigateToLanding())}
                onManualResync={handleManualResync}
                onGuideGoToPrice={handleGuideGoToPrice}
                onDismissPricePrompt={handleDismissPricePrompt}
                onSelectTab={selectTabWithDirection}
                onOpenShare={() => setIsShareModalOpen(true)}
              />

              {!user && (
                <div className="bg-gradient-to-r from-amber-500/10 via-primary/10 to-amber-500/5 border-b border-amber-500/20 px-4 py-2.5">
                  <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                      <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span>
                        {t("guestBannerText")} {t("previewModeNotice")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLoginModalOpen(true)}
                      className="shrink-0 whitespace-nowrap bg-primary hover:bg-primary/90 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      {t("loginToJoin")}
                    </button>
                  </div>
                </div>
              )}

              <TripDetailTabs
                trip={currentTrip}
                user={user}
                activeTab={activeTab}
                isCreator={isCreator}
                isGuest={isGuest}
                spentTotal={spentTotal}
                budgetLimit={budgetLimit}
                screenFollowOffsetPx={screenFollowOffsetPx}
                isDockDragging={dockDragSlot !== null}
                tabTransitionClass={tabTransitionClass}
                showItineraryGuideBanner={
                  postCreateGuideStep === "itinerary-hint"
                }
                autoEditFlightId={
                  postCreateGuideStep === "edit-price"
                    ? guideTargetFlightId
                    : null
                }
                onUpdateTrip={updateCurrentTrip}
                onEditBudget={() => setIsEditingBudget(true)}
                onDeleteTripClick={(target) => setTripToDelete(target)}
                onGuideGoToPrice={handleGuideGoToPrice}
                onDismissItineraryGuide={() => setPostCreateGuideStep("idle")}
                onGuidedPriceSaved={handleGuidedPriceSaved}
              />

              {isShareModalOpen && user && !isGuest && (
                <ShareModal
                  trip={currentTrip}
                  user={user}
                  onClose={() => setIsShareModalOpen(false)}
                  onInvite={async (email) => {
                    await handleInvite(email);
                    trackEvent("share_trip", {
                      method: "invite",
                      trip_id: currentTrip.id,
                    });
                  }}
                  onRemoveInvite={handleRemoveInvite}
                  copyLink={() => {
                    navigator.clipboard.writeText(
                      buildTripShareUrl(currentTrip.id)
                    );
                    trackEvent("share_trip", {
                      method: "copy_link",
                      trip_id: currentTrip.id,
                    });
                    setNotification({ message: t("copied"), type: "success" });
                  }}
                />
              )}

              {isExportModalOpen && currentTrip && (
                <ExportModal
                  trip={currentTrip}
                  isOpen={isExportModalOpen}
                  onClose={() => setIsExportModalOpen(false)}
                  onNotify={(message, type) => {
                    if (type === "success") {
                      trackEvent("export_artifact", {
                        trip_id: currentTrip.id,
                      });
                    }
                    setNotification({ message, type });
                  }}
                />
              )}

              {isEditingBudget && !isGuest && (
                <BudgetModal
                  initialValue={budgetLimit.toString()}
                  onClose={() => setIsEditingBudget(false)}
                  onSave={handleSaveBudget}
                />
              )}

              <FloatingDock
                tabs={tabs}
                activeTab={activeTab}
                user={user}
                isProfileMenuOpen={profileMenuOpen === "mobile"}
                dockDragSlot={dockDragSlot}
                mobileProfileMenuRef={mobileProfileMenuRef}
                profileMenuContent={profileMenuContent}
                onSelectTab={selectTabWithDirection}
                onCloseProfileMenu={() => setProfileMenuOpen(null)}
                onOpenProfileMenu={() => setProfileMenuOpen("mobile")}
                onToggleProfileMenu={() =>
                  setProfileMenuOpen((prev) =>
                    prev === "mobile" ? null : "mobile"
                  )
                }
                onDockDragSlotChange={setDockDragSlot}
                onScrubbingChange={(scrubbing) => {
                  isDockScrubbingRef.current = scrubbing;
                }}
              />
            </div>
          )}

          {view === "detail" && !currentTrip && !isLoading && (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-sm border border-slate-200/60 dark:border-white/10">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {t("tripNotFound")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                {t("tripNotFoundDesc")}
              </p>
              <button
                type="button"
                onClick={() => (user ? navigateToList() : navigateToLanding())}
                className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                {t("backHome")}
              </button>
            </div>
          )}

          {view === "list" && (
            <TripsListView
              trips={trips}
              currentUserId={user?.id}
              syncStatus={syncStatus}
              error={error}
              showCreateForm={showCreateForm}
              headerProfile={headerProfileElement}
              onManualResync={handleManualResync}
              onOpenCreateForm={() => setShowCreateForm(true)}
              onCloseCreateForm={() => setShowCreateForm(false)}
              onCreateTripSubmit={async (tripData) => {
                await handleCreateTripSubmit(tripData);
                trackEvent("create_trip", {
                  destination: tripData.destination,
                });
              }}
              onSelectTrip={navigateToTrip}
              onDeleteTripClick={(target) => setTripToDelete(target)}
              calculateTripTotal={calculateTripTotal}
              getGradient={getGradient}
              onTryDemoTrip={() => void handleUseTemplate("tokyo-3d", "demo")}
              onNavigatePublic={navigateToPublicPage}
            />
          )}

          <DeleteTripModal
            isOpen={Boolean(tripToDelete)}
            trip={tripToDelete}
            currentUserId={user?.id}
            onClose={() => setTripToDelete(null)}
            onConfirm={handleConfirmDeleteTrip}
            isDeleting={isDeletingTrip}
          />

          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => {
              setIsLoginModalOpen(false);
              setLoginReason(null);
            }}
            redirectTripId={pendingTripId || currentTripId}
            reason={loginReason}
          />

          <InstallPwaPromptModal
            isOpen={isInstallPwaOpen}
            onClose={() => setIsInstallPwaOpen(false)}
            canNativeInstall={canNativeInstall}
            onNativeInstall={triggerNativeInstall}
            envOverride={pwaEnv}
          />

          {pendingPwaIntent?.type === "share-target" && user && (
            <ShareTargetModal
              isOpen={true}
              initialTitle={pendingPwaIntent.title}
              initialText={pendingPwaIntent.text}
              initialUrl={
                pendingPwaIntent.extractedUrl || pendingPwaIntent.url
              }
              trips={trips}
              defaultTripId={currentTripId}
              currentUserId={user.id}
              onSave={(updatedTrip, savedItem) => {
                updateCurrentTrip(updatedTrip, "ADD_ITINERARY_ITEM");
                navigateToTrip(updatedTrip.id);
                selectTabWithDirection("itinerary");
                setNotification({
                  message: t("pwaShareSavedToast").replace(
                    "{name}",
                    savedItem.placeName
                  ),
                  type: "success",
                });
                cleanPwaLaunchUrl(
                  `/trips/${encodeURIComponent(updatedTrip.id)}`
                );
                setPendingPwaIntent(null);
              }}
              onClose={() => {
                cleanPwaLaunchUrl(
                  currentTripId
                    ? `/trips/${encodeURIComponent(currentTripId)}`
                    : "/trips"
                );
                setPendingPwaIntent(null);
              }}
            />
          )}

          <OnboardingTour
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            language={language}
            onNavigateTab={(tab) => {
              if (view === "detail" && currentTrip) {
                selectTabWithDirection(tab);
              }
            }}
          />

          <CookieConsentBanner
            language={language}
            onNavigatePrivacy={() => navigateToPublicPage("privacy")}
          />
        </div>
      </ErrorBoundary>
    </LocalizationProvider>
  );
};

export default App;
