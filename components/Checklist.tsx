import React, { useState } from 'react';
import { Trip, ChecklistItem } from '../types';
import { Check, Plus, Trash2 } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export const Checklist: React.FC<Props> = ({ trip, onUpdate }) => {
  const [newItemText, setNewItemText] = useState('');
  const [category, setCategory] = useState<ChecklistItem['category']>('Other');

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
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Pre-trip Checklist</h2>
        
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2 text-slate-600">
            <span>Ready for takeoff?</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Add Item */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add item..."
            className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 focus:outline-none"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            onClick={addItem}
            className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* List */}
        <div className="space-y-6">
          {categories.map(cat => {
            const items = trip.checklist.filter(i => i.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{cat}</h3>
                <div className="space-y-2">
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleItem(item.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            item.isCompleted 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 text-transparent hover:border-green-500'
                          }`}
                        >
                          <Check size={14} />
                        </button>
                        <span className={`text-slate-700 ${item.isCompleted ? 'line-through text-slate-400' : ''}`}>
                          {item.text}
                        </span>
                      </div>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
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
