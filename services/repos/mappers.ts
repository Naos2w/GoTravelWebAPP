import {
  Trip,
  ChecklistItem,
  Currency,
  Expense,
  ItineraryItem,
  DayPlan,
  FlightInfo,
} from "../../types";
import {
  decodeExpenseSplitMeta,
  encodeExpenseSplitMeta,
} from "../splitwiseService";

export { decodeExpenseSplitMeta, encodeExpenseSplitMeta };

/**
 * Formats a local Date instance as YYYY-MM-DD.
 */
export const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export interface DbTripRow {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  allowed_emails?: string[];
  trip_collaborators?: {
    user_id: string;
    email?: string;
    role: string;
  }[];
  flights?: {
    id: string;
    user_id: string;
    traveler_name: string;
    outbound: any;
    inbound?: any;
    price: number;
    currency: Currency;
    cabin_class: string;
    baggage: any;
    budget?: number;
  }[];
  checklist_items?: {
    id: string;
    user_id: string;
    text: string;
    is_completed: boolean;
    category: ChecklistItem["category"];
  }[];
  expenses?: {
    id: string;
    user_id: string;
    user_name: string;
    amount: string | number;
    currency: Currency;
    category: Expense["category"];
    date: string;
    note: string;
    exchange_rate: string | number;
    created_at?: string;
  }[];
  itinerary_items?: {
    id: string;
    trip_id: string;
    user_id: string;
    time: string;
    place_name: string;
    lat?: number;
    lng?: number;
    note?: string;
    type: "Place" | "Transport" | "Food";
    transport_type?: any;
    date: string;
  }[];
}

/**
 * Maps a raw `itinerary_items` database row to the frontend ItineraryItem model.
 */
export const mapDbItineraryRow = (it: any): ItineraryItem => ({
  id: it.id,
  trip_id: it.trip_id,
  user_id: it.user_id,
  time: it.time,
  placeName: it.place_name,
  lat: it.lat,
  lng: it.lng,
  note: it.note,
  type: it.type,
  transportType: it.transport_type,
  date: it.date,
});

/**
 * Maps a raw `flights` database row to the frontend FlightInfo model.
 */
export const mapDbFlightRow = (f: any): FlightInfo => ({
  id: f.id,
  user_id: f.user_id,
  traveler_name: f.traveler_name,
  outbound: f.outbound,
  inbound: f.inbound,
  price: f.price,
  currency: f.currency,
  exchangeRate:
    typeof f.baggage?.exchangeRate === "number" && f.baggage.exchangeRate > 0
      ? f.baggage.exchangeRate
      : undefined,
  cabinClass: f.cabin_class,
  baggage: f.baggage,
  budget: f.budget,
});

/**
 * Maps a raw `checklist_items` database row to the frontend ChecklistItem model.
 */
export const mapDbChecklistRow = (ci: any): ChecklistItem => ({
  id: ci.id,
  ...(ci.trip_id !== undefined ? { trip_id: ci.trip_id } : {}),
  user_id: ci.user_id,
  text: ci.text,
  isCompleted: ci.is_completed,
  category: ci.category,
});

/**
 * Maps a raw `expenses` database row to the frontend Expense model, decoding split metadata.
 */
export const mapDbExpenseRow = (ex: any): Expense => {
  const splitMeta = decodeExpenseSplitMeta(ex.note);
  return {
    id: ex.id,
    ...(ex.trip_id !== undefined ? { trip_id: ex.trip_id } : {}),
    user_id: ex.user_id,
    user_name: ex.user_name,
    amount: typeof ex.amount === "string" ? parseFloat(ex.amount) : ex.amount,
    currency: ex.currency,
    category: ex.category,
    date: ex.date,
    note: splitMeta.note,
    ...(splitMeta.paidBy ? { paidBy: splitMeta.paidBy } : {}),
    ...(splitMeta.paidByName ? { paidByName: splitMeta.paidByName } : {}),
    ...(splitMeta.splitWith ? { splitWith: splitMeta.splitWith } : {}),
    exchangeRate:
      typeof ex.exchange_rate === "string"
        ? parseFloat(ex.exchange_rate)
        : ex.exchange_rate,
    createdAt: ex.created_at,
  };
};

/**
 * Transforms a joined `trips` database row into a complete frontend Trip model.
 */
export const transformTripRow = (row: DbTripRow): Trip => {
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
      itineraryMap[it.date].push(mapDbItineraryRow(it));
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
    flights: (row.flights || []).map(mapDbFlightRow),
    checklist: (row.checklist_items || []).map(mapDbChecklistRow),
    expenses: (row.expenses || []).map(mapDbExpenseRow),
    itinerary,
  };
};

/**
 * Builds a database upsert/insert payload for an ItineraryItem.
 */
export const buildItineraryRowPayload = (
  item: ItineraryItem & { date: string },
  tripId: string,
  fallbackUserId: string
) => ({
  id: item.id,
  trip_id: tripId,
  user_id: item.user_id || fallbackUserId,
  date: item.date,
  time: item.time,
  type: item.type,
  place_name: item.placeName,
  lat: item.lat,
  lng: item.lng,
  note: item.note,
  transport_type: item.transportType,
});

/**
 * Builds a database upsert/insert payload for an Expense, encoding split metadata.
 */
export const buildExpenseRowPayload = (
  e: Expense,
  tripId: string,
  fallbackUserId: string
) => ({
  id: e.id,
  trip_id: tripId,
  user_id: e.user_id || fallbackUserId,
  user_name: e.user_name,
  amount: e.amount,
  currency: e.currency,
  category: e.category,
  date: e.date,
  note: encodeExpenseSplitMeta(e),
  exchange_rate: e.exchangeRate,
});

/**
 * Builds a database upsert/insert payload for a FlightInfo, preserving baggage.exchangeRate.
 */
export const buildFlightRowPayload = (
  f: FlightInfo,
  tripId: string,
  fallbackUserId: string
) => ({
  id: f.id,
  trip_id: tripId,
  user_id: f.user_id || fallbackUserId,
  traveler_name: f.traveler_name,
  outbound: f.outbound,
  inbound: f.inbound,
  price: f.price || 0,
  currency: f.currency,
  cabin_class: f.cabinClass,
  baggage:
    f.exchangeRate && f.exchangeRate > 0
      ? { ...(f.baggage || {}), exchangeRate: f.exchangeRate }
      : f.baggage,
  budget: f.budget || 0,
});

/**
 * Builds a database upsert/insert payload for a ChecklistItem.
 */
export const buildChecklistRowPayload = (
  c: ChecklistItem,
  tripId: string,
  fallbackUserId?: string
) => ({
  id: c.id,
  trip_id: tripId,
  user_id: fallbackUserId !== undefined ? c.user_id || fallbackUserId : c.user_id,
  text: c.text,
  category: c.category,
  is_completed: c.isCompleted || false,
});
