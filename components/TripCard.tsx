import React from "react";
import {
  Calendar,
  MapPin,
  Users,
  Trash2,
  LogOut,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Trip } from "../types";
import { useTranslation } from "../contexts/LocalizationContext";

interface TripCardProps {
  trip: Trip;
  currentUserId?: string;
  isEditMode?: boolean;
  onSelect: (tripId: string) => void;
  onDeleteClick: (trip: Trip) => void;
  calculateTripTotal: (trip: Trip) => number;
  getGradient: (str: string) => string;
}

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const getTripTiming = (startDateStr: string, endDateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseLocalDate(startDateStr);
  start.setHours(0, 0, 0, 0);

  const end = parseLocalDate(endDateStr || startDateStr);
  end.setHours(0, 0, 0, 0);

  const endEndOfDay = new Date(end);
  endEndOfDay.setHours(23, 59, 59, 999);

  const msPerDay = 1000 * 60 * 60 * 24;
  const startDiffDays = Math.round((start.getTime() - today.getTime()) / msPerDay);
  const durationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);

  if (today >= start && today <= endEndOfDay) {
    return { status: "ongoing" as const, daysUntilStart: 0, durationDays };
  } else if (today < start) {
    return {
      status: "upcoming" as const,
      daysUntilStart: Math.max(0, startDiffDays),
      durationDays,
    };
  } else {
    return { status: "past" as const, daysUntilStart: 0, durationDays };
  }
};

export const getTripCollaboratorCount = (trip: Trip): number => {
  const allEmails = new Set<string>();
  if (trip.allowed_emails && Array.isArray(trip.allowed_emails)) {
    trip.allowed_emails.forEach((e) => {
      if (e) allEmails.add(e.toLowerCase().trim());
    });
  }
  if (trip.collaborators && Array.isArray(trip.collaborators)) {
    trip.collaborators.forEach((c) => {
      if (c?.email) allEmails.add(c.email.toLowerCase().trim());
    });
  }
  return Math.max(1, allEmails.size);
};

export const getTripPlacesCount = (trip: Trip): number => {
  if (!trip.itinerary || !Array.isArray(trip.itinerary)) return 0;
  return trip.itinerary.reduce((total, day) => {
    const items = day.items || [];
    return total + items.filter((item) => item.type !== "Transport").length;
  }, 0);
};

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  currentUserId,
  isEditMode = false,
  onSelect,
  onDeleteClick,
  calculateTripTotal,
  getGradient,
}) => {
  const { t } = useTranslation();
  const isOwner = trip.user_id === currentUserId;
  const timing = getTripTiming(trip.startDate, trip.endDate);
  const placesCount = getTripPlacesCount(trip);
  const collaboratorCount = getTripCollaboratorCount(trip);
  const totalCost = calculateTripTotal(trip);

  const renderStatusBadge = () => {
    if (timing.status === "ongoing") {
      return (
        <span className="backdrop-blur-md bg-emerald-500/90 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {t("statusOngoing")}
        </span>
      );
    }
    if (timing.status === "upcoming") {
      return (
        <span className="backdrop-blur-md bg-black/40 text-white border border-white/20 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm">
          <Clock size={12} />
          {timing.daysUntilStart === 0
            ? t("statusToday")
            : `${timing.daysUntilStart} ${t("statusUpcomingIn")}`}
        </span>
      );
    }
    return (
      <span className="backdrop-blur-md bg-black/35 text-white/80 border border-white/10 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-sm">
        {t("statusPast")}
      </span>
    );
  };

  return (
    <div
      onClick={() => {
        if (isEditMode) {
          onDeleteClick(trip);
        } else {
          onSelect(trip.id);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isEditMode) {
            onDeleteClick(trip);
          } else {
            onSelect(trip.id);
          }
        }
      }}
      className={`group relative ios27-card rounded-[32px] border ${
        isEditMode
          ? "border-rose-400/60 dark:border-rose-500/50 ring-2 ring-rose-500/20"
          : "border-slate-200/70 dark:border-white/12"
      } shadow-ios overflow-hidden cursor-pointer transition-all duration-300 ease-spring hover:-translate-y-1.5 hover:shadow-ios-lg active:scale-[0.99] flex flex-col justify-between`}
    >
      {/* Top Banner with Gradient */}
      <div
        className={`h-52 relative overflow-hidden bg-gradient-to-br ${getGradient(
          trip.destination
        )} p-6 flex flex-col justify-between transition-transform duration-500`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />

        {/* Top Badges & Delete/Leave Button */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {renderStatusBadge()}
            {isOwner ? (
              <span className="backdrop-blur-md bg-white/20 text-white border border-white/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                {t("permissionEditor")}
              </span>
            ) : (
              <span className="backdrop-blur-md bg-amber-500/30 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                {t("permissionGuest")}
              </span>
            )}
          </div>

          {isEditMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(trip);
              }}
              title={isOwner ? t("deleteTrip") : t("leaveTrip")}
              aria-label={isOwner ? t("deleteTrip") : t("leaveTrip")}
              data-testid={isOwner ? "trip-delete-btn" : "trip-leave-btn"}
              className={`w-9 h-9 rounded-full ${
                isOwner
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/40"
                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/40"
              } flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer animate-in zoom-in-75 fade-in ring-2 ring-white/90 dark:ring-[#060709]`}
            >
              {isOwner ? <Trash2 size={16} /> : <LogOut size={16} />}
            </button>
          )}
        </div>

        {/* Bottom Destination & Trip Info */}
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-1 text-white/90 text-xs font-semibold drop-shadow-sm">
            <MapPin size={13} className="shrink-0 text-white/90" />
            <span className="truncate">{trip.destination}</span>
          </div>
          <h3 className="text-white text-2xl font-black tracking-tight truncate drop-shadow-sm">
            {trip.name}
          </h3>
          <p className="text-white/80 text-[11px] font-medium tracking-wide flex items-center gap-1.5 pt-0.5">
            <Calendar size={12} className="shrink-0" />
            <span>
              {trip.startDate} – {trip.endDate} • {timing.durationDays} {t("daysCount")}
            </span>
          </p>
        </div>
      </div>

      {/* Bottom Info Shelf */}
      <div className="px-6 py-4 bg-slate-50/80 dark:bg-white/[0.03] flex items-center justify-between border-t border-slate-100 dark:border-white/[0.08]">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t("totalCost")}
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            NT$ {totalCost.toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {placesCount > 0 && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-slate-400" />
                {placesCount} {t("placesCount")}
              </span>
            )}
            {collaboratorCount > 1 && (
              <span className="flex items-center gap-1">
                <Users size={13} className="text-slate-400" />
                {collaboratorCount}
              </span>
            )}
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-slate-400 dark:text-slate-200 group-hover:text-primary group-hover:bg-primary/10 group-hover:translate-x-0.5 transition-all">
            <ArrowRight size={15} />
          </div>
        </div>
      </div>
    </div>
  );
};
