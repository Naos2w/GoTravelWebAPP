import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  useMemo,
} from "react";
import { Trip, Currency, Theme, Language, User } from "./types";
import {
  getTrips,
  getTripById,
  saveTrip,
  deleteTrip,
  joinTrip,
  saveExpenseOnly,
  supabase,
} from "./services/storageService";
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
  X as CloseIcon
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

// Bilingual Translations
const translations = {
  zh: {
    appName: "Go Travel",
    yourTrips: "您的旅程",
    newTrip: "新增旅程",
    overview: "概覽",
    itinerary: "行程",
    checklist: "清單",
    expenses: "花費",
    tickets: "機票",
    syncing: "同步中...",
    countdown: "倒數",
    packingProgress: "行李準備",
    budgetStatus: "預算控制",
    daysLeft: "天",
    permissionEditor: "擁有者",
    permissionGuest: "協作者",
    upcoming: "即將到來",
    noUpcoming: "尚無行程",
    deleteTrip: "刪除旅程",
    confirmDelete: "確定刪除此旅程？此動作無法復原。",
    heroTitle: "聰明規劃，\n自在旅行。",
    heroSubtitle: "全方位的旅程規劃空間。",
    login: "登入 / 開始",
    errorTitle: "同步錯誤",
    errorDesc: "無法載入資料",
    setupRequired: "請設定機票",
    upcomingSchedule: "即將到來的行程",
    viewMap: "地圖",
    editBudget: "編輯預算",
    totalCost: "旅程總花費",
    includesFlight: "包含機票",
    breakdown: "類別佔比",
    addEntry: "新增支出",
    filterAll: "全部",
    filterUser: "成員",
    noExpenses: "尚無支出記錄",
    descRequired: "請輸入備註",
    amountRequired: "請輸入金額",
    confirmDeleteItems: "確定刪除嗎？",
    FlightTickets: "機票",
    save: "確認",
    cancel: "取消",
    amount: "金額",
    addPlace: "新增景點",
    addFood: "新增餐廳",
    editActivity: "編輯行程",
    newActivity: "新增行程",
    placeName: "地點名稱",
    time: "時間",
    note: "備註",
    noData: "暫無資料",
    selectTransport: "選擇交通方式",
    moving: "移動",
    readOnly: "僅供檢視",
    type: "類型",
    typePlace: "景點",
    typeFood: "餐飲",
    transportPublic: "大眾運輸",
    transportCar: "汽車",
    transportBike: "腳踏車",
    transportWalk: "步行",
    transportFlight: "飛機",
    catFood: "餐飲",
    catAccom: "住宿",
    catTransport: "交通",
    catTickets: "票券",
    catShopping: "購物",
    catOther: "其他",
    catDocs: "證件",
    catGear: "電器",
    catCloth: "衣物",
    catToilet: "盥洗",
    catFlight: "機票",
    searchOut: "搜尋去程",
    searchIn: "搜尋回程",
    selectOut: "選擇去程",
    selectIn: "選擇回程",
    origin: "出發地",
    destination: "目的地",
    date: "日期",
    flightNo: "航班代號",
    search: "搜尋",
    review: "確認行程",
    back: "返回",
    confirm: "確認",
    traveler: "旅客姓名",
    cabin: "艙等",
    totalPrice: "總票價",
    baggage: "行李",
    outboundBag: "去程行李",
    inboundBag: "回程行李",
    priceRequired: "請輸入金額",
    carryOn: "手提",
    checked: "託運",
    count: "件",
    weight: "重",
    airline: "航空公司",
    terminal: "航廈",
    flight: "航班",
    dep: "起飛",
    arr: "抵達",
    boardingTime: "登機時間",
    titleFlights: "成員航班",
    addMyFlight: "新增我的機票",
    addSegment: "新增航段",
    edit: "編輯",
    required: "必填",
    weightRequired: "請輸入重量",
    noFlights: "尚無機票",
    checklistSummary: "清單概況",
    completed: "已完成",
    tripNotFound: "找不到旅程或無權限存取",
    backHome: "返回首頁",
    shareTrip: "分享旅程",
    inviteEmail: "邀請 Email",
    invite: "邀請",
    collaborators: "協作者",
    shareLink: "分享連結",
    copied: "已複製",
    copy: "複製",
    emailPlaceholder: "輸入 Email",
    owner: "擁有者",
    accessDenied: "存取被拒",
    askOwner: "請將此 Email 提供給擁有者以獲取權限：",
    join: "加入旅程"
  },
  en: {
    appName: "Go Travel",
    yourTrips: "Your Trips",
    newTrip: "New Trip",
    overview: "Overview",
    itinerary: "Itinerary",
    checklist: "Checklist",
    expenses: "Expenses",
    tickets: "Tickets",
    syncing: "Syncing...",
    countdown: "Countdown",
    packingProgress: "Packing",
    budgetStatus: "Budget",
    daysLeft: "Days",
    permissionEditor: "Owner",
    permissionGuest: "Guest",
    upcoming: "Upcoming",
    noUpcoming: "No Items",
    deleteTrip: "Delete Trip",
    confirmDelete: "Delete trip? Irreversible.",
    heroTitle: "Travel Smart.",
    heroSubtitle: "All-in-one workspace.",
    login: "Login / Start",
    errorTitle: "Sync Error",
    errorDesc: "Failed to load",
    setupRequired: "Setup Flight",
    upcomingSchedule: "Upcoming Schedule",
    viewMap: "Map",
    editBudget: "Edit Budget",
    totalCost: "Total Cost",
    includesFlight: "Inc. Flights",
    breakdown: "Breakdown",
    addEntry: "Add Expense",
    filterAll: "All",
    filterUser: "Member",
    noExpenses: "No Data",
    descRequired: "Note Required",
    amountRequired: "Amount Required",
    confirmDeleteItems: "Delete?",
    FlightTickets: "Flights",
    save: "Save",
    cancel: "Cancel",
    amount: "Amount",
    addPlace: "Add Place",
    addFood: "Add Food",
    editActivity: "Edit Item",
    newActivity: "New Item",
    placeName: "Place Name",
    time: "Time",
    note: "Notes",
    noData: "No Data",
    selectTransport: "Transport",
    moving: "Move",
    readOnly: "Read Only",
    type: "Type",
    typePlace: "Place",
    typeFood: "Food",
    transportPublic: "Public",
    transportCar: "Car",
    transportBike: "Bike",
    transportWalk: "Walk",
    transportFlight: "Flight",
    catFood: "Food",
    catAccom: "Stay",
    catTransport: "Transport",
    catTickets: "Tickets",
    catShopping: "Shopping",
    catOther: "Other",
    catDocs: "Documents",
    catGear: "Electronics",
    catCloth: "Clothing",
    catToilet: "Toiletries",
    catFlight: "Flights",
    searchOut: "Outbound Search",
    searchIn: "Inbound Search",
    selectOut: "Select Outbound",
    selectIn: "Select Inbound",
    origin: "Origin",
    destination: "Destination",
    date: "Date",
    flightNo: "Flight No.",
    search: "Search",
    review: "Review",
    back: "Back",
    confirm: "Confirm",
    traveler: "Traveler",
    cabin: "Cabin",
    totalPrice: "Total Price",
    baggage: "Baggage",
    outboundBag: "Outbound Baggage",
    inboundBag: "Inbound Baggage",
    priceRequired: "Price Required",
    carryOn: "Carry-On",
    checked: "Checked",
    count: "Pcs",
    weight: "Kg",
    airline: "Airline",
    terminal: "Terminal",
    flight: "Flight",
    dep: "Dep",
    arr: "Arr",
    boardingTime: "Boarding",
    titleFlights: "Flights",
    addMyFlight: "Add Mine",
    addSegment: "Add Segment",
    edit: "Edit",
    required: "Required",
    weightRequired: "Weight Required",
    noFlights: "No Flights",
    checklistSummary: "Packing Status",
    completed: "Done",
    tripNotFound: "Trip not found or access denied",
    backHome: "Back to Home",
    shareTrip: "Share Trip",
    inviteEmail: "Invite Email",
    invite: "Invite",
    collaborators: "Collaborators",
    shareLink: "Share Link",
    copied: "Copied",
    copy: "Copy",
    emailPlaceholder: "Enter Email",
    owner: "Owner",
    accessDenied: "Access Denied",
    askOwner: "Please give this email to the owner to get access:",
    join: "Join Trip"
  },
};

const calculateTripTotal = (trip: Trip): number => {
  const rates: Record<string, number> = { 'TWD': 1, 'USD': 31.5, 'JPY': 0.21, 'EUR': 34.2, 'KRW': 0.024 };
  const expensesSum = trip.expenses.reduce((sum, item) => sum + (item.amount * (item.exchangeRate || 1)), 0);
  const flightsSum = (trip.flights || []).reduce((sum, f) => sum + (f.price * (rates[f.currency] || 1)), 0);
  return expensesSum + flightsSum;
};

// Generate a consistent gradient based on string input
const getGradient = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  
  const colors = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-indigo-400',
    'from-rose-500 to-orange-400',
    'from-emerald-500 to-teal-400',
    'from-amber-500 to-yellow-400',
    'from-fuchsia-500 to-pink-400',
    'from-sky-500 to-blue-400'
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

type LocalizationContextType = {
  t: (key: keyof typeof translations.en) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("useTranslation must be used within a LocalizationProvider");
  return context;
};

const ShareModal: React.FC<{
  trip: Trip;
  onClose: () => void;
  onInvite: (email: string) => void;
  onRemoveInvite: (email: string) => void;
  copyLink: () => void;
  copyFeedback: boolean;
}> = ({ trip, onClose, onInvite, onRemoveInvite, copyLink, copyFeedback }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[32px] p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex justify-between items-center">
             <h3 className="text-xl font-black text-slate-900 dark:text-white">{t('shareTrip')}</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><CloseIcon size={20}/></button>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('shareLink')}</label>
                <div className="flex gap-2">
                   <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-xs font-mono text-slate-500 truncate select-all">{`${window.location.origin}/?tripId=${trip.id}`}</div>
                   <button onClick={copyLink} className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${copyFeedback ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {copyFeedback ? t('copied') : t('copy')}
                   </button>
                </div>
             </div>

             <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"/>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('inviteEmail')}</label>
                <div className="flex gap-2">
                   <input 
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-primary/20 dark:text-white"
                     placeholder={t('emailPlaceholder')}
                   />
                   <button 
                     disabled={!email.trim()}
                     onClick={() => { onInvite(email); setEmail(''); }}
                     className="bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg shadow-primary/20"
                   >
                     {t('invite')}
                   </button>
                </div>
             </div>
             
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('collaborators')}</label>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                   {/* Owner (Implicit) */}
                   <div className="flex items-center gap-3 p-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">O</div>
                      <div className="flex-1 min-w-0">
                         <div className="text-xs font-black text-slate-900 dark:text-white truncate">{t('owner')}</div>
                      </div>
                   </div>
                   {/* Allowed Emails */}
                   {trip.allowed_emails && trip.allowed_emails.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 group">
                         <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center font-black text-xs">
                            <Mail size={14}/>
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{e}</div>
                         </div>
                         <button onClick={() => onRemoveInvite(e)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <CloseIcon size={14} />
                         </button>
                      </div>
                   ))}
                   {(!trip.allowed_emails || trip.allowed_emails.length === 0) && (
                      <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase">{t('noData')}</div>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"landing" | "list" | "detail">(() => (sessionStorage.getItem("appView") as any) || "landing");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tripId') || sessionStorage.getItem("currentTripId");
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "itinerary" | "checklist" | "expenses" | "flights">("dashboard");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("lang") as Language) || "zh");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState("");
  
  // New State for Share Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const saveTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentTripId) return;
    const refreshActiveTrip = async () => {
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(async () => {
        const updatedTrip = await getTripById(currentTripId);
        if (updatedTrip) {
           setTrips(prev => {
             const idx = prev.findIndex(t => t.id === updatedTrip.id);
             if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = updatedTrip;
                return newArr;
             }
             return [...prev, updatedTrip];
           });
        }
      }, 500); 
    };

    const channel = supabase
      .channel(`realtime-sync-${currentTripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => refreshActiveTrip())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, () => refreshActiveTrip())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_items' }, () => refreshActiveTrip())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => refreshActiveTrip())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => refreshActiveTrip())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTripId]);

  useEffect(() => { sessionStorage.setItem("appView", view); }, [view]);
  useEffect(() => {
    if (currentTripId) {
      sessionStorage.setItem("currentTripId", currentTripId);
      const url = new URL(window.location.href);
      url.searchParams.set('tripId', currentTripId);
      window.history.replaceState({}, '', url);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('tripId');
      window.history.replaceState({}, '', url);
    }
  }, [currentTripId]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleAuthUser = (supabaseUser: any) => {
    setUser({
      id: supabaseUser.id,
      name: supabaseUser.user_metadata.full_name,
      email: supabaseUser.email!,
      picture: supabaseUser.user_metadata.avatar_url || "",
    });
    if (new URLSearchParams(window.location.search).get('tripId')) setView("detail");
    else setView("list"); 
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) handleAuthUser(session.user);
      else { setIsLoading(false); if (view !== "landing") setView("landing"); }
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) handleAuthUser(session.user);
      else if (event === "SIGNED_OUT") { setUser(null); setView("landing"); setTrips([]); setIsLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) loadTrips(); }, [user]);

  const loadTrips = async () => {
    if (!user) return;
    setError(null);
    try {
      const userTrips = await getTrips(user.id);
      
      const sharedId = new URLSearchParams(window.location.search).get('tripId');
      let allTrips = [...userTrips];
      
      if (sharedId) {
        const alreadyHas = allTrips.find(t => t.id === sharedId);
        if (!alreadyHas) {
           const sharedTrip = await getTripById(sharedId);
           if (sharedTrip) {
              // Check if user is allowed to view/join
              const isOwner = sharedTrip.user_id === user.id;
              const isAllowed = sharedTrip.allowed_emails?.includes(user.email);
              
              if (isOwner || isAllowed) {
                 allTrips.push(sharedTrip);
                 // If not owner but allowed, auto join collaborators table
                 if (!isOwner && isAllowed) {
                    await joinTrip(sharedId, user.id);
                 }
              }
           }
        }
      }
      setTrips(allTrips);
    } catch (err: any) { 
      console.error(err);
      setError(err.message || "Failed to load trips");
    }
    finally { setIsLoading(false); }
  };

  const handleManualJoin = async () => {
    if (!currentTripId || !user) return;
    setIsLoading(true);
    await joinTrip(currentTripId, user.id);
    await loadTrips(); // Reload to see if access is granted
    setIsLoading(false);
  };

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Changed from window.location.origin to window.location.href to preserve URL parameters (like tripId)
          redirectTo: window.location.href
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  const currentTrip = trips.find((t) => t.id === currentTripId);
  const isCreator = user && currentTrip && (currentTrip.user_id === user.id || !currentTrip.user_id);
  const isGuest = user && currentTrip && currentTrip.user_id !== user.id;

  const isPricePending = useMemo(() => {
    if (!currentTrip || !user) return false;
    const myFlight = currentTrip.flights?.find(f => f.user_id === user.id);
    return !!myFlight && myFlight.price === 0;
  }, [currentTrip, user]);

  // Check for Header Alerts
  const hasMissingFlightInfo = useMemo(() => {
    if (!currentTrip || !currentTrip.flights) return false;
    return currentTrip.flights.some(f => {
       const hasPrice = f.price > 0;
       const bag = f.baggage || f.outbound.baggage;
       // Logic match FlightManager: if count > 0, weight must be valid. if weight > 0, count must be > 0.
       const checkBag = (b: any) => {
          if (!b) return true;
          const w = b.weight ? b.weight.replace(/[^0-9.]/g, '') : '';
          const c = b.count || 0;
          if (c > 0 && !w) return false;
          if (w.length > 0 && c <= 0) return false;
          return true;
       };
       const hasValidBaggage = checkBag(bag?.carryOn) && checkBag(bag?.checked);
       return !hasPrice || !hasValidBaggage;
    });
  }, [currentTrip]);

  useEffect(() => {
    if (isPricePending && activeTab !== 'flights') {
      setActiveTab('flights');
    }
  }, [isPricePending, activeTab]);

  const t = (key: keyof typeof translations.en) => (translations as any)[language][key] || (translations as any).en[key];

  const updateCurrentTrip = (updatedTrip: Trip) => {
    if (!user) return;
    setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try {
        await saveTrip(updatedTrip, user.id);
      } catch (err) { console.error("Save failed:", err); }
      finally { setIsSyncing(false); saveTimeoutRef.current = null; }
    }, 600);
  };

  const handleInvite = (email: string) => {
     if (!currentTrip) return;
     const newAllowed = [...(currentTrip.allowed_emails || [])];
     if (!newAllowed.includes(email)) {
        newAllowed.push(email);
        updateCurrentTrip({ ...currentTrip, allowed_emails: newAllowed });
     }
  };

  const handleRemoveInvite = (email: string) => {
     if (!currentTrip || !currentTrip.allowed_emails) return;
     const newAllowed = currentTrip.allowed_emails.filter(e => e !== email);
     updateCurrentTrip({ ...currentTrip, allowed_emails: newAllowed });
  };

  const handleCreateTripSubmit = async (tripData: Trip) => {
    if (!user) return;
    try {
      const enrichedTrip = {
        ...tripData,
        user_id: user.id,
        flights: tripData.flights.map(f => ({
          ...f,
          user_id: user.id,
          traveler_name: user.name,
        })),
        allowed_emails: [user.email] // Owner is allowed
      };

      await saveTrip(enrichedTrip, user.id);
      setTrips(prev => [enrichedTrip, ...prev]);
      setCurrentTripId(enrichedTrip.id);
      setView("detail");
      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to create trip:", err);
      setError("Failed to create trip. Please try again.");
    }
  };

  const handleDeleteTrip = async () => {
    if (!user || !currentTrip) return;
    if (!window.confirm(t("confirmDelete"))) return;
    
    try {
      await deleteTrip(currentTrip.id, user.id);
      setTrips(prev => prev.filter(t => t.id !== currentTrip.id));
      setCurrentTripId(null);
      setView("list");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete trip.");
    }
  };

  const saveBudget = () => {
     if (!currentTrip || !tempBudget) return;
     const newBudget = parseInt(tempBudget);
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
    { id: "flights", label: t("tickets"), icon: Plane, alert: hasMissingFlightInfo },
  ];

  const spentTotal = currentTrip ? calculateTripTotal(currentTrip) : 0;
  const budgetLimit = currentTrip?.flights?.[0]?.budget || 50000;
  const budgetPercent = Math.min(100, (spentTotal / budgetLimit) * 100);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const startDate = currentTrip ? new Date(currentTrip.startDate) : new Date();
  const daysDiff = (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const countdownPercent = daysDiff < 0 ? 0 : daysDiff > 30 ? 100 : (daysDiff / 30) * 100;
  const displayDays = Math.ceil(daysDiff);

  const packingPercent = currentTrip?.checklist.length 
      ? Math.round(currentTrip.checklist.filter(i => i.isCompleted).length / currentTrip.checklist.length * 100) 
      : 0;
      
  const chartData = useMemo(() => {
    if (!currentTrip) return [];
    const dataMap: Record<string, number> = {};
    const rates: Record<string, number> = { 'TWD': 1, 'USD': 31.5, 'JPY': 0.21, 'EUR': 34.2, 'KRW': 0.024 };
    currentTrip.expenses.forEach(e => {
      const twdVal = e.amount * (e.exchangeRate || 1);
      dataMap[e.category] = (dataMap[e.category] || 0) + twdVal;
    });
    const flightsSum = (currentTrip.flights || []).reduce((sum, f) => sum + (f.price * (rates[f.currency] || 1)), 0);
    if (flightsSum > 0) dataMap['Flight'] = (dataMap['Flight'] || 0) + flightsSum; // Use 'Flight' category
    
    return Object.entries(dataMap).map(([name, value]) => ({ name, value }));
  }, [currentTrip]);

  const upcomingItems = useMemo(() => {
     if (!currentTrip?.itinerary) return [];
     const now = new Date();
     const allItems = [];
     for (const day of currentTrip.itinerary) {
        for (const item of day.items) {
           const itemDate = new Date(`${day.date}T${item.time}`);
           if (itemDate > now) {
              allItems.push({ ...item, date: day.date });
           }
        }
     }
     return allItems.sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()).slice(0, 5);
  }, [currentTrip]);
  
  const checklistStats = useMemo(() => {
      if (!currentTrip) return [];
      const cats = ['Documents', 'Gear', 'Clothing', 'Toiletries', 'Other'];
      return cats.map(c => {
          const items = currentTrip.checklist.filter(i => i.category === c);
          const completed = items.filter(i => i.isCompleted).length;
          return { category: c, total: items.length, completed };
      }).filter(c => c.total > 0);
  }, [currentTrip]);

  const collaboratorCount = useMemo(() => {
     if (!currentTrip) return 0;
     const userSet = new Set<string>();
     currentTrip.expenses.forEach(e => userSet.add(e.user_id!));
     currentTrip.flights.forEach(f => userSet.add(f.user_id));
     return userSet.size;
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
          <div className="text-xs font-black truncate max-w-[100px]">{user.name}</div>
          {view === 'detail' && currentTrip && (
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {isCreator ? t("permissionEditor") : t("permissionGuest")}
            </div>
          )}
        </div>
        {/* Added referrerPolicy to fix Google image loading */}
        <img src={user.picture} referrerPolicy="no-referrer" className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  };

  const MobileHero = () => (
    <div className="md:hidden space-y-4 mb-6">
      {/* Updated Hero Card - Removed Images, Added Gradient */}
      <div className={`w-full rounded-[32px] p-8 shadow-ios border border-slate-100 dark:border-slate-700 bg-gradient-to-br ${getGradient(currentTrip?.destination || '')}`}>
         <div className="flex flex-col gap-2">
            <h2 className="text-4xl font-black text-white tracking-tighter">{currentTrip?.destination}</h2>
            <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-widest">
              <Calendar size={12}/> {currentTrip?.startDate} — {currentTrip?.endDate}
            </div>
         </div>
      </div>

      {/* Progress Bars Section */}
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-ios border border-slate-100 dark:border-slate-700 space-y-6">
          {/* Countdown */}
          <div>
             <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("countdown")}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{displayDays > 0 ? displayDays : 0} {t("daysLeft")}</span>
             </div>
             <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{width: `${countdownPercent}%`}} />
             </div>
          </div>

          {/* Budget */}
          <div onClick={() => !isGuest && setIsEditingBudget(true)} className={!isGuest ? "cursor-pointer active:opacity-70 transition-opacity" : ""}>
             <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">{t("budgetStatus")} {!isGuest && <Edit2 size={10}/>}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{Math.round(budgetPercent)}%</span>
             </div>
             <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${spentTotal > budgetLimit ? "bg-red-500" : "bg-indigo-500"}`} style={{width: `${budgetPercent}%`}} />
             </div>
          </div>

          {/* Packing */}
          <div>
             <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("packingProgress")}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{packingPercent}%</span>
             </div>
             <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{width: `${packingPercent}%`}} />
             </div>
          </div>
      </div>

      {/* Mobile Upcoming Schedule with Interactive hints */}
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-ios border border-slate-100 dark:border-slate-700">
         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> {t("upcomingSchedule")}</div>
         <div className="space-y-4">
             {upcomingItems.slice(0,5).map((item, i) => (
                 <div key={i} className="flex gap-4 group cursor-pointer active:scale-[0.98] active:bg-slate-50 dark:active:bg-slate-700/50 rounded-xl transition-all p-1 -m-1" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}>
                     <div className="flex flex-col items-center pt-2">
                         <div className="w-2 h-2 rounded-full bg-primary"/>
                         {i !== 4 && <div className="w-0.5 flex-1 bg-slate-100 dark:bg-slate-700 my-1"/>}
                     </div>
                     <div className="flex-1 flex justify-between items-center">
                         <div>
                             <div className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{item.placeName}</div>
                             <div className="text-[10px] font-bold text-slate-400">{item.date} • {item.time}</div>
                         </div>
                         <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-xl">
                            <MapIcon size={14} />
                         </div>
                     </div>
                 </div>
             ))}
             {upcomingItems.length === 0 && <div className="text-slate-300 font-bold text-xs uppercase text-center py-4">{t('noUpcoming')}</div>}
         </div>
      </div>
      
      {/* Delete Button for Mobile */}
      {!isGuest && (
         <button onClick={handleDeleteTrip} className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-2xl shadow-sm active:scale-95 transition-all">
            <Trash2 size={16}/> {t("deleteTrip")}
         </button>
      )}
    </div>
  );

  if (isLoading && view !== "landing") return <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-8"><Loader2 className="animate-spin text-primary mb-6" size={48} /><div className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{t("syncing")}</div></div>;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

  // Handle trip not found scenario
  if (view === "detail" && !currentTrip && !isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <AlertCircle size={40} className="text-slate-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('tripNotFound')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mb-4">{t('accessDenied')}</p>
          {user && (
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl max-w-sm mx-auto border border-slate-100 dark:border-slate-800">
               <div className="text-[10px] font-black text-slate-400 uppercase mb-2">{t('askOwner')}</div>
               <div className="font-mono text-sm font-bold text-slate-800 dark:text-white select-all">{user.email}</div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
           <button onClick={() => { setView('list'); setCurrentTripId(null); }} className="px-8 py-3 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
             {t('backHome')}
           </button>
           <button onClick={handleManualJoin} className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-primary/20">
             {t('join')}
           </button>
        </div>
      </div>
    );
  }

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage }}>
      <div className={`min-h-screen transition-all duration-500 ${theme === "dark" ? "dark bg-[#1C1C1E] text-slate-100" : "bg-[#FBFBFD] text-slate-900"}`}>
        {view === "landing" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10" />
            <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
               <div className="space-y-4">
                 <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-slate-900 dark:text-white whitespace-pre-line leading-[1.1]">{t("heroTitle")}</h1>
                 <p className="text-xl sm:text-2xl text-slate-500 font-medium tracking-tight">{t("heroSubtitle")}</p>
               </div>
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                 <button onClick={handleLogin} className="bg-primary text-white px-10 py-5 rounded-[24px] font-black text-lg shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">{t("login")}</button>
               </div>
            </div>
            <footer className="absolute bottom-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t("appName")} © 2024</footer>
          </div>
        )}

        {view === "detail" && currentTrip && (
          <div className="min-h-screen flex flex-col pb-24 md:pb-0">
            <nav className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 h-20 flex items-center px-4 sm:px-8">
              <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <button onClick={() => { setView("list"); setCurrentTripId(null); }} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"><ChevronLeft size={22} /></button>
                  <div className="truncate">
                    <div className="text-xl font-black truncate">{currentTrip.name}</div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentTrip.destination}</span>
                       <span className="hidden sm:inline-block w-1 h-1 bg-slate-200 rounded-full"/>
                       <span className="hidden sm:flex text-[9px] font-black text-slate-400 items-center gap-1 uppercase tracking-widest"><Users size={10}/> {collaboratorCount} Members</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="hidden md:flex bg-slate-100/60 dark:bg-slate-800/60 p-1.5 rounded-2xl">
                     {tabs.map((tab) => {
                       const isActive = activeTab === tab.id;
                       const isDisabled = isPricePending && tab.id !== 'flights';
                       return (
                        <button key={tab.id} onClick={() => !isDisabled && setActiveTab(tab.id as any)} disabled={isDisabled} className={`relative px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${isActive ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios" : "text-slate-500 hover:bg-slate-100"} ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                          {isDisabled && <Lock size={12} />}
                          <tab.icon size={16} strokeWidth={isActive ? 3 : 2} />
                          <span className="hidden lg:inline">{tab.label}</span>
                          {tab.alert && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                        </button>
                       );
                     })}
                   </div>
                   <button 
                      onClick={() => !isGuest ? setIsShareModalOpen(true) : null} 
                      className={`p-2.5 rounded-xl transition-all ${isGuest ? 'opacity-30 cursor-not-allowed' : 'text-slate-400 hover:text-primary'}`}
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

                  {/* Desktop Bento Grid - Re-engineered for Higher Density */}
                  <div className="hidden md:grid grid-cols-12 grid-rows-2 gap-6 h-[700px]">
                    
                    {/* 1. Main Hero (Smaller) - Col 6 - Clean Design (Replaced Image with Gradient) */}
                    <div className={`col-span-6 row-span-1 rounded-[48px] overflow-hidden relative group shadow-ios-lg p-12 flex flex-col justify-between border border-slate-100 dark:border-slate-700 bg-gradient-to-br ${getGradient(currentTrip.destination)}`}>
                       <div>
                          <div className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-4">{t('destination')}</div>
                          <h2 className="text-6xl font-black text-white tracking-tighter mb-2 leading-[0.9]">{currentTrip.destination}</h2>
                       </div>
                       <div>
                          <div className="flex items-center gap-3 text-white/80 font-bold uppercase tracking-[0.2em] text-xs">
                             <Calendar size={14}/> {currentTrip.startDate} — {currentTrip.endDate}
                          </div>
                          <div className="mt-4 flex gap-2">
                             {currentTrip.flights && currentTrip.flights.length > 0 && (
                                <div className="text-[10px] font-black bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-white">
                                   {currentTrip.flights[0].outbound.airline}
                                </div>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* 2. Budget & Spending (Interactive) - Col 3 */}
                    <div className="col-span-3 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-6 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col relative group/budget">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 p-2 rounded-xl"><Wallet size={20}/></div>
                            {!isGuest && <button onClick={() => { setTempBudget(budgetLimit.toString()); setIsEditingBudget(true); }} className="p-2 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"><Edit2 size={16}/></button>}
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('budgetStatus')}</div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white">
                                {Math.round(budgetPercent)}<span className="text-lg text-slate-400">%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                                <div className={`h-full ${spentTotal > budgetLimit ? "bg-red-500" : "bg-indigo-500"}`} style={{width: `${budgetPercent}%`}}/>
                            </div>
                            <div className="flex justify-between mt-2 text-xs font-bold text-slate-400">
                                <span>Spent: ${(spentTotal/1000).toFixed(1)}k</span>
                                <span>Limit: ${(budgetLimit/1000).toFixed(1)}k</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Expense Breakdown (Mini Chart) - Col 3 */}
                    <div className="col-span-3 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-6 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col">
                        <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <PieChartIcon size={14}/> {t('breakdown')}
                        </div>
                        <div className="flex-1 min-h-0">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip />
                                </PieChart>
                              </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4. Upcoming Schedule (Timeline) - Col 4 Row 2 */}
                    <div className="col-span-4 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-8 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col overflow-hidden">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> {t("upcomingSchedule")}</div>
                       <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                           {upcomingItems.slice(0,3).map((item, i) => (
                               <div key={i} className="flex gap-4 group cursor-pointer" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank')}>
                                   <div className="flex flex-col items-center">
                                       <div className="w-2 h-2 rounded-full bg-primary mt-1.5"/>
                                       {i !== 2 && <div className="w-0.5 flex-1 bg-slate-100 dark:bg-slate-700 my-1"/>}
                                   </div>
                                   <div>
                                       <div className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">{item.placeName}</div>
                                       <div className="text-[10px] font-bold text-slate-400">{item.date} • {item.time}</div>
                                   </div>
                               </div>
                           ))}
                           {upcomingItems.length === 0 && <div className="text-slate-300 font-bold text-xs uppercase text-center py-8">{t('noUpcoming')}</div>}
                       </div>
                    </div>

                    {/* 5. Checklist Summary - Col 4 Row 2 */}
                    <div className="col-span-4 row-span-1 bg-white dark:bg-slate-800 rounded-[40px] p-8 border border-slate-100 dark:border-slate-700 shadow-ios flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckSquare size={14}/> {t('checklistSummary')}</div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{packingPercent}%</div>
                        </div>
                        <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-2">
                            {checklistStats.map(stat => (
                                <div key={stat.category} className="flex items-center gap-3">
                                    <div className="w-20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.category}</div>
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 rounded-full" style={{width: `${(stat.completed/stat.total)*100}%`}}/>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-400 w-8 text-right">{stat.completed}/{stat.total}</div>
                                </div>
                            ))}
                            {checklistStats.length === 0 && <div className="text-slate-300 font-bold text-xs uppercase text-center py-8">{t('noData')}</div>}
                        </div>
                    </div>

                    {/* 6. Countdown & Actions - Col 4 Row 2 */}
                    <div className="col-span-4 row-span-1 flex flex-col gap-6">
                        {/* Modified Countdown Card to be theme-aware */}
                        <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[40px] p-8 shadow-ios flex flex-col justify-center relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t("countdown")}</div>
                                <div className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white">{displayDays > 0 ? displayDays : 0}</div>
                                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{t("daysLeft")}</div>
                            </div>
                            <Clock className="absolute -right-4 -bottom-4 text-slate-100 dark:text-slate-700 w-32 h-32 rotate-12 transition-transform group-hover:rotate-45 duration-700"/>
                        </div>
                        {!isGuest && (
                             <button onClick={handleDeleteTrip} className="h-16 flex items-center justify-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest bg-white dark:bg-slate-800 border border-red-50 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-3xl transition-all shadow-sm">
                                <Trash2 size={16}/> {t("deleteTrip")}
                             </button>
                        )}
                    </div>
                  </div>

                </div>
              )}
              {activeTab === "itinerary" && <Itinerary trip={currentTrip} onUpdate={updateCurrentTrip} isGuest={isGuest} />}
              {activeTab === "checklist" && <Checklist trip={currentTrip} onUpdate={updateCurrentTrip} isGuest={isGuest} />}
              {activeTab === "expenses" && <Expenses trip={currentTrip} onUpdate={updateCurrentTrip} isGuest={isGuest} />}
              {activeTab === "flights" && <FlightManager trip={currentTrip} onUpdate={updateCurrentTrip} isGuest={isGuest} />}
            </main>
            
            {/* Share Modal */}
            {isShareModalOpen && !isGuest && (
                <ShareModal 
                   trip={currentTrip}
                   onClose={() => setIsShareModalOpen(false)}
                   onInvite={handleInvite}
                   onRemoveInvite={handleRemoveInvite}
                   copyLink={() => { navigator.clipboard.writeText(`${window.location.origin}/?tripId=${currentTrip.id}`); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }}
                   copyFeedback={copyFeedback}
                />
            )}

            {/* Mobile Budget Edit Modal */}
            {isEditingBudget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">{t('editBudget')}</h3>
                        <div className="relative mb-6">
                            <span className="absolute left-4 top-3.5 text-slate-400 font-black text-lg">$</span>
                            <input 
                                autoFocus
                                type="number" 
                                value={tempBudget} 
                                onChange={e => setTempBudget(e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-black pl-8 pr-4 py-3 rounded-2xl outline-none border-2 border-transparent focus:border-primary/50"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditingBudget(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 rounded-xl">{t('cancel')}</button>
                            <button onClick={saveBudget} className="flex-1 py-3 text-white font-bold bg-primary rounded-xl">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-50 pb-safe">
              <div className="flex justify-around items-center p-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDisabled = isPricePending && tab.id !== 'flights';
                  return (
                    <button key={tab.id} onClick={() => !isDisabled && setActiveTab(tab.id as any)} disabled={isDisabled} className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${isActive ? "text-primary bg-primary/10" : "text-slate-400"} ${isDisabled ? "opacity-30" : ""}`}>
                      {isDisabled ? <Lock size={20} /> : <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />}
                      {tab.alert && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="p-6 sm:p-12 max-w-7xl mx-auto min-h-screen">
            <header className="flex justify-between items-center mb-16"><div className="text-2xl font-black text-primary tracking-tighter">{t("appName")}</div><div className="flex items-center gap-4"><GlobalNav /><UserHeaderProfile /></div></header>
            
            {error && (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center shrink-0"><AlertTriangle className="text-red-500 dark:text-red-400" size={20} /></div>
                <div><h3 className="font-black text-red-600 dark:text-red-400">{t("errorTitle")}</h3><p className="text-xs font-bold text-red-400 dark:text-red-500/80">{t("errorDesc")} ({error})</p></div>
              </div>
            )}

            <div className="flex justify-between items-end mb-12">
               <div><h2 className="text-5xl font-black tracking-tight mb-2">{t("yourTrips")}</h2><p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Total {trips.length} Adventures</p></div>
               <button onClick={() => setShowCreateForm(true)} className="bg-primary text-white px-8 py-5 rounded-[24px] flex items-center gap-2 font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"><Plus size={20} /> {t("newTrip")}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {trips.map((trip) => (
                <div key={trip.id} onClick={() => { setCurrentTripId(trip.id); setView("detail"); }} className="group bg-white dark:bg-slate-800 rounded-[56px] shadow-ios overflow-hidden cursor-pointer transition-all hover:-translate-y-4 hover:shadow-ios-lg">
                  <div className={`h-72 relative overflow-hidden bg-gradient-to-br ${getGradient(trip.destination)} flex flex-col justify-end p-12 transition-all duration-1000 group-hover:scale-105`}>
                     <h3 className="text-white text-4xl font-black truncate mb-1">{trip.name}</h3>
                     <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em]">{trip.startDate} - {trip.endDate}</p>
                  </div>
                  <div className="p-10 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]"><span>{trip.destination}</span><span className="text-primary">NT$ {calculateTripTotal(trip).toLocaleString()}</span></div>
                </div>
              ))}
            </div>
            {showCreateForm && <TripForm onClose={() => setShowCreateForm(false)} onSubmit={handleCreateTripSubmit} />}
          </div>
        )}
      </div>
    </LocalizationContext.Provider>
  );
};

export default App;