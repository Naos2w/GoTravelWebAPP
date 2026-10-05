import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trip, Expense, Currency, User } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, DollarSign, TrendingUp, Plane, Trash2, 
  Coffee, Home, Car, 
  Ticket, ShoppingBag, Tag, Edit2, Lock, User as UserIcon, Calendar, ArrowUpDown, Clock, Check, ChevronDown,
  CreditCard, Wallet, Sparkles
} from 'lucide-react';
import { useTranslation } from "../contexts/LocalizationContext";
import { DateTimeUtils } from '../services/dateTimeUtils';
import { supabase } from '../services/storageService';
import { CATEGORY_UI, getCategoryName } from './ExpenseCategories';

interface Props {
  trip: Trip;
  currentUser: User;
  onUpdate: (trip: Trip, action?: string, payload?: any) => void;
  isGuest?: boolean;
}

type SortType = 'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'amount-desc' | 'amount-asc';

interface SelectOption<T = string> {
  value: T;
  label: string;
}

interface CustomFilterSelectProps<T = string> {
  value: T;
  onChange: (val: T) => void;
  options: SelectOption<T>[];
  icon: React.ComponentType<{ size: number; className?: string }>;
  wrapperClass?: string;
  variant?: "filter" | "form";
  isError?: boolean;
}

const CustomFilterSelect = <T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  wrapperClass = "",
  variant = "filter",
  isError = false,
}: CustomFilterSelectProps<T>) => {
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

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative ${wrapperClass} shrink-0`} ref={selectRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center transition-all cursor-pointer group outline-none ${
          variant === 'filter' 
            ? `gap-1.5 py-1.5 px-3 rounded-xl shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200 ${isOpen ? 'bg-slate-200 dark:bg-slate-700 shadow-inner' : 'bg-slate-100/80 dark:bg-white/[0.06] hover:bg-slate-200/80 dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.06]'}`
            : `w-full gap-3 px-4 py-3 rounded-2xl text-sm font-bold bg-slate-50 dark:bg-slate-900 border ${isError ? 'border-red-500 ring-2 ring-red-500/20' : (isOpen ? 'border-primary ring-2 ring-primary/20 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800')}`
        }`}
      >
        <Icon size={variant === 'filter' ? 13 : 16} className={`${isOpen || (variant === 'filter' && value !== options[0]?.value) ? 'text-primary' : 'text-slate-400 group-hover:text-primary'} shrink-0 transition-colors`} />
        <span className={`${variant === 'filter' ? 'hidden sm:block truncate sm:max-w-[100px]' : 'flex-1'} text-left`}>{selectedOption?.label}</span>
        <ChevronDown size={variant === 'filter' ? 11 : 14} className={`${variant === 'filter' ? 'hidden sm:block' : ''} text-slate-400 opacity-60 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-max min-w-[150px] max-w-[240px] max-h-[300px] overflow-y-auto bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 p-1.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${value === opt.value ? 'bg-primary text-white shadow-sm' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              <span className="truncate pr-3">{opt.label}</span>
              {value === opt.value && <Check size={13} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Expenses: React.FC<Props> = ({ trip, currentUser, onUpdate, isGuest = false }) => {
  const { t } = useTranslation();
  
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

  const getCatName = (cat: string) => getCategoryName(cat, t);

  const members = useMemo(() => {
    const userMap = new Map<string, string>();
    (trip.expenses || []).forEach(e => { if(e.user_id && e.user_name) userMap.set(e.user_id, e.user_name); });
    (trip.flights || []).forEach(f => { if(f.user_id && f.traveler_name) userMap.set(f.user_id, f.traveler_name); });
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

  const rates: Record<Currency, number> = { 
    [Currency.TWD]: 1, 
    [Currency.USD]: 31.5, 
    [Currency.JPY]: 0.21, 
    [Currency.EUR]: 34.2, 
    [Currency.KRW]: 0.024 
  };

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

  const resetForm = () => { 
    setAmount(''); 
    setNote(''); 
    setEditingExpenseId(null); 
    setIsFormOpen(false); 
    setErrors({}); 
  };

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
    const exp = trip.expenses.find(e => e.id === id);
    if (exp?.user_id !== currentUser?.id && trip.user_id !== currentUser?.id) {
        return;
    }
    onUpdate({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) }, "DELETE_EXPENSE", id);
  };

  const flightsTotal = (trip.flights || []).reduce((sum, f) => sum + (f.price * (rates[f.currency] || 1)), 0);
  const expensesOnlyTotal = trip.expenses.reduce((sum, e) => sum + (e.amount * (e.exchangeRate || 1)), 0);
  const totalTWD = flightsTotal + expensesOnlyTotal;

  const flightExpenses: Expense[] = useMemo(() => {
    return (trip.flights || []).map(f => ({
      id: `flight-${f.id}`,
      user_id: f.user_id,
      user_name: f.traveler_name,
      amount: f.price,
      currency: f.currency,
      category: 'Flight',
      date: trip.startDate,
      createdAt: new Date().toISOString(),
      note: f.inbound?.flightNumber 
        ? `${t('flight')}: ${f.outbound.flightNumber} ⇄ ${f.inbound.flightNumber}` 
        : `${t('flight')}: ${f.outbound.flightNumber}`,
      exchangeRate: rates[f.currency] || 1,
      isFlight: true
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
      const val = e.amount * (e.exchangeRate || 1);
      dataMap[e.category] = (dataMap[e.category] || 0) + val;
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

  const inputClass = (isError: boolean) => 
    `bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 rounded-2xl border transition-all outline-none ${
      isError 
        ? 'border-red-500 ring-2 ring-red-500/20' 
        : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20'
    }`;

  const manualCategories = Object.keys(CATEGORY_UI).filter(c => c !== 'Flight');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Left Column: Apple Wallet Hero Card & Category Breakdown */}
      <div className="space-y-6 lg:col-span-1">
        {/* Apple Wallet Frosted Titanium / Gradient Card */}
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-7 sm:p-8 shadow-2xl border border-white/10 group">
          {/* Card Specular Reflection / Glow Effect */}
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-0 bottom-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[170px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white/70 uppercase tracking-widest">
                <CreditCard size={16} className="text-primary" />
                <span>{t('totalCost')}</span>
              </div>
              <div className="w-8 h-6 rounded-md border border-white/20 bg-white/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              </div>
            </div>

            <div className="my-4">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
                NT$ {totalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-white/60 mt-1 flex items-center gap-1.5 font-medium">
                <Plane size={13} className="text-primary" />
                <span>{t('includesFlight')} (NT$ {Math.round(flightsTotal).toLocaleString()})</span>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/70 font-medium">
              <span>當地累積消費</span>
              <span className="font-bold text-white font-mono">NT$ {Math.round(expensesOnlyTotal).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown (Apple Health / Wallet Activity style) */}
        <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl p-7 rounded-[36px] shadow-ios border border-black/[0.04] dark:border-white/[0.06]">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <span>{t('breakdown')}</span>
          </h3>

          <div className="space-y-4">
            {chartData.length > 0 ? (
              [...chartData].sort((a,b) => b.value - a.value).map((entry, index) => {
                const percent = totalTWD > 0 ? (entry.value / totalTWD) * 100 : 0;
                const ui = CATEGORY_UI[entry.category] || CATEGORY_UI.Other;
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ui.hexColor }} />
                        <span>{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                          NT$ {Math.round(entry.value).toLocaleString()}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {Math.round(percent)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out" 
                        style={{ width: `${percent}%`, backgroundColor: ui.hexColor }} 
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                {t('noExpenses')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Inset Grouped Expense List & Form */}
      <div className="lg:col-span-2 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl rounded-[36px] shadow-ios border border-black/[0.04] dark:border-white/[0.06] overflow-hidden flex flex-col min-h-[600px]">
        {/* Add Entry Accordion Button / Form */}
        <div className="bg-slate-50/70 dark:bg-white/[0.03] border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className={`${isFormOpen ? 'hidden' : 'block'}`}>
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="w-full py-5 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-all font-black text-xs uppercase tracking-widest cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={14} strokeWidth={3} />
              </div>
              <span>{t('addEntry')}</span>
            </button>
          </div>

          {isFormOpen && (
            <div className="p-6 sm:p-7 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingExpenseId ? "編輯記帳" : t('addEntry')}
                </h3>
                <button 
                  onClick={resetForm}
                  className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400"
                >
                  <Trash2 size={14} className="hidden" />
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative">
                  <span className="absolute left-4 inset-y-0 flex items-center text-xs font-mono font-bold text-slate-400 pointer-events-none">
                    {currency}
                  </span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => { setAmount(e.target.value); setErrors({...errors, amount: false}); }} 
                    className={`w-full pl-14 pr-4 py-3 font-mono font-bold text-sm shadow-sm ${inputClass(errors.amount)}`} 
                    placeholder="0" 
                  />
                </div>
                <CustomFilterSelect 
                  variant="form"
                  icon={DollarSign}
                  value={currency} 
                  onChange={(val: any) => setCurrency(val as Currency)} 
                  options={Object.values(Currency).map(c => ({ value: c, label: c }))} 
                />
                <CustomFilterSelect 
                  variant="form"
                  icon={Tag}
                  value={category} 
                  onChange={(val: any) => setCategory(val)} 
                  options={manualCategories.map(c => ({ value: c, label: getCatName(c) }))} 
                />
                <CustomFilterSelect 
                  variant="form"
                  icon={Calendar}
                  value={selectedDate} 
                  onChange={(val: any) => setSelectedDate(val)} 
                  options={dateOptions.map(d => ({ value: d, label: d }))} 
                />
              </div>

              <div className="relative">
                <input 
                  value={note} 
                  onChange={e => { setNote(e.target.value); setErrors({...errors, note: false}); }} 
                  className={`w-full px-5 py-3 font-medium text-sm shadow-sm ${inputClass(errors.note)}`} 
                  placeholder={t('descRequired') + "..."} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={saveExpense} 
                  className="flex-1 bg-primary text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/25 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                >
                  {t('save')}
                </button>
                <button 
                  onClick={resetForm} 
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="border-b border-black/[0.04] dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            共 {processedExpenses.length} 筆消費
          </span>
          <div className="flex flex-wrap items-center gap-2">
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
              onChange={(val) => setSortOrder(val)} 
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

        {/* Inset Grouped Transaction List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
          {processedExpenses.map((item: any) => {
            const config = CATEGORY_UI[item.category] || CATEGORY_UI.Other;
            const Icon = config.icon;
            const isFlightItem = !!item.isFlight;

            return (
              <div 
                key={item.id} 
                className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#2C2C2E]/60 border border-black/[0.04] dark:border-white/[0.06] hover:border-primary/30 shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} ${config.darkBgColor} ${config.textColor} flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {item.note}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <UserIcon size={10} /> {item.user_name}
                      </span>
                      <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {item.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 pl-3">
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm sm:text-base text-slate-800 dark:text-white">
                      {item.currency} {item.amount.toLocaleString()}
                    </div>
                    {item.currency !== Currency.TWD && (
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        ≈ NT$ {Math.round(item.amount * item.exchangeRate).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {!isFlightItem && (item.user_id === currentUser?.id || trip.user_id === currentUser?.id) ? (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(item)} 
                        className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-colors cursor-pointer"
                        aria-label="Edit expense"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => deleteExpense(item.id)} 
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        aria-label="Delete expense"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-1.5 text-slate-300 dark:text-slate-600">
                      <Lock size={14} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {processedExpenses.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-xs font-medium">
              {t('noExpenses')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};