
import React, { useState, useMemo, useEffect } from 'react';
import { Trip, Expense, Currency } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, DollarSign, TrendingUp, Plane, Trash2, 
  Filter, ArrowUpDown, Coffee, Home, Car, 
  Ticket, ShoppingBag, MoreHorizontal, Clock
} from 'lucide-react';
import { useTranslation } from '../App';
import { DateTimeUtils } from '../services/dateTimeUtils';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: any, color: string, bgColor: string, darkBgColor: string, textColor: string }> = {
  Food: { icon: Coffee, color: 'bg-orange-500', bgColor: 'bg-orange-50', darkBgColor: 'dark:bg-orange-900/10', textColor: 'text-orange-600' },
  Accommodation: { icon: Home, color: 'bg-indigo-500', bgColor: 'bg-indigo-50', darkBgColor: 'dark:bg-indigo-900/10', textColor: 'text-indigo-600' },
  Transport: { icon: Car, color: 'bg-slate-500', bgColor: 'bg-slate-50', darkBgColor: 'dark:bg-slate-900/10', textColor: 'text-slate-600' },
  Tickets: { icon: Ticket, color: 'bg-emerald-500', bgColor: 'bg-emerald-50', darkBgColor: 'dark:bg-emerald-900/10', textColor: 'text-emerald-600' },
  Shopping: { icon: ShoppingBag, color: 'bg-pink-500', bgColor: 'bg-pink-50', darkBgColor: 'dark:bg-pink-900/10', textColor: 'text-pink-600' },
  Other: { icon: MoreHorizontal, color: 'bg-slate-400', bgColor: 'bg-slate-100', darkBgColor: 'dark:bg-slate-800/50', textColor: 'text-slate-500' }
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

type SortType = 'created-desc' | 'created-asc' | 'amount-desc' | 'amount-asc';

export const Expenses: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [currency, setCurrency] = useState<Currency>(Currency.TWD);
  const [selectedDate, setSelectedDate] = useState(trip.startDate);
  const [note, setNote] = useState('');
  
  // 篩選與排序狀態
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortType>('created-desc');

  // 自動生成旅程日期選項
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

  useEffect(() => {
    if (dateOptions.length > 0 && !dateOptions.includes(selectedDate)) {
      setSelectedDate(dateOptions[0]);
    }
  }, [dateOptions, selectedDate]);

  const labels = {
    totalCost: language === 'zh' ? '旅程總花費' : 'Total Trip Cost',
    includesFlight: language === 'zh' ? '包含機票花費' : 'Includes flight tickets',
    breakdown: language === 'zh' ? '項目佔比' : 'Category Breakdown',
    addEntry: language === 'zh' ? '新增支出' : 'Add Expense',
    desc: language === 'zh' ? '項目描述 (必填)' : 'Description (required)',
    addBtn: language === 'zh' ? '確認新增' : 'Add Entry',
    flightTicket: language === 'zh' ? '機票' : 'Flight Ticket',
    flightSub: language === 'zh' ? '機票預訂費用' : 'Flight booking cost',
    noExpenses: language === 'zh' ? '尚無支出記錄' : 'No transactions recorded.',
    filterAll: language === 'zh' ? '全部' : 'All',
    sortBy: language === 'zh' ? '排序方式' : 'Sort By',
    createdDesc: language === 'zh' ? '新增時間：新 → 舊' : 'Added: Newest',
    createdAsc: language === 'zh' ? '新增時間：舊 → 新' : 'Added: Oldest',
    amountHigh: language === 'zh' ? '金額：高 → 低' : 'Amount: High',
    amountLow: language === 'zh' ? '金額：低 → 高' : 'Amount: Low',
    Accommodation: language === 'zh' ? '住宿' : 'Accommodation',
    Transport: language === 'zh' ? '交通' : 'Transport',
    Food: language === 'zh' ? '餐飲' : 'Food',
    Tickets: language === 'zh' ? '票券' : 'Tickets',
    Shopping: language === 'zh' ? '購物' : 'Shopping',
    Other: language === 'zh' ? '其他' : 'Other',
    expDate: language === 'zh' ? '支出日期' : 'Exp. Date',
    addedAt: language === 'zh' ? '新增於' : 'Added at',
    descRequired: language === 'zh' ? '請填寫項目描述。' : 'Please enter a description.'
  };

  const rates: Record<Currency, number> = {
    [Currency.TWD]: 1, [Currency.USD]: 31.5, [Currency.JPY]: 0.21, [Currency.EUR]: 34.2, [Currency.KRW]: 0.024
  };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatFullDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const addExpense = () => {
    if (!amount) return;
    if (!note.trim()) {
      alert(labels.descRequired);
      return;
    }
    const val = parseFloat(amount);
    const now = new Date();
    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: val,
      currency,
      category,
      date: selectedDate,
      createdAt: now.toISOString(),
      note,
      exchangeRate: rates[currency]
    };
    onUpdate({ ...trip, expenses: [newExpense, ...trip.expenses] });
    setAmount('');
    setNote('');
  };

  const deleteExpense = (id: string) => {
    onUpdate({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) });
  };

  const expensesTotal = trip.expenses.reduce((sum, item) => sum + (item.amount * (item.exchangeRate || 1)), 0);
  const flightPriceTWD = (trip.flight?.price && trip.flight.price > 0) ? (trip.flight.price * (rates[trip.flight.currency] || 1)) : 0;
  const totalTWD = expensesTotal + flightPriceTWD;

  const processedExpenses = useMemo(() => {
    let list = [...trip.expenses];
    if (filterCategory !== 'All') {
      list = list.filter(e => e.category === filterCategory);
    }
    list.sort((a, b) => {
      switch (sortOrder) {
        case 'created-asc': return new Date(a.createdAt || a.id).getTime() - new Date(b.createdAt || b.id).getTime();
        case 'amount-desc': return (b.amount * (b.exchangeRate || 1)) - (a.amount * (a.exchangeRate || 1));
        case 'amount-asc': return (a.amount * (a.exchangeRate || 1)) - (b.amount * (b.exchangeRate || 1));
        default: return new Date(b.createdAt || b.id).getTime() - new Date(a.createdAt || a.id).getTime();
      }
    });
    return list;
  }, [trip.expenses, filterCategory, sortOrder]);

  const dataMap = trip.expenses.reduce((acc, curr) => {
    const twdVal = curr.amount * (curr.exchangeRate || 1);
    acc[curr.category] = (acc[curr.category] || 0) + twdVal;
    return acc;
  }, {} as Record<string, number>);
  if (flightPriceTWD > 0) dataMap['Transport'] = (dataMap['Transport'] || 0) + flightPriceTWD;
  const chartData = Object.entries(dataMap).map(([name, value]) => ({ name: (labels as any)[name] || name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="space-y-6 lg:col-span-1">
        <div className="bg-slate-900 dark:bg-slate-800 text-white p-8 rounded-[32px] shadow-ios relative overflow-hidden transition-all duration-300">
           <div className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left">
             <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{labels.totalCost}</div>
             <div className="text-4xl font-black tracking-tighter">NT$ {totalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
             {flightPriceTWD > 0 && (
               <div className="text-[10px] text-slate-400 mt-4 flex items-center gap-1 font-bold">
                 <Plane size={12} /> {labels.includesFlight} NT$ {Math.round(flightPriceTWD).toLocaleString()}
               </div>
             )}
           </div>
           <TrendingUp className="absolute right-[-10%] bottom-[-10%] text-white/5 w-40 h-40" />
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-ios border border-gray-100 dark:border-slate-700 h-[320px] transition-all">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center lg:text-left">{labels.breakdown}</h3>
          <div className="h-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                    {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `NT$ ${Math.round(value).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase text-xs tracking-widest">{labels.noExpenses}</div>}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[40px] shadow-ios border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col h-[750px] transition-all">
        <div className="p-6 sm:p-10 bg-slate-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
           <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 text-center lg:text-left">{labels.addEntry}</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             <div className="relative lg:col-span-1">
                <span className="absolute left-4 top-1.5 text-slate-400 text-[8px] font-black uppercase tracking-widest">{currency}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full pl-10 pr-4 py-3 mt-1 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent focus:border-primary/20 outline-none font-black text-sm shadow-sm transition-all" />
             </div>
             <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="py-3 px-4 mt-1 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent outline-none font-black text-sm shadow-sm transition-all cursor-pointer">
               {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="py-3 px-4 mt-1 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent outline-none font-black text-sm shadow-sm transition-all cursor-pointer">
               {dateOptions.map(d => <option key={d} value={d}>{d}</option>)}
             </select>
             <select value={category} onChange={e => setCategory(e.target.value as any)} className="py-3 px-4 mt-1 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent outline-none font-black text-sm shadow-sm transition-all cursor-pointer">
               {Object.keys(CATEGORY_CONFIG).map(c => <option key={c} value={c}>{(labels as any)[c]}</option>)}
             </select>
             <button onClick={addExpense} className="lg:col-span-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black py-3 mt-1 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none">{labels.addBtn}</button>
           </div>
           <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={labels.desc} required className="w-full mt-4 px-6 py-3 bg-white dark:bg-slate-800 dark:text-white rounded-2xl text-sm font-bold border border-transparent outline-none shadow-sm transition-all" />
        </div>

        <div className="px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
              <button onClick={() => setFilterCategory('All')} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterCategory === 'All' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700'}`}>
                {labels.filterAll}
              </button>
              {Object.keys(CATEGORY_CONFIG).map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)} className={`flex-shrink-0 px-3 py-2 sm:px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterCategory === cat ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700'}`}>
                  {React.createElement(CATEGORY_CONFIG[cat].icon, { size: 14 })}
                  <span className="hidden sm:inline">{(labels as any)[cat]}</span>
                </button>
              ))}
           </div>
           <div className="relative group w-full sm:w-auto">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                 <ArrowUpDown size={14} className="text-slate-400" />
                 <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortType)} className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 cursor-pointer p-0">
                    <option value="created-desc">{labels.createdDesc}</option>
                    <option value="created-asc">{labels.createdAsc}</option>
                    <option value="amount-desc">{labels.amountHigh}</option>
                    <option value="amount-asc">{labels.amountLow}</option>
                 </select>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 custom-scrollbar">
           {flightPriceTWD > 0 && filterCategory === 'All' && (
              <div className="flex items-center justify-between p-6 rounded-[28px] bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm"><Plane size={20} strokeWidth={2.5} /></div>
                  <div><div className="font-black text-slate-800 dark:text-white">{labels.flightTicket}</div><div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.flightSub}</div></div>
                </div>
                <div className="text-right flex flex-col items-end"><div className="font-black text-slate-800 dark:text-white text-lg">{trip.flight?.currency} {trip.flight?.price.toLocaleString()}</div>{trip.flight?.currency !== Currency.TWD && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">≈ NT$ {Math.round(flightPriceTWD).toLocaleString()}</div>}</div>
              </div>
           )}

           {processedExpenses.map(item => {
             const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Other;
             const Icon = config.icon;
             return (
               <div key={item.id} className="group flex items-center justify-between p-5 rounded-[28px] bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-100 dark:border-slate-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${config.bgColor} ${config.darkBgColor} ${config.textColor} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}><Icon size={20} /></div>
                    <div className="max-w-[140px] sm:max-w-[240px]">
                      <div className="font-black text-slate-800 dark:text-white truncate text-base">{item.note}</div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{item.date}</div>
                        {item.createdAt && (
                          <div className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase flex items-center gap-1">
                            <Clock size={8} /> {formatFullDateTime(item.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right flex flex-col items-end">
                      <div className="font-black text-slate-800 dark:text-white text-lg">{item.currency} {item.amount.toLocaleString()}</div>
                      {item.currency !== Currency.TWD && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">≈ NT$ {Math.round(item.amount * (item.exchangeRate || 1)).toLocaleString()}</div>}
                    </div>
                    <button onClick={() => deleteExpense(item.id)} className="p-2.5 bg-slate-50 dark:bg-slate-700 text-red-500/80 dark:text-red-400/80 hover:text-red-600 dark:hover:text-red-300 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-red-100 dark:hover:border-red-900/30"><Trash2 size={16}/></button>
                  </div>
               </div>
             );
           })}
           
           {processedExpenses.length === 0 && (flightPriceTWD === 0 || filterCategory !== 'All') && (
             <div className="text-center py-24 text-slate-300 font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-4">
                <Filter size={32} className="opacity-20" />
                {labels.noExpenses}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
