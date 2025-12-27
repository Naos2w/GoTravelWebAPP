import React, { useState } from "react";
import { Trip, ChecklistItem } from "../types";
import {
  Check,
  Plus,
  Trash2,
  FileText,
  Zap,
  Shirt,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
  X as CloseIcon,
} from "lucide-react";
import { useTranslation } from "../App";

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const CATEGORY_UI: Record<
  string,
  {
    icon: any;
    color: string;
    ring: string;
    bar: string;
    bg: string;
    text: string;
  }
> = {
  Documents: {
    icon: FileText,
    color: "text-blue-500",
    ring: "ring-blue-500/20",
    bar: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  Gear: {
    icon: Zap,
    color: "text-purple-500",
    ring: "ring-purple-500/20",
    bar: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
  },
  Clothing: {
    icon: Shirt,
    color: "text-pink-500",
    ring: "ring-pink-500/20",
    bar: "bg-pink-500",
    bg: "bg-pink-50 dark:bg-pink-500/20",
    text: "text-pink-600 dark:text-pink-400",
  },
  Toiletries: {
    icon: Sparkles,
    color: "text-cyan-500",
    ring: "ring-cyan-500/20",
    bar: "bg-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  Other: {
    icon: Tag,
    color: "text-slate-500",
    ring: "ring-slate-500/20",
    bar: "bg-slate-500",
    bg: "bg-slate-100 dark:bg-slate-700",
    text: "text-slate-600 dark:text-slate-300",
  },
};

export const Checklist: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [newItemText, setNewItemText] = useState("");
  const [category, setCategory] = useState<ChecklistItem["category"]>("Other");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    Documents: true,
    Gear: true,
    Clothing: true,
    Toiletries: true,
    Other: true,
  });

  const labels = {
    title: language === "zh" ? "行前待辦清單" : "Pre-trip Checklist",
    ready: language === "zh" ? "準備好出發了嗎？" : "Ready for takeoff?",
    addItem: language === "zh" ? "新增項目" : "Add Item",
    inputPlaceholder: language === "zh" ? "想要準備什麼..." : "What to pack...",
    Documents: language === "zh" ? "證件與文件" : "Documents",
    Gear: language === "zh" ? "電子與器材" : "Gear",
    Clothing: language === "zh" ? "衣物" : "Clothing",
    Toiletries: language === "zh" ? "盥洗用品" : "Toiletries",
    Other: language === "zh" ? "其他" : "Other",
    confirm: language === "zh" ? "加入清單" : "Add to List",
    cancel: language === "zh" ? "取消" : "Cancel",
  };

  const toggleItem = (itemId: string) => {
    const newChecklist = trip.checklist.map((item) =>
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
    setNewItemText("");
    setIsFormOpen(false);
  };

  const deleteItem = (itemId: string) => {
    onUpdate({
      ...trip,
      checklist: trip.checklist.filter((i) => i.id !== itemId),
    });
  };

  const toggleExpand = (cat: string) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const globalProgress =
    trip.checklist.length === 0
      ? 0
      : Math.round(
          (trip.checklist.filter((i) => i.isCompleted).length /
            trip.checklist.length) *
            100
        );
  const categories: ChecklistItem["category"][] = [
    "Documents",
    "Gear",
    "Clothing",
    "Toiletries",
    "Other",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-12 rounded-[40px] shadow-ios border border-slate-100 dark:border-slate-800">
        <h2 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">
          {labels.title}
        </h2>

        {/* Global Progress */}
        <div className="mb-10 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
          <div className="flex justify-between text-[10px] font-black mb-3 text-slate-400 uppercase tracking-widest">
            <span>{labels.ready}</span>
            <span
              className={
                globalProgress === 100 ? "text-green-500" : "text-primary"
              }
            >
              {globalProgress}%
            </span>
          </div>
          <div className="h-2.5 bg-white dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-1000 ${
                globalProgress === 100 ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>

        {/* Toggleable Add Item Section */}
        <div className="mb-10 bg-slate-50/30 dark:bg-slate-900/30 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-500">
          <div
            className={`transition-all duration-500 ease-in-out ${
              isFormOpen
                ? "max-h-0 opacity-0 pointer-events-none"
                : "max-h-20 opacity-100"
            }`}
          >
            <button
              onClick={() => setIsFormOpen(true)}
              className="w-full py-6 flex items-center justify-center gap-2 text-slate-500 hover:text-primary dark:hover:text-white transition-all font-black uppercase text-xs tracking-[0.2em]"
            >
              <Plus size={18} /> {labels.addItem}
            </button>
          </div>

          <div
            className={`transition-all duration-500 ease-in-out ${
              isFormOpen
                ? "max-h-[400px] opacity-100 p-6 sm:p-8"
                : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                {labels.addItem}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
              >
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
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {(labels as any)[c]}
                    </option>
                  ))}
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
          {categories.map((cat) => {
            const items = trip.checklist.filter((i) => i.category === cat);
            if (items.length === 0) return null;

            const catCompleted = items.filter((i) => i.isCompleted).length;
            const catProgress = Math.round((catCompleted / items.length) * 100);
            const isComplete = catProgress === 100;
            const ui = CATEGORY_UI[cat] || CATEGORY_UI.Other;
            const isExpanded = expandedCats[cat];

            return (
              <div
                key={cat}
                className={`group space-y-4 p-5 sm:p-6 rounded-[32px] border transition-all duration-500 ${
                  !isComplete
                    ? "border-red-300 dark:border-red-500 bg-red-50/20 dark:bg-red-500/[0.08] shadow-[0_0_25px_rgba(239,68,68,0.08)] dark:shadow-[0_0_45px_rgba(239,68,68,0.2)] ring-1 ring-red-500/10 dark:ring-red-500/30"
                    : "border-slate-50 dark:border-slate-700 bg-white dark:bg-slate-800"
                }`}
              >
                {/* Category Header */}
                <div
                  onClick={() => toggleExpand(cat)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${ui.bg} ${ui.text} shadow-sm transition-transform group-hover:scale-105`}
                    >
                      {React.createElement(ui.icon, { size: 20 })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                          {(labels as any)[cat]}
                        </h3>
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            isComplete
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                          }`}
                        >
                          {catProgress}%
                        </span>
                      </div>
                      {/* Sub-progress bar */}
                      <div className="mt-2 h-1.5 w-32 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ${
                            isComplete ? "bg-green-500" : "bg-red-500"
                          }`}
                          style={{ width: `${catProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expand Toggle Button */}
                  <div className="sm:hidden p-2 text-slate-300 dark:text-slate-500">
                    {isExpanded ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </div>

                {/* Items List (Responsive Accordion) */}
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-all duration-300 overflow-hidden ${
                    isExpanded
                      ? "max-h-[2000px] opacity-100 mt-4"
                      : "max-h-0 opacity-0 sm:max-h-none sm:opacity-100 sm:mt-4"
                  }`}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`group/item flex items-center justify-between p-4 rounded-2xl transition-all border ${
                        item.isCompleted
                          ? "bg-slate-50/50 dark:bg-slate-900/30 border-transparent opacity-60"
                          : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-ios hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(item.id);
                          }}
                          className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
                            item.isCompleted
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-slate-200 dark:border-slate-600 text-transparent hover:border-primary"
                          }`}
                        >
                          <Check size={16} strokeWidth={4} />
                        </button>
                        <span
                          className={`font-bold text-sm truncate ${
                            item.isCompleted
                              ? "line-through text-slate-400"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {item.text}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-item-hover:opacity-100"
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
