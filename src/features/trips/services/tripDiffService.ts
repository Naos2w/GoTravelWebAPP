import {
  ChecklistItem,
  Expense,
  FlightInfo,
  ItineraryItem,
  Trip,
} from "../../../types";
import { encodeExpenseSplitMeta } from "../../expenses/services/splitwiseService";

export interface TripMetaPatch {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  allowed_emails?: string[];
}

export interface TripDelta {
  addedOrUpdatedItinerary: Array<ItineraryItem & { date: string }>;
  deletedItineraryIds: string[];
  addedOrUpdatedExpenses: Expense[];
  deletedExpenseIds: string[];
  addedOrUpdatedFlights: FlightInfo[];
  deletedFlightIds: string[];
  addedOrUpdatedChecklist: ChecklistItem[];
  deletedChecklistIds: string[];
  tripMetaChanged: boolean;
  tripMetaPatch: TripMetaPatch;
  hasChanges: boolean;
}

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).filter((k) => aObj[k] !== undefined);
  const bKeys = Object.keys(bObj).filter((k) => bObj[k] !== undefined);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
};

const isItineraryItemEqual = (
  a: ItineraryItem & { date: string },
  b: ItineraryItem & { date: string }
): boolean => {
  return (
    a.id === b.id &&
    a.date === b.date &&
    a.time === b.time &&
    a.type === b.type &&
    a.placeName === b.placeName &&
    (a.user_id ?? null) === (b.user_id ?? null) &&
    (a.lat ?? null) === (b.lat ?? null) &&
    (a.lng ?? null) === (b.lng ?? null) &&
    (a.note ?? "") === (b.note ?? "") &&
    (a.googleMapsUrl ?? "") === (b.googleMapsUrl ?? "") &&
    (a.transportType ?? null) === (b.transportType ?? null)
  );
};

const isExpenseEqual = (a: Expense, b: Expense): boolean => {
  return (
    a.id === b.id &&
    (a.user_id ?? null) === (b.user_id ?? null) &&
    (a.user_name ?? null) === (b.user_name ?? null) &&
    Object.is(a.amount, b.amount) &&
    a.currency === b.currency &&
    a.category === b.category &&
    a.date === b.date &&
    Object.is(a.exchangeRate, b.exchangeRate) &&
    encodeExpenseSplitMeta(a) === encodeExpenseSplitMeta(b)
  );
};

const isFlightEqual = (a: FlightInfo, b: FlightInfo): boolean => {
  return (
    a.id === b.id &&
    (a.user_id ?? null) === (b.user_id ?? null) &&
    a.traveler_name === b.traveler_name &&
    Object.is(a.price || 0, b.price || 0) &&
    a.currency === b.currency &&
    (a.exchangeRate ?? null) === (b.exchangeRate ?? null) &&
    a.cabinClass === b.cabinClass &&
    Object.is(a.budget || 0, b.budget || 0) &&
    deepEqual(a.outbound, b.outbound) &&
    deepEqual(a.inbound ?? null, b.inbound ?? null) &&
    deepEqual(a.baggage ?? null, b.baggage ?? null)
  );
};

const isChecklistItemEqual = (a: ChecklistItem, b: ChecklistItem): boolean => {
  return (
    a.id === b.id &&
    (a.user_id ?? null) === (b.user_id ?? null) &&
    a.text === b.text &&
    Boolean(a.isCompleted) === Boolean(b.isCompleted) &&
    a.category === b.category
  );
};

const normalizeEmails = (emails?: string[]): string[] =>
  (emails || []).map((e) => e.toLowerCase());

/**
 * Computes the exact row-level delta between `prevTrip` and `nextTrip` so that
 * mutations only upsert/delete rows that actually changed locally and never
 * clobber rows concurrently added or edited by collaborators in Supabase.
 */
export const diffTripChanges = (prevTrip: Trip, nextTrip: Trip): TripDelta => {
  // 1. Itinerary items (flattened across days with canonical day.date)
  const prevItineraryMap = new Map<string, ItineraryItem & { date: string }>();
  for (const day of prevTrip.itinerary || []) {
    for (const item of day.items || []) {
      prevItineraryMap.set(item.id, { ...item, date: day.date });
    }
  }

  const nextItineraryMap = new Map<string, ItineraryItem & { date: string }>();
  for (const day of nextTrip.itinerary || []) {
    for (const item of day.items || []) {
      nextItineraryMap.set(item.id, { ...item, date: day.date });
    }
  }

  const addedOrUpdatedItinerary: Array<ItineraryItem & { date: string }> = [];
  for (const [id, nextItem] of nextItineraryMap.entries()) {
    const prevItem = prevItineraryMap.get(id);
    if (!prevItem || !isItineraryItemEqual(prevItem, nextItem)) {
      addedOrUpdatedItinerary.push(nextItem);
    }
  }

  const deletedItineraryIds: string[] = [];
  for (const id of prevItineraryMap.keys()) {
    if (!nextItineraryMap.has(id)) {
      deletedItineraryIds.push(id);
    }
  }

  // 2. Expenses
  const prevExpenseMap = new Map<string, Expense>();
  for (const exp of prevTrip.expenses || []) {
    prevExpenseMap.set(exp.id, exp);
  }
  const nextExpenseMap = new Map<string, Expense>();
  for (const exp of nextTrip.expenses || []) {
    nextExpenseMap.set(exp.id, exp);
  }

  const addedOrUpdatedExpenses: Expense[] = [];
  for (const [id, nextExp] of nextExpenseMap.entries()) {
    const prevExp = prevExpenseMap.get(id);
    if (!prevExp || !isExpenseEqual(prevExp, nextExp)) {
      addedOrUpdatedExpenses.push(nextExp);
    }
  }

  const deletedExpenseIds: string[] = [];
  for (const id of prevExpenseMap.keys()) {
    if (!nextExpenseMap.has(id)) {
      deletedExpenseIds.push(id);
    }
  }

  // 3. Flights
  const prevFlightMap = new Map<string, FlightInfo>();
  for (const f of prevTrip.flights || []) {
    prevFlightMap.set(f.id, f);
  }
  const nextFlightMap = new Map<string, FlightInfo>();
  for (const f of nextTrip.flights || []) {
    nextFlightMap.set(f.id, f);
  }

  const addedOrUpdatedFlights: FlightInfo[] = [];
  for (const [id, nextFlight] of nextFlightMap.entries()) {
    const prevFlight = prevFlightMap.get(id);
    if (!prevFlight || !isFlightEqual(prevFlight, nextFlight)) {
      addedOrUpdatedFlights.push(nextFlight);
    }
  }

  const deletedFlightIds: string[] = [];
  for (const id of prevFlightMap.keys()) {
    if (!nextFlightMap.has(id)) {
      deletedFlightIds.push(id);
    }
  }

  // 4. Checklist
  const prevChecklistMap = new Map<string, ChecklistItem>();
  for (const ci of prevTrip.checklist || []) {
    prevChecklistMap.set(ci.id, ci);
  }
  const nextChecklistMap = new Map<string, ChecklistItem>();
  for (const ci of nextTrip.checklist || []) {
    nextChecklistMap.set(ci.id, ci);
  }

  const addedOrUpdatedChecklist: ChecklistItem[] = [];
  for (const [id, nextItem] of nextChecklistMap.entries()) {
    const prevItem = prevChecklistMap.get(id);
    if (!prevItem || !isChecklistItemEqual(prevItem, nextItem)) {
      addedOrUpdatedChecklist.push(nextItem);
    }
  }

  const deletedChecklistIds: string[] = [];
  for (const id of prevChecklistMap.keys()) {
    if (!nextChecklistMap.has(id)) {
      deletedChecklistIds.push(id);
    }
  }

  // 5. Trip metadata
  const tripMetaPatch: TripMetaPatch = {};
  if (prevTrip.name !== nextTrip.name) {
    tripMetaPatch.name = nextTrip.name;
  }
  if (prevTrip.destination !== nextTrip.destination) {
    tripMetaPatch.destination = nextTrip.destination;
  }
  if (prevTrip.startDate !== nextTrip.startDate) {
    tripMetaPatch.startDate = nextTrip.startDate;
  }
  if (prevTrip.endDate !== nextTrip.endDate) {
    tripMetaPatch.endDate = nextTrip.endDate;
  }
  const prevEmails = normalizeEmails(prevTrip.allowed_emails);
  const nextEmails = normalizeEmails(nextTrip.allowed_emails);
  if (!deepEqual(prevEmails, nextEmails)) {
    tripMetaPatch.allowed_emails = nextEmails;
  }

  const tripMetaChanged = Object.keys(tripMetaPatch).length > 0;
  const hasChanges =
    addedOrUpdatedItinerary.length > 0 ||
    deletedItineraryIds.length > 0 ||
    addedOrUpdatedExpenses.length > 0 ||
    deletedExpenseIds.length > 0 ||
    addedOrUpdatedFlights.length > 0 ||
    deletedFlightIds.length > 0 ||
    addedOrUpdatedChecklist.length > 0 ||
    deletedChecklistIds.length > 0 ||
    tripMetaChanged;

  return {
    addedOrUpdatedItinerary,
    deletedItineraryIds,
    addedOrUpdatedExpenses,
    deletedExpenseIds,
    addedOrUpdatedFlights,
    deletedFlightIds,
    addedOrUpdatedChecklist,
    deletedChecklistIds,
    tripMetaChanged,
    tripMetaPatch,
    hasChanges,
  };
};

export const createEmptyTripDelta = (): TripDelta => ({
  addedOrUpdatedItinerary: [],
  deletedItineraryIds: [],
  addedOrUpdatedExpenses: [],
  deletedExpenseIds: [],
  addedOrUpdatedFlights: [],
  deletedFlightIds: [],
  addedOrUpdatedChecklist: [],
  deletedChecklistIds: [],
  tripMetaChanged: false,
  tripMetaPatch: {},
  hasChanges: false,
});

const sortDayItems = (items: ItineraryItem[]): ItineraryItem[] =>
  [...items].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

/**
 * Applies only the rows/fields present in `delta` onto `baseTrip`, preserving
 * all untouched rows and slices (e.g. concurrent Realtime insertions).
 */
export const applyTripDelta = (baseTrip: Trip, delta: TripDelta): Trip => {
  let itinerary = baseTrip.itinerary || [];
  if (
    delta.deletedItineraryIds.length > 0 ||
    delta.addedOrUpdatedItinerary.length > 0
  ) {
    const deleteIds = new Set(delta.deletedItineraryIds);
    const upsertIds = new Set(delta.addedOrUpdatedItinerary.map((i) => i.id));

    itinerary = itinerary.map((day) => {
      const remaining = day.items.filter(
        (item) => !deleteIds.has(item.id) && !upsertIds.has(item.id)
      );
      const additions = delta.addedOrUpdatedItinerary.filter(
        (item) => item.date === day.date
      );
      if (additions.length === 0 && remaining.length === day.items.length) {
        return day;
      }
      return {
        ...day,
        items: sortDayItems([...remaining, ...additions]),
      };
    });
  }

  let expenses = baseTrip.expenses || [];
  if (
    delta.deletedExpenseIds.length > 0 ||
    delta.addedOrUpdatedExpenses.length > 0
  ) {
    const deleteIds = new Set(delta.deletedExpenseIds);
    const upsertMap = new Map(delta.addedOrUpdatedExpenses.map((e) => [e.id, e]));
    const updatedExistingIds = new Set<string>();

    const nextExpenses = expenses
      .filter((e) => !deleteIds.has(e.id))
      .map((e) => {
        const replacement = upsertMap.get(e.id);
        if (replacement) {
          updatedExistingIds.add(e.id);
          return replacement;
        }
        return e;
      });
    const newAdditions = delta.addedOrUpdatedExpenses.filter(
      (e) => !updatedExistingIds.has(e.id)
    );
    expenses = [...newAdditions, ...nextExpenses];
  }

  let flights = baseTrip.flights || [];
  if (
    delta.deletedFlightIds.length > 0 ||
    delta.addedOrUpdatedFlights.length > 0
  ) {
    const deleteIds = new Set(delta.deletedFlightIds);
    const upsertMap = new Map(delta.addedOrUpdatedFlights.map((f) => [f.id, f]));
    const updatedExistingIds = new Set<string>();

    const nextFlights = flights
      .filter((f) => !deleteIds.has(f.id))
      .map((f) => {
        const replacement = upsertMap.get(f.id);
        if (replacement) {
          updatedExistingIds.add(f.id);
          return replacement;
        }
        return f;
      });
    const newAdditions = delta.addedOrUpdatedFlights.filter(
      (f) => !updatedExistingIds.has(f.id)
    );
    flights = [...nextFlights, ...newAdditions];
  }

  let checklist = baseTrip.checklist || [];
  if (
    delta.deletedChecklistIds.length > 0 ||
    delta.addedOrUpdatedChecklist.length > 0
  ) {
    const deleteIds = new Set(delta.deletedChecklistIds);
    const upsertMap = new Map(delta.addedOrUpdatedChecklist.map((c) => [c.id, c]));
    const updatedExistingIds = new Set<string>();

    const nextChecklist = checklist
      .filter((c) => !deleteIds.has(c.id))
      .map((c) => {
        const replacement = upsertMap.get(c.id);
        if (replacement) {
          updatedExistingIds.add(c.id);
          return replacement;
        }
        return c;
      });
    const newAdditions = delta.addedOrUpdatedChecklist.filter(
      (c) => !updatedExistingIds.has(c.id)
    );
    checklist = [...nextChecklist, ...newAdditions];
  }

  return {
    ...baseTrip,
    ...(delta.tripMetaPatch.name !== undefined ? { name: delta.tripMetaPatch.name } : {}),
    ...(delta.tripMetaPatch.destination !== undefined
      ? { destination: delta.tripMetaPatch.destination }
      : {}),
    ...(delta.tripMetaPatch.startDate !== undefined
      ? { startDate: delta.tripMetaPatch.startDate }
      : {}),
    ...(delta.tripMetaPatch.endDate !== undefined
      ? { endDate: delta.tripMetaPatch.endDate }
      : {}),
    ...(delta.tripMetaPatch.allowed_emails !== undefined
      ? { allowed_emails: delta.tripMetaPatch.allowed_emails }
      : {}),
    itinerary,
    expenses,
    flights,
    checklist,
  };
};

/**
 * Surgically rolls back ONLY the rows/fields touched by `delta` back to their
 * `previousTrip` state, preserving any concurrent Realtime inserts/updates or
 * other committed local writes present in `currentTrip`.
 */
export const revertTripDelta = (
  currentTrip: Trip,
  previousTrip: Trip,
  delta: TripDelta
): Trip => {
  // 1. Itinerary surgical revert
  let itinerary = currentTrip.itinerary || [];
  if (
    delta.addedOrUpdatedItinerary.length > 0 ||
    delta.deletedItineraryIds.length > 0
  ) {
    const prevItineraryMap = new Map<string, ItineraryItem & { date: string }>();
    for (const day of previousTrip.itinerary || []) {
      for (const item of day.items || []) {
        prevItineraryMap.set(item.id, { ...item, date: day.date });
      }
    }

    const touchedIds = new Set<string>([
      ...delta.addedOrUpdatedItinerary.map((i) => i.id),
      ...delta.deletedItineraryIds,
    ]);

    const itemsToRestore: Array<ItineraryItem & { date: string }> = [];
    for (const id of touchedIds) {
      const prevItem = prevItineraryMap.get(id);
      if (prevItem) {
        itemsToRestore.push(prevItem);
      }
    }

    itinerary = itinerary.map((day) => {
      const withoutTouched = day.items.filter((item) => !touchedIds.has(item.id));
      const restoredForDay = itemsToRestore.filter((item) => item.date === day.date);
      if (
        restoredForDay.length === 0 &&
        withoutTouched.length === day.items.length
      ) {
        return day;
      }
      return {
        ...day,
        items: sortDayItems([...withoutTouched, ...restoredForDay]),
      };
    });
  }

  // 2. Expenses surgical revert
  let expenses = currentTrip.expenses || [];
  if (
    delta.addedOrUpdatedExpenses.length > 0 ||
    delta.deletedExpenseIds.length > 0
  ) {
    const prevMap = new Map((previousTrip.expenses || []).map((e) => [e.id, e]));
    const addedOrUpdatedIds = new Set(delta.addedOrUpdatedExpenses.map((e) => e.id));

    const nextExpenses: Expense[] = [];
    for (const exp of expenses) {
      if (addedOrUpdatedIds.has(exp.id)) {
        const prevExp = prevMap.get(exp.id);
        if (prevExp) nextExpenses.push(prevExp);
        // If not in prevMap, it was newly added -> drop on rollback
      } else {
        nextExpenses.push(exp);
      }
    }
    const existingIds = new Set(nextExpenses.map((e) => e.id));
    for (const delId of delta.deletedExpenseIds) {
      const prevExp = prevMap.get(delId);
      if (prevExp && !existingIds.has(delId)) {
        nextExpenses.unshift(prevExp);
        existingIds.add(delId);
      }
    }
    expenses = nextExpenses;
  }

  // 3. Flights surgical revert
  let flights = currentTrip.flights || [];
  if (
    delta.addedOrUpdatedFlights.length > 0 ||
    delta.deletedFlightIds.length > 0
  ) {
    const prevMap = new Map((previousTrip.flights || []).map((f) => [f.id, f]));
    const addedOrUpdatedIds = new Set(delta.addedOrUpdatedFlights.map((f) => f.id));

    const nextFlights: FlightInfo[] = [];
    for (const fl of flights) {
      if (addedOrUpdatedIds.has(fl.id)) {
        const prevFl = prevMap.get(fl.id);
        if (prevFl) nextFlights.push(prevFl);
      } else {
        nextFlights.push(fl);
      }
    }
    const existingIds = new Set(nextFlights.map((f) => f.id));
    for (const delId of delta.deletedFlightIds) {
      const prevFl = prevMap.get(delId);
      if (prevFl && !existingIds.has(delId)) {
        nextFlights.push(prevFl);
        existingIds.add(delId);
      }
    }
    flights = nextFlights;
  }

  // 4. Checklist surgical revert
  let checklist = currentTrip.checklist || [];
  if (
    delta.addedOrUpdatedChecklist.length > 0 ||
    delta.deletedChecklistIds.length > 0
  ) {
    const prevMap = new Map((previousTrip.checklist || []).map((c) => [c.id, c]));
    const addedOrUpdatedIds = new Set(delta.addedOrUpdatedChecklist.map((c) => c.id));

    const nextChecklist: ChecklistItem[] = [];
    for (const ci of checklist) {
      if (addedOrUpdatedIds.has(ci.id)) {
        const prevCi = prevMap.get(ci.id);
        if (prevCi) nextChecklist.push(prevCi);
      } else {
        nextChecklist.push(ci);
      }
    }
    const existingIds = new Set(nextChecklist.map((c) => c.id));
    for (const delId of delta.deletedChecklistIds) {
      const prevCi = prevMap.get(delId);
      if (prevCi && !existingIds.has(delId)) {
        nextChecklist.push(prevCi);
        existingIds.add(delId);
      }
    }
    checklist = nextChecklist;
  }

  // 5. Trip meta surgical revert
  return {
    ...currentTrip,
    ...(delta.tripMetaPatch.name !== undefined ? { name: previousTrip.name } : {}),
    ...(delta.tripMetaPatch.destination !== undefined
      ? { destination: previousTrip.destination }
      : {}),
    ...(delta.tripMetaPatch.startDate !== undefined
      ? { startDate: previousTrip.startDate }
      : {}),
    ...(delta.tripMetaPatch.endDate !== undefined
      ? { endDate: previousTrip.endDate }
      : {}),
    ...(delta.tripMetaPatch.allowed_emails !== undefined
      ? { allowed_emails: previousTrip.allowed_emails }
      : {}),
    itinerary,
    expenses,
    flights,
    checklist,
  };
};
