
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Trip, Currency, Theme, Language, User } from './types';
import { getTrips, saveTrip, deleteTrip, exportData, supabase } from './services/storageService';
import { Checklist } from './components/Checklist';
import { Itinerary } from './components/Itinerary';
import { Expenses } from './components/Expenses';
import { TripForm } from './components/TripForm';
import { FlightManager } from './components/FlightManager';
import { 
  Plane, Calendar, CheckSquare, DollarSign, 
  Plus, ArrowRight, ChevronLeft, LogOut, Loader2,
  LayoutDashboard, Trash2, Moon, Sun, Languages,
  Database, Cloud, Download, AlertCircle, Lock
} from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const translations = {
  zh: {
    appName: 'Go Travel',
    tagline: '讓旅行更簡單',
    heroTitle: '聰明規劃，\n自在旅行。',
    heroSubtitle: '全方位的旅程規劃空間。同步雲端，一切都在這個優美的平台。',
    startPlanning: '立即體驗',
    signIn: '使用 Google 登入',
    yourTrips: '您的旅程',
    newTrip: '新增',
    noTrips: '尚無行程',
    noTripsSub: '從加入機票資訊開始您的第一趟旅程吧。',
    addFlight: '加入機票',
    days: '天',
    spent: '花費',
    overview: '概覽',
    itinerary: '行程規劃',
    checklist: '待辦清單',
    expenses: '花費統計',
    tickets: '機票資訊',
    welcome: '歡迎回來',
    quickStats: '快速統計',
    totalSpent: '總花費',
    deleteTrip: '刪除旅程',
    confirmDelete: '確定要刪除這趟旅程嗎？此動作無法復原。',
    logout: '登出',
    devNotice: '開發者提示：尚未設定環境變數',
    devNoticeSub: '請設定 GOOGLE_CLIENT_ID、SUPABASE_URL 與 SUPABASE_ANON_KEY。',
    rlsNotice: '權限不足 (RLS Error)',
    rlsNoticeSub: '請至 Supabase Dashboard 設定 RLS 策略以允許資料寫入。',
    dataManagement: '資料管理',
    dataDesc: '資料已與您的帳號同步。',
    export: '匯出備份',
    syncing: '雲端同步中...',
    loading: '載入中...',
    error: '同步失敗',
    flightRequired: '請完成機票價格設定'
  },
  en: {
    appName: 'Go Travel',
    tagline: 'Travel smarter',
    heroTitle: 'Travel smarter,\nnot harder.',
    heroSubtitle: 'All-in-one travel workspace. Cloud synced across all your devices.',
    startPlanning: 'Start Planning',
    yourTrips: 'Your Trips',
    newTrip: 'New',
    noTrips: 'No trips yet',
    noTripsSub: 'Start by adding your flight details.',
    addFlight: 'Add Flight Ticket',
    days: 'Days',
    spent: 'spent',
    overview: 'Overview',
    itinerary: 'Itinerary',
    checklist: 'Checklist',
    expenses: 'Expenses',
    tickets: 'Tickets',
    welcome: 'Welcome back',
    quickStats: 'Quick Stats',
    totalSpent: 'Total Spent',
    deleteTrip: 'Delete Trip',
    confirmDelete: 'Are you sure you want to delete this trip?',
    logout: 'Logout',
    devNotice: 'Developer Notice: Env Vars Missing',
    devNoticeSub: 'Please set GOOGLE_CLIENT_ID, SUPABASE_URL, and SUPABASE_ANON_KEY.',
    rlsNotice: 'Permission Denied (RLS)',
    rlsNoticeSub: 'Please configure Supabase RLS policies to allow writes.',
    dataManagement: 'Data Management',
    dataDesc: 'Data is synced to your cloud account.',
    export: 'Export JSON',
    syncing: 'Syncing to cloud...',
    loading: 'Loading...',
    error: 'Sync failed',
    flightRequired: 'Price setup required'
  }
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'list' | 'detail'>(() => {
    const savedView = sessionStorage.getItem('appView');
    return (savedView as any) || 'landing';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(() => sessionStorage.getItem('currentTripId'));
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itinerary' | 'checklist' | 'expenses' | 'flights'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'zh');
  
  // 用於防抖儲存的 Ref
  const saveTimeoutRef = useRef<number | null>(null);

  const isEnvMissing = !GOOGLE_CLIENT_ID || !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('placeholder');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        setIsLoading(false);
        if (view !== 'landing') setView('landing');
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setView('landing');
        sessionStorage.removeItem('currentTripId');
        sessionStorage.removeItem('appView');
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthUser = (supabaseUser: any) => {
    const userData: User = {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata.full_name || supabaseUser.email?.split('@')[0] || 'User',
      email: supabaseUser.email!,
      picture: supabaseUser.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${supabaseUser.email}`,
    };
    setUser(userData);
    setView(prev => {
      if (prev === 'landing') return 'list';
      return prev;
    });
    setIsLoading(false);
  };

  useEffect(() => {
    sessionStorage.setItem('appView', view);
  }, [view]);

  useEffect(() => {
    if (currentTripId) {
      sessionStorage.setItem('currentTripId', currentTripId);
    } else {
      sessionStorage.removeItem('currentTripId');
    }
  }, [currentTripId]);

  useEffect(() => {
    if (user) loadTrips();
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [user, theme]);

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  const loadTrips = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const cloudTrips = await getTrips(user.id);
      setTrips(cloudTrips);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (!window.google || isEnvMissing) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      
      const navBtn = document.getElementById('google-login-nav');
      const heroBtn = document.getElementById('google-login-hero');
      
      const renderOptions = {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'pill'
      };

      if (navBtn) window.google.accounts.id.renderButton(navBtn, { ...renderOptions, width: 120, text: 'signin', size: 'medium' });
      if (heroBtn) window.google.accounts.id.renderButton(heroBtn, { ...renderOptions, width: 280, text: 'continue_with' });
    };

    const handleCredentialResponse = async (response: any) => {
      try {
        const { error } = await supabase.auth.signInWithIdToken({ 
          provider: 'google', 
          token: response.credential 
        });
        if (error) throw error;
      } catch (e) { 
        console.error("Auth Error", e);
      }
    };

    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) { initializeGoogleSignIn(); clearInterval(checkInterval); }
    }, 500);
    return () => clearInterval(checkInterval);
  }, [view, theme, user]);

  const t = (key: keyof typeof translations.en) => translations[language][key] || translations.en[key];
  
  const logout = () => { 
    supabase.auth.signOut();
  };

  const handleCreateTripSubmit = async (newTrip: Trip) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await saveTrip(newTrip, user.id);
      await loadTrips();
      setCurrentTripId(newTrip.id);
      setShowCreateForm(false);
      setView('detail');
      setActiveTab('flights');
    } catch (err: any) {
      alert(err.message);
    } finally { setIsSyncing(false); }
  };

  /**
   * 核心更新函數：支援防抖儲存，解決 409 Conflict 問題
   */
  const updateCurrentTrip = (updatedTrip: Trip) => {
    if (!user) return;
    
    // 立即更新本地 UI 狀態
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));

    // 清除先前的計時器
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // 設定新的儲存計時器 (1秒後執行)
    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try {
        await saveTrip(updatedTrip, user.id);
      } catch (err: any) {
        console.error("Debounced save failed:", err);
      } finally {
        setIsSyncing(false);
        saveTimeoutRef.current = null;
      }
    }, 1000);
  };

  const handleDeleteTrip = async () => {
    if (!currentTripId || !user) return;
    if (window.confirm(t('confirmDelete'))) {
      setIsSyncing(true);
      try {
        await deleteTrip(currentTripId, user.id);
        await loadTrips();
        setView('list');
        setCurrentTripId(null);
      } catch (err: any) { alert(err.message); }
      finally { setIsSyncing(false); }
    }
  };

  const calculateTotalSpentTWD = (trip: Trip) => {
    return trip.expenses.reduce((acc, e) => acc + (e.amount * (e.exchangeRate || 1)), 0);
  };

  const currentTrip = trips.find(t => t.id === currentTripId);
  const isFlightMissing = currentTrip && (!currentTrip.flight || currentTrip.flight.price === 0);

  const tabs = [
    { id: 'dashboard', label: t('overview'), icon: LayoutDashboard },
    { id: 'itinerary', label: t('itinerary'), icon: Calendar },
    { id: 'checklist', label: t('checklist'), icon: CheckSquare },
    { id: 'expenses', label: t('expenses'), icon: DollarSign },
    { id: 'flights', label: t('tickets'), icon: Plane },
  ];

  const handleTabChange = (tabId: any) => {
    if (isFlightMissing && !['flights', 'dashboard'].includes(tabId)) {
      return;
    }
    setActiveTab(tabId);
  };

  const GlobalNav = () => (
    <div className="flex items-center gap-2">
      <button onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white transition-all duration-300">
        <Languages size={18} />
      </button>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white transition-all duration-300">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      {user ? (
        <div className="flex items-center gap-2 pl-2 ml-2 border-l border-slate-100 dark:border-slate-800">
           <img src={user.picture} className="w-8 h-8 rounded-full border border-slate-200" />
           <button onClick={logout} className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-300">
             <LogOut size={18} />
           </button>
        </div>
      ) : (
        <div id="google-login-nav" className="ml-2"></div>
      )}
    </div>
  );

  if (isLoading && view === 'landing') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors ${theme === 'dark' ? 'bg-[#1C1C1E]' : 'bg-[#FBFBFD]'}`}>
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage: (l) => setLanguage(l) }}>
      <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-[#1C1C1E] text-slate-100' : 'bg-[#FBFBFD] text-slate-900'}`}>
        
        {view === 'detail' && currentTrip && (
          <div className="min-h-screen">
            <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 h-16 sm:h-20 flex items-center">
              <div className="max-w-7xl mx-auto px-4 w-full flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button onClick={() => { setView('list'); setCurrentTripId(null); }} className="p-2.5 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                    <ChevronLeft />
                  </button>
                  <div className="truncate">
                    <input value={currentTrip.name} onChange={(e) => updateCurrentTrip({ ...currentTrip, name: e.target.value })} className="text-sm sm:text-lg font-black bg-transparent w-full truncate dark:text-white outline-none" />
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-black text-slate-400">{currentTrip.destination}</span>
                       {isFlightMissing && (
                         <span className="text-[8px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                           <AlertCircle size={8} /> {t('flightRequired')}
                         </span>
                       )}
                       {isSyncing && !isFlightMissing && <span className="text-[8px] font-black text-blue-500 animate-pulse uppercase tracking-widest flex items-center gap-1"><Cloud size={8} /> {t('syncing')}</span>}
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                  {tabs.map(tab => {
                    const isLocked = isFlightMissing && !['flights', 'dashboard'].includes(tab.id);
                    const isActionRequired = isFlightMissing && tab.id === 'flights';
                    
                    return (
                      <button 
                        key={tab.id} 
                        onClick={() => handleTabChange(tab.id)} 
                        disabled={isLocked}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-300 relative ${
                          activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios' 
                            : (isLocked 
                                ? 'text-red-400/30 dark:text-red-900/30 bg-red-50/10 dark:bg-red-900/5 cursor-not-allowed opacity-40 hover:bg-red-50/20' 
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white')
                        }`}
                      >
                        {isLocked ? <Lock size={14} className="text-red-500/50" /> : <tab.icon size={16} />} 
                        <span className="hidden lg:inline">{tab.label}</span>
                        {isActionRequired && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full animate-bounce" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <GlobalNav />
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-12 pb-36">
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 md:p-12 shadow-ios border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-4 mb-6">
                        <img src={user?.picture} className="w-12 h-12 rounded-full border-2 border-primary/20 shadow-sm" />
                        <div>
                          <h2 className="text-3xl font-black tracking-tighter">{t('welcome')}{user ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{currentTrip.startDate} - {currentTrip.endDate}</p>
                        </div>
                      </div>
                      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destinations</div>
                          <div className="font-black text-lg">{currentTrip.destination}</div>
                        </div>
                         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                          <div className="font-black text-lg">{currentTrip.itinerary.length} {t('days')}</div>
                        </div>
                         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items</div>
                          <div className="font-black text-lg">{currentTrip.checklist.length}</div>
                        </div>
                         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expenses</div>
                          <div className="font-black text-lg">{currentTrip.expenses.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-ios border border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg font-black mb-8 flex items-center gap-3"><LayoutDashboard size={20} className="text-primary" /> {t('quickStats')}</h3>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('totalSpent')}</span>
                        <span className="text-3xl font-black text-primary">NT$ {calculateTotalSpentTWD(currentTrip).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-ios border border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg font-black mb-4 flex items-center gap-3"><Database size={20} className="text-indigo-500" /> {t('dataManagement')}</h3>
                      <p className="text-xs text-slate-500 mb-8 font-medium">{t('dataDesc')}</p>
                      <div className="space-y-3">
                        <button onClick={() => exportData(trips)} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-2xl font-black text-xs transition-all hover:opacity-90">
                          <Download size={16} /> {t('export')}
                        </button>
                        <button onClick={handleDeleteTrip} className="w-full flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30 text-red-500 py-3 rounded-2xl font-black text-xs transition-all hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 size={16} /> {t('deleteTrip')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'itinerary' && !isFlightMissing && <Itinerary trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'checklist' && !isFlightMissing && <Checklist trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'expenses' && !isFlightMissing && <Expenses trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'flights' && <FlightManager trip={currentTrip} onUpdate={updateCurrentTrip} />}
            </main>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-around items-center z-40 shadow-2xl pb-safe">
              {tabs.map(tab => {
                const isLocked = isFlightMissing && !['flights', 'dashboard'].includes(tab.id);
                const isActionRequired = isFlightMissing && tab.id === 'flights';
                
                return (
                  <button 
                    key={tab.id} 
                    onClick={() => handleTabChange(tab.id)} 
                    disabled={isLocked}
                    className={`p-3 rounded-2xl transition-all duration-300 relative ${
                      activeTab === tab.id 
                        ? 'text-primary bg-primary/5 scale-110' 
                        : (isLocked ? 'text-red-500/30 dark:text-red-900/30 scale-90 opacity-40' : 'text-slate-300 hover:text-slate-600')
                    }`}
                  >
                    {isLocked ? <Lock size={22} strokeWidth={2.5} className="text-red-500/30" /> : <tab.icon size={22} strokeWidth={2.5} />}
                    {isActionRequired && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-bounce" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === 'landing' && (
          <div className="min-h-screen flex flex-col bg-white dark:bg-[#1C1C1E] transition-colors overflow-x-hidden">
            <header className="p-4 sm:p-6 flex justify-between items-center max-w-7xl mx-auto w-full relative z-10">
              <div className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">{t('appName')}</div>
              <GlobalNav />
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 whitespace-pre-line animate-in fade-in slide-in-from-bottom-6 duration-1000">{t('heroTitle')}</h1>
              <p className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12 animate-in fade-in delay-200">{t('heroSubtitle')}</p>
              {isEnvMissing ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[32px] border border-red-100 max-w-sm">
                  <AlertCircle className="mx-auto mb-4 text-red-500" />
                  <h3 className="font-black text-red-900 dark:text-red-200 mb-2">{t('devNotice')}</h3>
                  <p className="text-xs text-red-600 dark:text-red-400">{t('devNoticeSub')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div id="google-login-hero"></div>
                  {user && <button onClick={() => setView('list')} className="group bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-10 py-5 rounded-full text-lg font-black shadow-2xl hover:scale-105 transition-all">{t('startPlanning')} <ArrowRight size={22} className="inline ml-2 group-hover:translate-x-1 transition-transform" /></button>}
                </div>
              )}
            </main>
          </div>
        )}

        {view === 'list' && (
          <div className="p-4 sm:p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
            <header className="flex justify-between items-center mb-12">
              <div className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">{t('appName')}</div>
              <GlobalNav />
            </header>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{t('yourTrips')}</h2>
              <div className="flex items-center gap-3">
                {isLoading && <Loader2 className="animate-spin text-slate-400" size={20} />}
                <button onClick={() => setShowCreateForm(true)} className="bg-primary text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs shadow-lg hover:scale-105 transition-all"><Plus size={18} /> {t('newTrip')}</button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="font-black text-slate-400 animate-pulse-soft uppercase text-[10px] tracking-widest">{t('loading')}</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-[40px] shadow-ios border border-slate-100 dark:border-slate-700">
                <Plane className="mx-auto mb-8 text-blue-500 opacity-20" size={60} />
                <h3 className="text-xl font-black mb-2">{t('noTrips')}</h3>
                <p className="text-slate-500 mb-8">{t('noTripsSub')}</p>
                <button onClick={() => setShowCreateForm(true)} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-8 py-3.5 rounded-full font-black hover:scale-105 transition-all">{t('addFlight')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {trips.map(trip => (
                  <div key={trip.id} onClick={() => { setCurrentTripId(trip.id); setView('detail'); }} className="group bg-white dark:bg-slate-800 rounded-[40px] shadow-ios overflow-hidden cursor-pointer transition-all transform hover:-translate-y-2 border border-transparent dark:border-slate-700">
                    <div className="h-52 relative overflow-hidden">
                      <img src={trip.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 p-8 flex flex-col justify-end">
                        <h3 className="text-white text-xl font-black truncate">{trip.name}</h3>
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{trip.startDate} - {trip.endDate}</p>
                      </div>
                    </div>
                    <div className="p-6 flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-black">{trip.itinerary.length} {t('days')}</span>
                      <span className="text-primary font-black">NT$ {calculateTotalSpentTWD(trip).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showCreateForm && <TripForm onClose={() => setShowCreateForm(false)} onSubmit={handleCreateTripSubmit} />}
          </div>
        )}
      </div>
    </LocalizationContext.Provider>
  );
};

export default App;
