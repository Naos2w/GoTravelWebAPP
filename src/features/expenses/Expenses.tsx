import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trip, Expense, Currency, User } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, DollarSign, TrendingUp, Plane, Trash2, 
  Coffee, Home, Car, 
  Ticket, ShoppingBag, Tag, Edit2, Lock, User as UserIcon, Calendar, ArrowUpDown, Clock, Check, ChevronDown,
  CreditCard, Wallet, Sparkles, X, Users, ArrowRight, Scale
} from 'lucide-react';
import { useTranslation } from "../../shared/contexts/LocalizationContext";
import { DateTimeUtils } from '../../shared/services/dateTimeUtils';
import { supabase } from '../../shared/services/storageService';
import { CATEGORY_UI, getCategoryName } from './ExpenseCategories';
import { calculateSplitwiseSettlement, SplitMember } from './services/splitwiseService';
import {
  getCachedRatesToTwd,
  fetchLiveRatesToTwd,
  getRateToTwd,
  resolveHistoricalFlightRate,
  formatWithCurrencySymbol,
  getTripLockedRates,
  lockTripRate,
  convertFromTwd,
} from './services/exchangeRateService';

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
  variant?: "filter" | "form" | "pill";
  isError?: boolean;
  testId?: string;
  ariaLabel?: string;
}

const CustomFilterSelect = <T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  wrapperClass = "",
  variant = "filter",
  isError = false,
  testId,
  ariaLabel,
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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId}
        aria-label={ariaLabel}
        className={`flex items-center transition-all cursor-pointer group outline-none ${
          variant === 'filter' 
            ? `gap-1.5 py-1.5 px-3 rounded-xl shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200 ${isOpen ? 'bg-slate-200 dark:bg-white/[0.15] shadow-inner' : 'bg-slate-100/80 dark:bg-white/[0.06] hover:bg-slate-200/80 dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.06]'}`
            : variant === 'pill'
            ? `gap-1.5 py-1.5 px-3 rounded-xl shrink-0 text-xs font-mono font-bold text-slate-800 dark:text-white ${isOpen ? 'bg-white dark:bg-white/[0.18] ring-2 ring-primary/30 shadow-sm' : 'bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] border border-black/[0.08] dark:border-white/[0.14] shadow-sm'}`
            : `w-full gap-3 px-4 py-3 rounded-2xl text-sm font-bold bg-slate-50 dark:bg-white/[0.05] border ${isError ? 'border-red-500 ring-2 ring-red-500/20' : (isOpen ? 'border-primary ring-2 ring-primary/20 bg-white dark:bg-white/[0.1]' : 'border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08]')}`
        }`}
      >
        <Icon size={variant === 'filter' || variant === 'pill' ? 13 : 16} className={`${isOpen || ((variant === 'filter' || variant === 'pill') && value !== options[0]?.value) ? 'text-primary' : 'text-slate-400 group-hover:text-primary'} shrink-0 transition-colors`} />
        <span className={`${variant === 'filter' ? 'hidden sm:block truncate sm:max-w-[100px]' : variant === 'pill' ? 'truncate' : 'flex-1'} text-left`}>{selectedOption?.label}</span>
        <ChevronDown size={variant === 'filter' || variant === 'pill' ? 11 : 14} className={`${variant === 'filter' ? 'hidden sm:block' : ''} text-slate-400 opacity-60 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-max min-w-[150px] max-w-[240px] max-h-[300px] overflow-y-auto bg-white/95 dark:bg-[#161822]/95 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 p-1.5">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${value === opt.value ? 'bg-primary text-white shadow-sm' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08]'}`}
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

  const lastCurrencyKey = `go-travel-last-currency-${trip.id}`;
  const getRememberedFormCurrency = (): Currency => {
    try {
      const saved = localStorage.getItem(lastCurrencyKey);
      if (saved && (Object.values(Currency) as string[]).includes(saved)) {
        return saved as Currency;
      }
    } catch {}
    return Currency.TWD;
  };
  
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [currency, setCurrency] = useState<Currency>(() => getRememberedFormCurrency());
  const [selectedDate, setSelectedDate] = useState(trip.startDate);
  const [note, setNote] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('All');
  const [filterUser, setFilterUser] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortType>('date-desc');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [paidBy, setPaidBy] = useState<string>(currentUser?.id || '');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [newBuddyName, setNewBuddyName] = useState('');

  const storageKey = `go-travel-split-members-${trip.id}`;
  const [customBuddies, setCustomBuddies] = useState<SplitMember[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCustomBuddies(saved ? JSON.parse(saved) : []);
    } catch {
      setCustomBuddies([]);
    }
  }, [storageKey]);

  const persistCustomBuddies = (next: SplitMember[]) => {
    setCustomBuddies(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const getCatName = (cat: string) => getCategoryName(cat, t);

  const members = useMemo<SplitMember[]>(() => {
    const userMap = new Map<string, string>();
    (trip.collaborators || []).forEach((c) => {
      if (c.user_id) userMap.set(c.user_id, (c.email || c.user_id).split('@')[0]);
    });
    if (currentUser?.id) {
      userMap.set(currentUser.id, currentUser.name || currentUser.email?.split('@')[0] || currentUser.id);
    }
    (trip.flights || []).forEach((f) => {
      if (f.user_id && f.traveler_name) userMap.set(f.user_id, f.traveler_name);
    });
    (trip.expenses || []).forEach((e) => {
      if (e.user_id && e.user_name) userMap.set(e.user_id, e.user_name);
      if (e.paidBy && e.paidByName) userMap.set(e.paidBy, e.paidByName);
    });
    customBuddies.forEach((b) => {
      if (b.id && b.name && !userMap.has(b.id)) userMap.set(b.id, b.name);
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [trip.collaborators, trip.expenses, trip.flights, currentUser, customBuddies]);

  const addCustomBuddy = () => {
    const trimmed = newBuddyName.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewBuddyName('');
      return;
    }
    const buddy: SplitMember = {
      id: `buddy-${trimmed.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`,
      name: trimmed,
    };
    persistCustomBuddies([...customBuddies, buddy]);
    if (isFormOpen) {
      setSplitWith((prev) => Array.from(new Set([...(prev.length ? prev : members.map((m) => m.id)), buddy.id])));
    }
    setNewBuddyName('');
  };

  const toggleSplitMember = (memberId: string) => {
    setSplitWith((prev) => {
      const current = prev.length > 0 ? prev : members.map((m) => m.id);
      if (current.includes(memberId)) {
        if (current.length <= 1) return current;
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  };

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

  const displayCurrencyKey = `go-travel-display-currency-${trip.id}`;
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem(displayCurrencyKey);
      return saved && (Object.values(Currency) as string[]).includes(saved)
        ? (saved as Currency)
        : Currency.TWD;
    } catch {
      return Currency.TWD;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(displayCurrencyKey);
      if (saved && (Object.values(Currency) as string[]).includes(saved)) {
        setDisplayCurrency(saved as Currency);
      } else {
        setDisplayCurrency(Currency.TWD);
      }
    } catch {
      setDisplayCurrency(Currency.TWD);
    }
  }, [displayCurrencyKey]);

  useEffect(() => {
    setCurrency(getRememberedFormCurrency());
  }, [lastCurrencyKey]);

  const [liveRates, setLiveRates] = useState<Record<Currency, number>>(() => getCachedRatesToTwd());

  useEffect(() => {
    let active = true;
    fetchLiveRatesToTwd().then((rates) => {
      if (!active) return;
      setLiveRates((prev) => {
        const changed = (Object.keys(rates) as Currency[]).some(
          (k) => prev[k] !== rates[k]
        );
        return changed ? rates : prev;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const tripRates = useMemo(
    () => getTripLockedRates(trip.id, trip.expenses || [], trip.flights || [], liveRates),
    [trip.id, trip.expenses, trip.flights, liveRates]
  );

  const handleDisplayCurrencyChange = (nextCurrency: Currency) => {
    setDisplayCurrency(nextCurrency);
    try {
      localStorage.setItem(displayCurrencyKey, nextCurrency);
    } catch {}
    if (nextCurrency !== Currency.TWD) {
      lockTripRate(trip.id, nextCurrency, tripRates[nextCurrency] || getRateToTwd(nextCurrency, liveRates));
    }
  };

  const editingExpense = useMemo(
    () => (editingExpenseId ? trip.expenses.find((e) => e.id === editingExpenseId) : undefined),
    [editingExpenseId, trip.expenses]
  );

  const activeRateForForm = useMemo(() => {
    if (currency === Currency.TWD) return 1;
    if (
      editingExpense &&
      editingExpense.currency === currency &&
      typeof editingExpense.exchangeRate === 'number' &&
      editingExpense.exchangeRate > 0
    ) {
      return editingExpense.exchangeRate;
    }
    return tripRates[currency] || getRateToTwd(currency, liveRates);
  }, [currency, editingExpense, tripRates, liveRates]);

  const parsedFormAmount = parseFloat(amount) || 0;

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
    const activePaidBy = paidBy || currentUser.id;
    const paidByMember = members.find((m) => m.id === activePaidBy);
    const activeSplitWith = splitWith.length > 0 ? splitWith : members.map((m) => m.id);
    const lockedRate = activeRateForForm;
    if (currency !== Currency.TWD) {
      lockTripRate(trip.id, currency, lockedRate);
    }
    if (!editingExpenseId) {
      try {
        localStorage.setItem(lastCurrencyKey, currency);
      } catch {}
    }

    if (editingExpenseId) {
      const exp = trip.expenses.find(e => e.id === editingExpenseId);
      if (exp?.user_id !== currentUser.id && trip.user_id !== currentUser.id) return;
      
      const updatedExpenses = trip.expenses.map(exp =>
        exp.id === editingExpenseId
          ? {
              ...exp,
              amount: val,
              currency,
              category,
              date: selectedDate,
              note,
              exchangeRate: lockedRate,
              paidBy: activePaidBy,
              paidByName: paidByMember?.name || currentUser.name,
              splitWith: activeSplitWith,
            }
          : exp
      );
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
        exchangeRate: lockedRate,
        paidBy: activePaidBy,
        paidByName: paidByMember?.name || currentUser.name,
        splitWith: activeSplitWith,
      };
      onUpdate({ ...trip, expenses: [newExpense, ...trip.expenses] });
    }
    resetForm();
  };

  const resetForm = () => { 
    setAmount(''); 
    setNote(''); 
    setCurrency(getRememberedFormCurrency());
    setPaidBy(currentUser?.id || '');
    setSplitWith(members.map((m) => m.id));
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
    setPaidBy(expense.paidBy || expense.user_id || currentUser?.id || '');
    setSplitWith(
      expense.splitWith && expense.splitWith.length > 0
        ? expense.splitWith
        : members.map((m) => m.id)
    );
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

  const flightsTotal = (trip.flights || []).reduce(
    (sum, f) => sum + f.price * resolveHistoricalFlightRate(f, tripRates),
    0
  );
  const expensesOnlyTotal = trip.expenses.reduce(
    (sum, e) =>
      sum + e.amount * (e.exchangeRate && e.exchangeRate > 0 ? e.exchangeRate : getRateToTwd(e.currency, tripRates)),
    0
  );
  const totalTWD = flightsTotal + expensesOnlyTotal;
  const displayTotal = convertFromTwd(totalTWD, displayCurrency, tripRates);
  const displayFlightsTotal = convertFromTwd(flightsTotal, displayCurrency, tripRates);
  const displayExpensesOnlyTotal = convertFromTwd(expensesOnlyTotal, displayCurrency, tripRates);

  const foreignCurrenciesInTrip = useMemo(() => {
    const set = new Set<Currency>();
    (trip.expenses || []).forEach((e) => {
      if (e.currency && e.currency !== Currency.TWD) set.add(e.currency);
    });
    (trip.flights || []).forEach((f) => {
      if (f.currency && f.currency !== Currency.TWD) set.add(f.currency);
    });
    return Array.from(set);
  }, [trip.expenses, trip.flights]);

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
      exchangeRate: resolveHistoricalFlightRate(f, tripRates),
      isFlight: true
    } as any));
  }, [trip.flights, trip.startDate, t, tripRates]);

  const processedExpenses = useMemo(() => {
    let list = [...trip.expenses, ...flightExpenses];
    if (filterCategory !== 'All') list = list.filter(e => e.category === filterCategory);
    if (filterUser !== 'All') list = list.filter(e => (e.paidBy || e.user_id) === filterUser);
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
      const rate = e.exchangeRate && e.exchangeRate > 0 ? e.exchangeRate : getRateToTwd(e.currency, tripRates);
      const val = e.amount * rate;
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

  const splitSettlement = useMemo(() => {
    return calculateSplitwiseSettlement(trip.expenses || [], members);
  }, [trip.expenses, members]);

  const inputClass = (isError: boolean) => 
    `bg-slate-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.08] text-slate-900 dark:text-white rounded-2xl border transition-all outline-none ${
      isError 
        ? 'border-red-500 ring-2 ring-red-500/20' 
        : 'border-slate-200/80 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/20'
    }`;

  const manualCategories = Object.keys(CATEGORY_UI).filter(c => c !== 'Flight');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Left Column: Apple Wallet Hero Card & Category Breakdown */}
      <div className="space-y-6 lg:col-span-1">
        {/* Apple Wallet iOS 27 Liquid Glass Card */}
        <div className="relative overflow-hidden rounded-[28px] ios27-card p-7 sm:p-8 shadow-xl border border-black/[0.06] dark:border-white/[0.14] group aviation-grid-bg">
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[170px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-white/70 uppercase tracking-[0.14em]">
                <CreditCard size={15} className="text-primary" />
                <span>{t('totalCost')}</span>
              </div>
              <CustomFilterSelect
                variant="pill"
                testId="display-currency-select"
                ariaLabel="Display currency"
                icon={DollarSign}
                value={displayCurrency}
                onChange={(val: any) => handleDisplayCurrencyChange(val as Currency)}
                options={Object.values(Currency).map((c) => ({ value: c, label: c }))}
              />
            </div>

            <div className="my-4">
              <div
                data-testid="hero-total-amount"
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums"
              >
                {formatWithCurrencySymbol(displayTotal, displayCurrency)}
              </div>
              {displayCurrency !== Currency.TWD && (
                <div className="text-[11px] font-mono font-semibold text-primary/90 dark:text-blue-400 mt-1 tabular-nums">
                  ≈ NT$ {Math.round(totalTWD).toLocaleString()} • 1 {displayCurrency} = NT$ {(tripRates[displayCurrency] || 1).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
              )}
              {displayCurrency === Currency.TWD && foreignCurrenciesInTrip.length > 0 && (
                <div
                  data-testid="trip-locked-rates-summary"
                  className="text-[11px] font-mono font-semibold text-primary/90 dark:text-blue-400 mt-1 tabular-nums flex flex-wrap gap-x-2.5 gap-y-0.5"
                >
                  {foreignCurrenciesInTrip.map((cur) => (
                    <span key={cur}>
                      1 {cur} = NT$ {(tripRates[cur] || 1).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-500 dark:text-white/60 mt-1.5 flex items-center gap-1.5 font-medium font-mono tabular-nums">
                <Plane size={13} className="text-primary" />
                <span>{t('includesFlight')} ({formatWithCurrencySymbol(displayFlightsTotal, displayCurrency)})</span>
              </div>
            </div>

            <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-white/70 font-medium">
              <span>{t('localSpending')}</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {formatWithCurrencySymbol(displayExpensesOnlyTotal, displayCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Category Breakdown (Apple Health / Wallet Activity style) */}
        <div className="ios27-card p-7 rounded-[28px] shadow-ios">
          <h3 className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-[0.14em] mb-5 flex items-center gap-2">
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
                        <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatWithCurrencySymbol(
                            convertFromTwd(entry.value, displayCurrency, tripRates),
                            displayCurrency
                          )}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 tabular-nums">
                          {Math.round(percent)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden w-full">
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
        {/* Splitwise Smart AA Settlement Card */}
        <div className="ios27-card p-7 rounded-[28px] shadow-ios" data-testid="splitwise-settlement-card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-[0.14em] flex items-center gap-2">
              <Scale size={14} className="text-primary" />
              <span>{t('splitSettlementTitle')}</span>
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
              {members.length}
            </span>
          </div>

          {/* Add offline travel buddy input */}
          {!isGuest && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newBuddyName}
                onChange={(e) => setNewBuddyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomBuddy()}
                placeholder={t('addSplitMemberPlaceholder')}
                className="flex-1 min-w-0 px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={addCustomBuddy}
                disabled={!newBuddyName.trim()}
                className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shrink-0"
              >
                {t('addMemberBtn')}
              </button>
            </div>
          )}

          {/* Member net balances */}
          {splitSettlement.balances.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {splitSettlement.balances.map((b) => (
                <div
                  key={b.id}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.08] text-[11px] flex items-center gap-1.5"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-200">{b.name}</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      b.net > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : b.net < 0
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {b.net > 0 ? `+${b.net.toLocaleString()}` : b.net.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Minimum-transfer settlement instructions */}
          {splitSettlement.transfers.length > 0 ? (
            <div className="space-y-2">
              {splitSettlement.transfers.map((tr, idx) => (
                <div
                  key={`${tr.fromId}-${tr.toId}-${idx}`}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.08] text-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 min-w-0 truncate">
                    <span className="truncate">{tr.fromName}</span>
                    <ArrowRight size={13} className="text-primary shrink-0" />
                    <span className="truncate">{tr.toName}</span>
                  </div>
                  <span className="font-mono font-extrabold text-primary tabular-nums shrink-0 pl-2">
                    {formatWithCurrencySymbol(
                      convertFromTwd(tr.amount, displayCurrency, tripRates),
                      displayCurrency
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-400 font-medium">
              {t('allSettled')}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Inset Grouped Expense List & Form */}
      <div className="lg:col-span-2 ios27-card rounded-[28px] shadow-ios overflow-hidden flex flex-col min-h-[600px]">
        {/* Add Entry Accordion Button / Form */}
        <div className="bg-slate-50/70 dark:bg-white/[0.03] border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className={`${isFormOpen ? 'hidden' : 'block'}`}>
            <button 
              onClick={() => {
                setEditingExpenseId(null);
                setCurrency(getRememberedFormCurrency());
                setPaidBy(currentUser?.id || members[0]?.id || '');
                setSplitWith(members.map((m) => m.id));
                setIsFormOpen(true);
              }} 
              className="w-full py-5 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-all font-bold text-xs uppercase tracking-widest cursor-pointer group"
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
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingExpenseId ? t('edit') : t('addEntry')}
                </h3>
                <button 
                  onClick={resetForm}
                  aria-label="Close form"
                  className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={16} />
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
                  onChange={(val: any) => {
                    const nextCur = val as Currency;
                    setCurrency(nextCur);
                    if (!editingExpenseId) {
                      try {
                        localStorage.setItem(lastCurrencyKey, nextCur);
                      } catch {}
                    }
                  }} 
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

              {(currency !== Currency.TWD || displayCurrency !== Currency.TWD) && (
                <div
                  data-testid="exchange-rate-preview"
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-primary/[0.06] dark:bg-primary/[0.12] border border-primary/15 text-xs"
                >
                  {currency !== Currency.TWD ? (
                    <>
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        1 {currency} ≈ NT$ {activeRateForForm.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {parsedFormAmount > 0 && (
                          <span className="font-mono font-bold text-primary tabular-nums">
                            ≈ NT$ {Math.round(parsedFormAmount * activeRateForForm).toLocaleString()}
                            {displayCurrency !== Currency.TWD && displayCurrency !== currency && (
                              <> • {formatWithCurrencySymbol(convertFromTwd(parsedFormAmount * activeRateForForm, displayCurrency, tripRates), displayCurrency)}</>
                            )}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          ({t('rateLockedHint')})
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        1 {displayCurrency} ≈ NT$ {(tripRates[displayCurrency] || 1).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                      {parsedFormAmount > 0 && (
                        <span className="font-mono font-bold text-primary tabular-nums">
                          ≈ {formatWithCurrencySymbol(convertFromTwd(parsedFormAmount, displayCurrency, tripRates), displayCurrency)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {members.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      {t('paidByLabel')}
                    </label>
                    <CustomFilterSelect
                      variant="form"
                      icon={Wallet}
                      value={paidBy || currentUser?.id || members[0]?.id || ''}
                      onChange={(val) => setPaidBy(val)}
                      options={members.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      {t('splitWithLabel')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const currentSelected = splitWith.length > 0 ? splitWith : members.map((mb) => mb.id);
                        const active = currentSelected.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleSplitMember(m.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              active
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-white/10'
                            }`}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={saveExpense} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-sm hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                >
                  {t('save')}
                </button>
                <button 
                  onClick={resetForm} 
                  className="px-6 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="border-b border-black/[0.04] dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {processedExpenses.length} {t('expenseCountLabel')}
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
                className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] hover:border-primary/30 dark:hover:border-white/20 shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} ${config.darkBgColor} ${config.textColor} flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {item.note}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <UserIcon size={10} /> {item.paidByName || item.user_name}
                      </span>
                      {Array.isArray(item.splitWith) && item.splitWith.length > 0 && (
                        <>
                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                          <span className="text-[10px] font-bold text-primary/80 dark:text-blue-400 flex items-center gap-0.5">
                            <Users size={10} /> AA/{item.splitWith.length}
                          </span>
                        </>
                      )}
                      <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {item.date}
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const itemRate =
                    item.exchangeRate && item.exchangeRate > 0
                      ? item.exchangeRate
                      : getRateToTwd(item.currency, tripRates);
                  const itemTwdValue = item.amount * itemRate;
                  const convertedValue = convertFromTwd(itemTwdValue, displayCurrency, tripRates);
                  const showSecondary =
                    item.currency !== displayCurrency || item.currency !== Currency.TWD;

                  return (
                    <div className="flex items-center gap-4 shrink-0 pl-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm sm:text-base text-slate-800 dark:text-white tabular-nums">
                          {item.currency} {item.amount.toLocaleString()}
                        </div>
                        {showSecondary && (
                          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                            {item.currency !== displayCurrency ? (
                              <>
                                ≈ {formatWithCurrencySymbol(convertedValue, displayCurrency)}
                                {item.currency !== Currency.TWD && ` (@ ${itemRate})`}
                              </>
                            ) : (
                              <>
                                ≈ NT$ {Math.round(itemTwdValue).toLocaleString()} (@ {itemRate})
                              </>
                            )}
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
                  );
                })()}
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