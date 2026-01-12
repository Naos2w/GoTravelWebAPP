
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Trip, Currency, Theme, Language, User } from './types';
import { getTrips, saveTrip, deleteTrip } from './services/storageService';
import { Checklist } from './components/Checklist';
import { Itinerary } from './components/Itinerary';
import { Expenses } from './components/Expenses';
import { ImageGenerator } from './components/ImageGenerator';
import { TripForm } from './components/TripForm';
import { FlightManager } from './components/FlightManager';
import { 
  Plane, Calendar, CheckSquare, DollarSign, CloudSun, 
  Plus, ArrowRight, Home, ChevronLeft, LogOut,
  LayoutDashboard, Trash2, Moon, Sun, Languages, Settings, User as UserIcon, AlertCircle, ExternalLink
} from 'lucide-react';

// 從環境變數讀取 Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// --- Localization ---
const translations = {
  zh: {
    appName: 'Go Travel',
    tagline: '讓旅行更簡單',
    heroTitle: '聰明規劃，\n自在旅行。',
    heroSubtitle: '全方位的旅程規劃空間。機票、行程、花費與 AI 助手，一切都在這個優美的平台。',
    startPlanning: '立即體驗',
    signIn: '使用 Google 登入',
    yourTrips: '您的旅程',
    newTrip: '新增旅程',
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
    weatherForecast: '天氣預報',
    deleteTrip: '刪除旅程',
    confirmDelete: '確定要刪除這趟旅程嗎？此動作無法復原。',
    logout: '登出',
    devNotice: '開發者提示：尚未設定 GOOGLE_CLIENT_ID',
    devNoticeSub: '請在環境變數中設定 GOOGLE_CLIENT_ID，並確保該 ID 已在 Google Cloud Console 中獲得授權。'
  },
  en: {
    appName: 'Go Travel',
    tagline: 'Travel smarter',
    heroTitle: 'Travel smarter,\nnot harder.',
    heroSubtitle: 'The all-in-one workspace for your next adventure. Flights, itinerary, expenses, and AI assistance in one beautiful place.',
    startPlanning: 'Start Planning',
    signIn: 'Sign in with Google',
    yourTrips: 'Your Trips',
    newTrip: 'New Trip',
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
    weatherForecast: 'Weather Forecast',
    deleteTrip: 'Delete Trip',
    confirmDelete: 'Are you sure you want to delete this trip? This action cannot be undone.',
    logout: 'Logout',
    devNotice: 'Developer Notice: GOOGLE_CLIENT_ID Not Set',
    devNoticeSub: 'Please set GOOGLE_CLIENT_ID in your environment variables and ensure it is authorized in the Google Cloud Console.'
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
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'landing' | 'list' | 'detail'>(() => {
    return localStorage.getItem('user') ? 'list' : 'landing';
  });
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itinerary' | 'checklist' | 'expenses' | 'flights'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'zh');
  
  // 檢查 Client ID 是否存在且有效
  const isClientIdMissing = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID');

  useEffect(() => {
    setTrips(getTrips());
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  // 初始化 Google 登入
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (!window.google || isClientIdMissing) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });

      const btnElement = document.getElementById('google-login-btn');
      if (btnElement) {
        window.google.accounts.id.renderButton(btnElement, {
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          width: 280,
          text: 'continue_with',
          shape: 'pill'
        });
      }
      
      // 嘗試啟用 One Tap
      window.google.accounts.id.prompt();
    };

    const handleCredentialResponse = (response: any) => {
      try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const decoded = JSON.parse(jsonPayload);
        const userData: User = {
          id: decoded.sub,
          name: decoded.name,
          email: decoded.email,
          picture: decoded.picture
        };

        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setView('list');
      } catch (e) {
        console.error("Google Auth Decode Error:", e);
      }
    };

    // 輪詢等待 SDK 載入完成
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        initializeGoogleSignIn();
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [view, theme, user, isClientIdMissing]);

  const t = (key: keyof typeof translations.en) => translations[language][key] || translations.en[key];

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(prev => prev === 'zh' ? 'en' : 'zh');

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setView('landing');
  };

  const handleCreateTripSubmit = (newTrip: Trip) => {
    saveTrip(newTrip);
    setTrips(getTrips());
    setCurrentTripId(newTrip.id);
    setShowCreateForm(false);
    setView('detail');
  };

  const currentTrip = trips.find(t => t.id === currentTripId);

  const updateCurrentTrip = (updatedTrip: Trip) => {
    saveTrip(updatedTrip);
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleDeleteTrip = () => {
    if (!currentTripId) return;
    if (window.confirm(t('confirmDelete'))) {
      deleteTrip(currentTripId);
      setTrips(getTrips());
      setView('list');
      setCurrentTripId(null);
    }
  };

  const calculateTotalSpentTWD = (trip: Trip) => {
    const rates: Record<string, number> = {
      'TWD': 1, 'USD': 31.5, 'JPY': 0.21, 'EUR': 34.2, 'KRW': 0.024
    };
    const expensesTotal = trip.expenses.reduce((acc, e) => acc + (e.amount * (e.exchangeRate || 1)), 0);
    const flightTotal = (trip.flight?.price && trip.flight.price > 0)
      ? (trip.flight.price * (rates[trip.flight.currency] || 1))
      : 0;
    return expensesTotal + flightTotal;
  };

  const tabs = [
    { id: 'dashboard', label: t('overview'), icon: LayoutDashboard },
    { id: 'itinerary', label: t('itinerary'), icon: Calendar },
    { id: 'checklist', label: t('checklist'), icon: CheckSquare },
    { id: 'expenses', label: t('expenses'), icon: DollarSign },
    { id: 'flights', label: t('tickets'), icon: Plane },
  ];

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage }}>
      <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-[#1C1C1E] text-slate-100' : 'bg-[#FBFBFD] text-slate-900'}`}>
        {view === 'landing' && (
          <div className="min-h-screen flex flex-col bg-white dark:bg-[#1C1C1E] transition-colors overflow-x-hidden">
            <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full relative z-10">
              <div className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
                {t('appName')}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleLanguage} className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                  <Languages size={20} />
                </button>
                <button onClick={toggleTheme} className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
              </div>
            </header>
            
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] rounded-full -z-10" />
              
              <h1 className="text-5xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter mb-8 whitespace-pre-line animate-in fade-in slide-in-from-bottom-6 duration-1000">
                {t('heroTitle')}
              </h1>
              <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12 font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                {t('heroSubtitle')}
              </p>
              
              <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                {isClientIdMissing ? (
                  <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-[32px] border border-red-100 dark:border-red-900/30 max-w-sm text-center shadow-ios">
                    <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="font-black text-red-900 dark:text-red-200 mb-2">{t('devNotice')}</h3>
                    <p className="text-xs text-red-600 dark:text-red-400/80 mb-6 leading-relaxed">{t('devNoticeSub')}</p>
                    <a 
                      href="https://console.cloud.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-xs hover:bg-red-700 transition-all shadow-md"
                    >
                      Google Console <ExternalLink size={14} />
                    </a>
                  </div>
                ) : (
                  <div id="google-login-btn"></div>
                )}
                
                {user && (
                  <button 
                    onClick={() => setView('list')}
                    className="group bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-10 py-5 rounded-full text-lg font-black hover:scale-105 transition-all flex items-center gap-3 shadow-2xl shadow-slate-200 dark:shadow-none"
                  >
                    {t('startPlanning')} <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </main>
            
            <footer className="p-8 text-center text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">
              &copy; {new Date().getFullYear()} {t('appName')} Inc. All Rights Reserved.
            </footer>
          </div>
        )}
        
        {view === 'list' && (
          <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('yourTrips')}</h2>
                <div className="flex gap-2">
                  <button onClick={toggleLanguage} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 border border-slate-100/50 dark:border-slate-700 shadow-ios hover:shadow-ios-lg transition-all">
                    <Languages size={18} />
                  </button>
                  <button onClick={toggleTheme} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 border border-slate-100/50 dark:border-slate-700 shadow-ios hover:shadow-ios-lg transition-all">
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {user && (
                   <div className="hidden sm:flex items-center gap-3 p-1.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-full pr-4 shadow-sm">
                      <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-slate-100" />
                      <span className="text-xs font-black dark:text-white">{user.name}</span>
                      <button onClick={logout} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 rounded-full transition-colors"><LogOut size={14} /></button>
                   </div>
                )}
                <button onClick={() => setShowCreateForm(true)} className="bg-primary text-white px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-blue-600 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all font-black text-sm">
                  <Plus size={20} /> <span className="hidden sm:inline">{t('newTrip')}</span>
                </button>
              </div>
            </div>
            
            {trips.length === 0 ? (
               <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-[40px] shadow-ios transition-all">
                 <div className="w-24 h-24 bg-blue-50/50 dark:bg-slate-900/50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-8">
                   <Plane size={40} />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">{t('noTrips')}</h3>
                 <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-sm mx-auto font-medium">{t('noTripsSub')}</p>
                 <button onClick={() => setShowCreateForm(true)} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-8 py-3.5 rounded-full font-black hover:scale-105 transition-all shadow-xl">{t('addFlight')}</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {trips.map(trip => (
                  <div 
                    key={trip.id} 
                    onClick={() => { setCurrentTripId(trip.id); setView('detail'); }} 
                    className="group bg-white dark:bg-slate-800 rounded-[40px] shadow-ios hover:shadow-ios-lg border border-transparent dark:border-slate-700 overflow-hidden cursor-pointer transition-all duration-500 transform hover:-translate-y-2"
                  >
                    <div className="h-56 overflow-hidden relative">
                       <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
                          <h3 className="text-white text-2xl font-black tracking-tight mb-1">{trip.name || trip.destination}</h3>
                          <p className="text-white/70 text-sm font-bold uppercase tracking-widest">
                            {new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()}
                          </p>
                       </div>
                    </div>
                    <div className="p-7 flex justify-between items-center text-sm">
                       <span className="text-slate-400 font-bold uppercase tracking-widest">{trip.itinerary.length} {t('days')}</span>
                       <span className="text-primary dark:text-blue-400 font-black">NT$ {calculateTotalSpentTWD(trip).toLocaleString()} {t('spent')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showCreateForm && <TripForm onClose={() => setShowCreateForm(false)} onSubmit={handleCreateTripSubmit} />}
          </div>
        )}

        {view === 'detail' && currentTrip && (
          <div className="min-h-screen">
            <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 transition-all duration-300 shadow-sm h-20">
              <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
                 <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                   <button onClick={() => setView('list')} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-slate-500 transition-colors">
                     <ChevronLeft size={24} />
                   </button>
                   <div className="flex flex-col">
                     <input 
                       value={currentTrip.name || currentTrip.destination} 
                       onChange={(e) => updateCurrentTrip({ ...currentTrip, name: e.target.value })}
                       className="text-lg font-black bg-transparent focus:outline-none focus:ring-0 rounded-md px-1 w-[120px] sm:w-auto dark:text-white"
                     />
                     <span className="hidden sm:inline text-[9px] uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-500 px-1">{currentTrip.destination}</span>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                    <div className="hidden sm:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                      {tabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 lg:px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                            activeTab === tab.id 
                             ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios' 
                             : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <tab.icon size={16} /> 
                          <span className="hidden lg:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={toggleLanguage} className="p-2.5 rounded-2xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <Languages size={20} />
                      </button>
                      <button onClick={toggleTheme} className="p-2.5 rounded-2xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                      </button>
                      {user && (
                         <button onClick={logout} className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                            <LogOut size={20} />
                         </button>
                      )}
                      <button onClick={handleDeleteTrip} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                 </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-12 pb-36 sm:pb-12 animate-in fade-in duration-500">
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 md:p-12 shadow-ios transition-all duration-300">
                       <div className="flex items-center gap-4 mb-4">
                          {user && <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full border-2 border-primary/20" />}
                          <h2 className="text-3xl font-black dark:text-white tracking-tighter">{t('welcome')}{user ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
                       </div>
                       <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">{new Date(currentTrip.startDate).toLocaleDateString()} - {new Date(currentTrip.endDate).toLocaleDateString()}</p>
                       <div className="mt-8 flex flex-wrap gap-3">
                          {currentTrip.flight?.outbound.flightNumber && (
                            <span className="bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-full font-black text-[10px] border border-blue-100/50 dark:border-blue-800 uppercase tracking-widest">
                              {currentTrip.flight.outbound.flightNumber}
                            </span>
                          )}
                       </div>
                    </div>
                    <ImageGenerator />
                  </div>
                  
                  <div className="space-y-8">
                     <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-ios transition-all duration-300">
                        <h3 className="text-lg font-black mb-8 text-slate-900 dark:text-white flex items-center gap-3">
                          <LayoutDashboard size={20} className="text-primary" /> {t('quickStats')}
                        </h3>
                        <div className="space-y-8">
                          <div className="flex flex-col gap-1.5">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('totalSpent')}</span>
                             <span className="text-3xl font-black text-primary tracking-tighter">NT$ {calculateTotalSpentTWD(currentTrip).toLocaleString()}</span>
                          </div>
                        </div>
                     </div>
                  </div>
                </div>
              )}
              {activeTab === 'itinerary' && <Itinerary trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'checklist' && <Checklist trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'expenses' && <Expenses trip={currentTrip} onUpdate={updateCurrentTrip} />}
              {activeTab === 'flights' && <FlightManager trip={currentTrip} onUpdate={updateCurrentTrip} />}
            </main>

            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-40 shadow-2xl transition-all duration-300 pb-safe">
              {tabs.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id as any)} 
                  className={`p-3.5 rounded-2xl transition-all duration-300 ${activeTab === tab.id ? 'text-primary bg-primary/5 scale-110' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'}`}
                >
                  <tab.icon size={26} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </LocalizationContext.Provider>
  );
};

export default App;
