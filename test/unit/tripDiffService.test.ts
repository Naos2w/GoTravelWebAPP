import { describe, it, expect } from "vitest";
import {
  diffTripChanges,
  applyTripDelta,
  revertTripDelta,
} from "../../src/features/trips/services/tripDiffService";
import { Currency, FlightInfo, Trip } from "../../src/types";

const createBaseTrip = (): Trip => ({
  id: "trip-1",
  user_id: "user-a",
  name: "Tokyo Autumn",
  destination: "Tokyo, Japan",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  allowed_emails: ["alice@example.com", "bob@example.com"],
  collaborators: [
    { user_id: "user-a", email: "alice@example.com", role: "owner" },
    { user_id: "user-b", email: "bob@example.com", role: "editor" },
  ],
  itinerary: [
    {
      date: "2026-10-01",
      items: [
        {
          id: "stop-1",
          user_id: "user-a",
          time: "09:00",
          placeName: "Senso-ji",
          lat: 35.7148,
          lng: 139.7967,
          note: "Morning visit",
          type: "Place",
          date: "2026-10-01",
        },
        {
          id: "stop-2",
          user_id: "user-b",
          time: "12:00",
          placeName: "Ichiran Ramen",
          lat: 35.712,
          lng: 139.798,
          note: "Lunch",
          type: "Food",
          date: "2026-10-01",
        },
      ],
    },
    {
      date: "2026-10-02",
      items: [],
    },
  ],
  expenses: [
    {
      id: "exp-1",
      user_id: "user-a",
      user_name: "Alice",
      amount: 1200,
      currency: Currency.JPY,
      category: "Food",
      date: "2026-10-01",
      note: "Ramen",
      exchangeRate: 0.22,
      paidBy: "user-a",
      paidByName: "Alice",
      splitWith: ["user-a", "user-b"],
    },
  ],
  flights: [
    {
      id: "flight-1",
      user_id: "user-a",
      traveler_name: "Alice",
      price: 15000,
      currency: Currency.TWD,
      exchangeRate: 1,
      cabinClass: "Economy",
      budget: 50000,
      baggage: {
        carryOn: { count: 1, weight: "7kg" },
        checked: { count: 1, weight: "23kg" },
      },
      outbound: {
        airline: "EVA Air",
        airlineID: "BR",
        flightNumber: "BR198",
        departureTime: "2026-10-01T08:50",
        arrivalTime: "2026-10-01T13:15",
        departureAirport: "TPE",
        arrivalAirport: "NRT",
        segments: [
          {
            airline: "EVA Air",
            flightNumber: "BR198",
            departureTime: "2026-10-01T08:50",
            arrivalTime: "2026-10-01T13:15",
            departureAirport: "TPE",
            arrivalAirport: "NRT",
          },
        ],
      },
    },
  ],
  checklist: [
    {
      id: "check-1",
      user_id: "user-a",
      text: "Passport",
      isCompleted: false,
      category: "Documents",
    },
  ],
});

describe("tripDiffService.diffTripChanges", () => {
  it("returns empty delta with hasChanges=false for identical cloned trips (no-op)", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);

    const delta = diffTripChanges(prev, next);

    expect(delta.hasChanges).toBe(false);
    expect(delta.tripMetaChanged).toBe(false);
    expect(delta.addedOrUpdatedItinerary).toEqual([]);
    expect(delta.deletedItineraryIds).toEqual([]);
    expect(delta.addedOrUpdatedExpenses).toEqual([]);
    expect(delta.deletedExpenseIds).toEqual([]);
    expect(delta.addedOrUpdatedFlights).toEqual([]);
    expect(delta.deletedFlightIds).toEqual([]);
    expect(delta.addedOrUpdatedChecklist).toEqual([]);
    expect(delta.deletedChecklistIds).toEqual([]);
  });

  it("detects itinerary add, edit, reorder, cross-day move, and delete without touching unchanged rows", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);

    // Edit stop-2 only
    next.itinerary[0].items[1].note = "Extra spicy";
    // Add stop-3 on Day 2
    next.itinerary[1].items.push({
      id: "stop-3",
      user_id: "user-b",
      time: "10:00",
      placeName: "Shibuya Sky",
      lat: 35.6584,
      lng: 139.7022,
      type: "Place",
      date: "2026-10-02",
    });

    const delta = diffTripChanges(prev, next);

    expect(delta.hasChanges).toBe(true);
    expect(delta.addedOrUpdatedItinerary.map((i) => i.id)).toEqual(["stop-2", "stop-3"]);
    expect(delta.deletedItineraryIds).toEqual([]);
    expect(delta.addedOrUpdatedExpenses).toEqual([]);
    expect(delta.addedOrUpdatedFlights).toEqual([]);
    expect(delta.tripMetaChanged).toBe(false);

    // Reorder (time swap) + delete stop-1 + move stop-2 to Day 2
    const next2 = structuredClone(prev);
    const movedStop2 = { ...next2.itinerary[0].items[1], time: "15:30" };
    next2.itinerary[0].items = [];
    next2.itinerary[1].items = [movedStop2];

    const delta2 = diffTripChanges(prev, next2);
    expect(delta2.deletedItineraryIds).toEqual(["stop-1"]);
    expect(delta2.addedOrUpdatedItinerary).toHaveLength(1);
    expect(delta2.addedOrUpdatedItinerary[0]).toMatchObject({
      id: "stop-2",
      date: "2026-10-02",
      time: "15:30",
    });
  });

  it("detects expense add, edit (including split metadata & exchangeRate), and delete", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);

    // Edit splitWith on exp-1 + add exp-2
    next.expenses[0].splitWith = ["user-a"];
    next.expenses.push({
      id: "exp-2",
      user_id: "user-b",
      user_name: "Bob",
      amount: 500,
      currency: Currency.JPY,
      category: "Transport",
      date: "2026-10-01",
      note: "Metro",
      exchangeRate: 0.215,
    });

    const delta = diffTripChanges(prev, next);
    expect(delta.hasChanges).toBe(true);
    expect(delta.addedOrUpdatedExpenses.map((e) => e.id)).toEqual(["exp-1", "exp-2"]);
    expect(delta.deletedExpenseIds).toEqual([]);

    // Delete exp-1
    const nextDeleted = structuredClone(prev);
    nextDeleted.expenses = [];
    const delDelta = diffTripChanges(prev, nextDeleted);
    expect(delDelta.deletedExpenseIds).toEqual(["exp-1"]);
    expect(delDelta.addedOrUpdatedExpenses).toEqual([]);
  });

  it("detects flight add, nested segment/baggage/budget edit, and delete", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);

    // Edit nested outbound segment gate and budget
    next.flights[0].outbound.segments![0].gate = "C7";
    next.flights[0].budget = 65000;

    // Add second traveler flight
    const newFlight: FlightInfo = {
      id: "flight-2",
      user_id: "user-b",
      traveler_name: "Bob",
      price: 16200,
      currency: Currency.TWD,
      cabinClass: "Economy",
      baggage: {
        carryOn: { count: 1, weight: "7kg" },
        checked: { count: 1, weight: "23kg" },
      },
      outbound: {
        airline: "Starlux",
        flightNumber: "JX800",
        departureTime: "2026-10-01T08:30",
        arrivalTime: "2026-10-01T12:45",
        departureAirport: "TPE",
        arrivalAirport: "NRT",
      },
    };
    next.flights.push(newFlight);

    const delta = diffTripChanges(prev, next);
    expect(delta.hasChanges).toBe(true);
    expect(delta.addedOrUpdatedFlights.map((f) => f.id)).toEqual(["flight-1", "flight-2"]);
    expect(delta.deletedFlightIds).toEqual([]);

    // Delete flight-1
    const nextDeleted = structuredClone(prev);
    nextDeleted.flights = [];
    const delDelta = diffTripChanges(prev, nextDeleted);
    expect(delDelta.deletedFlightIds).toEqual(["flight-1"]);
    expect(delDelta.addedOrUpdatedFlights).toEqual([]);
  });

  it("detects checklist add, edit, and delete", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);
    next.checklist[0].isCompleted = true;
    next.checklist.push({
      id: "check-2",
      user_id: "user-a",
      text: "Adapter",
      isCompleted: false,
      category: "Gear",
    });

    const delta = diffTripChanges(prev, next);
    expect(delta.addedOrUpdatedChecklist.map((c) => c.id)).toEqual(["check-1", "check-2"]);
    expect(delta.deletedChecklistIds).toEqual([]);

    const nextDeleted = structuredClone(prev);
    nextDeleted.checklist = [];
    expect(diffTripChanges(prev, nextDeleted).deletedChecklistIds).toEqual(["check-1"]);
  });

  it("detects trip metadata changes and normalizes allowed_emails comparison", () => {
    const prev = createBaseTrip();

    // Case-only difference in allowed_emails is a no-op
    const caseOnly = structuredClone(prev);
    caseOnly.allowed_emails = ["ALICE@EXAMPLE.COM", "Bob@Example.com"];
    expect(diffTripChanges(prev, caseOnly).tripMetaChanged).toBe(false);
    expect(diffTripChanges(prev, caseOnly).hasChanges).toBe(false);

    // Name + allowed_emails addition
    const next = structuredClone(prev);
    next.name = "Tokyo Extended";
    next.allowed_emails = ["alice@example.com", "bob@example.com", "CAROL@example.com"];

    const delta = diffTripChanges(prev, next);
    expect(delta.tripMetaChanged).toBe(true);
    expect(delta.tripMetaPatch).toEqual({
      name: "Tokyo Extended",
      allowed_emails: ["alice@example.com", "bob@example.com", "carol@example.com"],
    });
    expect(delta.addedOrUpdatedItinerary).toEqual([]);
  });

  it("applyTripDelta and revertTripDelta surgically patch and roll back without clobbering concurrent Realtime rows", () => {
    const prev = createBaseTrip();
    const next = structuredClone(prev);

    // User B adds a new expense exp-local and edits stop-1 note
    next.expenses.unshift({
      id: "exp-local",
      user_id: "user-b",
      user_name: "Bob",
      amount: 900,
      currency: Currency.JPY,
      category: "Food",
      date: "2026-10-01",
      note: "Local Temp Expense",
      exchangeRate: 0.22,
    });
    next.itinerary[0].items[0].note = "Edited note";

    const delta = diffTripChanges(prev, next);
    const optimistic = applyTripDelta(prev, delta);

    // Meanwhile User A inserts stop-realtime & exp-realtime via Realtime
    const withConcurrentRealtime = structuredClone(optimistic);
    withConcurrentRealtime.itinerary[0].items.push({
      id: "stop-realtime",
      user_id: "user-a",
      time: "18:00",
      placeName: "Tokyo Tower",
      type: "Place",
      date: "2026-10-01",
    });
    withConcurrentRealtime.expenses.unshift({
      id: "exp-realtime",
      user_id: "user-a",
      user_name: "Alice",
      amount: 1500,
      currency: Currency.JPY,
      category: "Tickets",
      date: "2026-10-01",
      note: "Tower Ticket",
      exchangeRate: 0.22,
    });

    // User B's write fails -> surgical rollback must revert ONLY exp-local and stop-1.note
    const rolledBack = revertTripDelta(withConcurrentRealtime, prev, delta);

    expect(rolledBack.expenses.map((e) => e.id)).toEqual(["exp-realtime", "exp-1"]);
    expect(rolledBack.itinerary[0].items.map((i) => i.id)).toEqual([
      "stop-1",
      "stop-2",
      "stop-realtime",
    ]);
    expect(rolledBack.itinerary[0].items[0].note).toBe("Morning visit");
  });
});
