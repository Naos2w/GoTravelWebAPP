import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trip, Expense, Currency, User } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, DollarSign, TrendingUp, Plane, Trash2, 
  Coffee, Home, Car, 
  Ticket, ShoppingBag, Tag, Edit2, Lock, User as UserIcon, Calendar, ArrowUpDown, Clock, Check, ChevronDown
} from 'lucide-react';
import { useTranslation } from "../contexts/LocalizationContext";
import { DateTimeUtils } from '../services/dateTimeUtils';
import { supabase } from '../services/storageService';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip, action?: string, payload?: any) => void;
  isGuest?: boolean;
}

export const CATEGORY_UI: Record<string, { icon: any, color: string, hexColor: string, bgColor: string, darkBgColor: string, textColor: string }> = {
  Flight: { icon: Plane, color: 'bg-sky-500', hexColor: '#0ea5e9', bgColor: 'bg-sky-50', darkBgColor: 'dark:bg-sky-900', textColor: 'text-sky-600' },
  Food: { icon: Coffee, color: 'bg-orange-500', hexColor: '#f97316', bgColor: 'bg-orange-50', darkBgColor: 'dark:bg-orange-900', textColor: 'text-orange-600' },
  Accommodation: { icon: Home, color: 'bg-indigo-500', hexColor: '#6366f1', bgColor: 'bg-indigo-50', darkBgColor: 'dark:bg-indigo-900', textColor: 'text-indigo-600' },
  Transport: { icon: Car, color: 'bg-teal-500', hexColor: '#14b8a6', bgColor: 'bg-teal-50', darkBgColor: 'dark:bg-teal-900', textColor: 'text-teal-600' },
  Tickets: { icon: Ticket, color: 'bg-emerald-500', hexColor: '#10b981', bgColor: 'bg-emerald-50', darkBgColor: 'dark:bg-emerald-900', textColor: 'text-emerald-600' },
  Shopping: { icon: ShoppingBag, color: 'bg-pink-500', hexColor: '#ec4899', bgColor: 'bg-pink-50', darkBgColor: 'dark:bg-pink-900', textColor: 'text-pink-600' },
  Other: { icon: Tag, color: 'bg-slate-400', hexColor: '#94a3b8', bgColor: 'bg-slate-100', darkBgColor: 'dark:bg-slate-800', textColor: 'text-slate-500' }
};

export const getCategoryName = (cat: string, t: (key: string) => string) => {
  switch(cat) {
      case 'Flight': return t('catFlight');
      case 'Food': return t('catFood');
      case 'Accommodation': return t('catAccom');
      case 'Transport': return t('catTransport');
      case 'Tickets': return t('catTickets');
      case 'Shopping': return t('catShopping');
      case 'Other': return t('catOther');
      default: return cat;
  }
};

type SortType = 'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'amount-desc' | 'amount-asc';

const CustomFilterSelect = ({ value, onChange, options, icon: Icon, wrapperClass = "", variant = "filter", isError = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((o:any) => o.value === value) || options[0];

  return (
    <div className={`relative ${wrapperClass} shrink-0`} ref={selectRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center transition-colors pointer group outline-none ${
          variant === 'filter' 
            ? `gap-1.5 p-2 px-3 rounded-[14px] shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ${isOpen ? 'bg-slate-200 dark:bg-slate-600 shadow-inner' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-sm'}`
            : `w-full gap-3 px-4 py-3 rounded-2xl text-sm font-black bg-slate-50 dark:bg-slate-900 border ${isError ? 'border-red-500 ring-2 ring-red-500/20' : (isOpen ? 'border-primary ring-2 ring-primary/20 bg-white dark:bg-slate-800' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800')}`
        }`}
      >
        <Icon size={variant === 'filter' ? 12 : 16} className={`${isOpen ? 'text-primary' : 'text-slate-400 group-hover:text-primary'} shrink-0 transition-colors`} />
        <span className={`${variant === 'filter' ? 'truncate max-w-[65px] sm:max-w-[90px]' : 'flex-1'} text-left`}>{selectedOption?.label}</span>
        <ChevronDown size={variant === 'filter' ? 10 : 14} className={`text-slate-400 opacity-50 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-max min-w-[140px] max-w-[220px] max-h-[300px] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 custom-thin-scrollbar p-1.5">
          {options.map((opt:any) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between group ${value === opt.value ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[0.98]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="truncate pr-4">{opt.label}</span>
              {value === opt.value && <Check size={12} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Expenses: React.FC<Props> = ({ trip, onUpdate, isGuest = false }) => {
  const { t } = useTranslation();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [currency, setCurrency] = useState<Currency>(Currency.TWD);
  const [selectedDate, setSelectedDate] = useState(trip.startDate);
  const [note, setNote] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('All');
  const [filterUser, setFilterUser] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortType>('date-desc');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Helper to translate categories
  const getCatName = (cat: string) => getCategoryName(cat, t);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
       if (data.user) {
          setCurrentUser({
             id: data.user.id,
             name: data.user.user_metadata.full_name,
             email: data.user.email!,
             picture: data.user.user_metadata.avatar_url
          });
       }
    });
  }, []);

  const members = useMemo(() => {
    const userMap = new Map<string, string>();
    trip.expenses.forEach(e => { if(e.user_id && e.user_name) userMap.set(e.user_id, e.user_name); });
    trip.flights.forEach(f => { if(f.user_id && f.traveler_name) userMap.set(f.user_id, f.traveler_name); });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [trip.expenses, trip.flights]);

  const dateOptions = useMemo(() => {
    const dates: string[] = [];
    if (!trip.startDate || !trip.endDate) return dates;
    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    const current = new Date(start);
    while (current <= end) {
      dates.push(DateTimeUtils.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [trip.startDate, trip.endDate]);

  const rates: Record<Currency, number> = { [Currency.TWD]: 1, [Currency.USD]: 31.5, [Currency.JPY]: 0.21, [Currency.EUR]: 34.2, [Currency.KRW]: 0.024 };

  const saveExpense = () => {
    const newErrors: Record<string, boolean> = {};
    if (!amount) newErrors.amount = true;
    if (!note.trim()) newErrors.note = true;
    
    if (Object.keys(newErrors).length > 0) {
       setErrors(newErrors);
       return;
    }

    if (!currentUser) return;
    
    const val = parseFloat(amount);
    if (editingExpenseId) {
      const exp = trip.expenses.find(e => e.id === editingExpenseId);
      if (exp?.user_id !== currentUser.id && trip.user_id !== currentUser.id) return;
      
      const updatedExpenses = trip.expenses.map(exp => (exp.id === editingExpenseId ? { ...exp, amount: val, currency, category, date: selectedDate, note, exchangeRate: rates[currency] } : exp));
      onUpdate({ ...trip, expenses: updatedExpenses });
    } else {
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        user_name: currentUser.name,
        amount: val,
        currency,
        category,
        date: selectedDate,
        createdAt: new Date().toISOString(),
        note,
        exchangeRate: rates[currency]
      };
      onUpdate({ ...trip, expenses: [newExpense, ...trip.expenses] });
    }
    resetForm();
  };

  const resetForm = () => { setAmount(''); setNote(''); setEditingExpenseId(null); setIsFormOpen(false); setErrors({}); };

  const startEdit = (expense: Expense) => {
    if (expense.user_id !== currentUser?.id && trip.user_id !== currentUser?.id) return;
    setEditingExpenseId(expense.id);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setCurrency(expense.currency);
    setSelectedDate(expense.date);
    setNote(expense.note);
    setIsFormOpen(true);
    setErrors({});
  };

  const deleteExpense = (id: string) => {
    console.log("[Expenses] Attempting to delete:", id);
    const exp = trip.expenses.find(e => e.id === id);
    
    if (!exp) {
        console.error("[Expenses] Expense not found in trip prop:", id);
    }

    if (exp?.user_id !== currentUser?.id && trip.user_id !== currentUser?.id) {
        console.warn("[Expenses] Permission denied for delete:", id);
        return;
    }

    console.log("[Expenses] Optimistic delete triggered for:", id);
    
    // Optimistic update
    onUpdate({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) }, "DELETE_EXPENSE", id);
  };

  const flightsTotal = (trip.flights || []).reduce((sum, f) => sum + (f.price * (rates[f.currency] || 1)), 0);
  const expensesOnlyTotal = trip.expenses.reduce((sum, e) => sum + (e.amount * (e.exchangeRate || 1)), 0);
  const totalTWD = flightsTotal + expensesOnlyTotal;

  // Transform flights into read-only expense items for the list display
  // Use distinct 'Flight' category
  const flightExpenses: Expense[] = useMemo(() => {
    return (trip.flights || []).map(f => ({
      id: `flight-${f.id}`, // Unique ID to prevent collision
      user_id: f.user_id,
      user_name: f.traveler_name,
      amount: f.price,
      currency: f.currency,
      category: 'Flight',
      date: trip.startDate, // Default to trip start date
      createdAt: new Date().toISOString(), // Just for sorting
      note: `${t('flight')}: ${f.outbound.flightNumber}`,
      exchangeRate: rates[f.currency] || 1,
      isFlight: true // Helper flag
    } as any));
  }, [trip.flights, trip.startDate, t]);

  const processedExpenses = useMemo(() => {
    let list = [...trip.expenses, ...flightExpenses];
    if (filterCategory !== 'All') list = list.filter(e => e.category === filterCategory);
    if (filterUser !== 'All') list = list.filter(e => e.user_id === filterUser);
    if (filterDate !== 'All') list = list.filter(e => e.date === filterDate);
    list.sort((a, b) => {
      switch (sortOrder) {
        case 'created-asc': return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
        case 'amount-desc': return (b.amount * b.exchangeRate) - (a.amount * a.exchangeRate);
        case 'amount-asc': return (a.amount * a.exchangeRate) - (b.amount * b.exchangeRate);
        case 'date-desc': {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff === 0) return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
          return dateDiff;
        }
        case 'date-asc': {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff === 0) return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
          return dateDiff;
        }
        case 'created-desc':
        default: return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      }
    });
    return list;
  }, [trip.expenses, flightExpenses, filterCategory, filterUser, filterDate, sortOrder]);

  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    trip.expenses.forEach(e => {
      const twdVal = e.amount * (e.exchangeRate || 1);
      dataMap[e.category] = (dataMap[e.category] || 0) + twdVal;
    });
    if (flightsTotal > 0) {
      dataMap['Flight'] = (dataMap['Flight'] || 0) + flightsTotal;
    }
    return Object.entries(dataMap).map(([catKey, value]) => ({ 
      category: catKey,
      name: getCatName(catKey), 
      value 
    }));
  }, [trip.expenses, flightsTotal, getCatName]);

  const inputClass = (isError: boolean) => `bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 rounded-2xl border-2 transition-all outline-none ${isError ? 'border-red-500 focus:border-red-500 ring-2 ring-red-500/20 animate-pulse-soft' : 'border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20'}`;

  // Filter out 'Flight' from manual entry options
  const manualCategories = Object.keys(CATEGORY_UI).filter(c => c !== 'Flight');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="space-y-6 lg:col-span-1">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-ios border border-gray-100 dark:border-slate-700 relative overflow-hidden">
           <div className="relative z-10">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('totalCost')}</div>
             <div className="text-4xl font-black tracking-tighter">NT$ {totalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
             <div className="text-[10px] text-slate-400 mt-4 flex items-center gap-1 font-bold"><Plane size={12} /> {t('includesFlight')}</div>
           </div>
           <TrendingUp className="absolute right-[-10%] bottom-[-10%] text-slate-100 dark:text-white/5 w-40 h-40" />
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-ios border border-gray-100 dark:border-slate-700 md:h-[320px] h-auto">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{t('breakdown')}</h3>
          <div className="md:h-full max-h-[200px] md:max-h-none overflow-y-auto custom-thin-scrollbar pr-2 pb-4 [&::-webkit-scrollbar]:w-1">
            {chartData.length > 0 ? (
              <>
                 {/* Desktop Pie Chart */}
                 <div className="hidden md:block h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_UI[entry.category]?.hexColor || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `NT$ ${Math.round(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                 </div>

                 {/* Mobile Bar View */}
                 <div className="md:hidden space-y-4 pb-2">
                    {[...chartData].sort((a,b) => b.value - a.value).map((entry, index) => {
                       const percent = totalTWD > 0 ? (entry.value / totalTWD) * 100 : 0;
                       const ui = CATEGORY_UI[entry.category] || CATEGORY_UI.Other;
                       // Using inline style for width 
                       return (
                         <div key={index}>
                           <div className="flex justify-between items-end mb-1">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ui.hexColor }}></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.name}</span>
                             </div>
                             <span className="text-xs font-black text-slate-900 dark:text-white">{Math.round(percent)}%</span>
                           </div>
                           <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-full">
                              <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: ui.hexColor }} />
                           </div>
                           <div className="text-right text-[10px] font-bold text-slate-400 mt-1">NT$ {Math.round(entry.value).toLocaleString()}</div>
                         </div>
                       )
                    })}
                 </div>
              </>
            ) : <div className="h-full flex items-center justify-center text-slate-300 font-bold">{t('noExpenses')}</div>}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[40px] shadow-ios border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col h-[750px]">
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
           <button onClick={() => setIsFormOpen(true)} className={`w-full py-6 flex items-center justify-center gap-2 text-slate-500 font-black uppercase text-xs tracking-widest transition-all ${isFormOpen ? 'hidden' : 'flex'}`}>
              <Plus size={18} /> {t('addEntry')}
           </button>
           {isFormOpen && (
             <div className="p-8 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-1">
                      <span className="absolute left-4 inset-y-0 flex items-center text-[11px] font-black text-slate-400 z-10">{currency}</span>
                      <input type="number" value={amount} onChange={e => {setAmount(e.target.value); setErrors({...errors, amount: false})}} className={`w-full pl-14 pr-4 py-3 font-black text-sm shadow-sm ${inputClass(errors.amount)}`} placeholder="0" />
                    </div>
                    <CustomFilterSelect 
                      variant="form"
                      icon={DollarSign}
                      value={currency} 
                      onChange={(val: any) => setCurrency(val as Currency)} 
                      options={Object.values(Currency).map(c => ({ value: c, label: c }))} 
                      wrapperClass="md:col-span-1"
                    />
                    <CustomFilterSelect 
                      variant="form"
                      icon={Tag}
                      value={category} 
                      onChange={(val: any) => setCategory(val)} 
                      options={manualCategories.map(c => ({ value: c, label: getCatName(c) }))} 
                      wrapperClass="md:col-span-1"
                    />
                    <CustomFilterSelect 
                      variant="form"
                      icon={Calendar}
                      value={selectedDate} 
                      onChange={(val: any) => setSelectedDate(val)} 
                      options={dateOptions.map(d => ({ value: d, label: d }))} 
                      wrapperClass="md:col-span-1"
                    />
                 </div>
                 <div className="relative">
                   <input value={note} onChange={e => {setNote(e.target.value); setErrors({...errors, note: false})}} className={`w-full px-5 py-4 font-bold text-sm shadow-sm ${inputClass(errors.note)}`} placeholder={t('descRequired') + "..."} />
                 </div>
                <div className="flex gap-3">
                   <button onClick={saveExpense} className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-black">{t('save')}</button>
                   <button onClick={resetForm} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl font-black">{t('cancel')}</button>
                </div>
             </div>
           )}
        </div>

        <div className="border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-20 w-full select-none">
           <div className="px-6 py-4 flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
              <CustomFilterSelect 
                icon={Tag} 
                value={filterCategory} 
                onChange={setFilterCategory} 
                options={[
                  { value: 'All', label: t('filterAll') },
                  ...Object.keys(CATEGORY_UI).map(cat => ({ value: cat, label: getCatName(cat) }))
                ]} 
              />
              <CustomFilterSelect 
                icon={Calendar} 
                value={filterDate} 
                onChange={setFilterDate} 
                options={[
                  { value: 'All', label: t('filterAllDates') },
                  ...dateOptions.map(d => ({ value: d, label: d }))
                ]} 
              />
              <CustomFilterSelect 
                icon={UserIcon} 
                value={filterUser} 
                onChange={setFilterUser} 
                options={[
                  { value: 'All', label: `${t('filterUser')}: ${t('filterAll')}` },
                  ...members.map(m => ({ value: m.id, label: m.name }))
                ]} 
              />
              <CustomFilterSelect 
                icon={ArrowUpDown} 
                value={sortOrder} 
                onChange={setSortOrder} 
                options={[
                  { value: 'date-desc', label: t('sortDateDesc') },
                  { value: 'date-asc', label: t('sortDateAsc') },
                  { value: 'created-desc', label: t('sortCreatedDesc') },
                  { value: 'amount-desc', label: t('sortAmountDesc') },
                  { value: 'amount-asc', label: t('sortAmountAsc') }
                ]} 
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {processedExpenses.map((item: any) => {
             const config = CATEGORY_UI[item.category] || CATEGORY_UI.Other;
             const Icon = config.icon;
             const isFlightItem = !!item.isFlight;

             return (
               <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-white dark:bg-slate-800/50 rounded-[28px] border border-slate-100 dark:border-slate-700 transition-all gap-4 sm:gap-0">
                  <div className="flex items-center gap-4 min-w-0 w-full sm:flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${config.bgColor} ${config.darkBgColor} ${config.textColor} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-sm sm:text-base text-slate-800 dark:text-white truncate">{item.note}</div>
                      <div className="flex items-center gap-2 mt-1">
                         <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserIcon size={10}/> {item.user_name}</div>
                         <div className="w-1 h-1 bg-slate-200 rounded-full"/>
                         <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:pl-4 w-full sm:w-auto border-t sm:border-t-0 border-slate-50 dark:border-slate-700/50 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="font-black text-base sm:text-lg text-slate-800 dark:text-white">{item.currency} {item.amount.toLocaleString()}</div>
                      {item.currency !== Currency.TWD && <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">≈ NT$ {Math.round(item.amount * item.exchangeRate).toLocaleString()}</div>}
                    </div>
                    {!isFlightItem && (item.user_id === currentUser?.id || trip.user_id === currentUser?.id) ? (
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => startEdit(item)} className="p-2 text-slate-400 hover:text-primary"><Edit2 size={16}/></button>
                        <button onClick={() => deleteExpense(item.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    ) : (
                      <div className="p-2 text-slate-300"><Lock size={16}/></div>
                    )}
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};