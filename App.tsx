
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Trip, Currency, Theme, Language } from './types';
import { getTrips, saveTrip, deleteTrip } from './services/storageService';
import { Checklist } from './components/Checklist';
import { Itinerary } from './components/Itinerary';
import { Expenses } from './components/Expenses';
import { ImageGenerator } from './components/ImageGenerator';
import { TripForm } from './components/TripForm';
import { FlightManager } from './components/FlightManager';
import { 
  Plane, Calendar, CheckSquare, DollarSign, CloudSun, 
  Plus, ArrowRight, Home, ChevronLeft,
  LayoutDashboard, Trash2, Moon, Sun, Languages, Settings
} from 'lucide-react';

// --- Localization ---
const translations = {
  zh: {
    appName: 'Go Travel',
    tagline: '讓旅行更簡單',
    heroTitle: '聰明規劃，\n自在旅行。',
    heroSubtitle: '全方位的旅程規劃空間。機票、行程、花費與 AI 助手，一切都在這個優美的平台。',
    startPlanning: '開始規劃',
    signIn: '登入',
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
    welcome: '歡迎來到',
    quickStats: '快速統計',
    totalSpent: '總花費',
    weatherForecast: '天氣預報',
    deleteTrip: '刪除旅程',
    confirmDelete: '確定要刪除這趟旅程嗎？此動作無法復原。'
  },
  en: {
    appName: 'Go Travel',
    tagline: 'Travel smarter',
    heroTitle: 'Travel smarter,\nnot harder.',
    heroSubtitle: 'The all-in-one workspace for your next adventure. Flights, itinerary, expenses, and AI assistance in one beautiful place.',
    startPlanning: 'Start Planning',
    signIn: 'Sign In',
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
    welcome: 'Welcome to',
    quickStats: 'Quick Stats',
    totalSpent: 'Total Spent',
    weatherForecast: 'Weather Forecast',
    deleteTrip: 'Delete Trip',
    confirmDelete: 'Are you sure you want to delete this trip? This action cannot be undone.'
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
  const [view, setView] = useState<'landing' | 'list' | 'detail'>('landing');
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itinerary' | 'checklist' | 'expenses' | 'flights'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'zh');

  useEffect(() => {
    setTrips(getTrips());
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  const t = (key: keyof typeof translations.en) => translations[language][key] || translations.en[key];

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(prev => prev === 'zh' ? 'en' : 'zh');

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

  return (
    <LocalizationContext.Provider value={{ t, language, setLanguage }}>
      <div className={`min-h-screen transition-all duration-500 ${theme === 'dark' ? 'dark bg-[#1C1C1E] text-slate-100' : 'bg-[#FBFBFD] text-slate-900'}`}>
        {view === 'landing' && (
          <div className="min-h-screen flex flex-col bg-white dark:bg-[#1C1C1E] transition-colors">
            <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
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
                <button onClick={() => setView('list')} className="hidden sm:block text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-4">{t('signIn')}</button>
              </div>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <h1 className="text-5xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter mb-8 whitespace-pre-line animate-in fade-in slide-in-from-bottom-6 duration-1000">
                {t('heroTitle')}
              </h1>
              <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12 font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                {t('heroSubtitle')}
              </p>
              <button 
                onClick={() => setView('list')}
                className="group bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-10 py-5 rounded-full text-lg font-black hover:scale-105 transition-all flex items-center gap-3 shadow-2xl shadow-slate-200 dark:shadow-none animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300"
              >
                {t('startPlanning')} <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </main>
          </div>
        )}
        
        {view === 'list' && (
          <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('yourTrips')}</h2>
                {/* 桌面與行動端皆可見的切換按鈕 */}
                <div className="flex gap-2">
                  <button onClick={toggleLanguage} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 border border-slate-100/50 dark:border-slate-700 shadow-ios hover:shadow-ios-lg transition-all">
                    <Languages size={18} />
                  </button>
                  <button onClick={toggleTheme} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 border border-slate-100/50 dark:border-slate-700 shadow-ios hover:shadow-ios-lg transition-all">
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  </button>
                </div>
              </div>
              <button onClick={() => setShowCreateForm(true)} className="bg-primary text-white px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-blue-600 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all font-black text-sm">
                <Plus size={20} /> <span className="hidden sm:inline">{t('newTrip')}</span>
              </button>
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
                 
                 {/* 桌面端切換按鈕，行動端收納在右側 */}
                 <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                    <div className="hidden lg:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                      {[
                        { id: 'dashboard', label: t('overview'), icon: LayoutDashboard },
                        { id: 'itinerary', label: t('itinerary'), icon: Calendar },
                        { id: 'checklist', label: t('checklist'), icon: CheckSquare },
                        { id: 'expenses', label: t('expenses'), icon: DollarSign },
                        { id: 'flights', label: t('tickets'), icon: Plane },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                            activeTab === tab.id 
                             ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-ios' 
                             : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <tab.icon size={16} /> {tab.label}
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
                      <button onClick={handleDeleteTrip} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                 </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-12 pb-32 lg:pb-12 animate-in fade-in duration-500">
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 md:p-12 shadow-ios transition-all duration-300">
                       <h2 className="text-3xl font-black mb-2 dark:text-white tracking-tighter">{t('welcome')} {currentTrip.name || currentTrip.destination}!</h2>
                       <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">{new Date(currentTrip.startDate).toLocaleDateString()} - {new Date(currentTrip.endDate).toLocaleDateString()}</p>
                       <div className="mt-8 flex flex-wrap gap-3">
                          {currentTrip.flight?.outbound.flightNumber && (
                            <span className="bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-full font-black text-[10px] border border-blue-100/50 dark:border-blue-800 uppercase tracking-widest">
                              {currentTrip.flight.outbound.flightNumber}
                            </span>
                          )}
                          {currentTrip.flight?.inbound && currentTrip.flight.inbound.flightNumber && (
                            <span className="bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-full font-black text-[10px] border border-blue-100/50 dark:border-blue-800 uppercase tracking-widest">
                              {currentTrip.flight.inbound.flightNumber}
                            </span>
                          )}
                       </div>
                    </div>
                    <ImageGenerator />
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-ios transition-all duration-300">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                        <CloudSun className="text-orange-400" size={24} /> {t('weatherForecast')}
                      </h3>
                      <div className="flex justify-between items-center overflow-x-auto gap-8 no-scrollbar py-2">
                         {Array.from({length: Math.min(6, currentTrip.itinerary.length || 1)}).map((_, i) => (
                           <div key={i} className="flex flex-col items-center min-w-[80px] p-4 rounded-[32px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                              <span className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">Day {i+1}</span>
                              <CloudSun size={32} className={i % 2 === 0 ? "text-yellow-500" : "text-slate-400"} />
                              <span className="text-xl font-black mt-3 dark:text-slate-100">{25 - i}°</span>
                           </div>
                         ))}
                      </div>
                    </div>
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
                          <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-end">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('checklist')}</span>
                               <span className="text-sm font-black dark:text-slate-200">{Math.round((currentTrip.checklist.filter(i => i.isCompleted).length / (currentTrip.checklist.length || 1)) * 100)}%</span>
                             </div>
                             <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,197,94,0.3)]" style={{ width: `${(currentTrip.checklist.filter(i => i.isCompleted).length / (currentTrip.checklist.length || 1)) * 100}%` }}></div>
                             </div>
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

            {/* 行動端底部導覽列 */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-40 shadow-2xl transition-all duration-300">
              {[
                 { id: 'dashboard', icon: Home },
                 { id: 'itinerary', icon: Calendar },
                 { id: 'checklist', icon: CheckSquare },
                 { id: 'expenses', icon: DollarSign },
                 { id: 'flights', icon: Plane },
              ].map(tab => (
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
