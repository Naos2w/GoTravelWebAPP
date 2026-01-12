import React, { useState } from 'react';
import { Trip, Expense, Currency } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Plus, DollarSign, TrendingUp, Plane } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Expenses: React.FC<Props> = ({ trip, onUpdate }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [currency, setCurrency] = useState<Currency>(Currency.TWD);
  const [note, setNote] = useState('');

  // Mock exchange rates (In a real app, fetch live)
  const rates: Record<Currency, number> = {
    [Currency.TWD]: 1,
    [Currency.USD]: 31.5,
    [Currency.JPY]: 0.21,
    [Currency.EUR]: 34.2,
    [Currency.KRW]: 0.024
  };

  const addExpense = () => {
    if (!amount) return;
    const val = parseFloat(amount);
    const exRate = rates[currency];
    
    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: val,
      currency,
      category,
      date: new Date().toISOString(),
      note,
      exchangeRate: exRate
    };

    onUpdate({ ...trip, expenses: [newExpense, ...trip.expenses] });
    setAmount('');
    setNote('');
  };

  const expensesTotal = trip.expenses.reduce((sum, item) => sum + (item.amount * item.exchangeRate), 0);
  const flightPriceTWD = (trip.flight?.price && trip.flight.price > 0) 
    ? (trip.flight.price * (rates[trip.flight.currency] || 1)) 
    : 0;
  
  const totalTWD = expensesTotal + flightPriceTWD;

  // Prepare chart data including flight
  const dataMap = trip.expenses.reduce((acc, curr) => {
    const twdVal = curr.amount * curr.exchangeRate;
    acc[curr.category] = (acc[curr.category] || 0) + twdVal;
    return acc;
  }, {} as Record<string, number>);

  if (flightPriceTWD > 0) {
    dataMap['Transport'] = (dataMap['Transport'] || 0) + flightPriceTWD;
  }

  const chartData = Object.entries(dataMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Col: Summary & Chart */}
      <div className="space-y-6">
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
           <div className="relative z-10">
             <div className="text-slate-400 text-sm font-medium mb-1">Total Trip Cost</div>
             <div className="text-3xl font-bold">NT$ {totalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
             {flightPriceTWD > 0 && (
               <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                 <Plane size={10} /> Includes NT$ {Math.round(flightPriceTWD).toLocaleString()} for flights
               </div>
             )}
           </div>
           <TrendingUp className="absolute right-4 bottom-4 text-slate-800 w-24 h-24" />
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[300px]">
          <h3 className="text-sm font-semibold text-slate-500 mb-4">Category Breakdown</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `NT$ ${Math.round(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300">No expenses yet</div>
          )}
        </div>
      </div>

      {/* Right Col: Add Form & List */}
      <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
        {/* Add Form */}
        <div className="p-6 bg-gray-50 border-b border-gray-100">
           <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Expense</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <div className="col-span-2 md:col-span-1 relative">
                <span className="absolute left-3 top-3 text-gray-400 text-xs">{currency}</span>
                <input 
                  type="number" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-2.5 bg-white rounded-xl border-none focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold"
                />
             </div>
             <select 
               value={currency} 
               onChange={e => setCurrency(e.target.value as Currency)}
               className="py-2.5 px-3 bg-white rounded-xl border-none focus:outline-none font-bold text-sm"
             >
               {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select 
               value={category} 
               onChange={e => setCategory(e.target.value as any)}
               className="py-2.5 px-3 bg-white rounded-xl border-none focus:outline-none font-bold text-sm"
             >
               {['Accommodation', 'Transport', 'Food', 'Tickets', 'Shopping', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <button onClick={addExpense} className="bg-primary text-white rounded-xl font-bold hover:bg-blue-600 shadow-sm transition-all">
               Add Entry
             </button>
           </div>
           <input 
             type="text" 
             value={note} 
             onChange={e => setNote(e.target.value)} 
             placeholder="Description (optional)"
             className="w-full mt-3 px-4 py-2 bg-white rounded-xl text-sm border-none focus:outline-none"
           />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {/* Flight Expense Entry (Static if exists) */}
           {flightPriceTWD > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/30 border border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Plane size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Flight Ticket</div>
                    <div className="text-xs text-slate-400">Total flight booking</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">
                    {trip.flight?.currency} {trip.flight?.price.toLocaleString()}
                  </div>
                  {trip.flight?.currency !== Currency.TWD && (
                    <div className="text-xs text-slate-400">
                      ≈ NT$ {flightPriceTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
              </div>
           )}

           {trip.expenses.map(item => (
             <div key={item.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 text-slate-400 flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{item.category}</div>
                    <div className="text-xs text-slate-400">{item.note || new Date(item.date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">
                    {item.currency} {item.amount.toLocaleString()}
                  </div>
                  {item.currency !== Currency.TWD && (
                    <div className="text-xs text-slate-400">
                      ≈ NT$ {(item.amount * item.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
             </div>
           ))}
           {trip.expenses.length === 0 && flightPriceTWD === 0 && (
             <div className="text-center py-20 text-gray-300 font-medium">No transactions recorded yet.</div>
           )}
        </div>
      </div>
    </div>
  );
};