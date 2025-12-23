
import React, { useState } from 'react';
import { Trip, ChecklistItem } from '../types';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const Checklist: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [newItemText, setNewItemText] = useState('');
  const [category, setCategory] = useState<ChecklistItem['category']>('Other');

  const labels = {
    title: language === 'zh' ? '行前待辦清單' : 'Pre-trip Checklist',
    ready: language === 'zh' ? '準備好出發了嗎？' : 'Ready for takeoff?',
    addItem: language === 'zh' ? '新增項目...' : 'Add item...',
    Documents: language === 'zh' ? '證件與文件' : 'Documents',
    Gear: language === 'zh' ? '電子與器材' : 'Gear',
    Clothing: language === 'zh' ? '衣物' : 'Clothing',
    Toiletries: language === 'zh' ? '盥洗用品' : 'Toiletries',
    Other: language === 'zh' ? '其他' : 'Other'
  };

  const toggleItem = (itemId: string) => {
    const newChecklist = trip.checklist.map(item => 
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    onUpdate({ ...trip, checklist: newChecklist });
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newItemText,
      isCompleted: false,
      category,
    };
    onUpdate({ ...trip, checklist: [...trip.checklist, newItem] });
    setNewItemText('');
  };

  const deleteItem = (itemId: string) => {
    onUpdate({ ...trip, checklist: trip.checklist.filter(i => i.id !== itemId) });
  };

  const completedCount = trip.checklist.filter(i => i.isCompleted).length;
  const totalCount = trip.checklist.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const categories: ChecklistItem['category'][] = ['Documents', 'Gear', 'Clothing', 'Toiletries', 'Other'];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[40px] shadow-sm border border-slate-50 dark:border-slate-700 transition-all duration-300">
        <h2 className="text-2xl font-black mb-8 text-slate-900 dark:text-white tracking-tight">{labels.title}</h2>
        
        <div className="mb-10 bg-slate-50/50 dark:bg-slate-900/40 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800/50">
          <div className="flex justify-between text-[11px] font-black mb-3 text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
            <span>{labels.ready}</span>
            <span className="text-green-500">{progress}%</span>
          </div>
          <div className="h-3 bg-white dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-100 dark:border-transparent">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,197,94,0.4)]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={labels.addItem}
            className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-[20px] border border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-bold text-sm shadow-sm transition-all"
          />
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-6 py-4 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-[20px] border border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-bold text-sm shadow-sm transition-all"
          >
            {categories.map(c => <option key={c} value={c}>{(labels as any)[c]}</option>)}
          </select>
          <button onClick={addItem} className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"><Plus size={24} /></button>
        </div>

        <div className="space-y-12">
          {categories.map(cat => {
            const items = trip.checklist.filter(i => i.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="animate-in fade-in duration-500">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-6 ml-1">{(labels as any)[cat]}</h3>
                <div className="space-y-4">
                  {items.map(item => (
                    <div key={item.id} className="group flex items-center justify-between p-5 rounded-[24px] bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-100 dark:border-slate-700/50 transition-all duration-300">
                      <div className="flex items-center gap-5">
                        <button 
                          onClick={() => toggleItem(item.id)} 
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                            item.isCompleted 
                              ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30' 
                              : 'border-slate-200 dark:border-slate-600 text-transparent hover:border-green-400'
                          }`}
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                        <span className={`text-base font-bold transition-all duration-300 ${
                          item.isCompleted 
                            ? 'line-through text-slate-300 dark:text-slate-600' 
                            : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {item.text}
                        </span>
                      </div>
                      <button onClick={() => deleteItem(item.id)} className="p-2.5 text-slate-200 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
