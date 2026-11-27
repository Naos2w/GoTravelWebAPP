import { Trip, ItineraryItem } from "../../../types";
import { supabase, SUPABASE_URL, isValidUUID } from "./supabaseClient";
import {
  transformTripRow,
  buildFlightRowPayload,
  buildExpenseRowPayload,
  buildChecklistRowPayload,
  encodeExpenseSplitMeta,
} from "./mappers";
import { ensureChecklistItems, upsertChecklistItems } from "./checklistRepo";
import { upsertItineraryItems } from "./itineraryRepo";

const TRIP_FULL_SELECT =
  "*, checklist_items (*), itinerary_items (*), expenses (*), flights (*), trip_collaborators (*)";

/**
 * Adds or updates a collaborator on a trip and ensures their default checklist items exist.
 */
export const joinTrip = async (
  tripId: string,
  userId: string,
  email?: string,
  role: string = "editor"
): Promise<void> => {
  // 1. Upsert collaborator status (mark as joined)
  const { error: joinError } = await supabase
    .from("trip_collaborators")
    .upsert(
      {
        trip_id: tripId,
        user_id: userId,
        role: role,
        email: email?.toLowerCase(),
      },
      { onConflict: "trip_id,user_id" }
    );

  if (joinError) {
    console.error(
      "Join error (detailed):",
      joinError.message,
      joinError.details,
      joinError.hint
    );
    // TODO: [Error Handling] Propagate database error up to the caller to display in UI
    throw joinError;
  } else {
    console.log("Join successful for user:", userId);
  }

  // 2. Ensure checklist items exist
  await ensureChecklistItems(tripId, userId);
};

/**
 * Attempts to look up a user's UUID from prior collaborations by email.
 */
export const findUserIdByEmail = async (
  email: string
): Promise<string | null> => {
  try {
    const { data } = await supabase
      .from("trip_collaborators")
      .select("user_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    return data?.user_id || null;
  } catch (e) {
    console.error("Failed to find user ID by email:", e);
    return null;
  }
};

/**
 * Removes all trip-scoped data created by a user and removes them from `trip_collaborators`.
 */
export const leaveTrip = async (
  tripId: string,
  userId: string
): Promise<void> => {
  try {
    // 1. Delete all data created by this user for this trip
    await Promise.all([
      supabase
        .from("checklist_items")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId),
      supabase
        .from("expenses")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId),
      supabase
        .from("flights")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId),
      supabase
        .from("itinerary_items")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId),
    ]);

    // 2. Finally remove the user from the collaborators table
    const { error } = await supabase
      .from("trip_collaborators")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId);
    if (error) console.error("Error removing collaborator row:", error);
  } catch (e) {
    console.error("Failed to leave trip:", e);
  }
};

/**
 * Finds a collaborator by email on a trip and cleans up their data via `leaveTrip`.
 */
export const removeCollaboratorByEmail = async (
  tripId: string,
  email: string
): Promise<string | null> => {
  try {
    // Fetch all collaborators for the trip to find the user_id
    const { data } = await supabase
      .from("trip_collaborators")
      .select("user_id, email")
      .eq("trip_id", tripId);

    const targetEmail = email.trim().toLowerCase();

    // Find if any joined user matches this email
    const match = data?.find(
      (c: any) => c.email && c.email.toLowerCase() === targetEmail
    );

    if (match && match.user_id) {
      // If found, perform full data cleanup
      await leaveTrip(tripId, match.user_id);
      return match.user_id;
    }
    // If user hasn't joined (no row in trip_collaborators), no data cleanup needed, just return null
    return null;
  } catch (e) {
    console.error("Failed to remove collaborator by email:", e);
    return null;
  }
};

/**
 * Alias for `removeCollaboratorByEmail` for domain repository callers.
 */
export const removeCollaborator = removeCollaboratorByEmail;

/**
 * Fetches all trips owned by or shared with the given user.
 */
export const getTrips = async (
  userId: string,
  userEmail?: string
): Promise<Trip[]> => {
  if (!userId || SUPABASE_URL.includes("placeholder")) return [];
  try {
    // Check if the allowed_emails array contains the user's email
    const emailFilter = userEmail
      ? `,allowed_emails.cs.{${userEmail.toLowerCase()}}`
      : "";

    const { data, error } = await supabase
      .from("trips")
      .select(TRIP_FULL_SELECT)
      .or(`user_id.eq.${userId}${emailFilter}`)
      .order("start_date", { ascending: false });

    if (error) throw error;

    return (data || []).map(transformTripRow);
  } catch (err) {
    console.error("Failed to get trips:", err);
    throw err;
  }
};

/**
 * Fetches a single trip by UUID, returning null if invalid, missing, or errored.
 */
export const getTripById = async (tripId: string): Promise<Trip | null> => {
  if (!tripId || !isValidUUID(tripId)) return null;
  try {
    const { data, error } = await supabase
      .from("trips")
      .select(TRIP_FULL_SELECT)
      .eq("id", tripId)
      .maybeSingle();

    if (error || !data) return null;
    return transformTripRow(data);
  } catch (err) {
    console.warn("[Storage] getTripById error:", err);
    return null;
  }
};

/**
 * Partially updates trip metadata fields, lowercasing `allowed_emails`.
 */
export const updateTripMeta = async (
  tripId: string,
  patch: Partial<{
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    allowed_emails: string[];
  }>
): Promise<void> => {
  const payload: Record<string, any> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.destination !== undefined) payload.destination = patch.destination;
  if (patch.startDate !== undefined) payload.start_date = patch.startDate;
  if (patch.endDate !== undefined) payload.end_date = patch.endDate;
  if (patch.allowed_emails !== undefined) {
    payload.allowed_emails = patch.allowed_emails.map((e) => e.toLowerCase());
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("trips")
    .update(payload)
    .eq("id", tripId);
  if (error) {
    console.error("Failed to update trip metadata:", error);
    throw error;
  }
};

/**
 * Upserts a trip and all of its child entities without deleting unseen remote rows.
 */
export const saveTrip = async (trip: Trip, userId: string): Promise<void> => {
  if (!userId || SUPABASE_URL.includes("placeholder"))
    throw new Error("Database configuration missing.");

  // 1. Checklist Items (Upsert First)
  if (trip.checklist && trip.checklist.length > 0) {
    await upsertChecklistItems(trip.id, userId, trip.checklist);
  }

  // 2. Itinerary Items (Upsert only — never delete DB rows unseen locally to prevent lost updates)
  if (trip.itinerary) {
    const itineraryItems: Array<ItineraryItem & { date: string }> = [];
    trip.itinerary.forEach((day) => {
      day.items.forEach((item) => {
        itineraryItems.push({ ...item, date: day.date });
      });
    });

    if (itineraryItems.length > 0) {
      await upsertItineraryItems(trip.id, userId, itineraryItems);
    }
  }

  // 3. Flights (Upsert only — deletions use deleteFlight)
  if (trip.flights && trip.flights.length > 0) {
    const flightPayloads = trip.flights.map((f) =>
      buildFlightRowPayload(f, trip.id, userId)
    );
    const { error: fErr } = await supabase.from("flights").upsert(flightPayloads);
    if (fErr) {
      console.error("Failed to upsert flights:", fErr);
      throw fErr;
    }
  }

  // 4. Expenses
  if (trip.expenses && trip.expenses.length > 0) {
    const expensePayloads = trip.expenses.map((e) =>
      buildExpenseRowPayload(e, trip.id, userId)
    );
    const { error: eErr } = await supabase
      .from("expenses")
      .upsert(expensePayloads);
    if (eErr) {
      console.error("Failed to upsert expenses:", eErr);
      throw eErr;
    }
  }

  // 5. Trip Meta (Last)
  const { error: tripError } = await supabase.from("trips").upsert({
    id: trip.id,
    user_id: trip.user_id || userId,
    name: trip.name,
    destination: trip.destination,
    start_date: trip.startDate,
    end_date: trip.endDate,
    allowed_emails: (trip.allowed_emails || []).map((e) => e.toLowerCase()),
  });

  if (tripError) throw tripError;
};

/**
 * Deletes a trip owned by the given user.
 */
export const deleteTrip = async (
  id: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

/**
 * Creates a blank in-memory Trip object with a fresh UUID.
 */
export const createNewTrip = (data: {
  destination: string;
  startDate: string;
  endDate: string;
}): Trip => {
  return {
    id: crypto.randomUUID(),
    name: data.destination,
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
    expenses: [],
    checklist: [],
    itinerary: [],
    flights: [],
    allowed_emails: [],
  };
};

/**
 * Creates a new trip parent row first (for FK/RLS ordering) and inserts all child rows.
 */
export const createFullTrip = async (
  trip: Trip,
  userId: string
): Promise<void> => {
  if (!userId || SUPABASE_URL.includes("placeholder"))
    throw new Error("Database configuration missing.");

  // 1. Save Trip Meta FIRST (Critical for Foreign Keys and RLS)
  const { error: tripError } = await supabase.from("trips").upsert({
    id: trip.id,
    user_id: trip.user_id || userId,
    name: trip.name,
    destination: trip.destination,
    start_date: trip.startDate,
    end_date: trip.endDate,
    allowed_emails: (trip.allowed_emails || []).map((e) => e.toLowerCase()),
  });

  if (tripError) throw tripError;

  // 2. Save Flights
  if (trip.flights && trip.flights.length > 0) {
    const flightPayloads = trip.flights.map((f) =>
      buildFlightRowPayload(f, trip.id, userId)
    );
    const { error: fErr } = await supabase.from("flights").insert(flightPayloads);
    if (fErr) {
      console.error("Failed to insert flights:", fErr);
      // TODO: [Error Handling] Propagate database error to UI
      throw fErr;
    }
  }

  // 3. Save Checklist
  if (trip.checklist && trip.checklist.length > 0) {
    const checkPayloads = trip.checklist.map((c) =>
      buildChecklistRowPayload(c, trip.id, userId)
    );
    const { error: cErr } = await supabase
      .from("checklist_items")
      .insert(checkPayloads);
    if (cErr) {
      console.error("Failed to insert checklist:", cErr);
      // TODO: [Error Handling] Propagate database error to UI
      throw cErr;
    }
  }

  // 4. Save Itinerary Items
  if (trip.itinerary && trip.itinerary.length > 0) {
    const itineraryPayloads: any[] = [];
    trip.itinerary.forEach((day) => {
      day.items.forEach((item) => {
        itineraryPayloads.push({
          id: item.id,
          trip_id: trip.id,
          user_id: userId,
          date: day.date,
          time: item.time,
          type: item.type,
          place_name: item.placeName,
          lat: item.lat,
          lng: item.lng,
          note: item.note,
          transport_type: item.transportType,
        });
      });
    });
    if (itineraryPayloads.length > 0) {
      const { error: iErr } = await supabase
        .from("itinerary_items")
        .insert(itineraryPayloads);
      if (iErr) {
        console.error("Failed to insert itinerary:", iErr);
        // TODO: [Error Handling] Propagate database error to UI
        throw iErr;
      }
    }
  }

  // 5. Save Expenses
  if (trip.expenses && trip.expenses.length > 0) {
    const expensePayloads = trip.expenses.map((e) => ({
      id: e.id,
      trip_id: trip.id,
      user_id: e.user_id,
      user_name: e.user_name,
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      date: e.date,
      note: encodeExpenseSplitMeta(e),
      exchange_rate: e.exchangeRate,
    }));
    const { error: eErr } = await supabase
      .from("expenses")
      .insert(expensePayloads);
    if (eErr) {
      console.error("Failed to insert expenses:", eErr);
      // TODO: [Error Handling] Propagate database error to UI
      throw eErr;
    }
  }
};
