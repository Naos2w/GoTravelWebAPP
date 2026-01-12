import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trip, Expense, Currency, User } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, DollarSign, TrendingUp, Plane, Trash2, 
  Coffee, Home, Car, 
  Ticket, ShoppingBag, Tag, Edit2, Lock, User as UserIcon
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
  Transport: { icon: Car, color: 'bg-slate-500', hexColor: '#64748b', bgColor: 'bg-slate-50', darkBgColor: 'dark:bg-slate-800', textColor: 'text-slate-600' },
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

type SortType = 'created-desc' | 'created-asc' | 'amount-desc' | 'amount-asc';

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
  const [filterUser, setFilterUser] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortType>('created-desc');
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
    list.sort((a, b) => {
      switch (sortOrder) {
        case 'created-asc': return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
        case 'amount-desc': return (b.amount * b.exchangeRate) - (a.amount * a.exchangeRate);
        case 'amount-asc': return (a.amount * a.exchangeRate) - (b.amount * b.exchangeRate);
        default: return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      }
    });
    return list;
  }, [trip.expenses, flightExpenses, filterCategory, filterUser, sortOrder]);

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

  const inputClass = (isError: boolean) => `bg-white dark:bg-slate-800 rounded-2xl border transition-all ${isError ? 'border-red-500 ring-4 ring-red-500/10 animate-pulse-soft' : 'border-slate-100 dark:border-slate-700'}`;

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
                    {chartData.sort((a,b) => b.value - a.value).map((entry, index) => {
                       const percent = totalTWD > 0 ? (entry.value / totalTWD) * 100 : 0;
                       const ui = CATEGORY_UI[entry.category] || CATEGORY_UI.Other;
                       // Using inline style for width 
                       return (
                         <div key={index}>
                           <div className="flex justify-between items-end mb-1">
                             <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${ui.color}`}></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.name}</span>
                             </div>
                             <span className="text-xs font-black text-slate-900 dark:text-white">{Math.round(percent)}%</span>
                           </div>
                           <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-full">
                              <div className={`h-full ${ui.color}`} style={{ width: `${percent}%` }} />
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="relative">
                     <span className="absolute left-3 top-3 text-[10px] font-black text-slate-400">{currency}</span>
                     <input type="number" value={amount} onChange={e => {setAmount(e.target.value); setErrors({...errors, amount: false})}} className={`w-full pl-12 pr-4 py-3 outline-none font-black text-sm ${inputClass(errors.amount)}`} placeholder="0" />
                   </div>
                   <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={`p-3 font-black text-xs ${inputClass(false)}`}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select>
                   <select value={category} onChange={e => setCategory(e.target.value as any)} className={`p-3 font-black text-xs ${inputClass(false)}`}>{manualCategories.map(c => <option key={c} value={c}>{getCatName(c)}</option>)}</select>
                   <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={`p-3 font-black text-xs ${inputClass(false)}`}>{dateOptions.map(d => <option key={d} value={d}>{d}</option>)}</select>
                </div>
                <div className="relative">
                  <input value={note} onChange={e => {setNote(e.target.value); setErrors({...errors, note: false})}} className={`w-full p-3 font-bold text-sm outline-none ${inputClass(errors.note)}`} placeholder={t('descRequired') + "..."} />
                </div>
                <div className="flex gap-3">
                   <button onClick={saveExpense} className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-black">{t('save')}</button>
                   <button onClick={resetForm} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl font-black">{t('cancel')}</button>
                </div>
             </div>
           )}
        </div>

        <div className="px-6 py-4 flex flex-col sm:flex-row gap-4 border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
           <div className="flex-1 flex gap-2 overflow-x-auto custom-thin-scrollbar pb-2">
              <button onClick={() => setFilterCategory('All')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 ${filterCategory === 'All' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{t('filterAll')}</button>
              {Object.keys(CATEGORY_UI).map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 ${filterCategory === cat ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{getCatName(cat)}</button>
              ))}
           </div>
           <div className="flex items-center gap-2">
              <UserIcon size={14} className="text-slate-400" />
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="bg-slate-100 dark:bg-slate-700 p-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-none">
                 <option value="All">{t('filterUser')}: {t('filterAll')}</option>
                 {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
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