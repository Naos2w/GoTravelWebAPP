import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  useMemo,
} from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Trip, Currency, Theme, Language, User } from "./types";
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
  supabase,
} from "./services/storageService";
import {
  useTranslation,
  LocalizationProvider,
  translations,
} from "./contexts/LocalizationContext";
import { Checklist } from "./components/Checklist";
import { Itinerary } from "./components/Itinerary";
import { Expenses } from "./components/Expenses";
import { TripForm } from "./components/TripForm";
import { FlightManager } from "./components/FlightManager";
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




const NotificationToast: React.FC<{
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}> = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-slate-900 dark:bg-white",
  };
  const textColors = {
    success: "text-white",
    error: "text-white",
    info: "text-white dark:text-slate-900",
  };
  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] ${bgColors[type]} ${textColors[type]} px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300`}
    >
      {type === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
      <span className="text-sm font-black tracking-wide">{message}</span>
    </div>
  );
};

const BudgetModal: React.FC<{
  onClose: () => void;
  onSave: (val: string) => void;
  initialValue: string;
}> = ({ onClose, onSave, initialValue }) => {
  const { t } = useTranslation();
  const [val, setVal] = useState(initialValue);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black dark:text-white">
            {t("editBudget")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            {t("amount")} (TWD)
          </label>
          <input
            autoFocus
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-primary/20 dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onSave(val)}
            className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            {t("save")}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl font-black"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

const ShareModal: React.FC<{
  trip: Trip;
  user: User;
  onClose: () => void;
  onInvite: (email: string) => void;
  onRemoveInvite: (email: string) => void;
  copyLink: () => void;
}> = ({ trip, user, onClose, onInvite, onRemoveInvite, copyLink }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const isOwner = trip.user_id === user.id;

  // Identify owner email to prevent duplication in list
  const ownerEmail =
    trip.collaborators?.find((c) => c.user_id === trip.user_id)?.email || "";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[32px] p-6 shadow-2xl flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {t("shareTrip")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("shareLink")}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-xs font-mono text-slate-500 truncate select-all">{`${window.location.origin}/?tripId=${trip.id}`}</div>
              <button
                onClick={copyLink}
                className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-black text-xs transition-all hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {t("copy")}
              </button>
            </div>
          </div>
          <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1" />
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("inviteEmail")}
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-primary/20 dark:text-white"
                placeholder={t("emailPlaceholder")}
              />
              <button
                disabled={!email.trim()}
                onClick={() => {
                  onInvite(email);
                  setEmail("");
                }}
                className="bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg shadow-primary/20"
              >
                {t("invite")}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("collaborators")}
            </label>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[9px] shadow-lg shadow-primary/20">
                  {isOwner ? "YOU" : "OWN"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {isOwner ? t("youOwner") : t("creator")}
                  </div>
                </div>
              </div>
              {trip.allowed_emails &&
                trip.allowed_emails
                  .filter((e) => {
                    const lowerE = e.toLowerCase();
                    // Exclude current user (viewer) and the owner
                    return (
                      lowerE !== user.email.toLowerCase() &&
                      lowerE !== ownerEmail.toLowerCase()
                    );
                  })
                  .map((e, i) => {
                    // Check if this email exists in trip_collaborators (meaning they joined)
                    const isJoined = trip.collaborators?.some(
                      (c) =>
                        c.email && c.email.toLowerCase() === e.toLowerCase()
                    );

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2 group hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-all"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isJoined
                              ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-500"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                          }`}
                        >
                          {isJoined ? (
                            <Users size={14} />
                          ) : (
                            <PendingIcon size={14} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                            {e}
                          </div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            {isJoined ? t("statusJoined") : t("statusPending")}
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => onRemoveInvite(e)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <CloseIcon size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"landing" | "list" | "detail">("landing");
  const [isLoading, setIsLoading] = useState(true);
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

  const saveTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const joinLockRef = useRef<string | null>(null);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);

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
  // Move refreshActiveTrip outside to be accessible
  const refreshActiveTrip = async () => {
    if (!currentTripId || !user) return;

    try {
        const updatedTrip = await getTripById(currentTripId);

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
      // Checklist Items: Split for DELETE support
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "checklist_items",
          // Unfiltered DELETE to catch removals
        },
        () => refreshActiveTrip()
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
    setUser({
      id: supabaseUser.id,
      name: supabaseUser.user_metadata.full_name,
      email: supabaseUser.email!,
      picture: supabaseUser.user_metadata.avatar_url || "",
    });

    // Read the URL param directly here, before any state updates can clear it
    const urlParams = new URLSearchParams(window.location.search);
    const urlTripId = urlParams.get("tripId");

    if (urlTripId) {
      setIsLoading(true);
      try {
        const trip = await getTripById(urlTripId);
        if (trip) {
          const userEmailLower = supabaseUser.email.toLowerCase();
          const isOwner = trip.user_id === supabaseUser.id;
          const isAllowed = trip.allowed_emails?.some(
            (e) => e.toLowerCase() === userEmailLower
          );

          if (isOwner || isAllowed) {
            setCurrentTripId(urlTripId);
            setView("detail");
          } else {
            setNotification({
              message: translations[language].accessDenied || "Access Denied",
              type: "error",
            });
            setView("list");
          }
        } else {
          setView("list");
        }
      } catch (e) {
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
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        if (!window.location.hash.includes("access_token")) {
          setIsLoading(false);
          setView("landing");
        }
      }
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          handleAuthUser(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setView("landing");
          setTrips([]);
          setIsLoading(false);
        } else {
          if (!session && !window.location.hash.includes("access_token")) {
            setIsLoading(false);
          }
        }
      });
      return () => subscription.unsubscribe();
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  const loadTrips = async () => {
    if (!user) return;
    try {
      const userTrips = await getTrips(user.id, user.email);
      setTrips(userTrips);
    } catch (err: any) {
      setError(err.message || "Failed to load trips");
    }
  };

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  const isCreator =
    user &&
    currentTrip &&
    (currentTrip.user_id === user.id || !currentTrip.user_id);
  const isGuest = user && currentTrip && currentTrip.user_id !== user.id;
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
    
    // Clear any pending save immediately to prevent race conditions
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );

    // Immediate action handlers
    if (action === "DELETE_EXPENSE" && payload) {
       console.log("[App] Handling DELETE_EXPENSE for:", payload);
       // Delete immediately from DB to avoid sync lag
       deleteExpense(payload, updatedTrip.id)
          .then(() => {
              console.log("[App] DB Delete successful for:", payload);
              // Broadcast the deletion event to all clients
              activeChannelRef.current?.send({
                  type: 'broadcast',
                  event: 'EXPENSE_DELETED',
                  payload: { id: payload }
              });
          })
          .catch(err => console.error("[App] Delete expense failed:", err));
       return; // Skip the debounced saveTrip for this action as it's already handled
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try {
        await saveTrip(updatedTrip, user.id);
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setIsSyncing(false);
        saveTimeoutRef.current = null;
      }
    }, 600);
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

  const handleDeleteTrip = async () => {
    if (!user || !currentTrip) return;
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      // Broadcast first so others can see it before access is cut
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'TRIP_DELETED',
        payload: { id: currentTrip.id }
      });

      await deleteTrip(currentTrip.id, user.id);
      setTrips((prev) => prev.filter((t) => t.id !== currentTrip.id));
      setCurrentTripId(null);
      setView("list");
    } catch (err) {
      alert("Failed to delete trip.");
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
    return Object.entries(dataMap).map(([name, value]) => ({ name, value }));
  }, [currentTrip]);

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

  const GlobalNav = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
      >
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>
      <button
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
      >
        <Languages size={20} />
      </button>
    </div>
  );

  const UserHeaderProfile = () => {
    if (!user) return null;
    return (
      <div className="flex items-center gap-3 pl-3 border-l border-slate-100 dark:border-slate-800">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-black truncate max-w-[100px]">
            {user.name}
          </div>
          {view === "detail" && currentTrip && (
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {isCreator ? t("permissionEditor") : t("permissionGuest")}
            </div>
          )}
        </div>
        <img
          src={user.picture}
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 object-cover border-2 border-white dark:border-slate-700 shadow-sm"
        />
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  };

  const MobileHero = () => {
    return (
      <div className="md:hidden space-y-4 mb-6">
        <div className="w-full rounded-[32px] p-8 shadow-ios border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
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
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-ios border border-slate-100 dark:border-slate-700 space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t("countdown")}
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {displayDays > 0 ? displayDays : 0} {t("daysLeft")}
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  spentTotal > budgetLimit ? "bg-red-500" : "bg-indigo-500"
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
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
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
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 active:scale-[0.98] transition-all"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      i === 0
                        ? "bg-primary/10 text-primary"
                        : "bg-slate-50 dark:bg-slate-700 text-slate-400"
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
                  <div className="text-slate-300">
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

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#ffc658",
  ];

  if (view === "landing") {
    return (
      <LocalizationProvider value={{ t, language, setLanguage }}>
        <div
          className={`min-h-screen transition-all duration-500 ${
            theme === "dark"
              ? "dark bg-[#1C1C1E] text-slate-100"
              : "bg-[#FBFBFD] text-slate-900"
          }`}
        >
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
                  className="bg-primary text-white px-10 py-5 rounded-[24px] font-black text-lg shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                  {t("login")}
                </button>
              </div>
            </div>
            <footer className="absolute bottom-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {t("appName")} © 2024
            </footer>
          </div>
        </div>
      </LocalizationProvider>
    );
  }

  return (
    <LocalizationProvider value={{ t, language, setLanguage }}>
      <div
        className={`min-h-screen transition-all duration-500 ${
          theme === "dark"
            ? "dark bg-[#1C1C1E] text-slate-100"
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
          <div className="min-h-screen flex flex-col pb-24 md:pb-0">
            <nav className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 h-20 flex items-center px-4 sm:px-8">
              <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <button
                    onClick={() => {
                      setView("list");
                      setCurrentTripId(null);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <div className="truncate">
                    <div className="text-xl font-black truncate">
                      {currentTrip.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {currentTrip.destination}
                      </span>
                      <span className="hidden sm:inline-block w-1 h-1 bg-slate-200 rounded-full" />
                      <span className="hidden sm:flex text-[9px] font-black text-slate-400 items-center gap-1 uppercase tracking-widest">
                        <Users size={10} /> {collaboratorCount} Members
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex bg-slate-100/60 dark:bg-slate-800/60 p-1.5 rounded-2xl">
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
                          className={`relative px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                            isActive
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios"
                              : "text-slate-500 hover:bg-slate-100"
                          } ${
                            isDisabled ? "opacity-40 cursor-not-allowed" : ""
                          }`}
                        >
                          {isDisabled && <Lock size={12} />}
                          <tab.icon size={16} strokeWidth={isActive ? 3 : 2} />
                          <span className="hidden lg:inline">{tab.label}</span>
                          {tab.alert && (
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() =>
                      !isGuest ? setIsShareModalOpen(true) : null
                    }
                    className={`p-2.5 rounded-xl transition-all ${
                      isGuest
                        ? "opacity-30 cursor-not-allowed"
                        : "text-slate-400 hover:text-primary"
                    }`}
                    disabled={isGuest}
                  >
                    <Share2 size={22} />
                  </button>
                  <GlobalNav />
                  <UserHeaderProfile />
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1">
              {activeTab === "dashboard" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
                  <MobileHero />
                  <div className="hidden md:grid grid-cols-12 grid-rows-2 gap-6 h-[700px]">
                    <div
                      className={`col-span-6 row-span-1 rounded-[48px] overflow-hidden relative group shadow-ios-lg p-12 flex flex-col justify-between border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800`}
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
                          {Array.from(
                            new Set(
                              allFlights
                                .map((f) => f.outbound.flightNumber)
                                .filter(Boolean)
                            )
                          ).map((fn) => (
                            <div
                              key={fn}
                              className="text-[10px] font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                            >
                              <Plane size={12} /> {fn}
                            </div>
                          ))}
                          {Array.from(
                            new Set(
                              allFlights
                                .map((f) => f.inbound?.flightNumber)
                                .filter(Boolean)
                            )
                          ).map((fn) => (
                            <div
                              key={fn}
                              className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl text-slate-400 flex items-center gap-2 hover:scale-105 transition-all"
                            >
                              <Plane size={12} className="rotate-180" /> {fn}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-6 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col relative group/budget">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 p-2 rounded-xl">
                          <Wallet size={20} />
                        </div>
                        {!isGuest && (
                          <button
                            onClick={() => {
                              setTempBudget(budgetLimit.toString());
                              setIsEditingBudget(true);
                            }}
                            className="p-2 text-slate-300 hover:text-indigo-500 rounded-lg transition-all"
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
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 mb-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              spentTotal > budgetLimit
                                ? "bg-red-500"
                                : "bg-indigo-500"
                            }`}
                            style={{
                              width: `${Math.min(budgetPercent, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-700/50">
                          <div>
                            <div className="text-slate-300 dark:text-slate-600 mb-0.5">
                              {t("spent")}
                            </div>
                            <div
                              className={
                                spentTotal > budgetLimit
                                  ? "text-red-500"
                                  : "text-slate-700 dark:text-slate-300"
                              }
                            >
                              ${(spentTotal / 1000).toFixed(1)}k
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-300 dark:text-slate-600 mb-0.5">
                              {t("limit")}
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                              ${(budgetLimit / 1000).toFixed(1)}k
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-6 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col">
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
                            >
                              {chartData.map((e, i) => (
                                <Cell
                                  key={`cell-${i}`}
                                  fill={COLORS[i % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="col-span-4 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-8 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col overflow-hidden">
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
                                <div className="w-0.5 flex-1 bg-slate-100 dark:bg-slate-700 my-1" />
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
                          <div className="text-slate-300 font-bold text-xs uppercase text-center py-8">
                            {t("noUpcoming")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-8 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col">
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
                            <div className="w-20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {stat.category}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
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
                      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[40px] p-8 shadow-ios flex flex-col justify-center relative overflow-hidden group">
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
                        <Clock className="absolute -right-4 -bottom-4 text-slate-100 dark:text-slate-700 w-32 h-32 rotate-12 transition-transform group-hover:rotate-45 duration-700" />
                      </div>
                      {!isGuest && (
                        <button
                          onClick={handleDeleteTrip}
                          className="h-16 flex items-center justify-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest bg-white dark:bg-slate-800 border border-red-50 dark:border-red-900/30 hover:bg-red-50 rounded-3xl transition-all shadow-sm"
                        >
                          <Trash2 size={16} /> {t("deleteTrip")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "itinerary" && (
                <Itinerary
                  trip={currentTrip}
                  onUpdate={updateCurrentTrip}
                  isGuest={isGuest}
                />
              )}
              {activeTab === "checklist" && (
                <Checklist
                  trip={currentTrip}
                  onUpdate={updateCurrentTrip}
                  isGuest={isGuest}
                />
              )}
              {activeTab === "expenses" && (
                <Expenses
                  trip={currentTrip}
                  onUpdate={updateCurrentTrip}
                  isGuest={isGuest}
                />
              )}
              {activeTab === "flights" && (
                <FlightManager
                  trip={currentTrip}
                  onUpdate={updateCurrentTrip}
                  isGuest={isGuest}
                />
              )}
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
            {isEditingBudget && !isGuest && (
              <BudgetModal
                initialValue={budgetLimit.toString()}
                onClose={() => setIsEditingBudget(false)}
                onSave={saveBudget}
              />
            )}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-50 pb-safe">
              <div className="flex justify-around items-center p-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDisabled = isPricePending && tab.id !== "flights";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                      disabled={isDisabled}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-slate-400"
                      } ${isDisabled ? "opacity-30" : ""}`}
                    >
                      {isDisabled ? (
                        <Lock size={20} />
                      ) : (
                        <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                      )}
                      {tab.alert && (
                        <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="p-6 sm:p-12 max-w-7xl mx-auto min-h-screen">
            <header className="flex justify-between items-center mb-16">
              <div className="text-2xl font-black text-primary tracking-tighter">
                {t("appName")}
              </div>
              <div className="flex items-center gap-4">
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
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-5xl font-black tracking-tight mb-2">
                  {t("yourTrips")}
                </h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">
                  Total {trips.length} Adventures
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary text-white px-8 py-5 rounded-[24px] flex items-center gap-2 font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Plus size={20} /> {t("newTrip")}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => {
                    setCurrentTripId(trip.id);
                    setView("detail");
                  }}
                  className="group bg-white dark:bg-slate-800 rounded-[56px] shadow-ios overflow-hidden cursor-pointer transition-all hover:-translate-y-4 hover:shadow-ios-lg"
                >
                  <div
                    className={`h-72 relative overflow-hidden bg-gradient-to-br ${getGradient(
                      trip.destination
                    )} flex flex-col justify-end p-12 transition-all duration-1000 group-hover:scale-105`}
                  >
                    <h3 className="text-white text-4xl font-black truncate mb-1">
                      {trip.name}
                    </h3>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em]">
                      {trip.startDate} - {trip.endDate}
                    </p>
                  </div>
                  <div className="p-10 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <span>{trip.destination}</span>
                    <span className="text-primary">
                      NT$ {calculateTripTotal(trip).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {showCreateForm && (
              <TripForm
                onClose={() => setShowCreateForm(false)}
                onSubmit={handleCreateTripSubmit}
              />
            )}
          </div>
        )}
      </div>
    </LocalizationProvider>
  );
};

export default App;
