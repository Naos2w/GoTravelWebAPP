import { createClient } from "@supabase/supabase-js";
import {
  Trip,
  ChecklistItem,
  Currency,
  Expense,
  ItineraryItem,
  DayPlan,
  FlightInfo,
  Collaborator,
} from "../types";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder-project.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "placeholder-key";

// Casting to any to avoid TypeScript errors when using Supabase v2 auth methods
export const supabase: any = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const isValidUUID = (id: string) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const transformTripRow = (row: any): Trip => {
  const start = new Date(row.start_date + "T00:00:00");
  const end = new Date(row.end_date + "T00:00:00");
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const itinerary: DayPlan[] = [];
  const itineraryMap: Record<string, ItineraryItem[]> = {};

  for (let i = 0; i < diffDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + i);
    const dateKey = formatDateStr(currentDate);
    itineraryMap[dateKey] = [];
  }

  (row.itinerary_items || []).forEach((it: any) => {
    if (itineraryMap[it.date]) {
      itineraryMap[it.date].push({
        id: it.id,
        trip_id: it.trip_id,
        user_id: it.user_id,
        time: it.time,
        placeName: it.place_name,
        note: it.note,
        type: it.type,
        transportType: it.transport_type,
        date: it.date,
      });
    }
  });

  Object.entries(itineraryMap).forEach(([date, items]) => {
    itinerary.push({
      date,
      items: items.sort((a, b) => a.time.localeCompare(b.time)),
    });
  });

  itinerary.sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    allowed_emails: (row.allowed_emails || []).map((e: string) =>
      e.toLowerCase()
    ),
    collaborators: (row.trip_collaborators || []).map((c: any) => ({
      user_id: c.user_id,
      email: c.email || "",
      role: c.role,
    })),
    flights: (row.flights || []).map((f: any) => ({
      id: f.id,
      user_id: f.user_id,
      traveler_name: f.traveler_name,
      outbound: f.outbound,
      inbound: f.inbound,
      price: f.price,
      currency: f.currency,
      cabinClass: f.cabin_class,
      baggage: f.baggage,
      budget: f.budget,
    })),
    checklist: (row.checklist_items || []).map((ci: any) => ({
      id: ci.id,
      user_id: ci.user_id,
      text: ci.text,
      isCompleted: ci.is_completed,
      category: ci.category,
    })),
    expenses: (row.expenses || []).map((ex: any) => ({
      id: ex.id,
      user_id: ex.user_id,
      user_name: ex.user_name,
      amount: parseFloat(ex.amount),
      currency: ex.currency,
      category: ex.category,
      date: ex.date,
      note: ex.note,
      exchangeRate: parseFloat(ex.exchange_rate),
      createdAt: ex.created_at,
    })),
    itinerary,
  };
};

export const joinTrip = async (
  tripId: string,
  userId: string,
  email?: string,
  role: string = "editor"
): Promise<void> => {
  try {
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
       console.error("Join error (detailed):", joinError.message, joinError.details, joinError.hint);
    } else {
       console.log("Join successful for user:", userId);
    }

    // 2. Ensure checklist items exist
    await ensureChecklistItems(tripId, userId);
  } catch (e) {
    console.error("Failed to join trip correctly:", e);
  }
};

export const ensureChecklistItems = async (
  tripId: string,
  userId: string
): Promise<void> => {
  try {
    // Check if this user already has checklist items for this trip
    const { count, error: countError } = await supabase
      .from("checklist_items")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("user_id", userId);

    // If no items found, insert defaults specifically for this user
    if (!countError && (count === null || count === 0)) {
      const defaultItems = [
        { text: "Passport & Visa", category: "Documents" },
        { text: "Phone Charger", category: "Gear" },
        { text: "Clothes", category: "Clothing" },
        { text: "Toothbrush", category: "Toiletries" },
        { text: "Cash / Credit Cards", category: "Other" },
      ];

      const payload = defaultItems.map((item) => ({
        // id: crypto.randomUUID(), // Let DB default gen_random_uuid() handle it to be safe, or generate new one
        trip_id: tripId,
        user_id: userId,
        text: item.text,
        category: item.category,
        is_completed: false,
      }));

      const { error: insertError } = await supabase
        .from("checklist_items")
        .insert(payload);
      if (insertError)
        console.error("Auto checklist init failed:", insertError);
    }
  } catch (err) {
    console.error("Error ensuring checklist items:", err);
  }
};

export const findUserIdByEmail = async (email: string): Promise<string | null> => {
  try {
    // Attempt to find a user_id from previous collaborations.
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

export const leaveTrip = async (
  tripId: string,
  userId: string
): Promise<void> => {
  try {
    // 1. Delete all data created by this user for this trip
    // Using Promise.all for parallel deletion
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
      .select(
        `*, checklist_items (*), itinerary_items (*), expenses (*), flights (*), trip_collaborators (*)`
      )
      .or(`user_id.eq.${userId}${emailFilter}`)
      .order("start_date", { ascending: false });

    if (error) throw error;

    const trips = (data || []).map(transformTripRow);

    return trips;
  } catch (err) {
    console.error("Failed to get trips:", err);
    throw err;
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  if (!tripId || !isValidUUID(tripId)) return null;
  try {
    const { data, error } = await supabase
      .from("trips")
      .select(
        `*, checklist_items (*), itinerary_items (*), expenses (*), flights (*), trip_collaborators (*)`
      )
      .eq("id", tripId)
      .maybeSingle();

    if (error || !data) return null;
    return transformTripRow(data);
  } catch (err) {
    return null;
  }
};

export const saveExpenseOnly = async (
  tripId: string,
  expense: Expense
): Promise<void> => {
  const payload = {
    id: isValidUUID(expense.id) ? expense.id : crypto.randomUUID(),
    trip_id: tripId,
    user_id: expense.user_id,
    user_name: expense.user_name,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    note: expense.note,
    exchange_rate: expense.exchangeRate,
  };

  const { error } = await supabase.from("expenses").upsert(payload);
  if (error) throw error;
};

export const saveTrip = async (trip: Trip, userId: string): Promise<void> => {
  if (!userId || SUPABASE_URL.includes("placeholder"))
    throw new Error("Database configuration missing.");

  // 1. Checklist Items (Upsert First)
  if (trip.checklist && trip.checklist.length > 0) {
    const checkPayloads = trip.checklist.map((c) => ({
      id: c.id,
      trip_id: trip.id,
      user_id: c.user_id || userId,
      text: c.text,
      category: c.category,
      is_completed: c.isCompleted || false,
    }));
    const { error: cErr } = await supabase
      .from("checklist_items")
      .upsert(checkPayloads);
    if (cErr) console.error("Failed to upsert checklist:", cErr);
  }

  // 2. Itinerary Items
  if (trip.itinerary && trip.itinerary.length > 0) {
    const itineraryPayloads: any[] = [];
    trip.itinerary.forEach((day) => {
      day.items.forEach((item) => {
        itineraryPayloads.push({
          id: item.id,
          trip_id: trip.id,
          user_id: item.user_id || userId,
          date: day.date,
          time: item.time,
          type: item.type,
          place_name: item.placeName,
          note: item.note,
          transport_type: item.transportType,
        });
      });
    });
    if (itineraryPayloads.length > 0) {
      const { error: iErr } = await supabase.from("itinerary_items").upsert(itineraryPayloads);
      if (iErr) console.error("Failed to upsert itinerary:", iErr);
    }
  }

  // 3. Flights
  if (trip.flights && trip.flights.length > 0) {
    const flightPayloads = trip.flights.map((f) => ({
      id: f.id,
      trip_id: trip.id,
      user_id: f.user_id || userId,
      traveler_name: f.traveler_name,
      outbound: f.outbound,
      inbound: f.inbound,
      price: f.price || 0,
      currency: f.currency,
      cabin_class: f.cabinClass,
      baggage: f.baggage,
      budget: f.budget || 0,
    }));
    const { error: fErr } = await supabase.from("flights").upsert(flightPayloads);
    if (fErr) console.error("Failed to upsert flights:", fErr);
  }

  // 4. Expenses
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
      note: e.note,
      exchange_rate: e.exchangeRate,
    }));
    const { error: eErr } = await supabase.from("expenses").upsert(expensePayloads);
    if (eErr) console.error("Failed to upsert expenses:", eErr);
  }

  // 4. Trip Meta (Last)
  // Updating this last ensures that if the 'trips' update triggers a refetch in the client,
  // the child data above has likely already been committed.
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

export const deleteExpense = async (id: string, tripId: string): Promise<void> => {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) throw error;
};

export const deleteChecklistItem = async (id: string, tripId: string): Promise<void> => {
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) throw error;
};

export const deleteTrip = async (id: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

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

export const createFullTrip = async (trip: Trip, userId: string): Promise<void> => {
  if (!userId || SUPABASE_URL.includes("placeholder"))
    throw new Error("Database configuration missing.");

  // 1. Save Trip Meta FIRST (Critical for Foreign Keys and RLS)
  // We manually upsert here to guarantee the parent exists before children
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
    const flightPayloads = trip.flights.map((f) => ({
      id: f.id,
      trip_id: trip.id,
      user_id: f.user_id || userId,
      traveler_name: f.traveler_name,
      outbound: f.outbound,
      inbound: f.inbound,
      price: f.price || 0,
      currency: f.currency,
      cabin_class: f.cabinClass,
      baggage: f.baggage,
      budget: f.budget || 0,
    }));
    const { error: fErr } = await supabase.from("flights").insert(flightPayloads);
    if (fErr) console.error("Failed to insert flights:", fErr);
  }

  // 3. Save Checklist
  if (trip.checklist && trip.checklist.length > 0) {
    const checkPayloads = trip.checklist.map((c) => ({
      id: c.id,
      trip_id: trip.id,
      user_id: c.user_id || userId,
      text: c.text,
      category: c.category,
      is_completed: c.isCompleted || false,
    }));
    const { error: cErr } = await supabase
      .from("checklist_items")
      .insert(checkPayloads);
    if (cErr) console.error("Failed to insert checklist:", cErr);
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
          note: item.note,
          transport_type: item.transportType,
        });
      });
    });
    if (itineraryPayloads.length > 0) {
      const { error: iErr } = await supabase.from("itinerary_items").insert(itineraryPayloads);
      if (iErr) console.error("Failed to insert itinerary:", iErr);
    }
  }

  // 5. Save Expenses (Handling new additions if any)
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
      note: e.note,
      exchange_rate: e.exchangeRate,
    }));
    const { error: eErr } = await supabase.from("expenses").insert(expensePayloads);
    if (eErr) console.error("Failed to insert expenses:", eErr);
  }
};
