import { createClient } from "@supabase/supabase-js";
import {
  Trip,
  ChecklistItem,
  Currency,
  Expense,
  ItineraryItem,
  DayPlan,
} from "../types";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder-project.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    coverImage: row.cover_image,
    flight: row.flight,
    checklist: (row.checklist_items || []).map((ci: any) => ({
      id: ci.id,
      text: ci.text,
      isCompleted: ci.is_completed,
      category: ci.category,
    })),
    expenses: (row.expenses || []).map((ex: any) => ({
      id: ex.id,
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

export const getTrips = async (userId: string): Promise<Trip[]> => {
  if (!userId || SUPABASE_URL.includes("placeholder")) return [];
  try {
    const { data: tripsData, error } = await supabase
      .from("trips")
      .select(`*, checklist_items (*), itinerary_items (*), expenses (*)`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (tripsData || []).map(transformTripRow);
  } catch (err) {
    console.error("Failed to get trips:", err);
    return [];
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  if (!tripId || !isValidUUID(tripId)) return null;
  try {
    const { data, error } = await supabase
      .from("trips")
      .select(`*, checklist_items (*), itinerary_items (*), expenses (*)`)
      .eq("id", tripId)
      .maybeSingle(); // 使用 maybeSingle 避免 406 錯誤

    if (error || !data) return null;
    return transformTripRow(data);
  } catch (err) {
    return null;
  }
};

/**
 * 僅供協作者儲存支出項目
 */
export const saveExpenseOnly = async (
  tripId: string,
  expense: Expense
): Promise<void> => {
  const payload = {
    id: isValidUUID(expense.id) ? expense.id : crypto.randomUUID(),
    trip_id: tripId,
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

  const { error: tripError } = await supabase.from("trips").upsert({
    id: trip.id,
    user_id: trip.user_id || userId,
    name: trip.name,
    destination: trip.destination,
    start_date: trip.startDate,
    end_date: trip.endDate,
    cover_image: trip.coverImage,
    flight: trip.flight,
  });

  if (tripError) throw tripError;

  await supabase.from("checklist_items").delete().eq("trip_id", trip.id);
  if (trip.checklist && trip.checklist.length > 0) {
    const checklistPayload = trip.checklist.map((ci) => ({
      id: isValidUUID(ci.id) ? ci.id : crypto.randomUUID(),
      trip_id: trip.id,
      text: ci.text,
      is_completed: ci.isCompleted,
      category: ci.category,
    }));
    await supabase.from("checklist_items").insert(checklistPayload);
  }

  await supabase.from("expenses").delete().eq("trip_id", trip.id);
  if (trip.expenses && trip.expenses.length > 0) {
    const expensesPayload = trip.expenses.map((ex) => ({
      id: isValidUUID(ex.id) ? ex.id : crypto.randomUUID(),
      trip_id: trip.id,
      amount: ex.amount,
      currency: ex.currency,
      category: ex.category,
      date: ex.date,
      note: ex.note,
      exchange_rate: ex.exchangeRate,
    }));
    await supabase.from("expenses").insert(expensesPayload);
  }

  await supabase.from("itinerary_items").delete().eq("trip_id", trip.id);
  const itineraryPayload: any[] = [];
  if (trip.itinerary) {
    trip.itinerary.forEach((day) => {
      day.items.forEach((item) => {
        itineraryPayload.push({
          id: isValidUUID(item.id) ? item.id : crypto.randomUUID(),
          trip_id: trip.id,
          date: day.date,
          time: item.time,
          place_name: item.placeName,
          note: item.note,
          type: item.type,
          transport_type: item.transportType,
        });
      });
    });
  }
  if (itineraryPayload.length > 0) {
    await supabase.from("itinerary_items").insert(itineraryPayload);
  }
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
    coverImage: `https://images.unsplash.com/photo-1436491865332-7a61a109c0f3?auto=format&fit=crop&q=80&w=800`,
    expenses: [],
    checklist: [],
    itinerary: [],
  };
};

export const exportData = (trips: Trip[]) => {
  const blob = new Blob([JSON.stringify(trips)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `go-travel-backup-${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();
};
