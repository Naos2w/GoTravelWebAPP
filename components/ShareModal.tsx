// TODO: [Refactored] Extract inline ShareModal component from App.tsx into standalone file to improve code organization
import React, { useState } from "react";
import { X as CloseIcon, Users, Clock as PendingIcon } from "lucide-react";
import { Trip, User } from "../types";
import { useTranslation } from "../contexts/LocalizationContext";

interface ShareModalProps {
  trip: Trip;
  user: User;
  onClose: () => void;
  onInvite: (email: string) => void;
  onRemoveInvite: (email: string) => void;
  copyLink: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  trip,
  user,
  onClose,
  onInvite,
  onRemoveInvite,
  copyLink,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const isOwner = trip.user_id === user.id;

  // Identify owner email to prevent duplication in list
  const ownerEmail =
    trip.collaborators?.find((c) => c.user_id === trip.user_id)?.email || "";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[32px] p-6 shadow-2xl flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {t("shareTrip")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("shareLink")}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-xs font-mono text-slate-500 truncate select-all">{`${window.location.origin}/?tripId=${trip.id}`}</div>
              <button
                onClick={copyLink}
                className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-black text-xs transition-all hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {t("copy")}
              </button>
            </div>
          </div>
          <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1" />
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("inviteEmail")}
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-primary/20 dark:text-white"
                placeholder={t("emailPlaceholder")}
              />
              <button
                disabled={!email.trim()}
                onClick={() => {
                  onInvite(email);
                  setEmail("");
                }}
                className="bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg shadow-primary/20"
              >
                {t("invite")}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {t("collaborators")}
            </label>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[9px] shadow-lg shadow-primary/20">
                  {isOwner ? "YOU" : "OWN"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {isOwner ? t("youOwner") : t("creator")}
                  </div>
                </div>
              </div>
              {trip.allowed_emails &&
                trip.allowed_emails
                  .filter((e) => {
                    const lowerE = e.toLowerCase();
                    // Exclude current user (viewer) and the owner
                    return (
                      lowerE !== user.email.toLowerCase() &&
                      lowerE !== ownerEmail.toLowerCase()
                    );
                  })
                  .map((e, i) => {
                    // Check if this email exists in trip_collaborators (meaning they joined)
                    const isJoined = trip.collaborators?.some(
                      (c) =>
                        c.email && c.email.toLowerCase() === e.toLowerCase()
                    );

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2 group hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-all"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isJoined
                              ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-500"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                          }`}
                        >
                          {isJoined ? (
                            <Users size={14} />
                          ) : (
                            <PendingIcon size={14} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                            {e}
                          </div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            {isJoined ? t("statusJoined") : t("statusPending")}
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => onRemoveInvite(e)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <CloseIcon size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
