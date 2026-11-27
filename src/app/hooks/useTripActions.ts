import React, { useState, useRef, MutableRefObject } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  Trip,
  FlightInfo,
  Language,
  User,
  ChecklistItem,
} from "../../types";
import {
  deleteTrip,
  joinTrip,
  leaveTrip,
  removeCollaboratorByEmail,
  ensureChecklistItems,
  createFullTrip,
  deleteExpense,
  deleteItineraryItem,
  deleteFlight,
  deleteChecklistItem,
  updateChecklistItem,
  addChecklistItem,
  upsertItineraryItems,
  upsertExpense,
  upsertFlight,
  upsertChecklistItems,
  updateTripMeta,
  findUserIdByEmail,
  supabase,
} from "../../shared/services/storageService";
import {
  diffTripChanges,
  applyTripDelta,
  revertTripDelta,
  createEmptyTripDelta,
  TripDelta,
} from "../../features/trips/services/tripDiffService";
import { translations } from "../../shared/contexts/LocalizationContext";
import {
  SyncStatus,
  NotificationState,
  isNavigatorOffline,
} from "./useTripRealtime";

export interface UseTripActionsOptions {
  user: User | null;
  currentTrip: Trip | undefined;
  currentTripId: string | null;
  tripsRef: MutableRefObject<Trip[]>;
  language: Language;
  t: (key: keyof typeof translations.en) => string;
  creatingTripRef: MutableRefObject<boolean>;
  inFlightWritesRef: MutableRefObject<number>;
  activeTripVersionRef: MutableRefObject<number>;
  activeChannelRef: MutableRefObject<RealtimeChannel | null>;
  tripToDelete: Trip | null;
  setTripToDelete: React.Dispatch<React.SetStateAction<Trip | null>>;
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  commitTripsUpdate: (updater: (prev: Trip[]) => Trip[]) => void;
  setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
  setNotification: React.Dispatch<React.SetStateAction<NotificationState | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditingBudget: React.Dispatch<React.SetStateAction<boolean>>;
  navigateToTrip: (tripId: string) => void;
  navigateToList: () => void;
  onTripCreatedWithFlight: (firstFlight: FlightInfo) => void;
  onTripCreatedWithoutFlight: () => void;
}

export interface UseTripActionsResult {
  isDeletingTrip: boolean;
  updateCurrentTrip: (updatedTrip: Trip, action?: string, payload?: any) => void;
  handleInvite: (email: string) => Promise<void>;
  handleRemoveInvite: (email: string) => Promise<void>;
  handleCreateTripSubmit: (tripData: Trip) => Promise<void>;
  handleConfirmDeleteTrip: () => Promise<void>;
  handleSaveBudget: (val: string) => void;
}

/**
 * Encapsulates all granular Trip CRUD mutations, optimistic delta application + surgical rollback,
 * collaborator invites/revocation, trip creation/deletion, and budget updates.
 */
export function useTripActions({
  user,
  currentTrip,
  currentTripId,
  tripsRef,
  language,
  t,
  creatingTripRef,
  inFlightWritesRef,
  activeTripVersionRef,
  activeChannelRef,
  tripToDelete,
  setTripToDelete,
  setTrips,
  commitTripsUpdate,
  setSyncStatus,
  setNotification,
  setError,
  setShowCreateForm,
  setIsEditingBudget,
  navigateToTrip,
  navigateToList,
  onTripCreatedWithFlight,
  onTripCreatedWithoutFlight,
}: UseTripActionsOptions): UseTripActionsResult {
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const updateCurrentTrip = (
    updatedTrip: Trip,
    action?: string,
    payload?: any
  ) => {
    if (!user) return;

    if (action === "SHOW_ERROR_TOAST") {
      setNotification({
        message:
          typeof payload === "string"
            ? payload
            : translations[language].errorTitle || "Error occurred",
        type: "error",
      });
      return;
    }

    const previousTrip = tripsRef.current.find((t) => t.id === updatedTrip.id);
    if (!previousTrip) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    let effectiveDelta: TripDelta;
    if (action === "DELETE_EXPENSE" && payload) {
      effectiveDelta = {
        ...createEmptyTripDelta(),
        deletedExpenseIds: [payload],
        hasChanges: true,
      };
    } else if (action === "DELETE_ITINERARY_ITEM" && payload) {
      const ids: string[] = Array.isArray(payload) ? payload : [payload];
      const itineraryOnlyDiff = diffTripChanges(previousTrip, {
        ...previousTrip,
        itinerary: updatedTrip.itinerary,
      });
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedItinerary: itineraryOnlyDiff.addedOrUpdatedItinerary,
        deletedItineraryIds: ids,
        hasChanges:
          ids.length > 0 || itineraryOnlyDiff.addedOrUpdatedItinerary.length > 0,
      };
    } else if (action === "UPDATE_CHECKLIST_ITEM" && payload) {
      const existingItem = (previousTrip.checklist || []).find(
        (c) => c.id === payload.id
      );
      const updatedChecklistItem: ChecklistItem | undefined = existingItem
        ? { ...existingItem, isCompleted: payload.isCompleted }
        : (updatedTrip.checklist || []).find((c) => c.id === payload.id);
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedChecklist: updatedChecklistItem
          ? [updatedChecklistItem]
          : [],
        hasChanges: Boolean(updatedChecklistItem),
      };
    } else if (action === "ADD_CHECKLIST_ITEM" && payload) {
      const items: ChecklistItem[] = Array.isArray(payload)
        ? payload
        : [payload];
      if (items.length === 0) return;
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedChecklist: items,
        hasChanges: true,
      };
    } else if (action === "DELETE_CHECKLIST_ITEM" && payload) {
      effectiveDelta = {
        ...createEmptyTripDelta(),
        deletedChecklistIds: [payload],
        hasChanges: true,
      };
    } else if (
      action === "ADD_ITINERARY_ITEM" ||
      action === "UPDATE_ITINERARY_ITEM" ||
      action === "SAVE_ITINERARY_ITEM"
    ) {
      const itineraryOnlyDiff = diffTripChanges(previousTrip, {
        ...previousTrip,
        itinerary: updatedTrip.itinerary,
      });
      effectiveDelta = {
        ...createEmptyTripDelta(),
        addedOrUpdatedItinerary: itineraryOnlyDiff.addedOrUpdatedItinerary,
        hasChanges: itineraryOnlyDiff.addedOrUpdatedItinerary.length > 0,
      };
    } else {
      effectiveDelta = diffTripChanges(previousTrip, updatedTrip);
    }

    if (!effectiveDelta.hasChanges) return;

    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) =>
        t.id === updatedTrip.id ? applyTripDelta(t, effectiveDelta) : t
      )
    );

    const runGranularWrite = (
      writeFn: () => Promise<void>,
      fallbackErrorMessage: string
    ) => {
      inFlightWritesRef.current += 1;
      if (!isNavigatorOffline()) setSyncStatus("syncing");
      writeFn()
        .then(() => {
          inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
          if (inFlightWritesRef.current === 0) {
            setSyncStatus(isNavigatorOffline() ? "offline" : "synced");
          }
        })
        .catch((err) => {
          inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
          console.error("[App] Granular write failed:", err);
          activeTripVersionRef.current += 1;
          commitTripsUpdate((prev) =>
            prev.map((t) =>
              t.id === updatedTrip.id
                ? revertTripDelta(t, previousTrip, effectiveDelta)
                : t
            )
          );
          setSyncStatus(isNavigatorOffline() ? "offline" : "error");
          setNotification({
            message: translations[language].errorTitle || fallbackErrorMessage,
            type: "error",
          });
        });
    };

    if (action === "DELETE_EXPENSE" && payload) {
      runGranularWrite(async () => {
        await deleteExpense(payload, updatedTrip.id);
        activeChannelRef.current?.send({
          type: "broadcast",
          event: "EXPENSE_DELETED",
          payload: { id: payload },
        });
      }, "Sync error: Failed to delete expense");
      return;
    }

    if (action === "DELETE_ITINERARY_ITEM" && payload) {
      runGranularWrite(async () => {
        const tasks: Promise<void>[] = effectiveDelta.deletedItineraryIds.map(
          (id) => deleteItineraryItem(id, updatedTrip.id)
        );
        if (effectiveDelta.addedOrUpdatedItinerary.length > 0) {
          tasks.push(
            upsertItineraryItems(
              updatedTrip.id,
              user.id,
              effectiveDelta.addedOrUpdatedItinerary
            )
          );
        }
        await Promise.all(tasks);
      }, "Sync error: Failed to delete itinerary items");
      return;
    }

    if (action === "UPDATE_CHECKLIST_ITEM" && payload) {
      runGranularWrite(
        () =>
          updateChecklistItem(payload.id, updatedTrip.id, {
            isCompleted: payload.isCompleted,
          }),
        "Sync error: Failed to update checklist item"
      );
      return;
    }

    if (action === "ADD_CHECKLIST_ITEM" && payload) {
      const items = effectiveDelta.addedOrUpdatedChecklist;
      runGranularWrite(async () => {
        await Promise.all(
          items.map((item) => addChecklistItem(item, updatedTrip.id))
        );
      }, "Sync error: Failed to add checklist item");
      return;
    }

    if (action === "DELETE_CHECKLIST_ITEM" && payload) {
      runGranularWrite(
        () => deleteChecklistItem(payload, updatedTrip.id),
        "Sync error: Failed to delete checklist item"
      );
      return;
    }

    runGranularWrite(async () => {
      const tasks: Promise<void>[] = [];
      if (effectiveDelta.addedOrUpdatedItinerary.length > 0) {
        tasks.push(
          upsertItineraryItems(
            updatedTrip.id,
            user.id,
            effectiveDelta.addedOrUpdatedItinerary
          )
        );
      }
      for (const id of effectiveDelta.deletedItineraryIds) {
        tasks.push(deleteItineraryItem(id, updatedTrip.id));
      }
      for (const expense of effectiveDelta.addedOrUpdatedExpenses) {
        tasks.push(upsertExpense(updatedTrip.id, user.id, expense));
      }
      for (const id of effectiveDelta.deletedExpenseIds) {
        tasks.push(deleteExpense(id, updatedTrip.id));
      }
      for (const flight of effectiveDelta.addedOrUpdatedFlights) {
        tasks.push(upsertFlight(updatedTrip.id, user.id, flight));
      }
      for (const id of effectiveDelta.deletedFlightIds) {
        tasks.push(deleteFlight(id, updatedTrip.id));
      }
      if (effectiveDelta.addedOrUpdatedChecklist.length > 0) {
        tasks.push(
          upsertChecklistItems(
            updatedTrip.id,
            user.id,
            effectiveDelta.addedOrUpdatedChecklist
          )
        );
      }
      for (const id of effectiveDelta.deletedChecklistIds) {
        tasks.push(deleteChecklistItem(id, updatedTrip.id));
      }
      if (effectiveDelta.tripMetaChanged) {
        tasks.push(updateTripMeta(updatedTrip.id, effectiveDelta.tripMetaPatch));
      }
      await Promise.all(tasks);
    }, "Sync error: Failed to save changes");
  };

  const handleInvite = async (email: string) => {
    if (!currentTrip || !user) return;
    const targetTripId = currentTrip.id;
    const emailLower = email.toLowerCase();
    const currentAllowed = currentTrip.allowed_emails || [];
    if (currentAllowed.some((e) => e.toLowerCase() === emailLower)) return;

    const newAllowed = [...currentAllowed, emailLower];
    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) => {
        if (t.id !== targetTripId) return t;
        const existing = (t.allowed_emails || []).map((e) => e.toLowerCase());
        if (existing.includes(emailLower)) return t;
        return { ...t, allowed_emails: [...existing, emailLower] };
      })
    );

    inFlightWritesRef.current += 1;
    try {
      if (!isNavigatorOffline()) setSyncStatus("syncing");
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

      const inviteeUserId = await findUserIdByEmail(emailLower);
      if (inviteeUserId) {
        await ensureChecklistItems(targetTripId, inviteeUserId);
      }
      await updateTripMeta(targetTripId, { allowed_emails: newAllowed });

      inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
      if (inFlightWritesRef.current === 0) {
        setSyncStatus(isNavigatorOffline() ? "offline" : "synced");
      }
    } catch (e) {
      inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
      console.error("Invite failed", e);
      setSyncStatus(isNavigatorOffline() ? "offline" : "error");
      setNotification({
        message: translations[language].errorTitle || "Invite failed",
        type: "error",
      });
      activeTripVersionRef.current += 1;
      commitTripsUpdate((prev) =>
        prev.map((t) =>
          t.id !== targetTripId
            ? t
            : {
                ...t,
                allowed_emails: (t.allowed_emails || []).filter(
                  (addr) => addr.toLowerCase() !== emailLower
                ),
              }
        )
      );
    }
  };

  const handleRemoveInvite = async (email: string) => {
    if (!currentTrip || !currentTrip.allowed_emails) return;
    const targetTripId = currentTrip.id;
    const emailLower = email.toLowerCase();
    inFlightWritesRef.current += 1;
    if (!isNavigatorOffline()) setSyncStatus("syncing");

    let removedUserId: string | null | undefined =
      currentTrip.collaborators?.find(
        (c) => c.email && c.email.toLowerCase() === emailLower
      )?.user_id;

    if (removedUserId) {
      await leaveTrip(targetTripId, removedUserId);
    } else {
      removedUserId = await removeCollaboratorByEmail(targetTripId, emailLower);
    }

    const latestAllowed =
      tripsRef.current.find((t) => t.id === targetTripId)?.allowed_emails ||
      currentTrip.allowed_emails;
    const newAllowedEmails = latestAllowed.filter(
      (e) => e.toLowerCase() !== emailLower
    );

    let hadError = false;
    try {
      await updateTripMeta(targetTripId, { allowed_emails: newAllowedEmails });
      activeChannelRef.current?.send({
        type: "broadcast",
        event: "ACCESS_REVOKED",
        payload: { email: emailLower },
      });
      if (removedUserId) {
        supabase.channel(`global-trips-${removedUserId}`).send({
          type: "broadcast",
          event: "ACCESS_REVOKED_GLOBAL",
          payload: { tripId: targetTripId },
        });
      }
    } catch (e) {
      hadError = true;
      console.error("Failed to update allowed list", e);
    }

    activeTripVersionRef.current += 1;
    commitTripsUpdate((prev) =>
      prev.map((t) => {
        if (t.id !== targetTripId) return t;
        const patched: Trip = {
          ...t,
          allowed_emails: (t.allowed_emails || []).filter(
            (e) => e.toLowerCase() !== emailLower
          ),
        };
        if (removedUserId) {
          patched.collaborators = (t.collaborators || []).filter(
            (c) => c.user_id !== removedUserId
          );
          patched.checklist = (t.checklist || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.expenses = (t.expenses || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.flights = (t.flights || []).filter(
            (i) => i.user_id !== removedUserId
          );
          patched.itinerary = (t.itinerary || []).map((day) => ({
            ...day,
            items: day.items.filter((item) => item.user_id !== removedUserId),
          }));
        }
        return patched;
      })
    );

    inFlightWritesRef.current = Math.max(0, inFlightWritesRef.current - 1);
    if (isNavigatorOffline()) {
      setSyncStatus("offline");
    } else if (hadError) {
      setSyncStatus("error");
    } else if (inFlightWritesRef.current === 0) {
      setSyncStatus("synced");
    }
  };

  const handleCreateTripSubmit = async (tripData: Trip) => {
    if (!user || creatingTripRef.current) return;
    creatingTripRef.current = true;
    try {
      const enrichedTrip = {
        ...tripData,
        user_id: user.id,
        flights: tripData.flights.map((f) => ({
          ...f,
          user_id: user.id,
          traveler_name: user.name,
        })),
        allowed_emails: [user.email.toLowerCase()],
      };

      await createFullTrip(enrichedTrip, user.id);
      await joinTrip(enrichedTrip.id, user.id, user.email, "owner");

      setTrips((prev) => [
        enrichedTrip,
        ...prev.filter((t) => t.id !== enrichedTrip.id),
      ]);
      navigateToTrip(enrichedTrip.id);
      setShowCreateForm(false);

      if (enrichedTrip.flights.length > 0) {
        onTripCreatedWithFlight(enrichedTrip.flights[0]);
      } else {
        onTripCreatedWithoutFlight();
      }
    } catch {
      setError("Failed to create trip.");
    } finally {
      creatingTripRef.current = false;
    }
  };

  const handleConfirmDeleteTrip = async () => {
    const targetTrip = tripToDelete || currentTrip;
    if (!user || !targetTrip) return;
    const isOwner = targetTrip.user_id === user.id;
    setIsDeletingTrip(true);
    try {
      if (isOwner) {
        activeChannelRef.current?.send({
          type: "broadcast",
          event: "TRIP_DELETED",
          payload: { id: targetTrip.id },
        });
        await deleteTrip(targetTrip.id, user.id);
        setNotification({ message: t("tripDeletedSuccess"), type: "info" });
      } else {
        await leaveTrip(targetTrip.id, user.id);
        setNotification({ message: t("tripLeaveSuccess"), type: "info" });
      }

      setTrips((prev) => prev.filter((t) => t.id !== targetTrip.id));
      if (currentTripId === targetTrip.id) {
        navigateToList();
      }
      setTripToDelete(null);
    } catch {
      setNotification({
        message: isOwner ? t("deleteFailed") : t("leaveFailed"),
        type: "error",
      });
    } finally {
      setIsDeletingTrip(false);
    }
  };

  const handleSaveBudget = (val: string) => {
    if (!currentTrip) return;
    const newBudget = parseInt(val);
    if (isNaN(newBudget)) return;
    const newFlights = [...currentTrip.flights];
    if (newFlights.length > 0) {
      newFlights[0] = { ...newFlights[0], budget: newBudget };
      updateCurrentTrip({ ...currentTrip, flights: newFlights });
    } else {
      updateCurrentTrip({ ...currentTrip, budget: newBudget });
    }
    setIsEditingBudget(false);
  };

  return {
    isDeletingTrip,
    updateCurrentTrip,
    handleInvite,
    handleRemoveInvite,
    handleCreateTripSubmit,
    handleConfirmDeleteTrip,
    handleSaveBudget,
  };
}
