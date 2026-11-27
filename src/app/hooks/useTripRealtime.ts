import React, { useState, useEffect, useRef, MutableRefObject } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Trip, Language, User } from "../../types";
import {
  getTrips,
  getTripById,
  joinTrip,
  mapDbChecklistRow,
  mapDbItineraryRow,
  mapDbExpenseRow,
  mapDbFlightRow,
  supabase,
} from "../../shared/services/storageService";
import { translations } from "../../shared/contexts/LocalizationContext";

export type SyncStatus = "synced" | "syncing" | "offline" | "error";

export const isNavigatorOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

export interface NotificationState {
  message: string;
  type: "success" | "error" | "info";
}

export interface UseTripRealtimeOptions {
  user: User | null;
  userRef: MutableRefObject<User | null>;
  currentTripId: string | null;
  currentTripIdRef: MutableRefObject<string | null>;
  currentTrip: Trip | undefined;
  language: Language;
  creatingTripRef: MutableRefObject<boolean>;
  inFlightWritesRef: MutableRefObject<number>;
  activeTripVersionRef: MutableRefObject<number>;
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  commitTripsUpdate: (updater: (prev: Trip[]) => Trip[]) => void;
  setNotification: React.Dispatch<React.SetStateAction<NotificationState | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  navigateToList: () => void;
}

export interface UseTripRealtimeResult {
  syncStatus: SyncStatus;
  setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
  activeChannelRef: MutableRefObject<RealtimeChannel | null>;
  refreshActiveTrip: () => Promise<boolean>;
  loadTrips: () => Promise<boolean>;
  handleManualResync: () => Promise<void>;
}

/**
 * Manages Supabase Realtime subscriptions (per-trip incremental sync & global trips list),
 * browser online/offline & visibilitychange reconnect resyncs, auto-join, and sync status.
 */
export function useTripRealtime({
  user,
  userRef,
  currentTripId,
  currentTripIdRef,
  currentTrip,
  language,
  creatingTripRef,
  inFlightWritesRef,
  activeTripVersionRef,
  setTrips,
  commitTripsUpdate,
  setNotification,
  setError,
  navigateToList,
}: UseTripRealtimeOptions): UseTripRealtimeResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    isNavigatorOffline() ? "offline" : "synced"
  );

  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const latestRefreshSeqRef = useRef<number>(0);
  const latestLoadTripsSeqRef = useRef<number>(0);
  const joinLockRef = useRef<string | null>(null);
  const languageRef = useRef<Language>(language);
  languageRef.current = language;

  // Auto-join logic: ensure invited users join properly and generate checklist on first visit
  useEffect(() => {
    if (!currentTripId || !user || !currentTrip) return;
    const isOwner = currentTrip.user_id === user.id;
    const isAllowed = currentTrip.allowed_emails?.some(
      (e: string) => e.toLowerCase() === user.email.toLowerCase()
    );
    const isJoined = currentTrip.collaborators?.some(
      (c) => c.user_id === user.id
    );

    if (
      !isOwner &&
      isAllowed &&
      !isJoined &&
      joinLockRef.current !== currentTripId
    ) {
      joinLockRef.current = currentTripId;
      joinTrip(currentTripId, user.id, user.email).then(() => {
        getTripById(currentTripId).then((updated) => {
          if (!updated) return;
          setTrips((prev) => {
            const idx = prev.findIndex((t) => t.id === updated.id);
            if (idx > -1) {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            return [updated, ...prev];
          });
        });
      });
      setTimeout(() => {
        joinLockRef.current = null;
      }, 5000);
    }
  }, [currentTripId, user, currentTrip, setTrips]);

  const refreshActiveTrip = async (): Promise<boolean> => {
    const activeTripId = currentTripIdRef.current;
    const activeUser = userRef.current;
    if (!activeTripId || !activeUser) return true;
    const seq = ++latestRefreshSeqRef.current;

    try {
      const updatedTrip = await getTripById(activeTripId);
      if (seq !== latestRefreshSeqRef.current) return true;

      if (!updatedTrip) {
        setNotification({
          message:
            translations[languageRef.current].tripNotFound || "Trip not found",
          type: "error",
        });
        navigateToList();
        setTrips((prev) => prev.filter((t) => t.id !== activeTripId));
        return true;
      }

      const isOwner = updatedTrip.user_id === activeUser.id;
      const isAllowed = updatedTrip.allowed_emails?.some(
        (e: string) => e.toLowerCase() === activeUser.email.toLowerCase()
      );

      if (!isOwner && !isAllowed) {
        setNotification({
          message:
            translations[languageRef.current].revoked || "Access Revoked",
          type: "error",
        });
        setTrips((prev) => prev.filter((t) => t.id !== activeTripId));
        navigateToList();
        return true;
      }

      activeTripVersionRef.current += 1;
      commitTripsUpdate((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedTrip.id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = updatedTrip;
          return next;
        }
        return [updatedTrip, ...prev];
      });
      return true;
    } catch (e) {
      console.error("Refresh failed:", e);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      return false;
    }
  };

  const loadTrips = async (): Promise<boolean> => {
    const activeUser = userRef.current;
    if (!activeUser) return true;
    const loadSeq = ++latestLoadTripsSeqRef.current;
    const activeTripIdAtStart = currentTripIdRef.current;
    const activeTripVersionAtStart = activeTripVersionRef.current;
    try {
      const userTrips = await getTrips(activeUser.id, activeUser.email);
      if (loadSeq !== latestLoadTripsSeqRef.current) return true;
      if (creatingTripRef.current) return true;
      const uniqueTrips = Array.from(
        new globalThis.Map(userTrips.map((t) => [t.id, t])).values()
      );
      commitTripsUpdate((prev) => {
        const activeId = currentTripIdRef.current;
        const shouldPreserveActive =
          Boolean(activeId) &&
          (inFlightWritesRef.current > 0 ||
            activeId !== activeTripIdAtStart ||
            activeTripVersionRef.current !== activeTripVersionAtStart);
        const prevActiveTrip = shouldPreserveActive
          ? prev.find((t) => t.id === activeId)
          : undefined;
        return uniqueTrips.map((t) =>
          prevActiveTrip && t.id === prevActiveTrip.id ? prevActiveTrip : t
        );
      });
      setError(null);
      return true;
    } catch (err: any) {
      if (loadSeq !== latestLoadTripsSeqRef.current) return true;
      console.warn("[Storage] loadTrips caught error:", err);
      setTrips((prev) => {
        if (prev.length === 0) {
          setError(err.message || "Failed to load trips");
        }
        return prev;
      });
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      return false;
    }
  };

  const handleManualResync = async () => {
    if (isNavigatorOffline()) {
      setSyncStatus("offline");
      return;
    }
    if (!userRef.current) {
      setSyncStatus("synced");
      return;
    }

    setSyncStatus("syncing");
    try {
      const results = await Promise.all([
        currentTripIdRef.current ? refreshActiveTrip() : Promise.resolve(true),
        loadTrips(),
      ]);
      const allOk = results.every(Boolean);
      if (isNavigatorOffline()) {
        setSyncStatus("offline");
      } else if (!allOk) {
        setSyncStatus("error");
      } else if (inFlightWritesRef.current === 0) {
        setSyncStatus("synced");
      }
    } catch (err) {
      console.error("[Sync] Resync failed:", err);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
    }
  };

  const resyncAllRef = useRef<() => Promise<void>>(handleManualResync);
  resyncAllRef.current = handleManualResync;

  // Browser online/offline & tab visibility reconnect resync
  useEffect(() => {
    const handleOffline = () => setSyncStatus("offline");
    const handleOnline = () => {
      if (userRef.current) {
        resyncAllRef.current();
      } else {
        setSyncStatus("synced");
      }
    };
    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        if (isNavigatorOffline()) {
          setSyncStatus("offline");
          return;
        }
        if (userRef.current) {
          resyncAllRef.current();
        }
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userRef]);

  useEffect(() => {
    if (!currentTripId || !user) return;
    refreshActiveTrip();
  }, [currentTripId, user]);

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  // Real-time incremental sync for active trip
  useEffect(() => {
    if (!currentTripId || !user) return;

    let isDisposed = false;
    let channelHadDrop = false;

    const patchActiveTrip = (
      predicate: (target: Trip) => boolean,
      updater: (target: Trip) => Trip
    ) => {
      commitTripsUpdate((prevTrips) => {
        const target = prevTrips.find((t) => t.id === currentTripId);
        if (!target || !predicate(target)) return prevTrips;
        activeTripVersionRef.current += 1;
        return prevTrips.map((t) => (t.id === currentTripId ? updater(t) : t));
      });
    };

    const patchTripItineraryUpsert = (
      mapped: ReturnType<typeof mapDbItineraryRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const nextItinerary = (t.itinerary || []).map((day) => {
            const withoutItem = day.items.filter(
              (item) => item.id !== mapped.id
            );
            if (day.date === mapped.date) {
              const merged = [...withoutItem, mapped].sort((a, b) =>
                (a.time || "").localeCompare(b.time || "")
              );
              return { ...day, items: merged };
            }
            return withoutItem.length === day.items.length
              ? day
              : { ...day, items: withoutItem };
          });
          return { ...t, itinerary: nextItinerary };
        })
      );
    };

    const patchTripExpenseUpsert = (
      mapped: ReturnType<typeof mapDbExpenseRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const existing = t.expenses || [];
          const hasExisting = existing.some((e) => e.id === mapped.id);
          return {
            ...t,
            expenses: hasExisting
              ? existing.map((e) => (e.id === mapped.id ? mapped : e))
              : [mapped, ...existing],
          };
        })
      );
    };

    const patchTripFlightUpsert = (
      mapped: ReturnType<typeof mapDbFlightRow>
    ) => {
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prevTrips) =>
        prevTrips.map((t) => {
          if (t.id !== currentTripId) return t;
          const existing = t.flights || [];
          const hasExisting = existing.some((f) => f.id === mapped.id);
          return {
            ...t,
            flights: hasExisting
              ? existing.map((f) => (f.id === mapped.id ? mapped : f))
              : [...existing, mapped],
          };
        })
      );
    };

    const channel = supabase
      .channel(`realtime-sync-${currentTripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `id=eq.${currentTripId}`,
        },
        async () => {
          refreshActiveTrip();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            const mapped = mapDbChecklistRow(newRow);
            activeTripVersionRef.current += 1;
            commitTripsUpdate((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                if ((t.checklist || []).some((item) => item.id === mapped.id))
                  return t;
                return { ...t, checklist: [...(t.checklist || []), mapped] };
              })
            );
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            const mapped = mapDbChecklistRow(updatedRow);
            activeTripVersionRef.current += 1;
            commitTripsUpdate((prevTrips) =>
              prevTrips.map((t) => {
                if (t.id !== currentTripId) return t;
                return {
                  ...t,
                  checklist: (t.checklist || []).map((item) =>
                    item.id === mapped.id
                      ? {
                          ...item,
                          isCompleted: mapped.isCompleted,
                          text: mapped.text ?? item.text,
                          category: mapped.category ?? item.category,
                        }
                      : item
                  ),
                };
              })
            );
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "checklist_items" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) =>
              (target.checklist || []).some((item) => item.id === deletedId),
            (t) => ({
              ...t,
              checklist: (t.checklist || []).filter(
                (item) => item.id !== deletedId
              ),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id && newRow?.date) {
            patchTripItineraryUpsert(mapDbItineraryRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id && updatedRow?.date) {
            patchTripItineraryUpsert(mapDbItineraryRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "itinerary_items" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) =>
              (target.itinerary || []).some((day) =>
                day.items.some((item) => item.id === deletedId)
              ),
            (t) => ({
              ...t,
              itinerary: (t.itinerary || []).map((day) => ({
                ...day,
                items: day.items.filter((item) => item.id !== deletedId),
              })),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            patchTripExpenseUpsert(mapDbExpenseRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            patchTripExpenseUpsert(mapDbExpenseRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "expenses" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) => (target.expenses || []).some((e) => e.id === deletedId),
            (t) => ({
              ...t,
              expenses: (t.expenses || []).filter((e) => e.id !== deletedId),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.id) {
            patchTripFlightUpsert(mapDbFlightRow(newRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "flights",
          filter: `trip_id=eq.${currentTripId}`,
        },
        (payload) => {
          const updatedRow = payload.new as any;
          if (updatedRow?.id) {
            patchTripFlightUpsert(mapDbFlightRow(updatedRow));
          } else {
            refreshActiveTrip();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "flights" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) {
            refreshActiveTrip();
            return;
          }
          patchActiveTrip(
            (target) => (target.flights || []).some((f) => f.id === deletedId),
            (t) => ({
              ...t,
              flights: (t.flights || []).filter((f) => f.id !== deletedId),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_collaborators",
          filter: `trip_id=eq.${currentTripId}`,
        },
        () => refreshActiveTrip()
      )
      .on("broadcast", { event: "EXPENSE_DELETED" }, (payload) => {
        const deletedId = payload.payload?.id;
        if (deletedId) {
          patchActiveTrip(
            (target) => (target.expenses || []).some((e) => e.id === deletedId),
            (t) => ({
              ...t,
              expenses: (t.expenses || []).filter((e) => e.id !== deletedId),
            })
          );
        } else {
          refreshActiveTrip();
        }
      })
      .on("broadcast", { event: "ACCESS_REVOKED" }, (payload) => {
        if (
          payload.payload?.email?.toLowerCase() === user?.email?.toLowerCase()
        ) {
          setNotification({
            message:
              translations[languageRef.current].revoked || "Access Revoked",
            type: "error",
          });
          setTrips((prev) => prev.filter((t) => t.id !== currentTripId));
          navigateToList();
        } else {
          refreshActiveTrip();
        }
      })
      .on("broadcast", { event: "TRIP_DELETED" }, () => {
        setNotification({
          message:
            translations[languageRef.current].tripNotFound || "Trip deleted",
          type: "info",
        });
        navigateToList();
      })
      .subscribe((status) => {
        if (isDisposed) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          channelHadDrop = true;
          setSyncStatus(isNavigatorOffline() ? "offline" : "error");
        } else if (status === "CLOSED") {
          channelHadDrop = true;
        } else if (status === "SUBSCRIBED") {
          if (channelHadDrop) {
            channelHadDrop = false;
            if (!isNavigatorOffline()) {
              resyncAllRef.current();
            }
          } else if (!isNavigatorOffline() && inFlightWritesRef.current === 0) {
            setSyncStatus((prev) =>
              prev === "error" || prev === "offline" ? "synced" : prev
            );
          }
        }
      });

    activeChannelRef.current = channel;

    return () => {
      isDisposed = true;
      supabase.removeChannel(channel);
      activeChannelRef.current = null;
    };
  }, [currentTripId, user]);

  // Global subscription for new invites or removals
  useEffect(() => {
    if (!user) return;

    const refreshList = async () => {
      if (creatingTripRef.current) return;
      await loadTrips();
    };

    const channel = supabase
      .channel(`global-trips-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (payload) => {
          if (
            !currentTripId ||
            (payload.new && (payload.new as any).id !== currentTripId) ||
            payload.eventType === "INSERT"
          ) {
            refreshList();
          } else {
            refreshActiveTrip();
            refreshList();
          }
        }
      )
      .on("broadcast", { event: "ACCESS_REVOKED_GLOBAL" }, (payload) => {
        const revokedTripId = payload.payload?.tripId;
        if (revokedTripId) {
          setTrips((prev) => prev.filter((t) => t.id !== revokedTripId));
          if (currentTripId === revokedTripId) {
            setNotification({
              message:
                translations[languageRef.current].revoked || "Access Revoked",
              type: "error",
            });
            navigateToList();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTripId]);

  return {
    syncStatus,
    setSyncStatus,
    activeChannelRef,
    refreshActiveTrip,
    loadTrips,
    handleManualResync,
  };
}
