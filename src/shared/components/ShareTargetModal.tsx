import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Check,
  Clock,
  FolderKanban,
  Link2,
  MapPin,
  Utensils,
  X,
} from "lucide-react";
import { ItineraryItem, Trip } from "../../types";
import { useTranslation } from "../contexts/LocalizationContext";
import { InfoTip } from "./InfoTip";
import { deriveSharedPlaceName } from "../services/pwaService";
import { resolveLocationInput } from "../../features/itinerary/services/mapUrlService";

export interface ShareTargetModalProps {
  isOpen: boolean;
  initialTitle?: string;
  initialText?: string;
  initialUrl?: string;
  trips: Trip[];
  defaultTripId?: string | null;
  currentUserId?: string;
  onSave: (updatedTrip: Trip, savedItem: ItineraryItem) => void;
  onClose: () => void;
}

const formatShortDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
};

const getTodayDateStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const ShareTargetModal: React.FC<ShareTargetModalProps> = ({
  isOpen,
  initialTitle = "",
  initialText = "",
  initialUrl = "",
  trips,
  defaultTripId,
  currentUserId,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const parsedLocation = useMemo(
    () => (initialUrl ? resolveLocationInput(initialUrl) : null),
    [initialUrl]
  );

  const computedInitialName = useMemo(
    () => deriveSharedPlaceName(initialTitle, initialText, initialUrl),
    [initialTitle, initialText, initialUrl]
  );

  const [placeName, setPlaceName] = useState<string>(computedInitialName);
  const [placeType, setPlaceType] = useState<"Place" | "Food">("Place");
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    if (defaultTripId && trips.some((tr) => tr.id === defaultTripId)) {
      return defaultTripId;
    }
    return trips[0]?.id || "";
  });
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [time, setTime] = useState<string>("12:00");
  const [nameError, setNameError] = useState<boolean>(false);

  // Sync defaults when modal opens or payload changes
  useEffect(() => {
    if (!isOpen) return;
    setPlaceName(computedInitialName);
    setNameError(false);
    setPlaceType("Place");
    setTime("12:00");
  }, [isOpen, computedInitialName]);

  // Keep selectedTripId valid when trips load asynchronously
  useEffect(() => {
    if (!isOpen) return;
    if (selectedTripId && trips.some((tr) => tr.id === selectedTripId)) {
      return;
    }
    if (defaultTripId && trips.some((tr) => tr.id === defaultTripId)) {
      setSelectedTripId(defaultTripId);
    } else if (trips.length > 0) {
      setSelectedTripId(trips[0].id);
    }
  }, [isOpen, trips, defaultTripId, selectedTripId]);

  const selectedTrip = useMemo(
    () => trips.find((tr) => tr.id === selectedTripId) || trips[0] || null,
    [trips, selectedTripId]
  );

  // Pick today's day index if within selected trip, else Day 1
  useEffect(() => {
    if (!selectedTrip) {
      setSelectedDayIdx(0);
      return;
    }
    const today = getTodayDateStr();
    const todayIdx = (selectedTrip.itinerary || []).findIndex(
      (day) => day.date === today
    );
    setSelectedDayIdx(todayIdx >= 0 ? todayIdx : 0);
  }, [selectedTrip?.id]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const itinerary = selectedTrip?.itinerary || [];
  const safeDayIdx =
    itinerary.length > 0 ? Math.min(selectedDayIdx, itinerary.length - 1) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = placeName.trim();
    if (!trimmedName) {
      setNameError(true);
      return;
    }
    if (!selectedTrip) return;

    const cleanUrl = (initialUrl || "").trim();
    const targetDate =
      itinerary[safeDayIdx]?.date || selectedTrip.startDate || getTodayDateStr();

    const newItem: ItineraryItem = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trip_id: selectedTrip.id,
      user_id: currentUserId,
      date: targetDate,
      time: time || "12:00",
      placeName: trimmedName,
      type: placeType,
      ...(parsedLocation
        ? { lat: parsedLocation.lat, lng: parsedLocation.lng }
        : {}),
      ...(cleanUrl ? { googleMapsUrl: cleanUrl, note: cleanUrl } : {}),
    };

    const existingDays = selectedTrip.itinerary || [];
    const hasDay = existingDays.some((day) => day.date === targetDate);
    const updatedItinerary = hasDay
      ? existingDays.map((day) =>
          day.date === targetDate
            ? {
                ...day,
                items: [...day.items, newItem].sort((a, b) =>
                  (a.time || "").localeCompare(b.time || "")
                ),
              }
            : day
        )
      : [...existingDays, { date: targetDate, items: [newItem] }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );

    const updatedTrip: Trip = {
      ...selectedTrip,
      itinerary: updatedItinerary,
    };

    onSave(updatedTrip, newItem);
  };

  const modalContent = (
    <div
      data-testid="share-target-backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-[#F5F6F8]/90 dark:bg-[#0B0D11]/85 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-target-title"
        data-testid="share-target-modal"
        className="w-full sm:max-w-md bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Mobile grabber */}
          <div className="w-12 h-1.5 rounded-full bg-[#68707D]/30 dark:bg-white/20 mx-auto sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-ns-green/12 text-ns-green border border-ns-green/20 flex items-center justify-center shrink-0">
                <MapPin size={20} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  id="share-target-title"
                  className="text-base font-black text-[#1A1D23] dark:text-[#ECEFF4] tracking-tight truncate"
                >
                  {t("pwaShareTitle")}
                </h3>
                <InfoTip
                  text={t("pwaShareTip")}
                  align="left"
                  testId="infotip-share-target"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("pwaClose")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#68707D] dark:text-[#8B93A1] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.06] dark:border-white/[0.10] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {trips.length === 0 ? (
            <div
              data-testid="share-target-empty-trips"
              className="p-4 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] text-xs font-semibold text-[#68707D] dark:text-[#8B93A1] leading-relaxed"
            >
              {t("pwaShareNoTrips")}
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Place Name Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="share-place-name"
                  className="block text-[11px] font-black text-[#68707D] dark:text-[#8B93A1] uppercase tracking-wider"
                >
                  {t("pwaSharePlaceName")}
                </label>
                <input
                  id="share-place-name"
                  data-testid="share-place-name-input"
                  type="text"
                  value={placeName}
                  onChange={(e) => {
                    setPlaceName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  placeholder={t("pwaSharePlacePlaceholder")}
                  className={`w-full h-11 px-3.5 rounded-xl bg-[#F0F2F5]/90 dark:bg-[#1B1F2A] border text-sm font-bold text-[#1A1D23] dark:text-[#ECEFF4] placeholder:text-[#68707D]/60 focus:outline-none focus:ring-2 focus:ring-ns-blue/40 transition-all ${
                    nameError
                      ? "border-ns-red"
                      : "border-black/[0.08] dark:border-white/[0.10]"
                  }`}
                />
                {nameError && (
                  <p className="text-[11px] font-bold text-ns-red">
                    {t("pwaSharePlaceRequired")}
                  </p>
                )}
              </div>

              {/* Shared URL Preview Pill */}
              {initialUrl && (
                <div
                  data-testid="share-url-preview"
                  className="px-3 py-2 rounded-xl bg-ns-green/10 dark:bg-ns-green/12 border border-ns-green/20 flex items-center gap-2 min-w-0"
                >
                  <Link2 size={14} className="text-ns-green shrink-0" />
                  <span className="text-[11px] font-mono font-semibold text-[#1A1D23] dark:text-[#ECEFF4] truncate flex-1 min-w-0">
                    {initialUrl}
                  </span>
                </div>
              )}

              {/* Target Trip Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="share-trip-select"
                  className="flex items-center gap-1.5 text-[11px] font-black text-[#68707D] dark:text-[#8B93A1] uppercase tracking-wider"
                >
                  <FolderKanban size={12} className="shrink-0" />
                  <span>{t("pwaShareSelectTrip")}</span>
                </label>
                <select
                  id="share-trip-select"
                  data-testid="share-trip-select"
                  value={selectedTrip?.id || ""}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F0F2F5]/90 dark:bg-[#1B1F2A] border border-black/[0.08] dark:border-white/[0.10] text-sm font-bold text-[#1A1D23] dark:text-[#ECEFF4] focus:outline-none focus:ring-2 focus:ring-ns-blue/40 cursor-pointer"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Day Pills */}
              {itinerary.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#68707D] dark:text-[#8B93A1] uppercase tracking-wider">
                    <Calendar size={12} className="shrink-0" />
                    <span>{t("pwaShareSelectDay")}</span>
                  </div>
                  <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-1.5 py-0.5">
                    {itinerary.map((day, idx) => {
                      const isPicked = safeDayIdx === idx;
                      return (
                        <button
                          key={day.date || idx}
                          type="button"
                          data-testid={`share-day-pill-${idx}`}
                          onClick={() => setSelectedDayIdx(idx)}
                          className={`h-8 px-3 rounded-full text-xs font-bold tabular-nums whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer border ${
                            isPicked
                              ? "bg-[#1A1D23] dark:bg-[#ECEFF4] text-white dark:text-[#0B0D11] border-transparent shadow-sm"
                              : "bg-[#F0F2F5] dark:bg-white/[0.06] text-[#68707D] dark:text-[#8B93A1] border-black/[0.08] dark:border-white/[0.10]"
                          }`}
                        >
                          Day {idx + 1}
                          {day.date ? ` · ${formatShortDate(day.date)}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category + Time Row (Mobile-Safe grid-cols-1 sm:grid-cols-2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-black text-[#68707D] dark:text-[#8B93A1] uppercase tracking-wider">
                    {t("pwaShareCategory")}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="share-type-place"
                      onClick={() => setPlaceType("Place")}
                      className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        placeType === "Place"
                          ? "bg-ns-blue/12 text-ns-blue border-ns-blue/30"
                          : "bg-[#F0F2F5]/85 dark:bg-[#1B1F2A] text-[#68707D] dark:text-[#8B93A1] border-black/[0.06] dark:border-white/[0.08]"
                      }`}
                    >
                      <MapPin size={14} className="shrink-0" />
                      <span>{t("typePlace")}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="share-type-food"
                      onClick={() => setPlaceType("Food")}
                      className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        placeType === "Food"
                          ? "bg-ns-amber/12 text-ns-amber border-ns-amber/30"
                          : "bg-[#F0F2F5]/85 dark:bg-[#1B1F2A] text-[#68707D] dark:text-[#8B93A1] border-black/[0.06] dark:border-white/[0.08]"
                      }`}
                    >
                      <Utensils size={14} className="shrink-0" />
                      <span>{t("typeFood")}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="share-time-input"
                    className="flex items-center gap-1.5 text-[11px] font-black text-[#68707D] dark:text-[#8B93A1] uppercase tracking-wider"
                  >
                    <Clock size={12} className="shrink-0" />
                    <span>{t("pwaShareTime")}</span>
                  </label>
                  <input
                    id="share-time-input"
                    data-testid="share-time-input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F0F2F5]/90 dark:bg-[#1B1F2A] border border-black/[0.08] dark:border-white/[0.10] text-xs font-mono font-bold tabular-nums text-[#1A1D23] dark:text-[#ECEFF4] focus:outline-none focus:ring-2 focus:ring-ns-blue/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 px-4 rounded-2xl bg-[#F0F2F5] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/[0.10] text-[#1A1D23] dark:text-[#ECEFF4] text-xs font-black whitespace-nowrap shrink-0 active:scale-[0.98] transition-all cursor-pointer"
            >
              {t("cancel")}
            </button>
            {trips.length > 0 && (
              <button
                type="submit"
                data-testid="share-target-save-btn"
                className="flex-1 h-11 px-4 rounded-2xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Check size={15} className="shrink-0" />
                <span>{t("pwaShareSaveBtn")}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
};
