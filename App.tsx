import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  Trip,
  FlightInfo,
  Theme,
  Language,
  User,
  ChecklistItem,
} from "./types";
import {
  getTrips,
  getTripById,
  deleteTrip,
  joinTrip,
  leaveTrip,
  removeCollaboratorByEmail,
  ensureChecklistItems,
  createFullTrip,
  deleteExpense,
  deleteItineraryItem,
  deleteFlight,
  deleteChecklistItem,
  updateChecklistItem,
  addChecklistItem,
  upsertItineraryItems,
  upsertExpense,
  upsertFlight,
  upsertChecklistItems,
  updateTripMeta,
  findUserIdByEmail,
  mapDbChecklistRow,
  mapDbItineraryRow,
  mapDbExpenseRow,
  mapDbFlightRow,
  supabase,
} from "./services/storageService";
import {
  diffTripChanges,
  applyTripDelta,
  revertTripDelta,
  createEmptyTripDelta,
  TripDelta,
} from "./services/tripDiffService";
import {
  parseSupabaseUser,
  signInWithGoogle,
  signOutSafely,
  consumeRedirectTripId,
  saveRedirectTripId,
  isSupabaseConfigured,
} from "./services/authService";
import { buildTripShareUrl } from "./services/routerService";
import {
  fetchLiveRatesToTwd,
  getRateToTwd,
  resolveHistoricalFlightRate,
} from "./services/exchangeRateService";
import {
  LocalizationProvider,
  translations,
} from "./contexts/LocalizationContext";
import { useTripRouter } from "./hooks/useTripRouter";
import { CATEGORY_UI, getCategoryName } from "./components/ExpenseCategories";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingPage } from "./components/LandingPage";
import { TripsListView } from "./components/TripsListView";
import { MobileHero } from "./components/MobileHero";
import {
  FloatingDock,
  DetailTabId,
  FloatingDockTab,
} from "./components/FloatingDock";
import { BoardingPassIssueModal } from "./components/BoardingPassIssueModal";
import { NotificationToast } from "./components/NotificationToast";
import { BudgetModal } from "./components/BudgetModal";
import { ShareModal } from "./components/ShareModal";
import { LoginModal, LoginReason } from "./components/LoginModal";
import { DeleteTripModal } from "./components/DeleteTripModal";
import { ExportModal } from "./components/ExportModal";
import {
  Plane,
  Calendar,
  CheckSquare,
  DollarSign,
  ChevronLeft,
  LogOut,
  Loader2,
  LayoutDashboard,
  Moon,
  Sun,
  Languages,
  Share2,
  Edit2,
  Clock,
  MapPin,
  Wallet,
  Users,
  Trash2,
  X,
  PieChart as PieChartIcon,
  AlertCircle,
  FileText,
  MoreHorizontal,
  User as UserIcon,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const Checklist = React.lazy(() =>
  import("./components/Checklist").then((m) => ({ default: m.Checklist }))
);
const Itinerary = React.lazy(() =>
  import("./components/Itinerary").then((m) => ({ default: m.Itinerary }))
);
const Expenses = React.lazy(() =>
  import("./components/Expenses").then((m) => ({ default: m.Expenses }))
);
const FlightManager = React.lazy(() =>
  import("./components/FlightManager").then((m) => ({
    default: m.FlightManager,
  }))
);

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
    "from-[#0A84FF] via-[#0051D5] to-[#002B7F]",
    "from-[#5E5CE6] via-[#3634A3] to-[#1D1B5E]",
    "from-[#00C7BE] via-[#007AFF] to-[#003B80]",
    "from-[#FF6B4A] via-[#D9381E] to-[#6E1409]",
    "from-[#10B981] via-[#059669] to-[#064E3B]",
    "from-[#8B5CF6] via-[#6D28D9] to-[#2E1065]",
    "from-[#0284C7] via-[#1D4ED8] to-[#1E1B4B]",
  ];
  return colors[Math.abs(hash) % colors.length];
};

type PostCreateGuideStep = "idle" | "issuing" | "itinerary-hint" | "edit-price";
type SyncStatus = "synced" | "syncing" | "offline" | "error";

const isNavigatorOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const TabSkeleton: React.FC = () => (
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    isNavigatorOffline() ? "offline" : "synced"
  );
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
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const [loginReason, setLoginReason] = useState<LoginReason>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<
    "desktop" | "mobile" | null
  >(null);
  const [dockDragSlot, setDockDragSlot] = useState<number | null>(null);
  const [tabSlideDir, setTabSlideDir] = useState<"left" | "right">("right");

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const prevTabIndexRef = useRef<number>(0);
  const isDockScrubbingRef = useRef<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const joinLockRef = useRef<string | null>(null);
  const creatingTripRef = useRef(false);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const inFlightWritesRef = useRef<number>(0);
  const latestRefreshSeqRef = useRef<number>(0);
  const latestLoadTripsSeqRef = useRef<number>(0);
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
    parseCurrentRoute,
    replaceRouteUrl,
  } = useTripRouter({ isLoading, userRef });

  // Preserve user object reference across background token refreshes to avoid breaking subscriptions
  const setSafeUser = (newUser: User | null) => {
    setUser((prev) => {
      if (!newUser) return null;
      if (
        prev &&
        prev.id === newUser.id &&
        prev.email === newUser.email &&
        prev.name === newUser.name
      ) {
        return prev;
      }
      return newUser;
    });
  };

  const currentTrip = trips.find((t) => t.id === currentTripId);
  const currentTripRef = useRef<Trip | undefined>(currentTrip);
  currentTripRef.current = currentTrip;

  // Close profile menu when view, active trip, or active tab changes (unless actively scrubbing dock)
  useEffect(() => {
    if (!isDockScrubbingRef.current) {
      setProfileMenuOpen(null);
    }
  }, [view, currentTripId, activeTab]);

  // Dismiss profile dropdown on outside click or Escape key press
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop =
        profileMenuRef.current && profileMenuRef.current.contains(target);
      const insideMobile =
        mobileProfileMenuRef.current &&
        mobileProfileMenuRef.current.contains(target);
      if (!insideDesktop && !insideMobile) {
        setProfileMenuOpen(null);
      }
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

  // Auto-join logic: ensure invited users join properly and generate checklist on first visit
  useEffect(() => {
    if (!currentTripId || !user || !currentTrip) return;
    const isOwner = currentTrip.user_id === user.id;
    const isAllowed = currentTrip.allowed_emails?.some(
      (e: string) => e.toLowerCase() === user.email.toLowerCase()
    );
    const isJoined = currentTrip.collaborators?.some(
      (c) => c.user_id === user.id
    );

    if (!isOwner && isAllowed && !isJoined && joinLockRef.current !== currentTripId) {
      joinLockRef.current = currentTripId;
      joinTrip(currentTripId, user.id, user.email).then(() => {
        getTripById(currentTripId).then((updated) => {
          if (!updated) return;
          setTrips((prev) => {
            const idx = prev.findIndex((t) => t.id === updated.id);
            if (idx > -1) {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            return [updated, ...prev];
          });
        });
      });
      setTimeout(() => {
        joinLockRef.current = null;
      }, 5000);
    }
  }, [currentTripId, user, currentTrip]);

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

  const refreshActiveTrip = async (): Promise<boolean> => {
    const activeTripId = currentTripIdRef.current;
    const activeUser = userRef.current;
    if (!activeTripId || !activeUser) return true;
    const seq = ++latestRefreshSeqRef.current;

    try {
      const updatedTrip = await getTripById(activeTripId);
      if (seq !== latestRefreshSeqRef.current) return true;

      if (!updatedTrip) {
        setNotification({
          message: translations[language].tripNotFound || "Trip not found",
          type: "error",
        });
        navigateToList();
        setTrips((prev) => prev.filter((t) => t.id !== activeTripId));
        return true;
      }

      const isOwner = updatedTrip.user_id === activeUser.id;
      const isAllowed = updatedTrip.allowed_emails?.some(
        (e: string) => e.toLowerCase() === activeUser.email.toLowerCase()
      );

      if (!isOwner && !isAllowed) {
        setNotification({
          message: translations[language].revoked || "Access Revoked",
          type: "error",
        });
        setTrips((prev) => prev.filter((t) => t.id !== activeTripId));
        navigateToList();
        return true;
      }

      activeTripVersionRef.current += 1;
      commitTripsUpdate((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedTrip.id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = updatedTrip;
          return next;
        }
        return [updatedTrip, ...prev];
      });
      return true;
    } catch (e) {
      console.error("Refresh failed:", e);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      return false;
    }
  };

  const loadTrips = async (): Promise<boolean> => {
    const activeUser = userRef.current;
    if (!activeUser) return true;
    const loadSeq = ++latestLoadTripsSeqRef.current;
    const activeTripIdAtStart = currentTripIdRef.current;
    const activeTripVersionAtStart = activeTripVersionRef.current;
    try {
      const userTrips = await getTrips(activeUser.id, activeUser.email);
      if (loadSeq !== latestLoadTripsSeqRef.current) return true;
      if (creatingTripRef.current) return true;
      const uniqueTrips = Array.from(
        new globalThis.Map(userTrips.map((t) => [t.id, t])).values()
      );
      commitTripsUpdate((prev) => {
        const activeId = currentTripIdRef.current;
        const shouldPreserveActive =
          Boolean(activeId) &&
          (inFlightWritesRef.current > 0 ||
            activeId !== activeTripIdAtStart ||
            activeTripVersionRef.current !== activeTripVersionAtStart);
        const prevActiveTrip = shouldPreserveActive
          ? prev.find((t) => t.id === activeId)
          : undefined;
        return uniqueTrips.map((t) =>
          prevActiveTrip && t.id === prevActiveTrip.id ? prevActiveTrip : t
        );
      });
      setError(null);
      return true;
    } catch (err: any) {
      if (loadSeq !== latestLoadTripsSeqRef.current) return true;
      console.warn("[Storage] loadTrips caught error:", err);
      setTrips((prev) => {
        if (prev.length === 0) {
          setError(err.message || "Failed to load trips");
        }
        return prev;
      });
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      return false;
    }
  };

  const handleManualResync = async () => {
    if (isNavigatorOffline()) {
      setSyncStatus("offline");
      return;
    }
    if (!userRef.current) {
      setSyncStatus("synced");
      return;
    }

    setSyncStatus("syncing");
    try {
      const results = await Promise.all([
        currentTripIdRef.current ? refreshActiveTrip() : Promise.resolve(true),
        loadTrips(),
      ]);
      const allOk = results.every(Boolean);
      if (isNavigatorOffline()) {
        setSyncStatus("offline");
      } else if (!allOk) {
        setSyncStatus("error");
      } else if (inFlightWritesRef.current === 0) {
        setSyncStatus("synced");
      }
    } catch (err) {
      console.error("[Sync] Resync failed:", err);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
    }
  };

  const resyncAllRef = useRef<() => Promise<void>>(handleManualResync);
  resyncAllRef.current = handleManualResync;

  // Browser online/offline & tab visibility reconnect resync
  useEffect(() => {
    const handleOffline = () => setSyncStatus("offline");
    const handleOnline = () => {
      if (userRef.current) {
        resyncAllRef.current();
      } else {
        setSyncStatus("synced");
      }
    };
    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        if (isNavigatorOffline()) {
          setSyncStatus("offline");
          return;
        }
        if (userRef.current) {
          resyncAllRef.current();
        }
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!currentTripId || !user) return;
    refreshActiveTrip();
  }, [currentTripId, user]);

  // Real-time incremental sync for active trip
  useEffect(() => {
    if (!currentTripId || !user) return;

    let isDisposed = false;
    let channelHadDrop = false;

    const patchActiveTrip = (
      predicate: (target: Trip) => boolean,
      updater: (target: Trip) => Trip
    ) => {
      commitTripsUpdate((prevTrips) => {
        const target = prevTrips.find((t) => t.id === currentTripId);
        if (!target || !predicate(target)) return prevTrips;
        activeTripVersionRef.current += 1;
        return prevTrips.map((t) => (t.id === currentTripId ? updater(t) : t));
      });
    };

    const patchTripItineraryUpsert = (
      mapped: ReturnType<typeof mapDbItineraryRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const nextItinerary = (t.itinerary || []).map((day) => {
            const withoutItem = day.items.filter(
              (item) => item.id !== mapped.id
            );
            if (day.date === mapped.date) {
              const merged = [...withoutItem, mapped].sort((a, b) =>
                (a.time || "").localeCompare(b.time || "")
              );
              return { ...day, items: merged };
            }
            return withoutItem.length === day.items.length
              ? day
              : { ...day, items: withoutItem };
          });
          return { ...t, itinerary: nextItinerary };
        })
      );
    };

    const patchTripExpenseUpsert = (
      mapped: ReturnType<typeof mapDbExpenseRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const existing = t.expenses || [];
          const hasExisting = existing.some((e) => e.id === mapped.id);
          return {
            ...t,
            expenses: hasExisting
              ? existing.map((e) => (e.id === mapped.id ? mapped : e))
              : [mapped, ...existing],
          };
        })
      );
    };

    const patchTripFlightUpsert = (
      mapped: ReturnType<typeof mapDbFlightRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const existing = t.flights || [];
          const hasExisting = existing.some((f) => f.id === mapped.id);
          return {
            ...t,
            flights: hasExisting
              ? existing.map((f) => (f.id === mapped.id ? mapped : f))
              : [...existing, mapped],
          };
        })
      );
    };

    const channel = supabase
      .channel(`realtime-sync-${currentTripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `id=eq.${currentTripId}`,
        },
        async () => {
          refreshActiveTrip();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            const mapped = mapDbChecklistRow(newRow);
            activeTripVersionRef.current += 1;
            commitTripsUpdate((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                if ((t.checklist || []).some((item) => item.id === mapped.id))
                  return t;
                return { ...t, checklist: [...(t.checklist || []), mapped] };
              })
            );
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            const mapped = mapDbChecklistRow(updatedRow);
            activeTripVersionRef.current += 1;
            commitTripsUpdate((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                return {
                  ...t,
                  checklist: (t.checklist || []).map((item) =>
                    item.id === mapped.id
                      ? {
                          ...item,
                          isCompleted: mapped.isCompleted,
                          text: mapped.text ?? item.text,
                          category: mapped.category ?? item.category,
                        }
                      : item
                  ),
                };
              })
            );
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "checklist_items" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) =>
              (target.checklist || []).some((item) => item.id === deletedId),
            (t) => ({
              ...t,
              checklist: (t.checklist || []).filter(
                (item) => item.id !== deletedId
              ),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id && newRow?.date) {
            patchTripItineraryUpsert(mapDbItineraryRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id && updatedRow?.date) {
            patchTripItineraryUpsert(mapDbItineraryRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "itinerary_items" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) =>
              (target.itinerary || []).some((day) =>
                day.items.some((item) => item.id === deletedId)
              ),
            (t) => ({
              ...t,
              itinerary: (t.itinerary || []).map((day) => ({
                ...day,
                items: day.items.filter((item) => item.id !== deletedId),
              })),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            patchTripExpenseUpsert(mapDbExpenseRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            patchTripExpenseUpsert(mapDbExpenseRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "expenses" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) => (target.expenses || []).some((e) => e.id === deletedId),
            (t) => ({
              ...t,
              expenses: (t.expenses || []).filter((e) => e.id !== deletedId),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            patchTripFlightUpsert(mapDbFlightRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            patchTripFlightUpsert(mapDbFlightRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "flights" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) => (target.flights || []).some((f) => f.id === deletedId),
            (t) => ({
              ...t,
              flights: (t.flights || []).filter((f) => f.id !== deletedId),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_collaborators",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on("broadcast", { event: "EXPENSE_DELETED" }, (payload) => {
        const deletedId = payload.payload?.id;
        if (deletedId) {
          patchActiveTrip(
            (target) => (target.expenses || []).some((e) => e.id === deletedId),
            (t) => ({
              ...t,
              expenses: (t.expenses || []).filter((e) => e.id !== deletedId),
            })
          );
        } else {
          refreshActiveTrip();
        }
      })
      .on("broadcast", { event: "ACCESS_REVOKED" }, (payload) => {
        if (
          payload.payload?.email?.toLowerCase() === user?.email?.toLowerCase()
        ) {
          setNotification({
            message: translations[language].revoked || "Access Revoked",
            type: "error",
          });
          setTrips((prev) => prev.filter((t) => t.id !== currentTripId));
          navigateToList();
        } else {
          refreshActiveTrip();
        }
      })
      .on("broadcast", { event: "TRIP_DELETED" }, () => {
        setNotification({
          message: translations[language].tripNotFound || "Trip deleted",
          type: "info",
        });
        navigateToList();
      })
      .subscribe((status) => {
        if (isDisposed) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          channelHadDrop = true;
          setSyncStatus(isNavigatorOffline() ? "offline" : "error");
        } else if (status === "CLOSED") {
          channelHadDrop = true;
        } else if (status === "SUBSCRIBED") {
          if (channelHadDrop) {
            channelHadDrop = false;
            if (!isNavigatorOffline()) {
              resyncAllRef.current();
            }
          } else if (!isNavigatorOffline() && inFlightWritesRef.current === 0) {
            setSyncStatus((prev) =>
              prev === "error" || prev === "offline" ? "synced" : prev
            );
          }
        }
      });

    activeChannelRef.current = channel;

    return () => {
      isDisposed = true;
      supabase.removeChannel(channel);
      activeChannelRef.current = null;
    };
  }, [currentTripId, user]);

  // Global subscription for new invites or removals
  useEffect(() => {
    if (!user) return;

    const refreshList = async () => {
      if (creatingTripRef.current) return;
      await loadTrips();
    };

    const channel = supabase
      .channel(`global-trips-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (payload) => {
          if (
            !currentTripId ||
            (payload.new && (payload.new as any).id !== currentTripId) ||
            payload.eventType === "INSERT"
          ) {
            refreshList();
          } else {
            refreshActiveTrip();
            refreshList();
          }
        }
      )
      .on("broadcast", { event: "ACCESS_REVOKED_GLOBAL" }, (payload) => {
        const revokedTripId = payload.payload?.tripId;
        if (revokedTripId) {
          setTrips((prev) => prev.filter((t) => t.id !== revokedTripId));
          if (currentTripId === revokedTripId) {
            setNotification({
              message: translations[language].revoked || "Access Revoked",
              type: "error",
            });
            navigateToList();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTripId]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchLiveRatesToTwd();
  }, []);

  const handleAuthUser = async (supabaseUser: any) => {
    const parsedUser = parseSupabaseUser(supabaseUser);
    setSafeUser(parsedUser);

    const parsedRoute = parseCurrentRoute();
    const urlTripId = parsedRoute.tripId || consumeRedirectTripId();

    if (urlTripId) {
      const isAlreadyViewing = currentTripIdRef.current === urlTripId;
      if (!isAlreadyViewing) setIsLoading(true);
      try {
        const trip = await getTripById(urlTripId);
        if (trip) {
          const userEmailLower = parsedUser.email.toLowerCase();
          const isOwner = trip.user_id === parsedUser.id;
          const isAllowed = trip.allowed_emails?.some(
            (e) => e.toLowerCase() === userEmailLower
          );

          if (isOwner || isAllowed) {
            setCurrentTripId(urlTripId);
            setTrips((prev) =>
              prev.some((t) => t.id === trip.id) ? prev : [trip, ...prev]
            );
            replaceRouteUrl("detail", urlTripId);
            setView("detail");
          } else {
            replaceRouteUrl("list", null);
            setNotification({
              message:
                translations[language].noPermissionRedirect ||
                "您沒有此行程的存取權限，已為您跳轉至您的行程頁面",
              type: "error",
            });
            setView("list");
          }
        } else {
          replaceRouteUrl("list", null);
          setNotification({
            message:
              translations[language].tripNotFoundRedirect ||
              "找不到此行程或無權限存取，已為您跳轉至您的行程頁面",
            type: "error",
          });
          setView("list");
        }
      } catch {
        replaceRouteUrl("list", null);
        setView("list");
      } finally {
        setIsLoading(false);
      }
    } else {
      replaceRouteUrl("list", null);
      setView("list");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 10000);

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (sessionError) console.warn("[Auth] getSession error:", sessionError);

        if (session?.user) {
          await handleAuthUser(session.user);
        } else if (!window.location.hash.includes("access_token")) {
          const parsedRoute = parseCurrentRoute();
          const urlTripId = parsedRoute.tripId;
          if (urlTripId) {
            saveRedirectTripId(urlTripId);
            setPendingTripId(urlTripId);
            replaceRouteUrl("landing", null);
            setNotification({
              message:
                translations[language].loginRequiredRedirect ||
                "此行程需要登入存取，已為您前往登入主頁",
              type: "info",
            });
            setLoginReason("trip_access");
            setIsLoginModalOpen(true);
          } else if (parsedRoute.view === "list") {
            replaceRouteUrl("landing", null);
            setIsLoginModalOpen(true);
          }

          if (isMounted) {
            setUser(null);
            navigateToLanding();
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn("[Auth] getSession unexpected failure:", err);
        if (isMounted) {
          setView("landing");
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_IN" && session?.user) {
        if (userRef.current?.id === session.user.id) {
          setSafeUser(parseSupabaseUser(session.user));
          return;
        }
        await handleAuthUser(session.user);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSafeUser(parseSupabaseUser(session.user));
      } else if (event === "SIGNED_OUT") {
        const activeTripId = currentTripIdRef.current;
        replaceRouteUrl("landing", null);
        if (activeTripId) {
          saveRedirectTripId(activeTripId);
          setPendingTripId(activeTripId);
        }
        setUser(null);
        setTrips([]);
        navigateToLanding();
        setIsLoading(false);
        setNotification({
          message:
            translations[language].sessionExpired || "登入已過期，請重新登入",
          type: "info",
        });
        setLoginReason("session_expired");
        setIsLoginModalOpen(true);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    if (!isSupabaseConfigured()) {
      setNotification({
        message:
          translations[language].configMissing ||
          "Supabase configuration is missing",
        type: "error",
      });
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithGoogle(pendingTripId || currentTripId);
    } catch (loginError: any) {
      console.error("Error logging in:", loginError);
      setIsLoggingIn(false);
      setNotification({
        message:
          loginError?.message ||
          translations[language].loginFailed ||
          "Failed to log in",
        type: "error",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSafely();
    } catch (logoutError) {
      console.warn("Logout error:", logoutError);
    } finally {
      setUser(null);
      setTrips([]);
      navigateToLanding();
      setIsLoading(false);
      setNotification({
        message: translations[language].logoutSuccess || "Logged out",
        type: "info",
      });
    }
  };

  const isCreator =
    user &&
    currentTrip &&
    (currentTrip.user_id === user.id || !currentTrip.user_id);

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

  const t = (key: keyof typeof translations.en) =>
    (translations as any)[language][key] || (translations as any).en[key];

  const updateCurrentTrip = (
    updatedTrip: Trip,
    action?: string,
    payload?: any
  ) => {
    if (!user) return;

    if (action === "SHOW_ERROR_TOAST") {
      setNotification({
        message:
          typeof payload === "string"
            ? payload
            : translations[language].errorTitle || "Error occurred",
        type: "error",
      });
      return;
    }

    const previousTrip = tripsRef.current.find((t) => t.id === updatedTrip.id);
    if (!previousTrip) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    let effectiveDelta: TripDelta;
    if (action === "DELETE_EXPENSE" && payload) {
      effectiveDelta = {
        ...createEmptyTripDelta(),
        deletedExpenseIds: [payload],
        hasChanges: true,
      };
    } else if (action === "DELETE_ITINERARY_ITEM" && payload) {
      const ids: string[] = Array.isArray(payload) ? payload : [payload];
      const itineraryOnlyDiff = diffTripChanges(previousTrip, {
        ...previousTrip,
        itinerary: updatedTrip.itinerary,
      });
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedItinerary: itineraryOnlyDiff.addedOrUpdatedItinerary,
        deletedItineraryIds: ids,
        hasChanges:
          ids.length > 0 || itineraryOnlyDiff.addedOrUpdatedItinerary.length > 0,
      };
    } else if (action === "UPDATE_CHECKLIST_ITEM" && payload) {
      const existingItem = (previousTrip.checklist || []).find(
        (c) => c.id === payload.id
      );
      const updatedChecklistItem: ChecklistItem | undefined = existingItem
        ? { ...existingItem, isCompleted: payload.isCompleted }
        : (updatedTrip.checklist || []).find((c) => c.id === payload.id);
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedChecklist: updatedChecklistItem
          ? [updatedChecklistItem]
          : [],
        hasChanges: Boolean(updatedChecklistItem),
      };
    } else if (action === "ADD_CHECKLIST_ITEM" && payload) {
      const items: ChecklistItem[] = Array.isArray(payload)
        ? payload
        : [payload];
      if (items.length === 0) return;
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedChecklist: items,
        hasChanges: true,
      };
    } else if (action === "DELETE_CHECKLIST_ITEM" && payload) {
      effectiveDelta = {
        ...createEmptyTripDelta(),
        deletedChecklistIds: [payload],
        hasChanges: true,
      };
    } else if (
      action === "ADD_ITINERARY_ITEM" ||
      action === "UPDATE_ITINERARY_ITEM" ||
      action === "SAVE_ITINERARY_ITEM"
    ) {
      const itineraryOnlyDiff = diffTripChanges(previousTrip, {
        ...previousTrip,
        itinerary: updatedTrip.itinerary,
      });
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedItinerary: itineraryOnlyDiff.addedOrUpdatedItinerary,
        hasChanges: itineraryOnlyDiff.addedOrUpdatedItinerary.length > 0,
      };
    } else {
      effectiveDelta = diffTripChanges(previousTrip, updatedTrip);
    }

    if (!effectiveDelta.hasChanges) return;

    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) =>
        t.id === updatedTrip.id ? applyTripDelta(t, effectiveDelta) : t
      )
    );

    const runGranularWrite = (
      writeFn: () => Promise<void>,
      fallbackErrorMessage: string
    ) => {
      inFlightWritesRef.current += 1;
      if (!isNavigatorOffline()) setSyncStatus("syncing");
      writeFn()
        .then(() => {
          inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
          if (inFlightWritesRef.current === 0) {
            setSyncStatus(isNavigatorOffline() ? "offline" : "synced");
          }
        })
        .catch((err) => {
          inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
          console.error("[App] Granular write failed:", err);
          activeTripVersionRef.current += 1;
          commitTripsUpdate((prev) =>
            prev.map((t) =>
              t.id === updatedTrip.id
                ? revertTripDelta(t, previousTrip, effectiveDelta)
                : t
            )
          );
          setSyncStatus(isNavigatorOffline() ? "offline" : "error");
          setNotification({
            message: translations[language].errorTitle || fallbackErrorMessage,
            type: "error",
          });
        });
    };

    if (action === "DELETE_EXPENSE" && payload) {
      runGranularWrite(async () => {
        await deleteExpense(payload, updatedTrip.id);
        activeChannelRef.current?.send({
          type: "broadcast",
          event: "EXPENSE_DELETED",
          payload: { id: payload },
        });
      }, "Sync error: Failed to delete expense");
      return;
    }

    if (action === "DELETE_ITINERARY_ITEM" && payload) {
      runGranularWrite(async () => {
        const tasks: Promise<void>[] = effectiveDelta.deletedItineraryIds.map(
          (id) => deleteItineraryItem(id, updatedTrip.id)
        );
        if (effectiveDelta.addedOrUpdatedItinerary.length > 0) {
          tasks.push(
            upsertItineraryItems(
              updatedTrip.id,
              user.id,
              effectiveDelta.addedOrUpdatedItinerary
            )
          );
        }
        await Promise.all(tasks);
      }, "Sync error: Failed to delete itinerary items");
      return;
    }

    if (action === "UPDATE_CHECKLIST_ITEM" && payload) {
      runGranularWrite(
        () =>
          updateChecklistItem(payload.id, updatedTrip.id, {
            isCompleted: payload.isCompleted,
          }),
        "Sync error: Failed to update checklist item"
      );
      return;
    }

    if (action === "ADD_CHECKLIST_ITEM" && payload) {
      const items = effectiveDelta.addedOrUpdatedChecklist;
      runGranularWrite(async () => {
        await Promise.all(
          items.map((item) => addChecklistItem(item, updatedTrip.id))
        );
      }, "Sync error: Failed to add checklist item");
      return;
    }

    if (action === "DELETE_CHECKLIST_ITEM" && payload) {
      runGranularWrite(
        () => deleteChecklistItem(payload, updatedTrip.id),
        "Sync error: Failed to delete checklist item"
      );
      return;
    }

    runGranularWrite(async () => {
      const tasks: Promise<void>[] = [];
      if (effectiveDelta.addedOrUpdatedItinerary.length > 0) {
        tasks.push(
          upsertItineraryItems(
            updatedTrip.id,
            user.id,
            effectiveDelta.addedOrUpdatedItinerary
          )
        );
      }
      for (const id of effectiveDelta.deletedItineraryIds) {
        tasks.push(deleteItineraryItem(id, updatedTrip.id));
      }
      for (const expense of effectiveDelta.addedOrUpdatedExpenses) {
        tasks.push(upsertExpense(updatedTrip.id, user.id, expense));
      }
      for (const id of effectiveDelta.deletedExpenseIds) {
        tasks.push(deleteExpense(id, updatedTrip.id));
      }
      for (const flight of effectiveDelta.addedOrUpdatedFlights) {
        tasks.push(upsertFlight(updatedTrip.id, user.id, flight));
      }
      for (const id of effectiveDelta.deletedFlightIds) {
        tasks.push(deleteFlight(id, updatedTrip.id));
      }
      if (effectiveDelta.addedOrUpdatedChecklist.length > 0) {
        tasks.push(
          upsertChecklistItems(
            updatedTrip.id,
            user.id,
            effectiveDelta.addedOrUpdatedChecklist
          )
        );
      }
      for (const id of effectiveDelta.deletedChecklistIds) {
        tasks.push(deleteChecklistItem(id, updatedTrip.id));
      }
      if (effectiveDelta.tripMetaChanged) {
        tasks.push(updateTripMeta(updatedTrip.id, effectiveDelta.tripMetaPatch));
      }
      await Promise.all(tasks);
    }, "Sync error: Failed to save changes");
  };

  const handleInvite = async (email: string) => {
    if (!currentTrip || !user) return;
    const targetTripId = currentTrip.id;
    const emailLower = email.toLowerCase();
    const currentAllowed = currentTrip.allowed_emails || [];
    if (currentAllowed.some((e) => e.toLowerCase() === emailLower)) return;

    const newAllowed = [...currentAllowed, emailLower];
    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) => {
        if (t.id !== targetTripId) return t;
        const existing = (t.allowed_emails || []).map((e) => e.toLowerCase());
        if (existing.includes(emailLower)) return t;
        return { ...t, allowed_emails: [...existing, emailLower] };
      })
    );

    inFlightWritesRef.current += 1;
    try {
      if (!isNavigatorOffline()) setSyncStatus("syncing");
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

      const inviteeUserId = await findUserIdByEmail(emailLower);
      if (inviteeUserId) {
        await ensureChecklistItems(targetTripId, inviteeUserId);
      }
      await updateTripMeta(targetTripId, { allowed_emails: newAllowed });

      inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
      if (inFlightWritesRef.current === 0) {
        setSyncStatus(isNavigatorOffline() ? "offline" : "synced");
      }
    } catch (e) {
      inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
      console.error("Invite failed", e);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      setNotification({
        message: translations[language].errorTitle || "Invite failed",
        type: "error",
      });
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prev) =>
        prev.map((t) =>
          t.id !== targetTripId
            ? t
            : {
                ...t,
                allowed_emails: (t.allowed_emails || []).filter(
                  (addr) => addr.toLowerCase() !== emailLower
                ),
              }
        )
      );
    }
  };

  const handleRemoveInvite = async (email: string) => {
    if (!currentTrip || !currentTrip.allowed_emails) return;
    const targetTripId = currentTrip.id;
    const emailLower = email.toLowerCase();
    inFlightWritesRef.current += 1;
    if (!isNavigatorOffline()) setSyncStatus("syncing");

    let removedUserId: string | null | undefined =
      currentTrip.collaborators?.find(
        (c) => c.email && c.email.toLowerCase() === emailLower
      )?.user_id;

    if (removedUserId) {
      await leaveTrip(targetTripId, removedUserId);
    } else {
      removedUserId = await removeCollaboratorByEmail(targetTripId, emailLower);
    }

    const latestAllowed =
      tripsRef.current.find((t) => t.id === targetTripId)?.allowed_emails ||
      currentTrip.allowed_emails;
    const newAllowedEmails = latestAllowed.filter(
      (e) => e.toLowerCase() !== emailLower
    );

    let hadError = false;
    try {
      await updateTripMeta(targetTripId, { allowed_emails: newAllowedEmails });
      activeChannelRef.current?.send({
        type: "broadcast",
        event: "ACCESS_REVOKED",
        payload: { email: emailLower },
      });
      if (removedUserId) {
        supabase.channel(`global-trips-${removedUserId}`).send({
          type: "broadcast",
          event: "ACCESS_REVOKED_GLOBAL",
          payload: { tripId: targetTripId },
        });
      }
    } catch (e) {
      hadError = true;
      console.error("Failed to update allowed list", e);
    }

    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) => {
        if (t.id !== targetTripId) return t;
        const patched: Trip = {
          ...t,
          allowed_emails: (t.allowed_emails || []).filter(
            (e) => e.toLowerCase() !== emailLower
          ),
        };
        if (removedUserId) {
          patched.collaborators = (t.collaborators || []).filter(
            (c) => c.user_id !== removedUserId
          );
          patched.checklist = (t.checklist || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.expenses = (t.expenses || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.flights = (t.flights || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.itinerary = (t.itinerary || []).map((day) => ({
            ...day,
            items: day.items.filter((item) => item.user_id !== removedUserId),
          }));
        }
        return patched;
      })
    );

    inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
    if (isNavigatorOffline()) {
      setSyncStatus("offline");
    } else if (hadError) {
      setSyncStatus("error");
    } else if (inFlightWritesRef.current === 0) {
      setSyncStatus("synced");
    }
  };

  const handleCreateTripSubmit = async (tripData: Trip) => {
    if (!user || creatingTripRef.current) return;
    creatingTripRef.current = true;
    try {
      const enrichedTrip = {
        ...tripData,
        user_id: user.id,
        flights: tripData.flights.map((f) => ({
          ...f,
          user_id: user.id,
          traveler_name: user.name,
        })),
        allowed_emails: [user.email.toLowerCase()],
      };

      await createFullTrip(enrichedTrip, user.id);
      await joinTrip(enrichedTrip.id, user.id, user.email, "owner");

      setTrips((prev) => [
        enrichedTrip,
        ...prev.filter((t) => t.id !== enrichedTrip.id),
      ]);
      navigateToTrip(enrichedTrip.id);
      setShowCreateForm(false);

      if (enrichedTrip.flights.length > 0) {
        setGuideFlight(enrichedTrip.flights[0]);
        setPostCreateGuideStep("issuing");
      } else {
        setPostCreateGuideStep("idle");
        selectTabWithDirection("dashboard");
      }
    } catch {
      setError("Failed to create trip.");
    } finally {
      creatingTripRef.current = false;
    }
  };

  const handleConfirmDeleteTrip = async () => {
    const targetTrip = tripToDelete || currentTrip;
    if (!user || !targetTrip) return;
    const isOwner = targetTrip.user_id === user.id;
    setIsDeletingTrip(true);
    try {
      if (isOwner) {
        activeChannelRef.current?.send({
          type: "broadcast",
          event: "TRIP_DELETED",
          payload: { id: targetTrip.id },
        });
        await deleteTrip(targetTrip.id, user.id);
        setNotification({ message: t("tripDeletedSuccess"), type: "info" });
      } else {
        await leaveTrip(targetTrip.id, user.id);
        setNotification({ message: t("tripLeaveSuccess"), type: "info" });
      }

      setTrips((prev) => prev.filter((t) => t.id !== targetTrip.id));
      if (currentTripId === targetTrip.id) {
        navigateToList();
      }
      setTripToDelete(null);
    } catch {
      setNotification({
        message: isOwner ? t("deleteFailed") : t("leaveFailed"),
        type: "error",
      });
    } finally {
      setIsDeletingTrip(false);
    }
  };

  const saveBudget = (val: string) => {
    if (!currentTrip) return;
    const newBudget = parseInt(val);
    if (isNaN(newBudget)) return;
    const newFlights = [...currentTrip.flights];
    if (newFlights.length > 0) {
      newFlights[0] = { ...newFlights[0], budget: newBudget };
      updateCurrentTrip({ ...currentTrip, flights: newFlights });
    } else {
      updateCurrentTrip({ ...currentTrip, budget: newBudget });
    }
    setIsEditingBudget(false);
  };

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
  const budgetPercent = Math.min(100, (spentTotal / budgetLimit) * 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = currentTrip ? new Date(currentTrip.startDate) : new Date();
  const daysDiff =
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const countdownPercent =
    daysDiff < 0 ? 0 : daysDiff > 30 ? 100 : (daysDiff / 30) * 100;
  const displayDays = Math.ceil(daysDiff);
  const arrivalCode = currentTrip?.flights?.[0]?.outbound?.arrivalAirport || "";

  const packingPercent = useMemo(() => {
    if (!currentTrip || !user) return 0;
    const myItems = currentTrip.checklist.filter((i) => i.user_id === user.id);
    if (myItems.length === 0) return 0;
    return Math.round(
      (myItems.filter((i) => i.isCompleted).length / myItems.length) * 100
    );
  }, [currentTrip, user]);

  const upcomingItems = useMemo(() => {
    if (!currentTrip?.itinerary) return [];
    const now = new Date();
    const allItems = [];
    for (const day of currentTrip.itinerary) {
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
  }, [currentTrip]);

  const chartData = useMemo(() => {
    if (!currentTrip) return [];
    const dataMap: Record<string, number> = {};
    currentTrip.expenses.forEach((e) => {
      const rate =
        e.exchangeRate && e.exchangeRate > 0
          ? e.exchangeRate
          : getRateToTwd(e.currency);
      dataMap[e.category] = (dataMap[e.category] || 0) + e.amount * rate;
    });
    const flightsSum = (currentTrip.flights || []).reduce(
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
  }, [currentTrip, language]);

  const sortedChartData = useMemo(
    () => [...chartData].sort((a, b) => b.value - a.value),
    [chartData]
  );
  const chartTotal = useMemo(
    () => sortedChartData.reduce((sum, item) => sum + item.value, 0),
    [sortedChartData]
  );

  const checklistStats = useMemo(() => {
    if (!currentTrip || !user) return [];
    return ["Documents", "Gear", "Clothing", "Toiletries", "Other"]
      .map((c) => {
        const items = currentTrip.checklist.filter(
          (i) => i.category === c && i.user_id === user.id
        );
        const completed = items.filter((i) => i.isCompleted).length;
        return { category: c, total: items.length, completed };
      })
      .filter((c) => c.total > 0);
  }, [currentTrip, user]);

  const collaboratorCount = useMemo(() => {
    if (!currentTrip) return 0;
    const allEmails = new Set<string>();
    currentTrip.allowed_emails?.forEach((e) => allEmails.add(e.toLowerCase()));
    return Math.max(1, allEmails.size);
  }, [currentTrip]);

  const profileMenuContent = (
    <>
      {user && (
        <>
          <div className="px-3 py-2.5 flex items-center gap-2.5">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || "User"}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                {user.name ? user.name[0].toUpperCase() : <UserIcon size={18} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                {user.name || "User"}
              </div>
              {user.email && (
                <div className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </div>
              )}
              {view === "detail" && currentTrip && (
                <div className="mt-0.5 inline-block text-[9px] font-bold text-primary uppercase tracking-wider">
                  {isCreator ? t("permissionEditor") : t("permissionGuest")}
                </div>
              )}
            </div>
          </div>
          <div className="h-px my-1 bg-black/[0.06] dark:bg-white/[0.08]" />
        </>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {theme === "light" ? (
            <Moon size={15} className="text-slate-500 dark:text-slate-400" />
          ) : (
            <Sun size={15} className="text-amber-400" />
          )}
          <span>{t("theme")}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {theme === "dark" ? t("themeDark") : t("themeLight")}
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Languages size={15} className="text-slate-500 dark:text-slate-400" />
          <span>{t("language")}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {language === "zh" ? "繁體中文" : "English"}
        </span>
      </button>

      {view === "detail" && currentTrip && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setProfileMenuOpen(null);
            setIsExportModalOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-amber-500" />
            <span>{t("exportTrip")}</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            iOS / 日曆
          </span>
        </button>
      )}

      <div className="h-px my-1 bg-black/[0.06] dark:bg-white/[0.08]" />
      {user ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setProfileMenuOpen(null);
            handleLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>{t("logout")}</span>
        </button>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setProfileMenuOpen(null);
            setIsLoginModalOpen(true);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <UserIcon size={15} />
          <span>{t("loginToJoin")}</span>
        </button>
      )}
    </>
  );

  const isDesktopProfileOpen = profileMenuOpen === "desktop";
  const headerProfileElement = (
    <div className="relative flex items-center" ref={profileMenuRef}>
      {!user ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setProfileMenuOpen((prev) =>
                prev === "desktop" ? null : "desktop"
              )
            }
            aria-label={t("more")}
            aria-expanded={isDesktopProfileOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
          >
            <MoreHorizontal size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t("loginToJoin")}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            setProfileMenuOpen((prev) =>
              prev === "desktop" ? null : "desktop"
            )
          }
          aria-label={user.name || "User Profile"}
          aria-expanded={isDesktopProfileOpen}
          className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-black/5 dark:hover:ring-white/10 transition-all cursor-pointer active:scale-95"
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || "User"}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs ring-1 ring-black/10 dark:ring-white/20">
              {user.name ? user.name[0].toUpperCase() : <UserIcon size={16} />}
            </div>
          )}
        </button>
      )}

      {isDesktopProfileOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 w-64 rounded-2xl p-1.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl text-slate-900 dark:text-slate-100 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right select-none"
          role="menu"
        >
          {profileMenuContent}
        </div>
      )}
    </div>
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

  const tabBoundaryProps = {
    scope: "tab" as const,
    title: t("errorBoundaryTitle"),
    description: t("errorBoundaryDesc"),
    retryLabel: t("errorBoundaryRetry"),
    detailsLabel: t("errorBoundaryDetails"),
  };

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
            />
          )}

          {postCreateGuideStep === "issuing" && guideFlight && (
            <BoardingPassIssueModal
              flight={guideFlight}
              onContinue={handleIssueContinue}
            />
          )}

          {view === "detail" && currentTrip && (
            <div className="min-h-screen flex flex-col pb-28 sm:pb-32 md:pb-0">
              <nav className="bg-white/80 dark:bg-[#060709]/80 backdrop-blur-3xl border-b border-black/[0.06] dark:border-white/[0.08] sticky top-0 z-40 h-[60px] flex items-center px-4 sm:px-6">
                <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        user ? navigateToList() : navigateToLanding()
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-all -ml-1 shrink-0 cursor-pointer"
                    >
                      <ChevronLeft size={20} strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0 truncate">
                      <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                        {currentTrip.name}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-semibold text-slate-400 truncate min-w-0">
                          {currentTrip.destination}
                        </span>
                        <span className="hidden sm:inline-block w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        <span className="hidden sm:flex text-[10px] font-semibold text-slate-400 items-center gap-0.5">
                          <Users size={9} /> {collaboratorCount}
                        </span>
                        <span className="hidden sm:inline-block w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        {syncStatus === "error" ? (
                          <button
                            type="button"
                            data-testid="sync-retry-btn"
                            data-sync-status="error"
                            onClick={handleManualResync}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                            title={t("syncRetry")}
                          >
                            <RefreshCw size={10} className="shrink-0" />
                            <span>
                              {t("syncError")} · {t("syncRetry")}
                            </span>
                          </button>
                        ) : syncStatus === "offline" ? (
                          <span
                            role="status"
                            data-testid="sync-status-pill"
                            data-sync-status="offline"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 whitespace-nowrap shrink-0"
                          >
                            <WifiOff size={10} className="shrink-0" />
                            <span>{t("syncOffline")}</span>
                          </span>
                        ) : (
                          <span
                            role="status"
                            data-testid="sync-status-pill"
                            data-sync-status={syncStatus}
                            className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap shrink-0 ${
                              syncStatus === "syncing"
                                ? "text-primary"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {syncStatus === "syncing" ? (
                              <Loader2
                                size={10}
                                className="animate-spin shrink-0"
                              />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            )}
                            <span>
                              {syncStatus === "syncing"
                                ? t("syncing")
                                : t("syncSynced")}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 sm:gap-3">
                    {showMobilePriceCta && (
                      <div
                        data-testid="mobile-itinerary-price-cta"
                        className="sm:hidden flex items-center gap-0.5 animate-in fade-in duration-300"
                      >
                        <button
                          type="button"
                          onClick={handleGuideGoToPrice}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-full bg-primary text-white shadow-sm whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                        >
                          <Plane size={12} />
                          {t("guideGoEnterPrice")}
                        </button>
                        <button
                          type="button"
                          onClick={handleDismissPricePrompt}
                          aria-label={t("guideBannerDismiss")}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="hidden md:flex bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-2xl gap-0.5 border border-black/[0.04] dark:border-white/[0.1] backdrop-blur-2xl shadow-sm">
                      {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => selectTabWithDirection(tab.id)}
                            className={`relative px-4 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all duration-300 ease-spring active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                              isActive
                                ? "ios27-dock-active text-primary shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            }`}
                          >
                            <tab.icon
                              size={14}
                              strokeWidth={isActive ? 2.5 : 1.8}
                            />
                            <span className="hidden lg:inline">
                              {tab.label}
                            </span>
                            {tab.alert && (
                              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        !isGuest ? setIsShareModalOpen(true) : null
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer ${
                        isGuest
                          ? "opacity-30 cursor-not-allowed text-slate-400"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
                      }`}
                      disabled={isGuest}
                      title={t("shareTrip")}
                    >
                      <Share2 size={18} />
                    </button>

                    <div className="hidden md:block">
                      {headerProfileElement}
                    </div>
                  </div>
                </div>
              </nav>

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

              <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1 overflow-x-hidden">
                <div
                  data-testid="tab-screen-follow-wrapper"
                  style={{
                    transform: screenFollowOffsetPx
                      ? `translate3d(${screenFollowOffsetPx.toFixed(1)}px, 0, 0)`
                      : undefined,
                    transition:
                      dockDragSlot !== null
                        ? "transform 45ms linear"
                        : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  {activeTab === "dashboard" && (
                    <ErrorBoundary
                      {...tabBoundaryProps}
                      resetKey={`${currentTrip.id}-dashboard`}
                    >
                      <div className={`space-y-6 ${tabTransitionClass}`}>
                        <MobileHero
                          trip={currentTrip}
                          currentUserId={user?.id}
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
                          onEditBudget={() => setIsEditingBudget(true)}
                        />

                        <div className="hidden md:grid grid-cols-12 gap-5 min-h-[620px]">
                          {/* Destination Hero Card */}
                          <div className="col-span-12 lg:col-span-6 rounded-[32px] overflow-hidden relative group ios27-card p-8 lg:p-10 flex flex-col justify-between aviation-grid-bg">
                            <div className="absolute -right-12 -top-12 w-52 h-52 bg-primary/10 dark:bg-primary/15 rounded-full blur-3xl pointer-events-none" />
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
                                {arrivalCode
                                  ? `Arriving at ${arrivalCode}`
                                  : t("destination")}
                              </div>
                              <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 leading-[1.05]">
                                {currentTrip.destination}
                              </h2>
                            </div>
                            <div className="relative z-10 pt-6">
                              <div className="inline-flex items-center gap-2.5 text-slate-500 dark:text-slate-400 font-mono font-semibold text-xs tabular-nums bg-slate-100/80 dark:bg-white/[0.06] px-3.5 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.08]">
                                <Calendar size={13} className="text-primary" />
                                <span>
                                  {currentTrip.startDate} — {currentTrip.endDate}
                                </span>
                              </div>
                              <div className="mt-5 flex flex-wrap gap-2">
                                {(currentTrip.flights || [])
                                  .filter((f) => f.user_id === user?.id)
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
                                        className={
                                          item.isReturn ? "rotate-180" : ""
                                        }
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
                                  onClick={() => setIsEditingBudget(true)}
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
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
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
                                              CATEGORY_UI[e.category]
                                                ?.hexColor ||
                                              CATEGORY_UI["Other"].hexColor
                                            }
                                          />
                                        ))}
                                      </Pie>
                                      <RechartsTooltip
                                        formatter={(value: number) =>
                                          `NT$ ${Math.round(
                                            value
                                          ).toLocaleString()}`
                                        }
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                                  {sortedChartData.slice(0, 4).map((entry) => {
                                    const pct =
                                      chartTotal > 0
                                        ? Math.round(
                                            (entry.value / chartTotal) * 100
                                          )
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
                              <MapPin size={14} className="text-primary" />{" "}
                              {t("upcomingSchedule")}
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
                                <CheckSquare
                                  size={14}
                                  className="text-emerald-500"
                                />{" "}
                                {t("checklistSummary")}
                              </div>
                              <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                                {packingPercent}%
                              </div>
                            </div>
                            <div className="space-y-3.5 flex-1 overflow-y-auto no-scrollbar pr-1">
                              {checklistStats.map((stat) => (
                                <div
                                  key={stat.category}
                                  className="flex items-center gap-3"
                                >
                                  <div className="w-20 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                                    {stat.category}
                                  </div>
                                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                      style={{
                                        width: `${
                                          (stat.completed / stat.total) * 100
                                        }%`,
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
                                onClick={() => setTripToDelete(currentTrip)}
                                className="h-12 flex items-center justify-center gap-2 text-rose-500/80 hover:text-rose-600 font-semibold text-xs tracking-wide bg-white/70 dark:bg-white/[0.03] border border-rose-200/60 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                              >
                                <Trash2 size={14} /> {t("deleteTrip")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </ErrorBoundary>
                  )}

                  {activeTab === "itinerary" && (
                    <ErrorBoundary
                      {...tabBoundaryProps}
                      resetKey={`${currentTrip.id}-itinerary`}
                    >
                      <Suspense fallback={<TabSkeleton />}>
                        <div key="itinerary" className={tabTransitionClass}>
                          {postCreateGuideStep === "itinerary-hint" && (
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
                                  onClick={handleGuideGoToPrice}
                                  className="bg-primary text-white text-xs font-black px-4 py-2 rounded-xl shadow-md shadow-primary/20 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {t("guideBannerCta")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPostCreateGuideStep("idle")}
                                  aria-label={t("guideBannerDismiss")}
                                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                          <Itinerary
                            trip={currentTrip}
                            currentUser={user!}
                            onUpdate={updateCurrentTrip}
                            isGuest={isGuest}
                          />
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  )}

                  {activeTab === "checklist" && (
                    <ErrorBoundary
                      {...tabBoundaryProps}
                      resetKey={`${currentTrip.id}-checklist`}
                    >
                      <Suspense fallback={<TabSkeleton />}>
                        <div key="checklist" className={tabTransitionClass}>
                          <Checklist
                            trip={currentTrip}
                            currentUser={user!}
                            onUpdate={updateCurrentTrip}
                            isGuest={isGuest}
                          />
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  )}

                  {activeTab === "expenses" && (
                    <ErrorBoundary
                      {...tabBoundaryProps}
                      resetKey={`${currentTrip.id}-expenses`}
                    >
                      <Suspense fallback={<TabSkeleton />}>
                        <div key="expenses" className={tabTransitionClass}>
                          <Expenses
                            trip={currentTrip}
                            currentUser={user!}
                            onUpdate={updateCurrentTrip}
                            isGuest={isGuest}
                          />
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  )}

                  {activeTab === "flights" && (
                    <ErrorBoundary
                      {...tabBoundaryProps}
                      resetKey={`${currentTrip.id}-flights`}
                    >
                      <Suspense fallback={<TabSkeleton />}>
                        <div key="flights" className={tabTransitionClass}>
                          <FlightManager
                            trip={currentTrip}
                            currentUser={user!}
                            onUpdate={updateCurrentTrip}
                            isGuest={isGuest}
                            autoEditFlightId={
                              postCreateGuideStep === "edit-price"
                                ? guideTargetFlightId
                                : null
                            }
                            onGuidedPriceSaved={handleGuidedPriceSaved}
                          />
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  )}
                </div>
              </main>

              {isShareModalOpen && user && !isGuest && (
                <ShareModal
                  trip={currentTrip}
                  user={user}
                  onClose={() => setIsShareModalOpen(false)}
                  onInvite={handleInvite}
                  onRemoveInvite={handleRemoveInvite}
                  copyLink={() => {
                    navigator.clipboard.writeText(
                      buildTripShareUrl(currentTrip.id)
                    );
                    setNotification({ message: t("copied"), type: "success" });
                  }}
                />
              )}

              {isExportModalOpen && currentTrip && (
                <ExportModal
                  trip={currentTrip}
                  isOpen={isExportModalOpen}
                  onClose={() => setIsExportModalOpen(false)}
                  onNotify={(message, type) =>
                    setNotification({ message, type })
                  }
                />
              )}

              {isEditingBudget && !isGuest && (
                <BudgetModal
                  initialValue={budgetLimit.toString()}
                  onClose={() => setIsEditingBudget(false)}
                  onSave={saveBudget}
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
              onCreateTripSubmit={handleCreateTripSubmit}
              onSelectTrip={navigateToTrip}
              onDeleteTripClick={(target) => setTripToDelete(target)}
              calculateTripTotal={calculateTripTotal}
              getGradient={getGradient}
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
        </div>
      </ErrorBoundary>
    </LocalizationProvider>
  );
};

export default App;
