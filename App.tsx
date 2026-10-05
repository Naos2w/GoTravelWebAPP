import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Trip, Currency, Theme, Language, User, ChecklistItem } from "./types";
import {
  getTrips,
  getTripById,
  saveTrip,
  deleteTrip,
  joinTrip,
  leaveTrip,
  saveExpenseOnly,
  removeCollaboratorByEmail,
  findUserIdByEmail,
  ensureChecklistItems,
  createFullTrip,
  deleteExpense,
  deleteItineraryItem,
  updateChecklistItem,
  addChecklistItem,
  supabase,
} from "./services/storageService";
import {
  parseSupabaseUser,
  signInWithGoogle,
  signOutSafely,
  consumeRedirectTripId,
  saveRedirectTripId,
  isSupabaseConfigured,
} from "./services/authService";
import {
  useTranslation,
  LocalizationProvider,
  translations,
} from "./contexts/LocalizationContext";
import {
  CATEGORY_UI,
  getCategoryName,
} from "./components/ExpenseCategories";

import { TripForm } from "./components/TripForm";
import { NotificationToast } from "./components/NotificationToast";
import { BudgetModal } from "./components/BudgetModal";
import { ShareModal } from "./components/ShareModal";
import { LoginModal, LoginReason } from "./components/LoginModal";
import { DeleteTripModal } from "./components/DeleteTripModal";
import { ExportModal } from "./components/ExportModal";
import { TripCard, getTripTiming } from "./components/TripCard";
import { APP_VERSION } from "./services/version";

// TODO: [Optimized] Lazy load heavy components for better bundle code-splitting
const Checklist = React.lazy(() => import("./components/Checklist").then(m => ({ default: m.Checklist })));
const Itinerary = React.lazy(() => import("./components/Itinerary").then(m => ({ default: m.Itinerary })));
const Expenses = React.lazy(() => import("./components/Expenses").then(m => ({ default: m.Expenses })));
const FlightManager = React.lazy(() => import("./components/FlightManager").then(m => ({ default: m.FlightManager })));
import {
  Plane,
  Calendar,
  CheckSquare,
  DollarSign,
  Plus,
  ArrowRight,
  ChevronLeft,
  LogOut,
  Loader2,
  LayoutDashboard,
  Moon,
  Sun,
  Languages,
  Share2,
  Luggage,
  Check,
  Edit2,
  Clock,
  MapPin,
  Map,
  Wallet,
  Users,
  AlertTriangle,
  Trash2,
  Lock,
  PieChart as PieChartIcon,
  List,
  AlertCircle,
  Map as MapIcon,
  Mail,
  X as CloseIcon,
  Bell,
  Clock as PendingIcon,
  Search,
  Compass,
  Filter,
  FileText,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const calculateTripTotal = (trip: Trip): number => {
  const rates: Record<string, number> = {
    TWD: 1,
    USD: 31.5,
    JPY: 0.21,
    EUR: 34.2,
    KRW: 0.024,
  };
  const expensesSum = trip.expenses.reduce(
    (sum, item) => sum + item.amount * (item.exchangeRate || 1),
    0
  );
  const flightsSum = (trip.flights || []).reduce(
    (sum, f) => sum + f.price * (rates[f.currency] || 1),
    0
  );
  return expensesSum + flightsSum;
};

const getGradient = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-indigo-400",
    "from-rose-500 to-orange-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-yellow-400",
    "from-fuchsia-500 to-pink-400",
    "from-sky-500 to-blue-400",
  ];
  return colors[Math.abs(hash) % colors.length];
};






const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"landing" | "list" | "detail">("landing");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "itinerary" | "checklist" | "expenses" | "flights"
  >("dashboard");
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const [tempBudget, setTempBudget] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const [loginReason, setLoginReason] = useState<LoginReason>(null);
  const [tripSearchQuery, setTripSearchQuery] = useState("");
  const [tripFilter, setTripFilter] = useState<"all" | "upcoming" | "past">("all");
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Automatically reset edit mode if all trips are deleted or if leaving list view
  useEffect(() => {
    if ((trips.length === 0 || view !== "list") && isEditMode) {
      setIsEditMode(false);
    }
  }, [trips.length, view, isEditMode]);

  const saveTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const joinLockRef = useRef<string | null>(null);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const userRef = useRef<User | null>(user);
  userRef.current = user;
  const currentTripIdRef = useRef<string | null>(currentTripId);
  currentTripIdRef.current = currentTripId;

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

  // Auto-join logic: When a user enters a trip detail, ensure they are joined properly.
  // This triggers checklist generation on first visit.
  useEffect(() => {
    if (currentTripId && user && currentTrip) {
      const isOwner = currentTrip.user_id === user.id;
      const isAllowed =
        currentTrip.allowed_emails &&
        currentTrip.allowed_emails.some(
          (e: string) => e.toLowerCase() === user.email.toLowerCase()
        );

      // Explicitly check if the user is already in the collaborators list to prevent re-join
      const isJoined = currentTrip.collaborators?.some(
        (c) => c.user_id === user.id
      );

      if (!isOwner && isAllowed && !isJoined) {
        if (joinLockRef.current !== currentTripId) {
          joinLockRef.current = currentTripId;

          // Execute join
          joinTrip(currentTripId, user.id, user.email).then(() => {
            // Immediately refresh data to ensure "Joined" status and checklist items are reflected in UI
            getTripById(currentTripId).then((updated) => {
              if (updated) {
                setTrips((prev) => {
                  const idx = prev.findIndex((t) => t.id === updated.id);
                  if (idx > -1) {
                    const newArr = [...prev];
                    newArr[idx] = updated;
                    return newArr;
                  }
                  return [updated, ...prev];
                });
              }
            });
          });

          // Unlock after delay
          setTimeout(() => {
            joinLockRef.current = null;
          }, 5000);
        }
      }
    }
  }, [currentTripId, user, currentTrip]);

  // Real-time synchronization for active trip with Permission Check
  // Monotonic sequence ref to prevent out-of-order asynchronous responses from reverting newer local updates
  const latestRefreshSeqRef = useRef<number>(0);

  const refreshActiveTrip = async () => {
    if (!currentTripId || !user) return;
    const seq = ++latestRefreshSeqRef.current;

    try {
        const updatedTrip = await getTripById(currentTripId);

        // If a newer refresh started while this one was in-flight, discard stale result!
        if (seq !== latestRefreshSeqRef.current) {
          return;
        }

        // 1. Check if trip still exists
        if (!updatedTrip) {
          setNotification({
            message: translations[language].tripNotFound || "Trip not found",
            type: "error",
          });
          setCurrentTripId(null);
          setView("list");
          // Remove from list if it exists
          setTrips((prev) => prev.filter((t) => t.id !== currentTripId));
          return;
        }

        // 2. Security Check: Is user still allowed?
        const isOwner = updatedTrip.user_id === user.id;
        const isAllowed =
          updatedTrip.allowed_emails &&
          updatedTrip.allowed_emails.some(
            (e: string) => e.toLowerCase() === user.email.toLowerCase()
          );

        if (!isOwner && !isAllowed) {
          setNotification({
            message: translations[language].revoked || "Access Revoked",
            type: "error",
          });
          setCurrentTripId(null);
          setView("list");
          // CRITICAL FIX: Immediately remove the trip from local state so it disappears from the list
          setTrips((prev) => prev.filter((t) => t.id !== currentTripId));
          // Requirement 6: Force redirect to list view and clear current trip
          setCurrentTripId(null);
          setView("list");
          return;
        }

        // 3. Update Data
        setTrips((prev) => {
          const idx = prev.findIndex((t) => t.id === updatedTrip.id);
          if (idx > -1) {
             // Requirement 2 & 3: Ensure we have the latest collaborator data and member counts
            const newArr = [...prev];
            newArr[idx] = updatedTrip;
            return newArr;
          }
          return [updatedTrip, ...prev];
        });
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  useEffect(() => {
    if (!currentTripId || !user) return;
    // Call refreshActiveTrip initially and whenever currentTripId or user changes
    refreshActiveTrip();
  }, [currentTripId, user]);

    // Subscriptions
    useEffect(() => {
    if (!currentTripId || !user) return;

    // Subscribe to changes affecting the current trip
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
        async (payload) => {
           // Requirement 6: Check for permission revocation immediately on trip update
           // If the allowed_emails list changed in a way that excludes us, refreshActiveTrip will catch it.
           refreshActiveTrip();
        }
      )
      // Checklist Items: Granular state sync to eliminate 6-table full refetch race conditions
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
          if (newRow && newRow.id) {
            setTrips((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                if ((t.checklist || []).some((item) => item.id === newRow.id)) return t;
                const newItem: ChecklistItem = {
                  id: newRow.id,
                  user_id: newRow.user_id,
                  text: newRow.text,
                  category: newRow.category,
                  isCompleted: newRow.is_completed,
                };
                return { ...t, checklist: [...(t.checklist || []), newItem] };
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
          if (updatedRow && updatedRow.id) {
            setTrips((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                const newChecklist = (t.checklist || []).map((item) =>
                  item.id === updatedRow.id
                    ? {
                        ...item,
                        isCompleted: updatedRow.is_completed,
                        text: updatedRow.text ?? item.text,
                        category: updatedRow.category ?? item.category,
                      }
                    : item
                );
                return { ...t, checklist: newChecklist };
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
          event: "DELETE",
          schema: "public",
          table: "checklist_items",
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setTrips((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                return {
                  ...t,
                  checklist: (t.checklist || []).filter((item) => item.id !== deletedId),
                };
              })
            );
          } else {
            refreshActiveTrip();
          }
        }
      )
      // Itinerary Items: Split for DELETE support
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "itinerary_items",
          // Unfiltered DELETE
        },
        () => refreshActiveTrip()
      )
      // Expenses: Split to handle DELETE separately due to filter limitations (Replica Identity)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "expenses",
          // No filter here because DELETE payload might not have trip_id
        },
        (payload) => {
             // Optimization: We could check if payload.old.id is in our known list,
             // but current closure limitations make direct state access stale.
             // A fetch check is safer.
             refreshActiveTrip();
        }
      )
      // Flights: Split for DELETE support
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "flights",
        },
        () => refreshActiveTrip()
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
      .on('broadcast', { event: 'EXPENSE_DELETED' }, (payload) => {
         console.log("Broadcast received: EXPENSE_DELETED", payload);
         refreshActiveTrip();
      })
      .on('broadcast', { event: 'ACCESS_REVOKED' }, (payload) => {
         console.log("Broadcast received: ACCESS_REVOKED", payload);
         // If I am the one revoked, kick me out
         if (payload.payload?.email?.toLowerCase() === user?.email?.toLowerCase()) {
            setNotification({
              message: translations[language].revoked || "Access Revoked",
              type: "error",
            });
            setTrips((prev) => prev.filter((t) => t.id !== currentTripId));
            setCurrentTripId(null);
            setView("list");
         } else {
            // Otherwise just refresh to update the collaborator list UI
            refreshActiveTrip();
         }
      })
      .on('broadcast', { event: 'TRIP_DELETED' }, () => {
         console.log("Broadcast received: TRIP_DELETED");
         setNotification({
           message: translations[language].tripNotFound || "Trip deleted",
           type: "info",
         });
         setCurrentTripId(null);
         setView("list");
      })
      .subscribe((status) => {
        console.log(`[Active Trip Realtime] Subscription status for ${currentTripId}:`, status);
      });

    activeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      activeChannelRef.current = null;
    };
  }, [currentTripId, user]);

  // Global subscription for new invites (auto-appear on list) or removals
  useEffect(() => {
    if (!user) return;

    const refreshList = async () => {
      // Simple reload to catch any new trips where I was added to allowed_emails
      await loadTrips();
    };

    // Listen to changes in 'trips' table to detect new invites
    // We listen to ALL trip updates, but in a real app might want to filter.
    // Since RLS policies usually restrict what we see, we might only receive events for rows we can access.
    // However, for invitations, the Row Level Security often allows "read if in allowed_emails".
    const channel = supabase
      .channel(`global-trips-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (payload) => {
          // Requirement 5: Real-time update for new trips on homepage
          // If a new trip is created, or I am updated on an existing trip (e.g. allowed_emails changed),
          // we should refresh the list.
          // Since we can't easily filter "trips where I am allowed" purely client-side without data,
          // we just aggressively refresh the list on any trip change if we are in list view,
          // or if the change isn't the one we are currently viewing.
          if (
            !currentTripId ||
            (payload.new && (payload.new as any).id !== currentTripId) ||
             payload.eventType === 'INSERT' // Always refresh on inserts to catch new invites
          ) {
            console.log("[Global Realtime] Refreshing list due to event:", payload.eventType, payload);
            refreshList();
          } else {
            console.log("[Global Realtime] Event matches current trip, forcing active refresh:", payload.eventType);
            refreshActiveTrip();
            // Also refresh list just in case metadata like name changed
            refreshList();
          }
        }
      )
      .on('broadcast', { event: 'ACCESS_REVOKED_GLOBAL' }, (payload) => {
        const revokedTripId = payload.payload?.tripId;
        console.log("[Global Realtime] ACCESS_REVOKED_GLOBAL for trip:", revokedTripId);
        if (revokedTripId) {
          // Remove from list automatically
          setTrips(prev => prev.filter(t => t.id !== revokedTripId));
          // If we are currently in this trip's detail, kick out
          if (currentTripId === revokedTripId) {
            setNotification({
              message: translations[language].revoked || "Access Revoked",
              type: "error",
            });
            setCurrentTripId(null);
            setView("list");
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTripId]);

  // View persistence and handle share links from URL
  useEffect(() => {
    // CRITICAL FIX: Do not touch the URL until loading is complete to prevent clearing invite links
    if (isLoading) return;

    const url = new URL(window.location.href);

    if (view === "detail" && currentTripId) {
      sessionStorage.setItem("currentTripId", currentTripId);
      url.searchParams.set("tripId", currentTripId);
      window.history.replaceState({}, "", url);
    } else if (view === "list") {
      sessionStorage.removeItem("currentTripId");
      if (url.searchParams.has("tripId")) {
        url.searchParams.delete("tripId");
        window.history.replaceState({}, "", url);
      }
    }
  }, [currentTripId, view, isLoading]);

  // Handle browser back button (Popstate)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const urlTripId = url.searchParams.get("tripId");
      if (!urlTripId && view === "detail") {
        setView("list");
        setCurrentTripId(null);
      } else if (urlTripId && view === "list") {
        setCurrentTripId(urlTripId);
        setView("detail");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleAuthUser = async (supabaseUser: any) => {
    const parsedUser = parseSupabaseUser(supabaseUser);
    setSafeUser(parsedUser);

    // Read the URL param directly here, or restore from sessionStorage deep link
    const urlParams = new URLSearchParams(window.location.search);
    const urlTripId = urlParams.get("tripId") || consumeRedirectTripId();

    if (urlTripId) {
      // Do not flash full-screen loading spinner if the user is already actively viewing this trip
      const isAlreadyViewing = currentTripIdRef.current === urlTripId;
      if (!isAlreadyViewing) {
        setIsLoading(true);
      }
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
            setTrips((prev) => {
              const exists = prev.some((t) => t.id === trip.id);
              return exists ? prev : [trip, ...prev];
            });
            // Keep ?tripId in URL bar so user permalinks and reloads work seamlessly
            if (!window.location.search.includes(urlTripId)) {
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}?tripId=${urlTripId}`
              );
            }
            setView("detail");
          } else {
            // 有登入但無權限：清除無效參數，跳出訊息，跳轉到自己的行程頁面
            window.history.replaceState(null, "", window.location.pathname);
            setNotification({
              message:
                translations[language].noPermissionRedirect ||
                "您沒有此行程的存取權限，已為您跳轉至您的行程頁面",
              type: "error",
            });
            setView("list");
          }
        } else {
          // 找不到此行程：清除無效參數，跳出訊息，跳轉到自己的行程頁面
          window.history.replaceState(null, "", window.location.pathname);
          setNotification({
            message:
              translations[language].tripNotFoundRedirect ||
              "找不到此行程或無權限存取，已為您跳轉至您的行程頁面",
            type: "error",
          });
          setView("list");
        }
      } catch (e) {
        window.history.replaceState(null, "", window.location.pathname);
        setView("list");
      } finally {
        setIsLoading(false);
      }
    } else {
      setView("list");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Guarantee that isLoading will never remain stuck on true under any circumstances
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 10000);

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) console.warn("[Auth] getSession error:", error);

        if (session?.user) {
          // 1. 有登入：交給 handleAuthUser 驗證該行程讀取權限
          // 若有權限則進入行程詳情頁；若無權限則跳出提示並跳轉到自己的行程頁面 (list)
          await handleAuthUser(session.user);
        } else if (!window.location.hash.includes("access_token")) {
          // 2. 沒登入：跳出訊息提示，跳轉到登入主頁 (landing)
          const params = new URLSearchParams(window.location.search);
          const urlTripId = params.get("tripId");
          if (urlTripId) {
            saveRedirectTripId(urlTripId);
            setPendingTripId(urlTripId);
            window.history.replaceState(null, "", window.location.pathname);
            setNotification({
              message:
                translations[language].loginRequiredRedirect ||
                "此行程需要登入存取，已為您前往登入主頁",
              type: "info",
            });
            setLoginReason("trip_access");
            setIsLoginModalOpen(true);
          }

          if (isMounted) {
            setUser(null);
            setCurrentTripId(null);
            setView("landing");
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

    // Subscribe to auth state changes for ongoing lifecycle (e.g. login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // Ignore INITIAL_SESSION because initAuth() handles startup deterministically without race condition
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_IN" && session?.user) {
        // If user is already authenticated with the same ID (e.g. window focus / background session check),
        // safely update user reference without tearing down UI or flashing full-screen spinner!
        if (userRef.current?.id === session.user.id) {
          setSafeUser(parseSupabaseUser(session.user));
          return;
        }

        await handleAuthUser(session.user);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSafeUser(parseSupabaseUser(session.user));
      } else if (event === "SIGNED_OUT") {
        window.history.replaceState(null, "", window.location.pathname);
        if (currentTripId) {
          saveRedirectTripId(currentTripId);
          setPendingTripId(currentTripId);
        }
        setUser(null);
        setView("landing");
        setTrips([]);
        setCurrentTripId(null);
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

  const loadTrips = async () => {
    if (!user) return;
    try {
      const userTrips = await getTrips(user.id, user.email);
      setTrips(userTrips);
      setError(null);
    } catch (err: any) {
      console.warn("[Storage] loadTrips caught error:", err);
      // Only display prominent error banner if no trips have been loaded yet
      setTrips((prev) => {
        if (prev.length === 0) {
          setError(err.message || "Failed to load trips");
        }
        return prev;
      });
    }
  };

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
    } catch (error: any) {
      console.error("Error logging in:", error);
      setIsLoggingIn(false);
      setNotification({
        message:
          error?.message ||
          translations[language].loginFailed ||
          "Failed to log in",
        type: "error",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSafely();
    } catch (error) {
      console.warn("Logout error:", error);
    } finally {
      setUser(null);
      setView("landing");
      setTrips([]);
      setCurrentTripId(null);
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
  const isPricePending = useMemo(() => {
    if (!currentTrip || !user) return false;
    const myFlight = currentTrip.flights?.find((f) => f.user_id === user.id);
    return !!myFlight && myFlight.price === 0;
  }, [currentTrip, user]);

  const hasMissingFlightInfo = useMemo(() => {
    if (!currentTrip || !currentTrip.flights) return false;
    return currentTrip.flights.some((f) => {
      const hasPrice = f.price > 0;
      const bag = f.baggage || f.outbound.baggage;
      const checkBag = (b: any) => {
        if (!b) return true;
        const w = b.weight ? b.weight.replace(/[^0-9.]/g, "") : "";
        const c = b.count || 0;
        return !((c > 0 && !w) || (w.length > 0 && c <= 0));
      };
      return !hasPrice || !checkBag(bag?.carryOn) || !checkBag(bag?.checked);
    });
  }, [currentTrip]);

  useEffect(() => {
    if (isPricePending && activeTab !== "flights") setActiveTab("flights");
  }, [isPricePending, activeTab]);

  const t = (key: keyof typeof translations.en) =>
    (translations as any)[language][key] || (translations as any).en[key];

  const updateCurrentTrip = (updatedTrip: Trip, action?: string, payload?: any) => {
    if (!user) return;

    // Snapshot current trips state before we apply the update
    const previousTrips = [...trips];

    // Handle dummy action for triggering global notifications
    if (action === "SHOW_ERROR_TOAST") {
       setNotification({
         message: typeof payload === "string" ? payload : (translations[language].errorTitle || "Error occurred"),
         type: "error",
       });
       return;
    }
    
    // Clear any pending save immediately to prevent race conditions
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );

    // Immediate action handlers
    if (action === "DELETE_EXPENSE" && payload) {
       console.log("[App] Handling DELETE_EXPENSE for:", payload);
       deleteExpense(payload, updatedTrip.id)
          .then(() => {
              activeChannelRef.current?.send({ type: 'broadcast', event: 'EXPENSE_DELETED', payload: { id: payload } });
          })
          .catch(err => {
              console.error("[App] Delete expense failed:", err);
              setTrips(previousTrips);
              setNotification({
                message: translations[language].errorTitle || "Sync error: Failed to delete expense",
                type: "error",
              });
          });
       return; 
    }

    // Handle Itinerary item deletion centrally to support revert
    if (action === "DELETE_ITINERARY_ITEM" && payload) {
       console.log("[App] Handling DELETE_ITINERARY_ITEM for:", payload);
       const ids = Array.isArray(payload) ? payload : [payload];
       Promise.all(ids.map(id => deleteItineraryItem(id, updatedTrip.id)))
          .catch(err => {
              console.error("[App] Delete itinerary items failed:", err);
              setTrips(previousTrips);
              setNotification({
                message: translations[language].errorTitle || "Sync error: Failed to delete itinerary items",
                type: "error",
              });
          });
       return;
    }

    // Handle checklist updates & additions directly with targeted row mutations
    if (action === "UPDATE_CHECKLIST_ITEM" && payload) {
       updateChecklistItem(payload.id, updatedTrip.id, { isCompleted: payload.isCompleted })
          .catch(err => {
              console.error("[App] Update checklist item failed:", err);
              setTrips(previousTrips);
              setNotification({
                message: translations[language].errorTitle || "Sync error: Failed to update checklist item",
                type: "error",
              });
          });
       return;
    }

    if (action === "ADD_CHECKLIST_ITEM" && payload) {
       addChecklistItem(payload, updatedTrip.id)
          .catch(err => {
              console.error("[App] Add checklist item failed:", err);
              setTrips(previousTrips);
              setNotification({
                message: translations[language].errorTitle || "Sync error: Failed to add checklist item",
                type: "error",
              });
          });
       return;
    }

    // Immediate Save for explicit user actions (Add/Edit) to avoid "Waiting" feel
    const immediateActions = [
      "ADD_ITINERARY_ITEM", "UPDATE_ITINERARY_ITEM", "SAVE_ITINERARY_ITEM"
    ];
    const delay = action && immediateActions.includes(action) ? 0 : 2000;

    const performSave = async () => {
      setIsSyncing(true);
      try {
        await saveTrip(updatedTrip, user.id);
      } catch (err) {
        console.error("Save failed:", err);
        setTrips(previousTrips);
        setNotification({
          message: translations[language].errorTitle || "Sync error: Failed to save changes",
          type: "error",
        });
      } finally {
        setIsSyncing(false);
        saveTimeoutRef.current = null;
      }
    };

    if (delay === 0) {
      performSave();
    } else {
      saveTimeoutRef.current = window.setTimeout(performSave, 600);
    }
  };


  
  const handleInvite = async (email: string) => {
    if (!currentTrip || !user) return;
    const emailLower = email.toLowerCase();
    const currentAllowed = currentTrip.allowed_emails || [];

    if (currentAllowed.some((e) => e.toLowerCase() === emailLower)) return;

    const newAllowed = [...currentAllowed, emailLower];

    // 1. Optimistic Update to UI
    const updatedTrip = { ...currentTrip, allowed_emails: newAllowed };
    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );

    // 2. Direct Save & Requirement 1: Pre-generate checklist if user exists
    try {
      setIsSyncing(true);
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

      // Attempt to find the user ID for this email to pre-create their checklist
      const inviteeUserId = await findUserIdByEmail(emailLower);
      console.log("[Invite Debug] Found User ID:", inviteeUserId, "for email:", emailLower);
      if (inviteeUserId) {
         console.log("[Invite Debug] Creating checklist items for:", inviteeUserId);
         await ensureChecklistItems(updatedTrip.id, inviteeUserId);
      } else {
         console.warn("[Invite Debug] User ID not found for email:", emailLower);
      }

      await saveTrip(updatedTrip, user.id);
    } catch (e) {
      console.error("Invite failed", e);
      // TODO: [Error Handling] Catch invitation/database failure and trigger Toast notification
      setNotification({
        message: translations[language].errorTitle || "Invite failed",
        type: "error",
      });
      // Revert on failure
      setTrips((prev) =>
        prev.map((t) => (t.id === currentTrip.id ? currentTrip : t))
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoveInvite = async (email: string) => {
    if (!currentTrip || !currentTrip.allowed_emails) return;
    const emailLower = email.toLowerCase();
    setIsSyncing(true);

    // 1. Attempt to resolve User ID via trip_collaborators (local cache)
    // This handles users who have already accepted and joined.
    // If they haven't joined, 'removeCollaboratorByEmail' will just return null (safe).
    let removedUserId: string | null | undefined =
      currentTrip.collaborators?.find(
        (c) => c.email && c.email.toLowerCase() === emailLower
      )?.user_id;

    if (removedUserId) {
      // User has joined, so we must explicitly remove them from the trip (database)
      await leaveTrip(currentTrip.id, removedUserId);
    } else {
      // Double check backend if local cache is stale or user just hasn't joined yet
      removedUserId = await removeCollaboratorByEmail(
        currentTrip.id,
        emailLower
      );
    }

    // 2. Regardless of whether they were Active or Pending, remove from permission list.
    const newAllowedEmails = currentTrip.allowed_emails.filter(
      (e) => e.toLowerCase() !== emailLower
    );

    try {
      // Update database
      await supabase
        .from("trips")
        .update({ allowed_emails: newAllowedEmails })
        .eq("id", currentTrip.id);

      // 3. Broadcast removal to trigger instant kickout for the target user (Requirement 6)
      // Broadcast to active trip channel (standard)
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'ACCESS_REVOKED',
        payload: { email: emailLower }
      });

      // ALSO broadcast to the target user's PRIVATE global channel (for background/list sync)
      if (removedUserId) {
        supabase.channel(`global-trips-${removedUserId}`).send({
          type: 'broadcast',
          event: 'ACCESS_REVOKED_GLOBAL',
          payload: { tripId: currentTrip.id }
        }, (status: any) => {
           console.log("Global revocation broadcast status:", status);
        });
      }
    } catch (e) {
      console.error("Failed to update allowed list", e);
    }

    // 3. Update Local State (UI) immediately to reflect removal
    const newTrip = { ...currentTrip };
    newTrip.allowed_emails = newAllowedEmails;

    // Filter out the removed user's data from local state so UI updates instantly
    if (removedUserId) {
      newTrip.collaborators =
        newTrip.collaborators?.filter((c) => c.user_id !== removedUserId) || [];
      newTrip.checklist = newTrip.checklist.filter(
        (i) => i.user_id !== removedUserId
      );
      newTrip.expenses = newTrip.expenses.filter(
        (i) => i.user_id !== removedUserId
      );
      newTrip.flights = newTrip.flights.filter(
        (i) => i.user_id !== removedUserId
      );
      newTrip.itinerary = newTrip.itinerary.map((day) => ({
        ...day,
        items: day.items.filter((item) => item.user_id !== removedUserId),
      }));
    }

    setTrips((prev) => prev.map((t) => (t.id === newTrip.id ? newTrip : t)));
    setIsSyncing(false);
  };

  const handleCreateTripSubmit = async (tripData: Trip) => {
    if (!user) return;
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
      
      // Use createFullTrip to save flights, itinerary, checklist, and metadata
      await createFullTrip(enrichedTrip, user.id);

      // CRITICAL UPDATE: Join the creator immediately
      await joinTrip(enrichedTrip.id, user.id, user.email, "owner");

      setTrips((prev) => [enrichedTrip, ...prev]);
      setCurrentTripId(enrichedTrip.id);
      setView("detail");
      setShowCreateForm(false);
    } catch (err) {
      setError("Failed to create trip.");
    }
  };

  const handleConfirmDeleteTrip = async () => {
    const targetTrip = tripToDelete || currentTrip;
    if (!user || !targetTrip) return;
    const isOwner = targetTrip.user_id === user.id;
    setIsDeletingTrip(true);
    try {
      if (isOwner) {
        // Broadcast first so others can see it before access is cut
        activeChannelRef.current?.send({
          type: 'broadcast',
          event: 'TRIP_DELETED',
          payload: { id: targetTrip.id }
        });

        await deleteTrip(targetTrip.id, user.id);
        setNotification({
          message: t("tripDeletedSuccess"),
          type: "info",
        });
      } else {
        await leaveTrip(targetTrip.id, user.id);
        setNotification({
          message: t("tripLeaveSuccess"),
          type: "info",
        });
      }

      setTrips((prev) => prev.filter((t) => t.id !== targetTrip.id));
      if (currentTripId === targetTrip.id) {
        setCurrentTripId(null);
        setView("list");
      }
      setTripToDelete(null);
    } catch (err) {
      setNotification({
        message: isOwner ? t("deleteFailed") : t("leaveFailed"),
        type: "error",
      });
    } finally {
      setIsDeletingTrip(false);
    }
  };

  const handleDeleteTrip = () => {
    if (currentTrip) {
      setTripToDelete(currentTrip);
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
    }
    setIsEditingBudget(false);
  };

  const tabs = [
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
  const spentTotal = currentTrip ? calculateTripTotal(currentTrip) : 0;
  const budgetLimit = currentTrip?.flights?.[0]?.budget || 50000;
  const budgetPercent = Math.min(100, (spentTotal / budgetLimit) * 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = currentTrip ? new Date(currentTrip.startDate) : new Date();
  const daysDiff =
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const countdownPercent =
    daysDiff < 0 ? 0 : daysDiff > 30 ? 100 : (daysDiff / 30) * 100;
  const displayDays = Math.ceil(daysDiff);

  const allFlights = currentTrip?.flights || [];
  const arrivalCode = allFlights[0]?.outbound?.arrivalAirport || "";

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
        if (itemDate > now && item.type !== "Transport")
          allItems.push({ ...item, date: day.date });
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
    const rates: Record<string, number> = {
      TWD: 1,
      USD: 31.5,
      JPY: 0.21,
      EUR: 34.2,
      KRW: 0.024,
    };
    currentTrip.expenses.forEach((e) => {
      const twdVal = e.amount * (e.exchangeRate || 1);
      dataMap[e.category] = (dataMap[e.category] || 0) + twdVal;
    });
    const flightsSum = (currentTrip.flights || []).reduce(
      (sum, f) => sum + f.price * (rates[f.currency] || 1),
      0
    );
    if (flightsSum > 0)
      dataMap["Flight"] = (dataMap["Flight"] || 0) + flightsSum;
    return Object.entries(dataMap).map(([key, value]) => ({ 
      category: key,
      name: key, // Keep for backward compat inside App if any, but prefer category
      displayName: getCategoryName(key, t),
      value 
    }));
  }, [currentTrip, t]);



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

  // Updated Member Count Logic: Count all allowed emails (invited) + Owner (if not in allowed list)
  const collaboratorCount = useMemo(() => {
    if (!currentTrip) return 0;
    const allEmails = new Set<string>();

    if (currentTrip.allowed_emails) {
      currentTrip.allowed_emails.forEach((e) => allEmails.add(e.toLowerCase()));
    }
    // Normally owner is in allowed_emails, but if not, ensure count is at least 1
    return Math.max(1, allEmails.size);
  }, [currentTrip]);

  // Filtered trips and status metrics for "Your Trips"
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
      // 1. Filter by status tab
      if (tripFilter !== "all") {
        const timing = getTripTiming(trip.startDate, trip.endDate);
        if (tripFilter === "upcoming" && timing.status === "past") return false;
        if (tripFilter === "past" && timing.status !== "past") return false;
      }

      // 2. Search query by name or destination
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

  const GlobalNav = () => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200"
      >
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <button
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200"
      >
        <Languages size={18} />
      </button>
    </div>
  );

  const UserHeaderProfile = () => {
    if (!user) {
      return (
        <div className="flex items-center gap-2 pl-3 border-l border-black/[0.06] dark:border-white/10">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {t("guestPreview")}
          </span>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>{t("loginToJoin")}</span>
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5 pl-3 border-l border-black/[0.06] dark:border-white/10">
        <img
          src={user.picture}
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.08] object-cover ring-2 ring-white dark:ring-white/20 shadow-sm"
        />
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold truncate max-w-[100px] text-slate-900 dark:text-slate-100">
            {user.name ? user.name.split(" ")[0] : "User"}
          </div>
          {view === "detail" && currentTrip && (
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
              {isCreator ? t("permissionEditor") : t("permissionGuest")}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  };

  const MobileHero = () => {
    return (
      <div className="md:hidden space-y-4 mb-6">
        <div className="w-full rounded-[32px] p-8 shadow-ios ios27-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex justify-between items-start mb-1">
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                {arrivalCode || t("destination")}
              </div>
            </div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
              {currentTrip?.destination}
            </h2>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              <Calendar size={12} /> {currentTrip?.startDate} —{" "}
              {currentTrip?.endDate}
            </div>
            {/* Mobile Flight Numbers */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(currentTrip?.flights || [])
                .filter(f => f.user_id === user?.id)
                .map(f => {
                   // Collect outgoing and returning flight numbers
                   const numbers = [];
                   if (f.outbound?.flightNumber) numbers.push({ num: f.outbound.flightNumber, isReturn: false });
                   if (f.inbound?.flightNumber) numbers.push({ num: f.inbound.flightNumber, isReturn: true });
                   return numbers;
                })
                .flat()
                .map((item, idx) => (
                  <div key={idx} className={`text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${item.isReturn ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-300 border-slate-200/60 dark:border-white/10' : 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/20'}`}>
                     <Plane size={10} className={item.isReturn ? "rotate-180" : ""} /> {item.num}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="ios27-card rounded-[32px] p-6 shadow-ios space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t("countdown")}
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
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
            onClick={() => !isGuest && setIsEditingBudget(true)}
            className={
              !isGuest
                ? "cursor-pointer active:opacity-70 transition-opacity"
                : ""
            }
          >
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                {t("budgetStatus")} {!isGuest && <Edit2 size={10} />}
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {(spentTotal / 1000).toFixed(1)}k /{" "}
                {(budgetLimit / 1000).toFixed(1)}k ({Math.round(budgetPercent)}
                %)
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  spentTotal > budgetLimit ? "bg-red-500" : "bg-primary"
                }`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t("packingProgress")}
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
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
                  key={i}
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
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                      {item.time}
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {item.placeName}
                    </div>
                  </div>
                  <div className="text-slate-300 dark:text-slate-500">
                    <Map size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary mb-6" size={48} />
        <div className="font-black text-slate-400 uppercase tracking-widest text-[10px]">
          {t("syncing")}
        </div>
      </div>
    );



  if (view === "landing") {
    return (
      <LocalizationProvider value={{ t, language, setLanguage }}>
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
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10" />
            <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="space-y-4">
                <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-slate-900 dark:text-white whitespace-pre-line leading-[1.1]">
                  {t("heroTitle")}
                </h1>
                <p className="text-xl sm:text-2xl text-slate-500 font-medium tracking-tight">
                  {t("heroSubtitle")}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="bg-primary text-white px-8 py-4 sm:px-10 sm:py-5 rounded-[24px] font-black text-base sm:text-lg shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all flex items-center gap-3 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="animate-spin" size={22} />
                      <span>{t("loggingIn")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{t("login")}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 px-6 py-4 sm:px-8 sm:py-5 rounded-[24px] font-bold text-base sm:text-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm border border-black/[0.04] dark:border-white/[0.08]"
                >
                  <Mail size={20} />
                  <span>{t("emailLogin")}</span>
                </button>
              </div>
            </div>
            <footer className="absolute bottom-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <span>{t("appName")}</span>
              <span>•</span>
              <span className="font-mono">v{APP_VERSION}</span>
            </footer>
          </div>
          {pendingTripId && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-xl border border-primary/30 shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 max-w-[90vw]">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Lock size={16} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {t("loginToViewTrip")}
                </div>
                <div className="text-[10px] text-slate-400">
                  {t("targetTripSaved")}
                </div>
              </div>
              <button
                onClick={() => {
                  setLoginReason("trip_access");
                  setIsLoginModalOpen(true);
                }}
                className="bg-primary text-white text-xs font-black px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ml-2 shadow-md shadow-primary/20"
              >
                {t("login")}
              </button>
            </div>
          )}
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
      </LocalizationProvider>
    );
  }

  return (
    <LocalizationProvider value={{ t, language, setLanguage }}>
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

        {view === "detail" && currentTrip && (
          <div className="min-h-screen flex flex-col pb-28 sm:pb-32 md:pb-0">
            <nav className="bg-white/80 dark:bg-[#060709]/80 backdrop-blur-3xl border-b border-black/[0.06] dark:border-white/[0.08] sticky top-0 z-40 h-[60px] flex items-center px-4 sm:px-6">
              <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      if (!user) {
                        setView("landing");
                        setCurrentTripId(null);
                      } else {
                        setView("list");
                        setCurrentTripId(null);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-all -ml-1 cursor-pointer"
                  >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                  </button>
                  <div className="truncate">
                    <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                      {currentTrip.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {currentTrip.destination}
                      </span>
                      <span className="hidden sm:inline-block w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                      <span className="hidden sm:flex text-[10px] font-semibold text-slate-400 items-center gap-0.5">
                        <Users size={9} /> {collaboratorCount}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex bg-black/[0.06] dark:bg-white/[0.06] p-1 rounded-2xl gap-0.5 border border-black/[0.03] dark:border-white/[0.08]">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      const isDisabled = isPricePending && tab.id !== "flights";
                      return (
                        <button
                          key={tab.id}
                          onClick={() =>
                            !isDisabled && setActiveTab(tab.id as any)
                          }
                          disabled={isDisabled}
                          className={`relative px-4 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          } ${
                            isDisabled ? "opacity-40 cursor-not-allowed" : ""
                          }`}
                        >
                          {isDisabled && <Lock size={11} />}
                          <tab.icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                          <span className="hidden lg:inline">{tab.label}</span>
                          {tab.alert && (
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() =>
                      !isGuest ? setIsShareModalOpen(true) : null
                    }
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                      isGuest
                        ? "opacity-30 cursor-not-allowed text-slate-400"
                        : "text-slate-400 hover:text-primary hover:bg-primary/10"
                    }`}
                    disabled={isGuest}
                    title={t("shareTrip")}
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-primary/10 hover:text-primary text-slate-700 dark:text-slate-200 transition-all text-xs font-bold cursor-pointer active:scale-95"
                    title="匯出至 iOS 備忘錄 / Apple 日曆"
                  >
                    <FileText size={14} className="text-amber-500" />
                    <span className="hidden sm:inline">匯出</span>
                  </button>
                  <GlobalNav />
                  <UserHeaderProfile />
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
                    onClick={() => setIsLoginModalOpen(true)}
                    className="shrink-0 bg-primary hover:bg-primary/90 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    {t("loginToJoin")}
                  </button>
                </div>
              </div>
            )}

            <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1">
              {activeTab === "dashboard" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
                  <MobileHero />
                  <div className="hidden md:grid grid-cols-12 grid-rows-2 gap-6 h-[700px]">
                    <div
                      className={`col-span-6 row-span-1 rounded-[48px] overflow-hidden relative group ios27-card p-12 flex flex-col justify-between`}
                    >
                      <div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">
                          {arrivalCode
                            ? `Arriving at ${arrivalCode}`
                            : t("destination")}
                        </div>
                        <h2 className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-2 leading-[0.9]">
                          {currentTrip.destination}
                        </h2>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">
                          <Calendar size={14} /> {currentTrip.startDate} —{" "}
                          {currentTrip.endDate}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2">
                          {(currentTrip.flights || [])
                            .filter((f) => f.user_id === user?.id)
                            .map((f) => {
                               // Collect outgoing and returning flight numbers
                               const numbers = [];
                               if (f.outbound?.flightNumber) numbers.push({ num: f.outbound.flightNumber, isReturn: false });
                               if (f.inbound?.flightNumber) numbers.push({ num: f.inbound.flightNumber, isReturn: true });
                               return numbers;
                            })
                            .flat()
                            .map((item, i) => (
                            <div
                              key={i}
                              className={`text-[10px] font-black px-4 py-2 rounded-xl flex items-center gap-2 border transition-all hover:scale-105 ${
                                item.isReturn
                                 ? "bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-300 border-slate-200/60 dark:border-white/10"
                                 : "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 shadow-sm"
                              }`}
                            >
                              <Plane size={12} className={item.isReturn ? "rotate-180" : ""} /> {item.num}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 row-span-1 ios27-card rounded-[40px] p-6 flex flex-col relative group/budget">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-primary/10 dark:bg-primary/20 text-primary p-2.5 rounded-2xl">
                          <Wallet size={20} />
                        </div>
                        {!isGuest && (
                          <button
                            onClick={() => {
                              setTempBudget(budgetLimit.toString());
                              setIsEditingBudget(true);
                            }}
                            className="p-2 text-slate-300 hover:text-primary rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-end space-y-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {t("budgetStatus")}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">
                            {Math.round(budgetPercent)}
                            <span className="text-lg">%</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full mt-2 mb-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              spentTotal > budgetLimit
                                ? "bg-red-500"
                                : "bg-primary"
                            }`}
                            style={{
                              width: `${Math.min(budgetPercent, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                          <div>
                            <div className="text-slate-300 dark:text-slate-500 mb-0.5">
                              {t("spent")}
                            </div>
                            <div
                              className={
                                spentTotal > budgetLimit
                                  ? "text-red-500"
                                  : "text-slate-700 dark:text-slate-200"
                              }
                            >
                              NT$ {(spentTotal / 1000).toFixed(1)}k
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-300 dark:text-slate-500 mb-0.5">
                              {t("limit")}
                            </div>
                            <div className="text-slate-700 dark:text-slate-200">
                              NT$ {(budgetLimit / 1000).toFixed(1)}k
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 row-span-1 ios27-card rounded-[40px] p-6 flex flex-col">
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <PieChartIcon size={14} /> {t("breakdown")}
                      </div>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={5}
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
                            <RechartsTooltip formatter={(value: number) => `NT$ ${Math.round(value).toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="col-span-4 row-span-1 ios27-card rounded-[40px] p-8 flex flex-col overflow-hidden">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <MapPin size={14} /> {t("upcomingSchedule")}
                      </div>
                      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                        {upcomingItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex gap-4 group cursor-pointer"
                            onClick={() =>
                              window.open(
                                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  item.placeName
                                )}`,
                                "_blank"
                              )
                            }
                          >
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                              {i !== upcomingItems.length - 1 && (
                                <div className="w-0.5 flex-1 bg-slate-100 dark:bg-white/10 my-1" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                                {item.placeName}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {item.date} • {item.time}
                              </div>
                            </div>
                          </div>
                        ))}
                        {upcomingItems.length === 0 && (
                          <div className="text-slate-300 dark:text-slate-600 font-bold text-xs uppercase text-center py-8">
                            {t("noUpcoming")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4 row-span-1 ios27-card rounded-[40px] p-8 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <CheckSquare size={14} /> {t("checklistSummary")}
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                          {packingPercent}%
                        </div>
                      </div>
                      <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-2">
                        {checklistStats.map((stat) => (
                          <div
                            key={stat.category}
                            className="flex items-center gap-3"
                          >
                            <div className="w-20 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              {stat.category}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${
                                    (stat.completed / stat.total) * 100
                                  }%`,
                                }}
                              />
                            </div>
                            <div className="text-[10px] font-black text-slate-400 w-8 text-right">
                              {stat.completed}/{stat.total}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-4 row-span-1 flex flex-col gap-6">
                      <div className="flex-1 ios27-card rounded-[40px] p-8 flex flex-col justify-center relative overflow-hidden group">
                        <div className="relative z-10">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            {t("countdown")}
                          </div>
                          <div className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white">
                            {displayDays > 0 ? displayDays : 0}
                          </div>
                          <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                            {t("daysLeft")}
                          </div>
                        </div>
                        <Clock className="absolute -right-4 -bottom-4 text-slate-100 dark:text-white/[0.04] w-32 h-32 rotate-12 transition-transform group-hover:rotate-45 duration-700" />
                      </div>
                      {isCreator && (
                        <button
                          onClick={handleDeleteTrip}
                          className="h-16 flex items-center justify-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest bg-white dark:bg-white/[0.04] border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-3xl transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Trash2 size={16} /> {t("deleteTrip")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* TODO: [Optimized] Wrap lazy-loaded components in Suspense and pass down pre-fetched currentUser prop */}
              <Suspense fallback={
                <div className="flex items-center justify-center p-20">
                  <Loader2 className="animate-spin text-primary w-10 h-10" />
                </div>
              }>
                {activeTab === "itinerary" && (
                  <Itinerary
                    trip={currentTrip}
                    currentUser={user!}
                    onUpdate={updateCurrentTrip}
                    isGuest={isGuest}
                  />
                )}
                {activeTab === "checklist" && (
                  <Checklist
                    trip={currentTrip}
                    currentUser={user!}
                    onUpdate={updateCurrentTrip}
                    isGuest={isGuest}
                  />
                )}
                {activeTab === "expenses" && (
                  <Expenses
                    trip={currentTrip}
                    currentUser={user!}
                    onUpdate={updateCurrentTrip}
                    isGuest={isGuest}
                  />
                )}
                {activeTab === "flights" && (
                  <FlightManager
                    trip={currentTrip}
                    currentUser={user!}
                    onUpdate={updateCurrentTrip}
                    isGuest={isGuest}
                  />
                )}
              </Suspense>
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
                    `${window.location.origin}/?tripId=${currentTrip.id}`
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
                onNotify={(message, type) => setNotification({ message, type })}
              />
            )}
            {isEditingBudget && !isGuest && (
              <BudgetModal
                initialValue={budgetLimit.toString()}
                onClose={() => setIsEditingBudget(false)}
                onSave={saveBudget}
              />
            )}
            {/* Instagram / Dynamic Island Floating Bottom Navigation Dock */}
            <div className="md:hidden fixed bottom-[max(0.875rem,env(safe-area-inset-bottom))] inset-x-4 max-w-lg mx-auto z-50 pointer-events-none">
              <nav 
                aria-label="Mobile Navigation"
                className="pointer-events-auto bg-white/85 dark:bg-[#060709]/85 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.14] ring-1 ring-white/60 dark:ring-white/10 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.16)] dark:shadow-[0_20px_48px_-8px_rgba(0,0,0,0.85)] rounded-full px-2.5 py-1.5 flex items-center justify-between gap-1 transition-all duration-300"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDisabled = isPricePending && tab.id !== "flights";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                      disabled={isDisabled}
                      aria-label={tab.label}
                      className={`relative flex flex-col items-center justify-center flex-1 py-1 rounded-full gap-0.5 transition-all duration-200 ease-spring active:scale-90 select-none cursor-pointer ${
                        isDisabled ? "opacity-35 cursor-not-allowed active:scale-100" : ""
                      }`}
                    >
                      <div
                        className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-300 ${
                          isActive
                            ? "bg-primary/15 dark:bg-primary/25 text-primary scale-105 shadow-sm"
                            : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        {isDisabled ? (
                          <Lock size={17} />
                        ) : (
                          <tab.icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                        )}
                        {tab.alert && (
                          <span className="absolute top-0.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#060709] animate-pulse" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold tracking-tight transition-all duration-200 ${
                          isActive
                            ? "text-primary font-black scale-100"
                            : "text-slate-400 dark:text-slate-500 scale-95"
                        }`}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
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
              onClick={() => {
                setView(user ? "list" : "landing");
                setCurrentTripId(null);
              }}
              className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {t("backHome")}
            </button>
          </div>
        )}

        {view === "list" && (
          <div className="p-4 sm:p-10 pb-28 max-w-7xl mx-auto min-h-screen relative">
            <header className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-2.5">
                <div className="text-lg font-bold text-primary tracking-tight">
                  {t("appName")}
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.08]">
                  v{APP_VERSION}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <GlobalNav />
                <UserHeaderProfile />
              </div>
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
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {t("yourTrips")}
                  </h2>
                  <p className="text-slate-400 font-semibold text-xs sm:text-sm mt-1">
                    {trips.length > 0 ? (
                      language === "zh" ? (
                        `${trips.length} 個旅程 • ${tripCounts.upcoming} 個即將到來`
                      ) : (
                        `${trips.length} trips • ${tripCounts.upcoming} upcoming`
                      )
                    ) : (
                      language === "zh" ? "尚無已建立的旅程" : "No trips created yet"
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {trips.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsEditMode((prev) => !prev)}
                      data-testid="toggle-edit-mode-btn"
                      className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer border ${
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
                    onClick={() => setShowCreateForm(true)}
                    className="hidden sm:inline-flex bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-2xl items-center gap-2 font-bold text-sm shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                  >
                    <Plus size={18} /> {t("newTrip")}
                  </button>
                </div>
              </div>

              {/* Edit Mode Notice Banner */}
              {isEditMode && trips.length > 0 && (
                <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Trash2 size={15} />
                    <span>{t("manageTripsHint")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
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
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-2xl border border-slate-200/60 dark:border-white/[0.08] self-start md:self-auto overflow-x-auto max-w-full">
                    <button
                      type="button"
                      onClick={() => setTripFilter("all")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        tripFilter === "all"
                          ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <span>{t("filterAll")}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        tripFilter === "upcoming"
                          ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <span>{t("filterUpcoming")}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        tripFilter === "past"
                          ? "bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <span>{t("filterPast")}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="bg-primary hover:bg-primary/95 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={18} /> {t("createFirstTrip")}
                </button>
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
                    currentUserId={user?.id}
                    isEditMode={isEditMode}
                    onSelect={(id) => {
                      setCurrentTripId(id);
                      setView("detail");
                    }}
                    onDeleteClick={(target) => setTripToDelete(target)}
                    calculateTripTotal={calculateTripTotal}
                    getGradient={getGradient}
                  />
                ))}
              </div>
            )}
            {showCreateForm && (
              <TripForm
                onClose={() => setShowCreateForm(false)}
                onSubmit={handleCreateTripSubmit}
              />
            )}
            {/* Mobile Floating Action Button (FAB) for New Trip */}
            <div className="sm:hidden fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                aria-label={t("newTrip")}
                className="w-14 h-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/40 flex items-center justify-center active:scale-90 transition-transform duration-200 cursor-pointer"
              >
                <Plus size={24} strokeWidth={2.5} />
              </button>
            </div>
          </div>
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
    </LocalizationProvider>
  );
};

export default App;
