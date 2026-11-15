import React, { useEffect } from "react";
import { X as CloseIcon, Trash2, LogOut, Loader2 } from "lucide-react";
import { Trip } from "../types";
import { useTranslation } from "../contexts/LocalizationContext";

interface DeleteTripModalProps {
  isOpen: boolean;
  trip: Trip | null;
  currentUserId?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteTripModal: React.FC<DeleteTripModalProps> = ({
  isOpen,
  trip,
  currentUserId,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !trip) return null;

  const isOwner = trip.user_id === currentUserId;
  const title = isOwner ? t("deleteTripConfirmTitle") : t("leaveTripConfirmTitle");
  const rawDesc = isOwner ? t("deleteTripConfirmDesc") : t("leaveTripConfirmDesc");
  const description = rawDesc.replace("{name}", trip.name);
  const actionLabel = isOwner ? t("deleteTrip") : t("leaveTrip");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-trip-title"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-[#121318]/95 backdrop-blur-3xl w-full max-w-md rounded-[32px] p-6 sm:p-7 shadow-2xl border border-black/[0.08] dark:border-white/[0.14] flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isOwner
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-200/60 dark:border-rose-900/40"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200/60 dark:border-amber-900/40"
              }`}
            >
              {isOwner ? <Trash2 size={22} /> : <LogOut size={22} />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                {isOwner ? t("actionIrreversible") : t("permissionGuest")}
              </span>
              <h3
                id="delete-trip-title"
                className="text-xl font-black text-slate-900 dark:text-white"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Trip Card Mini Preview */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{trip.destination}</span>
            <span>
              {trip.startDate} – {trip.endDate}
            </span>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate">
            {trip.name}
          </div>
        </div>

        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="cancel-trip-action-btn"
            className="flex-1 px-5 py-3.5 bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer text-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isDeleting}
            data-testid="confirm-trip-action-btn"
            className={`flex-1 px-5 py-3.5 font-bold rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm ${
              isOwner
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25"
                : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25"
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t("deleting")}</span>
              </>
            ) : (
              <>
                {isOwner ? <Trash2 size={16} /> : <LogOut size={16} />}
                <span>{actionLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
