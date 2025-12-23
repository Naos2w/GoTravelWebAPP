
import React, { useState } from 'react';
import { Trip, Expense, Currency } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, DollarSign, TrendingUp, Plane } from 'lucide-react';
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Expenses: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [currency, setCurrency] = useState<Currency>(Currency.TWD);
  const [note, setNote] = useState('');

  const labels = {
    totalCost: language === 'zh' ? '旅程總花費' : 'Total Trip Cost',
    includesFlight: language === 'zh' ? '包含機票花費' : 'Includes flight tickets',
    breakdown: language === 'zh' ? '項目佔比' : 'Category Breakdown',
    addEntry: language === 'zh' ? '新增支出' : 'Add Expense',
    desc: language === 'zh' ? '項目描述 (選填)' : 'Description (optional)',
    addBtn: language === 'zh' ? '確認新增' : 'Add Entry',
    flightTicket: language === 'zh' ? '機票' : 'Flight Ticket',
    flightSub: language === 'zh' ? '機票預訂費用' : 'Flight booking cost',
    noExpenses: language === 'zh' ? '尚無支出記錄' : 'No transactions recorded.',
    Accommodation: language === 'zh' ? '住宿' : 'Accommodation',
    Transport: language === 'zh' ? '交通' : 'Transport',
    Food: language === 'zh' ? '餐飲' : 'Food',
    Tickets: language === 'zh' ? '票券' : 'Tickets',
    Shopping: language === 'zh' ? '購物' : 'Shopping',
    Other: language === 'zh' ? '其他' : 'Other'
  };

  const rates: Record<Currency, number> = {
    [Currency.TWD]: 1, [Currency.USD]: 31.5, [Currency.JPY]: 0.21, [Currency.EUR]: 34.2, [Currency.KRW]: 0.024
  };

  const addExpense = () => {
    if (!amount) return;
    const val = parseFloat(amount);
    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: val,
      currency,
      category,
      date: new Date().toISOString(),
      note,
      exchangeRate: rates[currency]
    };
    onUpdate({ ...trip, expenses: [newExpense, ...trip.expenses] });
    setAmount('');
    setNote('');
  };

  const expensesTotal = trip.expenses.reduce((sum, item) => sum + (item.amount * (item.exchangeRate || 1)), 0);
  const flightPriceTWD = (trip.flight?.price && trip.flight.price > 0) ? (trip.flight.price * (rates[trip.flight.currency] || 1)) : 0;
  const totalTWD = expensesTotal + flightPriceTWD;

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

      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[40px] shadow-ios border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col h-[650px] transition-all">
        <div className="p-6 sm:p-10 bg-slate-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
           <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 text-center lg:text-left">{labels.addEntry}</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">{currency}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full pl-14 pr-4 py-3 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent focus:border-primary/20 outline-none font-black text-sm shadow-sm transition-all" />
             </div>
             <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="py-3 px-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent outline-none font-black text-sm shadow-sm transition-all cursor-pointer">
               {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select value={category} onChange={e => setCategory(e.target.value as any)} className="py-3 px-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-transparent outline-none font-black text-sm shadow-sm transition-all cursor-pointer">
               {['Accommodation', 'Transport', 'Food', 'Tickets', 'Shopping', 'Other'].map(c => <option key={c} value={c}>{(labels as any)[c]}</option>)}
             </select>
             <button onClick={addExpense} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black py-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none">{labels.addBtn}</button>
           </div>
           <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={labels.desc} className="w-full mt-4 px-6 py-3 bg-white dark:bg-slate-800 dark:text-white rounded-2xl text-sm font-bold border border-transparent outline-none shadow-sm transition-all" />
        </div>
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 custom-scrollbar">
           {flightPriceTWD > 0 && (
              <div className="flex items-center justify-between p-6 rounded-[28px] bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm"><Plane size={20} strokeWidth={2.5} /></div>
                  <div><div className="font-black text-slate-800 dark:text-white">{labels.flightTicket}</div><div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{labels.flightSub}</div></div>
                </div>
                <div className="text-right flex flex-col items-end"><div className="font-black text-slate-800 dark:text-white text-lg">{trip.flight?.currency} {trip.flight?.price.toLocaleString()}</div>{trip.flight?.currency !== Currency.TWD && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">≈ NT$ {Math.round(flightPriceTWD).toLocaleString()}</div>}</div>
              </div>
           )}
           {trip.expenses.map(item => (
             <div key={item.id} className="flex items-center justify-between p-6 rounded-[28px] bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-100 dark:border-slate-700/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center"><DollarSign size={20} /></div>
                  <div><div className="font-black text-slate-800 dark:text-slate-200">{(labels as any)[item.category]}</div><div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.note || new Date(item.date).toLocaleDateString()}</div></div>
                </div>
                <div className="text-right flex flex-col items-end"><div className="font-black text-slate-800 dark:text-white text-lg">{item.currency} {item.amount.toLocaleString()}</div>{item.currency !== Currency.TWD && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">≈ NT$ {Math.round(item.amount * (item.exchangeRate || 1)).toLocaleString()}</div>}</div>
             </div>
           ))}
           {trip.expenses.length === 0 && flightPriceTWD === 0 && <div className="text-center py-24 text-slate-300 font-black uppercase text-xs tracking-widest">{labels.noExpenses}</div>}
        </div>
      </div>
    </div>
  );
};
