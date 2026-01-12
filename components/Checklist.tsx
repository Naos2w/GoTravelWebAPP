
import React, { useState } from 'react';
import { Trip, ChecklistItem } from '../types';
import { 
  Check, Plus, Trash2, ChevronDown, 
  FileText, Zap, Shirt, Sparkles, Tag 
} from 'lucide-react';
import { useTranslation } from '../App';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const CATEGORY_UI: Record<string, { icon: any, color: string, ring: string, bar: string, bg: string, darkBg: string, text: string, darkText: string }> = {
  Documents: { 
    icon: FileText, 
    color: 'text-blue-500', 
    ring: 'ring-blue-500/20', 
    bar: 'bg-blue-500', 
    bg: 'bg-blue-50/80', 
    darkBg: 'dark:bg-blue-900/30',
    text: 'text-blue-600',
    darkText: 'dark:text-blue-400'
  },
  Gear: { 
    icon: Zap, 
    color: 'text-purple-500', 
    ring: 'ring-purple-500/20', 
    bar: 'bg-purple-500', 
    bg: 'bg-purple-50/80', 
    darkBg: 'dark:bg-purple-900/30',
    text: 'text-purple-600',
    darkText: 'dark:text-purple-400'
  },
  Clothing: { 
    icon: Shirt, 
    color: 'text-pink-500', 
    ring: 'ring-pink-500/20', 
    bar: 'bg-pink-500', 
    bg: 'bg-pink-50/80', 
    darkBg: 'dark:bg-pink-900/30',
    text: 'text-pink-600',
    darkText: 'dark:text-pink-400'
  },
  Toiletries: { 
    icon: Sparkles, 
    color: 'text-cyan-500', 
    ring: 'ring-cyan-500/20', 
    bar: 'bg-cyan-500', 
    bg: 'bg-cyan-50/80', 
    darkBg: 'dark:bg-cyan-900/30',
    text: 'text-cyan-600',
    darkText: 'dark:text-cyan-400'
  },
  Other: { 
    icon: Tag, 
    color: 'text-slate-500', 
    ring: 'ring-slate-500/20', 
    bar: 'bg-slate-500', 
    bg: 'bg-slate-100/80', 
    darkBg: 'dark:bg-slate-700/50',
    text: 'text-slate-600',
    darkText: 'dark:text-slate-400'
  }
};

export const Checklist: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [newItemText, setNewItemText] = useState('');
  const [category, setCategory] = useState<ChecklistItem['category']>('Other');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

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

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
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
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-12 rounded-[32px] sm:rounded-[40px] shadow-sm border border-slate-50 dark:border-slate-700 transition-all duration-300">
        <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 text-slate-900 dark:text-white tracking-tight">{labels.title}</h2>
        
        {/* 總體進度條 */}
        <div className="mb-10 bg-slate-50/50 dark:bg-slate-900/40 p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-slate-100 dark:border-slate-800/50">
          <div className="flex justify-between text-[10px] sm:text-[11px] font-black mb-2 sm:mb-3 text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
            <span className="hidden sm:inline">{labels.ready}</span>
            <span className="sm:hidden">Progress</span>
            <span className="text-green-500 font-bold">{progress}%</span>
          </div>
          <div className="h-2 sm:h-3 bg-white dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-100 dark:border-transparent">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,197,94,0.4)]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 新增項目 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={labels.addItem}
            className="flex-1 px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-[16px] sm:rounded-[20px] border border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-bold text-sm shadow-sm transition-all"
          />
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-[16px] sm:rounded-[20px] border border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-bold text-sm shadow-sm transition-all cursor-pointer"
          >
            {categories.map(c => <option key={c} value={c}>{(labels as any)[c]}</option>)}
          </select>
          <button onClick={addItem} className="px-8 py-3.5 sm:py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[16px] sm:rounded-[20px] font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center"><Plus size={24} /></button>
        </div>

        {/* 分類清單 */}
        <div className="space-y-6">
          {categories.map(cat => {
            const items = trip.checklist.filter(i => i.category === cat);
            if (items.length === 0) return null;
            
            const catCompleted = items.filter(i => i.isCompleted).length;
            const catProgress = Math.round((catCompleted / items.length) * 100);
            const ui = CATEGORY_UI[cat] || CATEGORY_UI.Other;
            const CatIcon = ui.icon;
            const isCollapsed = collapsedCategories[cat];
            const isPending = catProgress < 100;

            return (
              <div 
                key={cat} 
                className={`animate-in fade-in duration-500 rounded-[28px] overflow-hidden border transition-all duration-500 ${
                  isPending 
                    ? 'border-red-400/60 dark:border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)] ring-1 ring-red-400/10' 
                    : 'border-slate-50 dark:border-slate-700/50'
                }`}
              >
                {/* 類別標題 & 專屬進度條 */}
                <div 
                  onClick={() => toggleCategory(cat)}
                  className={`group flex flex-col p-4 sm:p-5 cursor-pointer transition-all duration-300 ${isCollapsed ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-transparent'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${ui.bg} ${ui.darkBg} ${ui.text} ${ui.darkText} shadow-sm transition-transform group-hover:scale-110`}>
                        <CatIcon size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <h3 className="hidden min-[420px]:inline text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">{(labels as any)[cat]}</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      {isPending && (
                        <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-[9px] font-black text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/30 animate-pulse">
                          PENDING
                        </span>
                      )}
                      <span className={`text-[10px] sm:text-xs font-black transition-colors ${catProgress === 100 ? 'text-green-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {catProgress}%
                      </span>
                      <ChevronDown size={18} className={`text-slate-300 dark:text-slate-600 transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`} />
                    </div>
                  </div>
                  
                  {/* 類別細進度條 */}
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${ui.bar}`}
                      style={{ width: `${catProgress}%` }}
                    />
                  </div>
                </div>

                {/* 類別項目清單：收縮動畫 */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-50/20 dark:bg-slate-900/10 border-t border-slate-50 dark:border-slate-700/50">
                    {items.map(item => (
                      <div key={item.id} className="group flex items-center justify-between p-4 rounded-[20px] bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-100 dark:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <button 
                            onClick={() => toggleItem(item.id)} 
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
                              item.isCompleted 
                                ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30' 
                                : `border-slate-200 dark:border-slate-600 text-transparent hover:border-green-400`
                            }`}
                          >
                            <Check size={item.isCompleted ? 12 : 16} strokeWidth={4} className={item.isCompleted ? 'sm:w-4 sm:h-4' : ''} />
                          </button>
                          <span className={`text-[11px] sm:text-sm font-bold transition-all duration-300 truncate ${
                            item.isCompleted 
                              ? 'line-through text-slate-300 dark:text-slate-600' 
                              : 'text-slate-700 dark:text-slate-200'
                          }`}>
                            {item.text}
                          </span>
                        </div>
                        <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-200 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
