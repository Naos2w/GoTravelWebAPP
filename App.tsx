
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Trip, Currency, Theme, Language, User } from './types';
import { getTrips, saveTrip, deleteTrip, exportData, supabase } from './services/storageService';
import { Checklist } from './components/Checklist';
import { Itinerary } from './components/Itinerary';
import { Expenses } from './components/Expenses';
import { TripForm } from './components/TripForm';
import { FlightManager } from './components/FlightManager';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plane, Calendar, CheckSquare, DollarSign, 
  Plus, ArrowRight, ChevronLeft, LogOut, Loader2,
  LayoutDashboard, Trash2, Moon, Sun, Languages,
  Database, Cloud, Download, AlertCircle, Lock,
  Share2, Luggage, Sparkles, Check, User as UserIcon, 
  Edit2, Clock, MapPin, CloudRain, SunMedium, Wind, X, ExternalLink,
  Coffee
} from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const translations = {
  zh: {
    appName: 'Go Travel',
    yourTrips: '您的旅程',
    newTrip: '新增',
    overview: '概覽',
    itinerary: '行程',
    checklist: '清單',
    expenses: '花費',
    tickets: '機票',
    totalSpent: '總計',
    syncing: '同步中...',
    countdown: '倒數',
    upcoming: '即將到來',
    packingProgress: '行李',
    budgetStatus: '預算進度',
    daysLeft: '天',
    budget: '預算',
    permissionEditor: '編輯者模式',
    noUpcoming: '尚無行程資料',
    dataManagement: '數據管理',
    export: '備份匯出',
    weather7Day: '7 天預報',
    source: '來源',
    deleteTrip: '刪除旅程',
    confirmDelete: '確定刪除？',
    heroTitle: '聰明規劃，\n自在旅行。',
    heroSubtitle: '全方位的旅程規劃空間。',
    startPlanning: '立即體驗',
    copied: '已複製',
    shareTrip: '分享'
  },
  en: {
    appName: 'Go Travel',
    yourTrips: 'Trips',
    newTrip: 'New',
    overview: 'Main',
    itinerary: 'Plan',
    checklist: 'List',
    expenses: 'Cost',
    tickets: 'Pass',
    totalSpent: 'Total',
    syncing: 'Syncing...',
    countdown: 'Due',
    upcoming: 'Upcoming',
    packingProgress: 'Pack',
    budgetStatus: 'Budget',
    daysLeft: 'D',
    budget: 'Budget',
    permissionEditor: 'Editor',
    noUpcoming: 'Empty',
    dataManagement: 'Data',
    export: 'Export',
    weather7Day: '7-Day',
    source: 'Source',
    deleteTrip: 'Delete',
    confirmDelete: 'Delete?',
    heroTitle: 'Travel Smart.',
    heroSubtitle: 'All-in-one workspace.',
    startPlanning: 'Start',
    copied: 'Copied',
    shareTrip: 'Share'
  }
};

const calculateExpensesTotal = (trip: Trip): number => {
  return trip.expenses.reduce((sum, item) => sum + (item.amount * (item.exchangeRate || 1)), 0);
};

type LocalizationContextType = {
  t: (key: keyof typeof translations.en) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useTranslation must be used within a LocalizationProvider');
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
  const [view, setView] = useState<'landing' | 'list' | 'detail'>(() => (sessionStorage.getItem('appView') as any) || 'landing');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(() => sessionStorage.getItem('currentTripId'));
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itinerary' | 'checklist' | 'expenses' | 'flights'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'zh');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState<number>(50000);
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([]);
  const [weatherSource, setWeatherSource] = useState<string | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => { sessionStorage.setItem('appView', view); }, [view]);
  useEffect(() => { if (currentTripId) sessionStorage.setItem('currentTripId', currentTripId); }, [currentTripId]);
  useEffect(() => { localStorage.setItem('lang', language); }, [language]);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('theme', theme); }, [theme]);

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (!window.google || user) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
      const renderBtn = (id: string, width: number) => {
        const el = document.getElementById(id);
        if (el) window.google.accounts.id.renderButton(el, { theme: theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'pill', width });
      };
      setTimeout(() => { renderBtn('google-login-nav', 120); renderBtn('google-login-hero', 280); }, 100);
    };
    const handleCredentialResponse = async (response: any) => {
      try { await supabase.auth.signInWithIdToken({ provider: 'google', token: response.credential }); } 
      catch (e) { console.error("Auth Error", e); }
    };
    const interval = setInterval(() => { if (window.google?.accounts?.id) { initializeGoogleSignIn(); clearInterval(interval); } }, 300);
    return () => clearInterval(interval);
  }, [view, theme, user]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) handleAuthUser(session.user);
      else { setIsLoading(false); if (view !== 'landing') setView('landing'); }
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) handleAuthUser(session.user);
      else if (event === 'SIGNED_OUT') { setUser(null); setView('landing'); setTrips([]); setIsLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuthUser = (supabaseUser: any) => {
    setUser({ id: supabaseUser.id, name: supabaseUser.user_metadata.full_name, email: supabaseUser.email!, picture: supabaseUser.user_metadata.avatar_url || '' });
    setView(prev => (prev === 'landing' ? 'list' : prev));
  };

  useEffect(() => { if (user) loadTrips(); }, [user]);

  const loadTrips = async () => {
    if (!user) return;
    setIsLoading(true);
    try { const cloudTrips = await getTrips(user.id); setTrips(cloudTrips); } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const currentTrip = trips.find(t => t.id === currentTripId);

  useEffect(() => {
    if (currentTrip) { load7DayWeather(); }
  }, [currentTripId, trips]);

  const load7DayWeather = async () => {
    if (!currentTrip) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide a 7-day weather forecast for ${currentTrip.destination}. Return ONLY a JSON array. Date (MM/DD), Temp (min-max°C), Condition, Icon (sun, cloud, rain, wind).`,
        config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" },
      });
      setWeatherForecast(JSON.parse(response.text || '[]'));
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0 && chunks[0].web) setWeatherSource(chunks[0].web.uri);
    } catch (e) { console.error(e); }
  };

  const isCreator = user && currentTrip && (currentTrip.user_id === user.id || !currentTrip.user_id);
  const isFlightMissing = currentTrip && (!currentTrip.flight || currentTrip.flight.price === 0);
  const t = (key: keyof typeof translations.en) => translations[language][key] || translations.en[key];

  const updateCurrentTrip = (updatedTrip: Trip) => {
    if (!user) return;
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try { await saveTrip(updatedTrip, user.id); } catch (err) { console.error(err); }
      finally { setIsSyncing(false); saveTimeoutRef.current = null; }
    }, 1000);
  };

  const handleCreateTripSubmit = async (newTrip: Trip) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await saveTrip(newTrip, user.id);
      setTrips(prev => [newTrip, ...prev]);
      setCurrentTripId(newTrip.id);
      setView('detail');
      setShowCreateForm(false);
    } catch (err) { console.error(err); } finally { setIsSyncing(false); }
  };

  const GlobalNav = () => (
    <div className="flex items-center gap-1 sm:gap-2 relative z-50">
      <button onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all"><Languages size={18} /></button>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
      {user && <button onClick={() => supabase.auth.signOut()} className="p-2 ml-1 rounded-xl text-slate-400 hover:text-red-500 transition-all"><LogOut size={18} /></button>}
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: t('overview'), icon: LayoutDashboard },
    { id: 'itinerary', label: t('itinerary'), icon: Calendar },
    { id: 'checklist', label: t('checklist'), icon: CheckSquare },
    { id: 'expenses', label: t('expenses'), icon: DollarSign },
    { id: 'flights', label: t('tickets'), icon: Plane },
  ];

  if (isLoading && view !== 'landing') {
    return (
      <div className="min-h-screen bg-[#FBFBFD] dark:bg-[#1C1C1E] flex flex-col items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary mb-6" size={48} />
        <div className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{t('syncing')}</div>
      </div>
    );
  }

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage }}>
      <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-[#1C1C1E] text-slate-100' : 'bg-[#FBFBFD] text-slate-900'}`}>
        
        {view === 'detail' && currentTrip && (
          <div className="min-h-screen flex flex-col pb-20 sm:pb-0">
            {/* Header - Aligned Right with Responsive Text Hiding */}
            <nav className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 h-16 sm:h-20 flex items-center px-4 sm:px-8">
              <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <button onClick={() => { setView('list'); setCurrentTripId(null); }} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"><ChevronLeft size={22}/></button>
                  <div className="truncate">
                    <input disabled={!isCreator} value={currentTrip.name} onChange={(e) => updateCurrentTrip({ ...currentTrip, name: e.target.value })} className={`text-base sm:text-xl font-black bg-transparent outline-none ${!isCreator ? '' : 'hover:bg-slate-100/10'}`} />
                    <div className="hidden sm:flex items-center gap-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentTrip.destination}</span>
                       {isSyncing && <span className="text-[9px] font-black text-blue-500 animate-pulse uppercase"><Cloud size={9} className="inline mr-1" />{t('syncing')}</span>}
                    </div>
                  </div>
                </div>

                {/* Combined Right Navigation Group */}
                <div className="flex items-center gap-1 sm:gap-3">
                  <div className="hidden sm:flex bg-slate-100/60 dark:bg-slate-800/60 p-1.5 rounded-2xl">
                    {tabs.map(tab => {
                      const isLocked = isFlightMissing && !['flights', 'dashboard'].includes(tab.id);
                      const isActive = activeTab === tab.id;
                      return (
                        <button 
                          key={tab.id} 
                          onClick={() => !isLocked && setActiveTab(tab.id as any)} 
                          disabled={isLocked} 
                          className={`px-3 lg:px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${isActive ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios' : (isLocked ? 'opacity-30' : 'text-slate-500 hover:bg-slate-100')}`}
                        >
                          <tab.icon size={16} strokeWidth={isActive ? 3 : 2} /> 
                          <span className="hidden lg:inline">{tab.label.slice(0, 2)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }} className={`p-2.5 rounded-xl transition-all ${copyFeedback ? 'text-green-500' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`}>
                    {copyFeedback ? <Check size={22} /> : <Share2 size={22} />}
                  </button>
                  <GlobalNav />
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-10 w-full flex-1">
              {activeTab === 'dashboard' && (
                <div className="space-y-6 sm:space-y-12 animate-in fade-in slide-in-from-bottom-3 duration-700">
                  
                  {/* Hero Block - Pure Brand/Destination Focus */}
                  <div className="bg-white dark:bg-slate-800 rounded-[40px] sm:rounded-[56px] p-8 sm:p-20 shadow-ios-lg border border-slate-100 dark:border-slate-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-[250px] -mt-[250px] transition-all duration-1000 group-hover:scale-110" />
                    <div className="relative z-10 text-center sm:text-left">
                       <h2 className="text-5xl sm:text-8xl font-black tracking-tighter mb-6 text-slate-900 dark:text-white leading-[0.9]">{currentTrip.destination}</h2>
                       <div className="text-xs sm:text-base font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center justify-center sm:justify-start gap-4">
                          <div className="w-10 h-0.5 bg-primary rounded-full hidden sm:block"></div>
                          <Calendar size={18} className="text-primary" /> {currentTrip.startDate} — {currentTrip.endDate}
                       </div>
                    </div>

                    {/* Integrated Stats Row (Mobile Version Only) */}
                    <div className="sm:hidden mt-12 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-[28px] border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col items-center border-r border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('countdown')}</span>
                          <span className="text-xl font-black text-primary">{(() => {
                            const start = new Date(currentTrip.startDate + 'T00:00:00');
                            const diff = start.getTime() - new Date().getTime();
                            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                          })()}</span>
                        </div>
                        <div className="flex flex-col items-center border-r border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('packingProgress')}</span>
                          <span className="text-xl font-black text-green-500">{Math.round((currentTrip.checklist.filter(i => i.isCompleted).length / (currentTrip.checklist.length || 1)) * 100)}%</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('totalSpent')}</span>
                          <span className="text-xl font-black text-indigo-500">{(calculateExpensesTotal(currentTrip)/1000).toFixed(1)}k</span>
                        </div>
                    </div>
                  </div>

                  {/* Desktop Only: Enhanced Aesthetic KPI Cards */}
                  <div className="hidden sm:grid grid-cols-3 gap-8">
                     <div className="bg-white dark:bg-slate-800 p-10 rounded-[48px] shadow-ios border border-slate-100 dark:border-slate-800 flex flex-col items-center group transition-all hover:shadow-ios-lg hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center mb-6 transition-transform group-hover:scale-110"><Clock size={32} strokeWidth={2.5}/></div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('countdown')}</span>
                        <div className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                           {(() => {
                              const start = new Date(currentTrip.startDate + 'T00:00:00');
                              const diff = start.getTime() - new Date().getTime();
                              return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                            })()} <span className="text-lg text-slate-300 ml-1">{t('daysLeft')}</span>
                        </div>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-10 rounded-[48px] shadow-ios border border-slate-100 dark:border-slate-800 flex flex-col items-center group transition-all hover:shadow-ios-lg hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-3xl bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center mb-6 transition-transform group-hover:scale-110"><Luggage size={32} strokeWidth={2.5}/></div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('packingProgress')}</span>
                        <div className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                           {Math.round((currentTrip.checklist.filter(i => i.isCompleted).length / (currentTrip.checklist.length || 1)) * 100)}<span className="text-lg text-slate-300 ml-1">%</span>
                        </div>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-10 rounded-[48px] shadow-ios border border-slate-100 dark:border-slate-800 flex flex-col items-center group transition-all hover:shadow-ios-lg hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center mb-6 transition-transform group-hover:scale-110"><DollarSign size={32} strokeWidth={2.5}/></div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('totalSpent')}</span>
                        <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                           <span className="text-lg text-slate-300 mr-2 uppercase">NT$</span>{calculateExpensesTotal(currentTrip).toLocaleString()}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
                     {/* Upcoming Activities */}
                     <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 sm:p-14 shadow-ios border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-10 text-slate-400 flex items-center gap-3"><Sparkles size={16} className="text-primary" /> {t('upcoming')}</h3>
                        <div className="space-y-5">
                           {(() => {
                              const upcoming = currentTrip.itinerary.flatMap(d => d.items.map(it => ({ ...it, dDate: d.date }))).filter(it => it.type !== 'Transport').slice(0, 3);
                              if (!upcoming.length) return <div className="py-16 text-center text-xs font-black text-slate-300 uppercase tracking-widest">{t('noUpcoming')}</div>;
                              return upcoming.map((it, idx) => (
                                 <div key={idx} className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900/40 rounded-[32px] transition-all hover:bg-slate-100/80 hover:scale-[1.01] border border-transparent hover:border-slate-100 shadow-sm">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${it.type === 'Food' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                       {it.type === 'Food' ? <Coffee size={24}/> : <MapPin size={24}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <div className="font-black text-lg text-slate-900 dark:text-white truncate">{it.placeName}</div>
                                       <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">{it.dDate} • {it.time}</div>
                                    </div>
                                 </div>
                              ));
                           })()}
                        </div>
                     </div>

                     {/* Weather Forecast */}
                     <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 sm:p-14 shadow-ios border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-10">
                           <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3"><CloudRain size={16} className="text-blue-500" /> {t('weather7Day')}</h3>
                           {weatherSource && <a href={weatherSource} target="_blank" rel="noreferrer" className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-300 hover:text-primary transition-all"><ExternalLink size={16} /></a>}
                        </div>
                        <div className="flex lg:grid lg:grid-cols-7 gap-4 overflow-x-auto no-scrollbar pb-4 lg:pb-0">
                           {weatherForecast.map((w, i) => (
                              <div key={i} className="flex-shrink-0 w-32 lg:w-full flex flex-col items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-[28px] border border-transparent hover:border-slate-100 transition-all shadow-sm">
                                 <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">{w.date}</span>
                                 {w.icon === 'sun' ? <SunMedium size={28} className="text-orange-500" /> : w.icon === 'rain' ? <CloudRain size={28} className="text-blue-500" /> : <Cloud size={28} className="text-slate-400" />}
                                 <span className="text-base font-black tracking-tighter text-slate-900 dark:text-white">{w.temp}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Budget & Utilities */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-16">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[40px] p-10 sm:p-12 shadow-ios border border-slate-100 dark:border-slate-800 group">
                       <div className="flex justify-between items-center mb-8">
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('budgetStatus')}</h3>
                          {isCreator && !isEditingBudget && <button onClick={() => { setTempBudget(currentTrip.flight?.budget || 50000); setIsEditingBudget(true); }} className="p-3 opacity-0 group-hover:opacity-100 text-primary hover:bg-primary/5 rounded-2xl transition-all"><Edit2 size={16} /></button>}
                       </div>
                       <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-6 p-0.5">
                          <div className={`h-full transition-all duration-1000 rounded-full ${calculateExpensesTotal(currentTrip) > (currentTrip.flight?.budget || 50000) ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, (calculateExpensesTotal(currentTrip) / (currentTrip.flight?.budget || 50000)) * 100)}%` }} />
                       </div>
                       <div className="flex justify-between items-end">
                          <div className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                             <span className="text-sm uppercase text-slate-300 mr-2">NT$</span>{calculateExpensesTotal(currentTrip).toLocaleString()} 
                             <span className="text-base text-slate-400 dark:text-slate-600 font-bold ml-4">/ NT$ {(currentTrip.flight?.budget || 50000).toLocaleString()}</span>
                          </div>
                       </div>
                       {isEditingBudget && (
                          <div className="mt-8 flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
                             <input autoFocus type="number" className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-base font-black w-full border-2 border-primary/20 outline-none" value={tempBudget} onChange={e => setTempBudget(parseInt(e.target.value) || 0)} />
                             <button onClick={() => { updateCurrentTrip({ ...currentTrip, flight: { ...currentTrip.flight!, budget: tempBudget } }); setIsEditingBudget(false); }} className="p-4 bg-green-500 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"><Check size={22} strokeWidth={3} /></button>
                             <button onClick={() => setIsEditingBudget(false)} className="p-4 bg-slate-200 dark:bg-slate-700 rounded-2xl text-slate-500 hover:bg-slate-300 transition-all"><X size={22} /></button>
                          </div>
                       )}
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 sm:p-12 shadow-ios border border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-5">
                        <button onClick={() => exportData(trips)} className="w-full flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900 py-5 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><Download size={20} /> {t('export')}</button>
                        {isCreator && <button onClick={async () => { if (window.confirm(t('confirmDelete'))) { await deleteTrip(currentTrip.id, user.id); setView('list'); } }} className="w-full text-red-500 py-3 font-black text-xs uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all">{t('deleteTrip')}</button>}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'itinerary' && <Itinerary trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'checklist' && <Checklist trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'expenses' && <Expenses trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'flights' && <FlightManager trip={currentTrip} onUpdate={updateCurrentTrip} />}
            </main>

            {/* Mobile Bottom Bar - Compact Height with Balanced Vertical Padding */}
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 px-10 py-3 pb-4 shadow-[0_-12px_40px_rgba(0,0,0,0.06)]">
               <div className="flex justify-between items-center max-w-md mx-auto">
                  {tabs.map(tab => {
                    const isLocked = isFlightMissing && !['flights', 'dashboard'].includes(tab.id);
                    const isActive = activeTab === tab.id;
                    return (
                      <button 
                        key={tab.id} 
                        onClick={() => !isLocked && setActiveTab(tab.id as any)} 
                        disabled={isLocked} 
                        className={`p-2 transition-all duration-300 flex flex-col items-center ${isActive ? 'text-primary scale-115' : (isLocked ? 'text-slate-200' : 'text-slate-400')}`}
                        aria-label={tab.label}
                      >
                        <tab.icon size={22} strokeWidth={isActive ? 3 : 2} />
                      </button>
                    );
                  })}
               </div>
            </nav>
          </div>
        )}

        {/* Landing View (Unchanged Logic, UI maintained) */}
        {view === 'landing' && (
          <div className="min-h-screen flex flex-col bg-white dark:bg-[#1C1C1E] relative overflow-hidden">
            <header className="p-6 flex justify-between items-center relative z-50"><div className="text-2xl font-black text-primary tracking-tighter">{t('appName')}</div><GlobalNav /></header>
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-10 whitespace-pre-line leading-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">{t('heroTitle')}</h1>
              <p className="text-xl md:text-2xl text-slate-500 mb-14 animate-in fade-in duration-1000 delay-300 max-w-2xl">{t('heroSubtitle')}</p>
              {!user ? <div id="google-login-hero"></div> : <button onClick={() => setView('list')} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-14 py-6 rounded-full text-xl font-black shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-3">{t('startPlanning')} <ArrowRight size={26} /></button>}
            </main>
          </div>
        )}

        {/* Trip List View */}
        {view === 'list' && (
          <div className="p-6 sm:p-12 max-w-7xl mx-auto min-h-screen pb-24">
            <header className="flex justify-between items-center mb-16"><div className="text-2xl font-black text-primary tracking-tighter">{t('appName')}</div><GlobalNav /></header>
            <div className="flex justify-between items-end mb-12">
               <div>
                  <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">{t('yourTrips')}</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total {trips.length} Adventures</p>
               </div>
               <button onClick={() => setShowCreateForm(true)} className="bg-primary text-white px-8 py-4 rounded-[20px] flex items-center gap-2 font-black text-sm shadow-xl hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95"><Plus size={20} /> {t('newTrip')}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {trips.map(trip => (
                <div key={trip.id} onClick={() => { setCurrentTripId(trip.id); setView('detail'); }} className="group bg-white dark:bg-slate-800 rounded-[48px] shadow-ios overflow-hidden cursor-pointer transition-all border border-transparent dark:border-slate-700 hover:-translate-y-3 hover:shadow-ios-lg">
                  <div className="h-64 relative overflow-hidden">
                    <img src={trip.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 p-10 flex flex-col justify-end">
                      <h3 className="text-white text-3xl font-black truncate mb-1">{trip.name}</h3>
                      <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.2em]">{trip.startDate} - {trip.endDate}</p>
                    </div>
                  </div>
                  <div className="p-8 flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-[0.2em]"><span>{trip.destination}</span><span className="text-primary">NT$ {calculateExpensesTotal(trip).toLocaleString()}</span></div>
                </div>
              ))}
              {trips.length === 0 && !isLoading && (
                <div className="col-span-full py-32 text-center text-slate-300 font-black uppercase text-xs tracking-[0.4em] border-2 border-dashed border-slate-50 dark:border-slate-800 rounded-[56px] flex flex-col items-center gap-6">
                   <MapPin size={48} className="opacity-20" />
                   {t('noUpcoming')}
                </div>
              )}
            </div>
            {showCreateForm && <TripForm onClose={() => setShowCreateForm(false)} onSubmit={handleCreateTripSubmit} />}
          </div>
        )}
      </div>
    </LocalizationContext.Provider>
  );
};

export default App;
