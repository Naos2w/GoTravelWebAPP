import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trip, ChecklistItem, User } from '../types';
import { 
  Check, Plus, Trash2, FileText, Zap, 
  Shirt, Sparkles, Tag, ChevronDown, ChevronUp, X as CloseIcon,
  CheckCircle2, Circle, ListFilter
} from 'lucide-react';
import { useTranslation } from "../contexts/LocalizationContext";
import { supabase, deleteChecklistItem } from '../services/storageService';

interface Props {
  trip: Trip;
  currentUser: User;
  onUpdate: (trip: Trip, action?: string, payload?: any) => void;
  isGuest?: boolean;
}

const CATEGORY_META: Record<string, { icon: any; color: string; bg: string; badgeBg: string }> = {
  Documents: {
    icon: FileText,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500',
    badgeBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
  },
  Gear: {
    icon: Zap,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500',
    badgeBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
  },
  Clothing: {
    icon: Shirt,
    color: 'text-indigo-500 dark:text-indigo-400',
    bg: 'bg-indigo-500',
    badgeBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
  },
  Toiletries: {
    icon: Sparkles,
    color: 'text-teal-500 dark:text-teal-400',
    bg: 'bg-teal-500',
    badgeBg: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'
  },
  Other: {
    icon: Tag,
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-500',
    badgeBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
};

const QUICK_SUGGESTIONS: { text: string; category: ChecklistItem['category'] }[] = [
  { text: '護照 / 機票確認信', category: 'Documents' },
  { text: '萬用轉接插頭', category: 'Gear' },
  { text: '行動電源 (放隨身行李)', category: 'Gear' },
  { text: '換洗衣物 / 外套', category: 'Clothing' },
  { text: '牙刷常備藥物', category: 'Toiletries' }
];

export const Checklist: React.FC<Props> = ({ trip, currentUser, onUpdate, isGuest = false }) => {
  const { t } = useTranslation();
  const [newItemText, setNewItemText] = useState('');
  const [category, setCategory] = useState<ChecklistItem['category']>('Other');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'completed'>('all');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    Documents: true,
    Gear: true,
    Clothing: true,
    Toiletries: true,
    Other: true
  });

  const getCatName = (cat: string) => {
    switch(cat) {
      case 'Documents': return t('catDocs');
      case 'Gear': return t('catGear');
      case 'Clothing': return t('catCloth');
      case 'Toiletries': return t('catToilet');
      default: return t('catOther');
    }
  };

  const labels = {
    title: t('checklist'),
    ready: t('packingProgress'),
    addItem: t('addChecklistItem'),
    inputPlaceholder: t('descRequired'),
    confirm: t('save'),
    cancel: t('cancel'),
    confirmDelete: t('confirmDeleteItems')
  };

  // Optimistic UI state
  const [optimisticChecklist, setOptimisticChecklist] = useState<ChecklistItem[]>(trip.checklist || []);

  // Track pending toggle operations per item to prevent race conditions and stale server echoes
  const pendingTogglesRef = useRef<Map<string, { value: boolean; timestamp: number }>>(new Map());
  const debounceTimeoutsRef = useRef<Map<string, number>>(new Map());

  // Merge external trip.checklist with optimistic state while respecting pending user interactions
  useEffect(() => {
    if (!trip.checklist) return;

    setOptimisticChecklist((currentList) => {
      const now = Date.now();
      return trip.checklist.map((serverItem) => {
        const pending = pendingTogglesRef.current.get(serverItem.id);
        if (pending && now - pending.timestamp < 2500) {
          if (serverItem.isCompleted === pending.value) {
            pendingTogglesRef.current.delete(serverItem.id);
            return serverItem;
          }
          return { ...serverItem, isCompleted: pending.value };
        }
        return serverItem;
      });
    });
  }, [trip.checklist]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      debounceTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
      debounceTimeoutsRef.current.clear();
    };
  }, []);

  // Filter items that belong to the current user (using optimistic state)
  const myItems = useMemo(() => {
    return optimisticChecklist.filter(i => currentUser && i.user_id === currentUser.id);
  }, [optimisticChecklist, currentUser]);

  const toggleItem = (itemId: string) => {
    const currentItem = optimisticChecklist.find((i) => i.id === itemId);
    if (!currentItem) return;

    const nextCompleted = !currentItem.isCompleted;

    // 1. Mark as pending with current timestamp to protect against stale server echoes
    pendingTogglesRef.current.set(itemId, {
      value: nextCompleted,
      timestamp: Date.now(),
    });

    // 2. Optimistic update immediately in UI
    const updatedList = optimisticChecklist.map((item) =>
      item.id === itemId ? { ...item, isCompleted: nextCompleted } : item
    );
    setOptimisticChecklist(updatedList);

    // 3. Debounce rapid clicks for this specific item (150ms)
    const existingTimeout = debounceTimeoutsRef.current.get(itemId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    const timer = window.setTimeout(() => {
      debounceTimeoutsRef.current.delete(itemId);
      onUpdate(
        { ...trip, checklist: updatedList },
        "UPDATE_CHECKLIST_ITEM",
        { id: itemId, isCompleted: nextCompleted }
      );
    }, 150);

    debounceTimeoutsRef.current.set(itemId, timer);
  };

  const addItemWithText = (text: string, cat: ChecklistItem['category'] = category) => {
    if (!text.trim() || !currentUser) return;
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      text: text.trim(),
      isCompleted: false,
      category: cat,
    };
    const updatedList = [...optimisticChecklist, newItem];
    setOptimisticChecklist(updatedList);
    onUpdate({ ...trip, checklist: updatedList }, "ADD_CHECKLIST_ITEM", newItem);
    setNewItemText('');
    setIsFormOpen(false);
  };

  const addItem = () => {
    addItemWithText(newItemText, category);
  };

  const deleteItem = async (itemId: string) => {
    const backup = [...optimisticChecklist];
    const updatedList = optimisticChecklist.filter(i => i.id !== itemId);
    setOptimisticChecklist(updatedList);

    try {
      await deleteChecklistItem(itemId, trip.id);
    } catch (e) {
      console.error("Failed to delete item", e);
      setOptimisticChecklist(backup);
      onUpdate(trip, "SHOW_ERROR_TOAST", t("errorTitle") || "Failed to delete checklist item");
    }
  };

  const toggleExpand = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const completedCount = myItems.filter(i => i.isCompleted).length;
  const globalProgress = myItems.length === 0 ? 0 : Math.round((completedCount / myItems.length) * 100);
  const categories: ChecklistItem['category'][] = ['Documents', 'Gear', 'Clothing', 'Toiletries', 'Other'];

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-16">
      <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl p-6 sm:p-10 rounded-[36px] shadow-ios border border-black/[0.04] dark:border-white/[0.06]">
        {/* Title & Progress Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span>{labels.title}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {completedCount}/{myItems.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
              Apple Reminders 風格清單 • 點擊圓圈標記完成
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-100/80 dark:bg-white/[0.06] p-1 rounded-2xl gap-1 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setFilterState('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterState === 'all'
                  ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterState('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterState === 'pending'
                  ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              未完成
            </button>
            <button
              onClick={() => setFilterState('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterState === 'completed'
                  ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              已完成
            </button>
          </div>
        </div>
        
        {/* iOS Battery/Health Progress Capsule */}
        <div className="mb-8 bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-100 dark:border-white/[0.05]">
          <div className="flex justify-between items-center text-[11px] font-bold mb-2.5 text-slate-500 dark:text-slate-400">
            <span>{labels.ready}</span>
            <span className={`font-mono font-black ${globalProgress === 100 ? "text-emerald-500" : "text-primary"}`}>
              {globalProgress}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-200/60 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-700 ease-out rounded-full ${
                globalProgress === 100 
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                  : 'bg-primary shadow-sm shadow-primary/30'
              }`} 
              style={{ width: `${globalProgress}%` }} 
            />
          </div>
        </div>

        {/* Add Item Trigger / Form */}
        <div className="mb-8 bg-slate-50/60 dark:bg-white/[0.03] rounded-3xl border border-slate-100 dark:border-white/[0.06] overflow-hidden transition-all duration-300">
          <div className={`transition-all duration-300 ease-in-out ${isFormOpen ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-20 opacity-100'}`}>
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="w-full py-5 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all font-black text-xs uppercase tracking-widest cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={14} strokeWidth={3} />
              </div>
              <span>{labels.addItem}</span>
            </button>
          </div>
          
          <div className={`transition-all duration-300 ease-in-out ${isFormOpen ? 'max-h-[400px] opacity-100 p-5 sm:p-7' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {labels.addItem}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)} 
                className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                aria-label="Close form"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <input 
                type="text" 
                value={newItemText} 
                onChange={(e) => setNewItemText(e.target.value)} 
                placeholder={labels.inputPlaceholder} 
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                className="flex-1 px-5 py-3.5 bg-white dark:bg-slate-900 dark:text-white rounded-2xl border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm shadow-sm" 
              />
              
              <div className="relative group/select min-w-[150px] h-12 md:h-auto">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value as any)} 
                  className="w-full h-full pl-5 pr-10 py-3 bg-white dark:bg-slate-900 dark:text-white rounded-2xl border border-slate-200/80 dark:border-slate-700 appearance-none font-bold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                >
                  {categories.map(c => <option key={c} value={c}>{getCatName(c)}</option>)}
                </select>
              </div>
              
              <button 
                onClick={addItem} 
                disabled={!newItemText.trim()}
                className="h-12 md:h-auto px-7 bg-primary text-white rounded-2xl font-bold shadow-md shadow-primary/25 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-wider disabled:opacity-50 disabled:scale-100 disabled:shadow-none shrink-0 cursor-pointer"
              >
                {labels.confirm}
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                常見行李推薦（點擊直接新增）：
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => addItemWithText(sug.text, sug.category)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold transition-all active:scale-95"
                  >
                    + {sug.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Categories and Items */}
        <div className="space-y-6">
          {categories.map(cat => {
            let items = myItems.filter(i => i.category === cat);
            if (filterState === 'pending') items = items.filter(i => !i.isCompleted);
            if (filterState === 'completed') items = items.filter(i => i.isCompleted);

            if (items.length === 0 && myItems.filter(i => i.category === cat).length === 0) return null;
            if (items.length === 0 && filterState !== 'all') return null;
            
            const totalInCat = myItems.filter(i => i.category === cat).length;
            const catCompleted = myItems.filter(i => i.category === cat && i.isCompleted).length;
            const catProgress = totalInCat === 0 ? 0 : Math.round((catCompleted / totalInCat) * 100);
            const isComplete = totalInCat > 0 && catCompleted === totalInCat;
            const isExpanded = expandedCats[cat];
            const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
            const Icon = meta.icon;

            return (
              <div 
                key={cat} 
                className="bg-white/80 dark:bg-[#2C2C2E]/60 rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] p-5 sm:p-6 shadow-sm hover:shadow-ios transition-all duration-300"
              >
                <div 
                  onClick={() => toggleExpand(cat)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${meta.badgeBg}`}>
                       <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          {getCatName(cat)}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isComplete 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {catCompleted}/{totalInCat}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.05] grid grid-cols-1 md:grid-cols-2 gap-2.5 animate-in fade-in duration-200">
                    {items.map(item => (
                      <div 
                        key={item.id} 
                        className={`group/item flex items-center justify-between p-3.5 px-4 rounded-2xl transition-all border ${
                          item.isCompleted 
                          ? 'bg-slate-50/50 dark:bg-white/[0.02] border-transparent opacity-60' 
                          : 'bg-white dark:bg-[#1C1C1E] border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          {/* Apple Reminders Circular Checkbox */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }} 
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer active:scale-75 ${
                              item.isCompleted 
                              ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/30 scale-100' 
                              : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-500 hover:scale-105'
                            }`}
                            aria-label="Toggle item"
                          >
                            <Check size={13} strokeWidth={3.5} className={`transition-transform duration-200 ${item.isCompleted ? 'scale-100' : 'scale-0'}`} />
                          </button>

                          <span className={`font-bold text-sm truncate transition-all ${
                            item.isCompleted 
                            ? 'line-through text-slate-400 dark:text-slate-500' 
                            : 'text-slate-800 dark:text-slate-100'
                          }`}>
                            {item.text}
                          </span>
                        </div>
                        
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} 
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-all active:scale-90 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 cursor-pointer"
                          aria-label="Delete item"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {myItems.length === 0 && (
            <div className="text-center py-12 px-4 rounded-3xl bg-slate-50/60 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                尚無待辦事項
              </h4>
              <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                點擊上方「新增項目」或下方快速按鈕，輕鬆準備出發行李！
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.slice(0, 3).map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => addItemWithText(sug.text, sug.category)}
                    className="text-xs px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    + {sug.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};