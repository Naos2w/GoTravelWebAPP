import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { Trip, Currency, Theme, Language, User } from "./types";
import {
  getTrips,
  getTripById,
  saveTrip,
  saveExpenseOnly,
  supabase,
} from "./services/storageService";
import { Checklist } from "./components/Checklist";
import { Itinerary } from "./components/Itinerary";
import { Expenses } from "./components/Expenses";
import { TripForm } from "./components/TripForm";
import { FlightManager } from "./components/FlightManager";
import { GoogleGenAI } from "@google/genai";
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
  Cloud,
  Share2,
  Luggage,
  Sparkles,
  Check,
  Edit2,
  Clock,
  MapPin,
  Map,
  CloudRain,
  SunMedium,
  ExternalLink,
  Coffee,
  Wallet,
  Coins,
  LogIn,
} from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const translations = {
  zh: {
    appName: "Go Travel",
    yourTrips: "您的旅程",
    newTrip: "新增",
    overview: "概覽",
    itinerary: "行程",
    checklist: "清單",
    expenses: "花費",
    tickets: "機票",
    syncing: "同步中...",
    countdown: "出發倒數",
    packingProgress: "行李準備",
    budgetStatus: "預算進度",
    daysLeft: "天",
    budget: "預算",
    permissionEditor: "擁有者",
    upcoming: "即將到來的行程",
    noUpcoming: "尚無行程資料",
    export: "備份匯出",
    weather7Day: "天氣預報",
    deleteTrip: "刪除旅程",
    confirmDelete: "確定刪除？",
    heroTitle: "聰明規劃，\n自在旅行。",
    heroSubtitle: "全方位的旅程規劃空間。",
    startPlanning: "立即體驗",
    copied: "已複製",
    shareTrip: "分享",
    guestMode: "協作者",
    save: "儲存",
    cancel: "取消",
    login: "登入",
  },
  en: {
    appName: "Go Travel",
    yourTrips: "Trips",
    newTrip: "New",
    overview: "Overview",
    itinerary: "Itinerary",
    checklist: "Checklist",
    expenses: "Expenses",
    tickets: "Tickets",
    syncing: "Syncing...",
    countdown: "Due",
    packingProgress: "Pack",
    budgetStatus: "Budget",
    daysLeft: "D",
    budget: "Budget",
    permissionEditor: "Owner",
    upcoming: "Upcoming",
    noUpcoming: "Empty",
    export: "Export",
    weather7Day: "Forecast",
    deleteTrip: "Delete",
    confirmDelete: "Delete?",
    heroTitle: "Travel Smart.",
    heroSubtitle: "All-in-one workspace.",
    startPlanning: "Start",
    copied: "Copied",
    shareTrip: "Share",
    guestMode: "Guest",
    save: "Save",
    cancel: "Cancel",
    login: "Login",
  },
};

const calculateExpensesTotal = (trip: Trip): number => {
  return trip.expenses.reduce(
    (sum, item) => sum + item.amount * (item.exchangeRate || 1),
    0
  );
};

type LocalizationContextType = {
  t: (key: keyof typeof translations.en) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined
);

export const useTranslation = () => {
  const context = useContext(LocalizationContext);
  if (!context)
    throw new Error(
      "useTranslation must be used within a LocalizationProvider"
    );
  return context;
};

interface WeatherDay {
  date: string;
  temp: string;
  condition: string;
  icon: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"landing" | "list" | "detail">(
    () => (sessionStorage.getItem("appView") as any) || "landing"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tripId") || sessionStorage.getItem("currentTripId");
  });
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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState<number>(50000);
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([]);
  const [weatherSource, setWeatherSource] = useState<string | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  // --- Optimized Debounced Real-time Sync ---
  useEffect(() => {
    if (!currentTripId) return;

    const refreshActiveTrip = async () => {
      // Use debounce to prevent multiple rapid refreshes when a user saves a trip
      // (because saveTrip triggers several deletes and inserts)
      if (refreshTimeoutRef.current)
        window.clearTimeout(refreshTimeoutRef.current);

      refreshTimeoutRef.current = window.setTimeout(async () => {
        console.log("Sync triggered: Fetching latest trip data...");
        const updatedTrip = await getTripById(currentTripId);
        if (updatedTrip) {
          setTrips((prev) =>
            prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
          );
        }
      }, 500);
    };

    // Listen to changes globally and filter client-side for maximum reliability
    const channel = supabase
      .channel(`realtime-sync-${currentTripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (p) => {
          if ((p.new as any)?.id === currentTripId) refreshActiveTrip();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items" },
        (p) => {
          if (
            (p.new as any)?.trip_id === currentTripId ||
            (p.old as any)?.trip_id === currentTripId
          )
            refreshActiveTrip();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_items" },
        (p) => {
          if (
            (p.new as any)?.trip_id === currentTripId ||
            (p.old as any)?.trip_id === currentTripId
          )
            refreshActiveTrip();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        (p) => {
          if (
            (p.new as any)?.trip_id === currentTripId ||
            (p.old as any)?.trip_id === currentTripId
          )
            refreshActiveTrip();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.log("Realtime connected for trip:", currentTripId);
      });

    return () => {
      supabase.removeChannel(channel);
      if (refreshTimeoutRef.current)
        window.clearTimeout(refreshTimeoutRef.current);
    };
  }, [currentTripId]);

  useEffect(() => {
    sessionStorage.setItem("appView", view);
  }, [view]);

  useEffect(() => {
    if (currentTripId) {
      sessionStorage.setItem("currentTripId", currentTripId);
      const url = new URL(window.location.href);
      url.searchParams.set("tripId", currentTripId);
      window.history.replaceState({}, "", url);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("tripId");
      window.history.replaceState({}, "", url);
    }
  }, [currentTripId]);

  useEffect(() => {
    localStorage.setItem("lang", language);
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const initGoogleLogin = () => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });

    const renderBtn = (id: string, width: number) => {
      const el = document.getElementById(id);
      if (el) {
        window.google.accounts.id.renderButton(el, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          width,
        });
      }
    };

    setTimeout(() => {
      renderBtn("google-login-hero", 280);
      renderBtn("google-login-header-right", 120);
    }, 100);
  };

  const handleCredentialResponse = async (response: any) => {
    try {
      await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });
    } catch (e) {
      console.error("Auth Error", e);
    }
  };

  useEffect(() => {
    if (!user) {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGoogleLogin();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [view, theme, user]);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) handleAuthUser(session.user);
      else {
        setIsLoading(false);
        if (view !== "landing") setView("landing");
      }
    };
    checkSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) handleAuthUser(session.user);
      else if (event === "SIGNED_OUT") {
        setUser(null);
        setView("landing");
        setTrips([]);
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuthUser = (supabaseUser: any) => {
    setUser({
      id: supabaseUser.id,
      name: supabaseUser.user_metadata.full_name,
      email: supabaseUser.email!,
      picture: supabaseUser.user_metadata.avatar_url || "",
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tripId")) {
      setView("detail");
    } else {
      setView((prev) => (prev === "landing" ? "list" : prev));
    }
  };

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  const loadTrips = async () => {
    if (!user) return;
    try {
      const userTrips = await getTrips(user.id);
      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("tripId");

      let allTrips = [...userTrips];
      if (sharedId && !userTrips.find((t) => t.id === sharedId)) {
        const sharedTrip = await getTripById(sharedId);
        if (sharedTrip) allTrips.push(sharedTrip);
      }
      setTrips(allTrips);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentTrip = trips.find((t) => t.id === currentTripId);
  const isCreator =
    user &&
    currentTrip &&
    (currentTrip.user_id === user.id || !currentTrip.user_id);
  const isGuest = user && currentTrip && currentTrip.user_id !== user.id;

  useEffect(() => {
    if (currentTrip) {
      load7DayWeather();
    }
  }, [currentTripId]);

  const load7DayWeather = async () => {
    if (!currentTrip) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a 7-day weather forecast for ${currentTrip.destination}. Return ONLY a JSON array. Date (MM/DD), Temp (min-max°C), Condition, Icon (sun, cloud, rain, wind).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });
      setWeatherForecast(JSON.parse(response.text || "[]"));
      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0 && chunks[0].web)
        setWeatherSource(chunks[0].web.uri);
    } catch (e) {
      console.error(e);
    }
  };

  const t = (key: keyof typeof translations.en) =>
    (translations as any)[language][key] || (translations as any).en[key];

  const updateCurrentTrip = (updatedTrip: Trip) => {
    if (!user) return;

    // Optimistic UI Update
    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try {
        if (isGuest) {
          const originalTrip = trips.find((t) => t.id === updatedTrip.id);
          if (
            originalTrip &&
            updatedTrip.expenses.length > originalTrip.expenses.length
          ) {
            const newExpenses = updatedTrip.expenses.filter(
              (ne) => !originalTrip.expenses.some((oe) => oe.id === ne.id)
            );
            if (newExpenses.length > 0) {
              await saveExpenseOnly(updatedTrip.id, newExpenses[0]);
            }
          }
        } else {
          await saveTrip(updatedTrip, user.id);
        }
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setIsSyncing(false);
        saveTimeoutRef.current = null;
      }
    }, 600);
  };

  const handleCreateTripSubmit = async (newTrip: Trip) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await saveTrip(newTrip, user.id);
      setTrips((prev) => [newTrip, ...prev]);
      setCurrentTripId(newTrip.id);
      setView("detail");
      setShowCreateForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const GlobalNav = () => (
    <div className="flex items-center gap-1 sm:gap-2 relative z-50">
      <button
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all"
      >
        <Languages size={18} />
      </button>
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all"
      >
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      {user && (
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-2 ml-1 rounded-xl text-slate-400 hover:text-red-500 transition-all"
        >
          <LogOut size={18} />
        </button>
      )}
    </div>
  );

  const UserHeaderProfile = () => {
    if (!user)
      return (
        <div className="flex items-center gap-2">
          <div
            id="google-login-header-right"
            className="min-w-[40px] h-[40px] flex items-center justify-center overflow-hidden"
          >
            <button className="flex items-center gap-2 text-xs font-black text-slate-400 opacity-60">
              <LogIn size={14} /> {t("login")}
            </button>
          </div>
        </div>
      );
    return (
      <div className="flex items-center gap-3 pl-4 border-l border-slate-100 dark:border-slate-800">
        <div className="hidden lg:block text-right">
          <div className="text-[10px] font-black text-slate-900 dark:text-white leading-none">
            {user.name}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {isCreator ? t("permissionEditor") : t("guestMode")}
          </div>
        </div>
        <div className="w-10 h-10 rounded-full border-primary overflow-hidden shadow-lg p-0.5 shrink-0">
          <img
            src={user.picture}
            className="w-full h-full rounded-full object-cover"
            alt={user.name}
          />
        </div>
      </div>
    );
  };

  const tabs = [
    { id: "dashboard", label: t("overview"), icon: LayoutDashboard },
    { id: "itinerary", label: t("itinerary"), icon: Calendar },
    { id: "checklist", label: t("checklist"), icon: CheckSquare },
    { id: "expenses", label: t("expenses"), icon: DollarSign },
    { id: "flights", label: t("tickets"), icon: Plane },
  ];

  const getDaysLeft = () => {
    if (!currentTrip) return 0;
    const start = new Date(currentTrip.startDate + "T00:00:00");
    const diff = start.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPackingPercent = () => {
    if (!currentTrip || !currentTrip.checklist.length) return 0;
    return Math.round(
      (currentTrip.checklist.filter((i) => i.isCompleted).length /
        currentTrip.checklist.length) *
        100
    );
  };

  if (isLoading && view !== "landing") {
    return (
      <div className="min-h-screen bg-[#FBFBFD] dark:bg-[#1C1C1E] flex flex-col items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary mb-6" size={48} />
        <div className="font-black text-slate-400 uppercase tracking-widest text-[10px]">
          {t("syncing")}
        </div>
      </div>
    );
  }

  const spentTotal = currentTrip ? calculateExpensesTotal(currentTrip) : 0;
  const budgetLimit = currentTrip?.flight?.budget || 50000;
  const budgetPercent = Math.min(100, (spentTotal / budgetLimit) * 100);
  const daysLeft = getDaysLeft();
  const daysProgress =
    daysLeft <= 0
      ? 0
      : daysLeft >= 30
      ? 100
      : Math.round((daysLeft / 30) * 100);

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage }}>
      <div
        className={`min-h-screen transition-all duration-500 ${
          theme === "dark"
            ? "dark bg-[#1C1C1E] text-slate-100"
            : "bg-[#FBFBFD] text-slate-900"
        }`}
      >
        {view === "detail" && currentTrip && (
          <div className="min-h-screen flex flex-col pb-24 sm:pb-0">
            <nav className="hidden sm:flex bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 h-20 items-center px-8">
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
                    {isCreator ? (
                      <input
                        value={currentTrip.name}
                        onChange={(e) =>
                          updateCurrentTrip({
                            ...currentTrip,
                            name: e.target.value,
                          })
                        }
                        className="text-xl font-black bg-transparent outline-none hover:bg-slate-100/10"
                      />
                    ) : (
                      <div className="text-xl font-black">
                        {currentTrip.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {currentTrip.destination}
                      </span>
                      {isSyncing && (
                        <span className="text-[9px] font-black text-blue-500 animate-pulse uppercase">
                          <Cloud size={9} className="inline mr-1" />
                          {t("syncing")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-slate-100/60 dark:bg-slate-800/60 p-1.5 rounded-2xl">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                            isActive
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          <tab.icon size={16} strokeWidth={isActive ? 3 : 2} />
                          <span className="hidden lg:inline">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set("tripId", currentTrip.id);
                      navigator.clipboard.writeText(url.toString());
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    }}
                    className={`p-2.5 rounded-xl transition-all ${
                      copyFeedback
                        ? "text-green-500"
                        : "text-slate-400 hover:text-primary"
                    }`}
                  >
                    {copyFeedback ? <Check size={22} /> : <Share2 size={22} />}
                  </button>
                  <GlobalNav />
                  <UserHeaderProfile />
                </div>
              </div>
            </nav>

            <nav className="sm:hidden sticky top-0 z-40 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-3xl px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setView("list");
                  setCurrentTripId(null);
                }}
                className="p-2 -ml-2 text-slate-500 active:scale-90 transition-transform"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="flex items-center gap-2 -mr-2">
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("tripId", currentTrip.id);
                    navigator.clipboard.writeText(url.toString());
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 2000);
                  }}
                  className="p-2 text-slate-400 active:scale-90 transition-all"
                >
                  {copyFeedback ? (
                    <Check size={20} className="text-green-500" />
                  ) : (
                    <Share2 size={20} />
                  )}
                </button>
                <GlobalNav />
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1">
              {activeTab === "dashboard" && (
                <div className="space-y-8 sm:space-y-16 animate-in fade-in slide-in-from-bottom-3 duration-700">
                  <div className="bg-white dark:bg-slate-800 rounded-[48px] sm:rounded-[64px] p-8 sm:p-20 shadow-ios-lg border border-slate-100 dark:border-slate-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-[250px] -mt-[250px] transition-all duration-1000 group-hover:scale-110" />
                    <div className="relative z-10">
                      <h2 className="text-4xl sm:text-8xl font-black tracking-tighter mb-6 text-slate-900 dark:text-white leading-tight">
                        {currentTrip.destination}
                      </h2>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                        <div className="hidden sm:flex text-base font-black text-slate-400 uppercase tracking-[0.3em] items-center gap-3">
                          <Calendar size={14} className="text-primary" />{" "}
                          {currentTrip.startDate} — {currentTrip.endDate}
                        </div>
                        <div className="sm:hidden flex flex-col gap-6 p-6 bg-slate-50/70 dark:bg-slate-900/40 rounded-[32px] border border-slate-100 dark:border-slate-700/50 backdrop-blur-md">
                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                            <Calendar size={12} className="text-primary" />{" "}
                            {currentTrip.startDate} — {currentTrip.endDate}
                          </div>
                          <div className="grid grid-cols-3 gap-2 px-1">
                            <div className="flex flex-col items-center gap-1.5 border-r border-slate-200 dark:border-slate-700/50">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-blue-500" />
                                <span className="text-[11px] font-black text-slate-900 dark:text-white">
                                  {daysLeft}d
                                </span>
                              </div>
                              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-700"
                                  style={{ width: `${daysProgress}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1.5 border-r border-slate-200 dark:border-slate-700/50">
                              <div className="flex items-center gap-1.5">
                                <Luggage size={12} className="text-green-500" />
                                <span className="text-[11px] font-black text-slate-900 dark:text-white">
                                  {getPackingPercent()}%
                                </span>
                              </div>
                              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all duration-700"
                                  style={{ width: `${getPackingPercent()}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1.5">
                              <button
                                onClick={() =>
                                  isCreator &&
                                  (setTempBudget(budgetLimit),
                                  setIsEditingBudget(true))
                                }
                                className="flex items-center gap-1 min-w-0 max-w-full px-1 group/coin active:scale-95 transition-all"
                              >
                                <Coins
                                  size={12}
                                  className="text-indigo-500 shrink-0"
                                />
                                <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                                  {(spentTotal / 1000).toFixed(1)}k
                                </span>
                                {isCreator && (
                                  <Edit2
                                    size={10}
                                    className="text-slate-300 shrink-0"
                                  />
                                )}
                              </button>
                              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-700 ${
                                    spentTotal > budgetLimit
                                      ? "bg-red-500"
                                      : "bg-indigo-500"
                                  }`}
                                  style={{ width: `${budgetPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[56px] shadow-ios border border-slate-50 dark:border-slate-800/50 flex flex-col items-center group transition-all hover:scale-[1.02] hover:shadow-ios-lg">
                      <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 text-blue-500 flex items-center justify-center mb-8 transition-all duration-500 group-hover:bg-blue-500 group-hover:text-white">
                        <Clock size={48} strokeWidth={2.5} />
                      </div>
                      <div className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-none mb-6 flex items-baseline gap-2">
                        {daysLeft}{" "}
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {t("daysLeft")}
                        </span>
                      </div>
                      <div className="w-full max-w-[160px] h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full bg-blue-500 transition-all duration-1000"
                          style={{ width: `${daysProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-40">
                        {t("countdown")}
                      </span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[56px] shadow-ios border border-slate-50 dark:border-slate-800/50 flex flex-col items-center group transition-all hover:scale-[1.02] hover:shadow-ios-lg">
                      <div className="w-24 h-24 rounded-[32px] bg-green-500/10 text-green-500 flex items-center justify-center mb-8 transition-all duration-500 group-hover:bg-green-500 group-hover:text-white">
                        <Luggage size={48} strokeWidth={2.5} />
                      </div>
                      <div className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-none mb-6">
                        {getPackingPercent()}
                        <span className="text-xl text-slate-300 ml-1">%</span>
                      </div>
                      <div className="w-full max-w-[160px] h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full bg-green-500 transition-all duration-1000"
                          style={{ width: `${getPackingPercent()}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-40">
                        {t("packingProgress")}
                      </span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[56px] shadow-ios border border-slate-50 dark:border-slate-800/50 flex flex-col items-center group transition-all hover:scale-[1.02] hover:shadow-ios-lg relative overflow-hidden">
                      <div className="w-24 h-24 rounded-[32px] bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-8 transition-all duration-500 group-hover:bg-indigo-500 group-hover:text-white">
                        <Wallet size={48} strokeWidth={2.5} />
                      </div>
                      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-none">
                        {(spentTotal / 1000).toFixed(1)}k{" "}
                        <span className="text-xs text-slate-300 uppercase">
                          TWD
                        </span>
                      </div>
                      <div className="w-full max-w-[180px] h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            spentTotal > budgetLimit
                              ? "bg-red-500"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${budgetPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-40">
                        {t("budgetStatus")}
                      </span>
                      {isCreator && (
                        <button
                          onClick={() => (
                            setTempBudget(budgetLimit), setIsEditingBudget(true)
                          )}
                          className="absolute bottom-6 right-6 p-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-primary transition-all active:scale-90"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 sm:p-16 shadow-ios border border-slate-100 dark:border-slate-800">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-slate-400 flex items-center gap-3">
                        <Sparkles size={16} className="text-primary" />{" "}
                        {t("upcoming")}
                      </h3>
                      <div className="space-y-6">
                        {(() => {
                          const upcoming = currentTrip.itinerary
                            .flatMap((d) =>
                              d.items.map((it) => ({ ...it, dDate: d.date }))
                            )
                            .filter((it) => it.type !== "Transport")
                            .slice(0, 3);
                          if (!upcoming.length)
                            return (
                              <div className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                                {t("noUpcoming")}
                              </div>
                            );
                          return upcoming.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900/40 rounded-[32px] transition-all hover:bg-slate-100 border border-transparent"
                            >
                              <div
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                                  it.type === "Food"
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {it.type === "Food" ? (
                                  <Coffee size={24} />
                                ) : (
                                  <MapPin size={24} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-lg text-slate-900 dark:text-white truncate">
                                  {it.placeName}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {it.dDate} • {it.time}
                                </div>
                              </div>
                              <button
                                onClick={(e) => (
                                  e.stopPropagation(),
                                  window.open(
                                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      it.placeName
                                    )}`,
                                    "_blank"
                                  )
                                )}
                                className="p-3 bg-white dark:bg-slate-700 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 transition-all active:scale-90"
                              >
                                <Map size={18} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 sm:p-16 shadow-ios border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-10">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                          <CloudRain size={16} className="text-blue-500" />{" "}
                          {t("weather7Day")}
                        </h3>
                        {weatherSource && (
                          <a
                            href={weatherSource}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-300 hover:text-primary transition-all"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                      <div className="flex lg:grid lg:grid-cols-7 gap-4 overflow-x-auto no-scrollbar pb-4 lg:pb-0">
                        {weatherForecast.map((w, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 w-24 lg:w-full flex flex-col items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-[28px] border border-transparent hover:border-slate-100 transition-all shadow-sm"
                          >
                            <span className="text-[8px] font-black opacity-30 uppercase tracking-widest">
                              {w.date}
                            </span>
                            {w.icon === "sun" ? (
                              <SunMedium
                                size={24}
                                className="text-orange-500"
                              />
                            ) : w.icon === "rain" ? (
                              <CloudRain size={24} className="text-blue-500" />
                            ) : (
                              <Cloud size={24} className="text-slate-400" />
                            )}
                            <span className="text-sm font-black tracking-tighter text-slate-900 dark:text-white">
                              {w.temp}
                            </span>
                          </div>
                        ))}
                      </div>
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

            <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl border-t border-slate-100 dark:border-slate-800 px-6 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.06)]">
              <div className="flex justify-between items-center max-w-md mx-auto">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex flex-col items-center transition-all duration-300 ${
                        isActive ? "text-primary" : "text-slate-400"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-2xl transition-all ${
                          isActive ? "bg-primary/10" : ""
                        }`}
                      >
                        <tab.icon size={24} strokeWidth={isActive ? 3 : 2} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            {isEditingBudget && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 p-10 rounded-[48px] shadow-2xl w-full max-w-sm border border-slate-100 dark:border-slate-700">
                  <h3 className="text-xl font-black mb-6 text-slate-900 dark:text-white text-center">
                    {t("budgetStatus")}
                  </h3>
                  <div className="relative mb-8">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      TWD
                    </span>
                    <input
                      autoFocus
                      type="number"
                      className="bg-slate-50 dark:bg-slate-900 p-6 pl-16 rounded-3xl text-2xl font-black w-full border-none outline-none"
                      value={tempBudget}
                      onChange={(e) =>
                        setTempBudget(parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        updateCurrentTrip({
                          ...currentTrip,
                          flight: {
                            ...currentTrip.flight!,
                            budget: tempBudget,
                          },
                        });
                        setIsEditingBudget(false);
                      }}
                      className="flex-1 py-5 bg-primary text-white rounded-3xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {t("save")}
                    </button>
                    <button
                      onClick={() => setIsEditingBudget(false)}
                      className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-3xl font-black hover:bg-slate-200 transition-all"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "landing" && (
          <div className="min-h-screen flex flex-col bg-white dark:bg-[#1C1C1E] relative overflow-hidden">
            <header className="p-6 sm:p-10 flex justify-between items-center relative z-50">
              <div className="text-2xl font-black text-primary tracking-tighter">
                {t("appName")}
              </div>
              <div className="flex items-center gap-4">
                <GlobalNav />
                <UserHeaderProfile />
              </div>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-10 whitespace-pre-line leading-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {t("heroTitle")}
              </h1>
              {!user ? (
                <div
                  id="google-login-hero"
                  className="min-h-[50px] min-w-[280px] flex items-center justify-center"
                ></div>
              ) : (
                <button
                  onClick={() => setView("list")}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-14 py-6 rounded-full text-xl font-black shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
                >
                  {t("startPlanning")} <ArrowRight size={26} />
                </button>
              )}
            </main>
          </div>
        )}

        {view === "list" && (
          <div className="p-6 sm:p-12 max-w-7xl mx-auto min-h-screen pb-24">
            <header className="flex justify-between items-center mb-16 px-4">
              <div className="text-2xl font-black text-primary tracking-tighter">
                {t("appName")}
              </div>
              <div className="flex items-center gap-4">
                <GlobalNav />
                <UserHeaderProfile />
              </div>
            </header>
            <div className="flex justify-between items-end mb-12">
              <div className="px-4">
                <h2 className="text-5xl font-black tracking-tight mb-2">
                  {t("yourTrips")}
                </h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">
                  Total {trips.length} Adventures
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary text-white px-8 py-5 rounded-[24px] flex items-center gap-2 font-black text-sm shadow-2xl hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95"
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
                  className="group bg-white dark:bg-slate-800 rounded-[56px] shadow-ios overflow-hidden cursor-pointer transition-all border border-transparent dark:border-slate-700 hover:-translate-y-4 hover:shadow-ios-lg"
                >
                  <div className="h-72 relative overflow-hidden">
                    <img
                      src={trip.coverImage}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 p-12 flex flex-col justify-end">
                      <h3 className="text-white text-4xl font-black truncate mb-1">
                        {trip.name}
                      </h3>
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em]">
                        {trip.startDate} - {trip.endDate}
                      </p>
                    </div>
                  </div>
                  <div className="p-10 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <span>{trip.destination}</span>
                    <span className="text-primary">
                      NT$ {calculateExpensesTotal(trip).toLocaleString()}
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
    </LocalizationContext.Provider>
  );
};

export default App;
