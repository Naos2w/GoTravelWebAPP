
import React, { useState, useEffect } from 'react';
import { Trip, ChecklistItem, User } from '../types';
import { 
  Check, Plus, Trash2, FileText, Zap, 
  Shirt, Sparkles, Tag, ChevronDown, ChevronUp, X as CloseIcon
} from 'lucide-react';
import { useTranslation } from '../App';
import { supabase } from '../services/storageService';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
  isGuest?: boolean;
}

const CATEGORY_ICONS: Record<string, any> = {
  Documents: FileText,
  Gear: Zap,
  Clothing: Shirt,
  Toiletries: Sparkles,
  Other: Tag
};

export const Checklist: React.FC<Props> = ({ trip, onUpdate, isGuest = false }) => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [category, setCategory] = useState<ChecklistItem['category']>('Other');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    Documents: true,
    Gear: true,
    Clothing: true,
    Toiletries: true,
    Other: true
  });

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

  // Filter items that belong to the current user
  const myItems = trip.checklist.filter(i => currentUser && i.user_id === currentUser.id);

  const toggleItem = (itemId: string) => {
    // No guest restriction here because it's their own list
    const newChecklist = trip.checklist.map(item => 
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    onUpdate({ ...trip, checklist: newChecklist });
  };

  const addItem = () => {
    if (!newItemText.trim() || !currentUser) return;
    const newItem: ChecklistItem = {
      id: `manual-${Date.now()}`,
      user_id: currentUser.id, // Assign to current user
      text: newItemText,
      isCompleted: false,
      category,
    };
    onUpdate({ ...trip, checklist: [...trip.checklist, newItem] });
    setNewItemText('');
    setIsFormOpen(false);
  };

  const deleteItem = (itemId: string) => {
    if (!window.confirm(labels.confirmDelete)) return;
    onUpdate({ ...trip, checklist: trip.checklist.filter(i => i.id !== itemId) });
  };

  const toggleExpand = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const globalProgress = myItems.length === 0 ? 0 : Math.round((myItems.filter(i => i.isCompleted).length / myItems.length) * 100);
  const categories: ChecklistItem['category'][] = ['Documents', 'Gear', 'Clothing', 'Toiletries', 'Other'];

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-12 rounded-[40px] shadow-ios border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{labels.title}</h2>
        </div>
        
        <div className="mb-10 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
          <div className="flex justify-between text-[10px] font-black mb-3 text-slate-400 uppercase tracking-widest">
            <span>{labels.ready}</span>
            <span className={globalProgress === 100 ? "text-green-500" : "text-primary"}>{globalProgress}%</span>
          </div>
          <div className="h-2.5 bg-white dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div className={`h-full transition-all duration-1000 ${globalProgress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${globalProgress}%` }} />
          </div>
        </div>

        <div className="mb-10 bg-slate-50/30 dark:bg-slate-900/30 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-500">
             <div className={`transition-all duration-500 ease-in-out ${isFormOpen ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-20 opacity-100'}`}>
               <button 
                 onClick={() => setIsFormOpen(true)} 
                 className="w-full py-6 flex items-center justify-center gap-2 text-slate-500 hover:text-primary dark:hover:text-white transition-all font-black uppercase text-xs tracking-[0.2em]"
               >
                 <Plus size={18} /> {labels.addItem}
               </button>
             </div>
             
             <div className={`transition-all duration-500 ease-in-out ${isFormOpen ? 'max-h-[400px] opacity-100 p-6 sm:p-8' : 'max-h-0 opacity-0 pointer-events-none'}`}>
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{labels.addItem}</h3>
                 <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                   <CloseIcon size={18} />
                 </button>
               </div>
               
               <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                   type="text" 
                   value={newItemText} 
                   onChange={(e) => setNewItemText(e.target.value)} 
                   placeholder={labels.inputPlaceholder} 
                   className="flex-1 px-6 py-4 bg-white dark:bg-slate-900 dark:text-white rounded-2xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold shadow-sm" 
                 />
                 <div className="flex gap-2 h-14 sm:h-auto">
                   <select 
                     value={category} 
                     onChange={(e) => setCategory(e.target.value as any)} 
                     className="flex-1 sm:w-40 px-4 py-4 bg-white dark:bg-slate-900 dark:text-white rounded-2xl border-none font-black text-xs uppercase tracking-widest outline-none shadow-sm cursor-pointer"
                   >
                     {categories.map(c => <option key={c} value={c}>{getCatName(c)}</option>)}
                   </select>
                 </div>
               </div>
               
               <div className="flex gap-3 mt-6">
                 <button 
                   onClick={addItem} 
                   className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-primary dark:hover:bg-primary dark:hover:text-white flex items-center justify-center gap-2"
                 >
                   <Plus size={20} /> {labels.confirm}
                 </button>
                 <button 
                   onClick={() => setIsFormOpen(false)} 
                   className="px-6 py-4 bg-slate-200/50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                 >
                   {labels.cancel}
                 </button>
               </div>
             </div>
          </div>

        <div className="space-y-8">
          {categories.map(cat => {
            const items = myItems.filter(i => i.category === cat);
            if (items.length === 0) return null;
            
            const catCompleted = items.filter(i => i.isCompleted).length;
            const catProgress = Math.round((catCompleted / items.length) * 100);
            const isComplete = catProgress === 100;
            const isExpanded = expandedCats[cat];
            const Icon = CATEGORY_ICONS[cat] || Tag;

            const cardStyle = isComplete 
              ? 'border-green-100 bg-green-50/20 dark:border-green-900/30 dark:bg-green-900/10' 
              : 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10';
            
            const iconStyle = isComplete
              ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
              : 'text-red-500 bg-red-100 dark:text-red-400 dark:bg-red-900/30';

            const barColor = isComplete ? 'bg-green-500' : 'bg-red-500';

            return (
              <div 
                key={cat} 
                className={`group space-y-4 p-5 sm:p-6 rounded-[32px] border transition-all ${cardStyle}`}
              >
                <div 
                  onClick={() => toggleExpand(cat)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${iconStyle}`}>
                       <Icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                          {getCatName(cat)}
                        </h3>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isComplete ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {catProgress}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-32 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-700 ${barColor}`} 
                          style={{ width: `${catProgress}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2 text-slate-400 dark:text-slate-500">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className={`group/item flex items-center justify-between p-4 rounded-2xl transition-all border ${
                        item.isCompleted 
                        ? 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent opacity-60' 
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-ios hover:border-primary/20'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }} 
                          className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
                            item.isCompleted 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-slate-200 dark:border-slate-600 text-transparent hover:border-primary'
                          }`}
                        >
                          <Check size={16} strokeWidth={4} />
                        </button>
                        <span className={`font-bold text-sm truncate ${
                          item.isCompleted 
                          ? 'line-through text-slate-400' 
                          : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {item.text}
                        </span>
                      </div>
                      
                      <button 
                          onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} 
                          className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
                        >
                          <Trash2 size={16}/>
                      </button>
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