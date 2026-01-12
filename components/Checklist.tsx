
import React, { useState } from 'react';
import { Trip, ChecklistItem } from '../types';
import { 
  Check, Plus, Trash2, FileText, Zap, 
  Shirt, Sparkles, Tag 
} from 'lucide-react';
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const CATEGORY_UI: Record<string, { icon: any, color: string, ring: string, bar: string, bg: string, text: string }> = {
  Documents: { icon: FileText, color: 'text-blue-500', ring: 'ring-blue-500/20', bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600' },
  Gear: { icon: Zap, color: 'text-purple-500', ring: 'ring-purple-500/20', bar: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-600' },
  Clothing: { icon: Shirt, color: 'text-pink-500', ring: 'ring-pink-500/20', bar: 'bg-pink-500', bg: 'bg-pink-50', text: 'text-pink-600' },
  Toiletries: { icon: Sparkles, color: 'text-cyan-500', ring: 'ring-cyan-500/20', bar: 'bg-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  Other: { icon: Tag, color: 'text-slate-500', ring: 'ring-slate-500/20', bar: 'bg-slate-500', bg: 'bg-slate-100', text: 'text-slate-600' }
};

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
      id: `manual-${Date.now()}`,
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

  const progress = trip.checklist.length === 0 ? 0 : Math.round((trip.checklist.filter(i => i.isCompleted).length / trip.checklist.length) * 100);
  const categories: ChecklistItem['category'][] = ['Documents', 'Gear', 'Clothing', 'Toiletries', 'Other'];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 p-12 rounded-[40px] shadow-sm border border-slate-50 dark:border-slate-700">
        <h2 className="text-2xl font-black mb-8">{labels.title}</h2>
        
        <div className="mb-10 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase tracking-widest">
            <span>{labels.ready}</span>
            <span className="text-green-500">{progress}%</span>
          </div>
          <div className="h-2 bg-white dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex gap-3 mb-10">
          <input type="text" value={newItemText} onChange={(e) => setNewItemText(e.target.value)} placeholder={labels.addItem} className="flex-1 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold" />
          <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-none font-bold">
            {categories.map(c => <option key={c} value={c}>{(labels as any)[c]}</option>)}
          </select>
          <button onClick={addItem} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3.5 rounded-2xl font-black shadow-xl"><Plus /></button>
        </div>

        <div className="space-y-6">
          {categories.map(cat => {
            const items = trip.checklist.filter(i => i.category === cat);
            if (items.length === 0) return null;
            const ui = CATEGORY_UI[cat] || CATEGORY_UI.Other;

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">{(labels as any)[cat]}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(item => (
                    <div key={item.id} className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl transition-all hover:shadow-ios">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleItem(item.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 text-transparent hover:border-green-300'}`}>
                          <Check size={14} strokeWidth={4} />
                        </button>
                        <span className={`font-bold text-sm ${item.isCompleted ? 'line-through text-slate-300' : 'text-slate-700 dark:text-slate-200'}`}>{item.text}</span>
                      </div>
                      <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
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
