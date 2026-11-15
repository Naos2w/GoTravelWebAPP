// TODO: [Refactored] Extract inline BudgetModal component from App.tsx into standalone file to improve code organization
import React, { useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useTranslation } from "../contexts/LocalizationContext";

interface BudgetModalProps {
  onClose: () => void;
  onSave: (val: string) => void;
  initialValue: string;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  onClose,
  onSave,
  initialValue,
}) => {
  const { t } = useTranslation();
  const [val, setVal] = useState(initialValue);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-[#121318]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.14] w-full max-w-sm rounded-[32px] p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black dark:text-white">
            {t("editBudget")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-full"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            {t("amount")} (TWD)
          </label>
          <input
            autoFocus
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/[0.05] p-5 rounded-2xl text-2xl font-black outline-none border-2 border-slate-100 dark:border-white/[0.08] focus:border-primary/20 dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onSave(val)}
            className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            {t("save")}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-4 bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.12] rounded-2xl font-black"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};
