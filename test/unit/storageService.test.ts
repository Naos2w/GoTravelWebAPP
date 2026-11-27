import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storageService from "../../src/shared/services/storageService";
import {
  isValidUUID,
  formatDateStr,
  transformTripRow,
  mapDbItineraryRow,
  mapDbExpenseRow,
  mapDbFlightRow,
  mapDbChecklistRow,
  upsertItineraryItems,
  deleteItineraryItem,
  upsertExpense,
  deleteExpense,
  saveExpenseOnly,
  upsertFlight,
  deleteFlight,
  upsertChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  ensureChecklistItems,
  updateTripMeta,
  createNewTrip,
  getTripById,
  deleteTrip,
  joinTrip,
  leaveTrip,
  removeCollaboratorByEmail,
  findUserIdByEmail,
  supabase,
  DbTripRow,
} from "../../src/shared/services/storageService";
import * as supabaseClientRepo from "../../src/shared/services/repos/supabaseClient";
import * as mappersRepo from "../../src/shared/services/repos/mappers";
import * as itineraryRepo from "../../src/shared/services/repos/itineraryRepo";
import * as expenseRepo from "../../src/shared/services/repos/expenseRepo";
import * as checklistRepo from "../../src/shared/services/repos/checklistRepo";
import * as flightRepo from "../../src/shared/services/repos/flightRepo";
import * as tripRepo from "../../src/shared/services/repos/tripRepo";
import { Currency, Expense, FlightInfo, ItineraryItem } from "../../src/types";

describe("storageService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isValidUUID", () => {
    it("returns true for valid standard UUIDs (v4 or standard 8-4-4-4-12 hex)", () => {
      expect(isValidUUID("5bf223d6-4053-4a75-a38f-1c51596b1c5c")).toBe(true);
      expect(isValidUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
      expect(isValidUUID("A1B2C3D4-E5F6-7A8B-9C0D-1E2F3A4B5C6D")).toBe(true);
    });

    it("returns false for invalid UUID strings", () => {
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID("invalid-id")).toBe(false);
      expect(isValidUUID("5bf223d6-4053-4a75-a38f")).toBe(false);
      expect(isValidUUID("5bf223d640534a75a38f1c51596b1c5c")).toBe(false);
    });
  });

  describe("formatDateStr", () => {
    it("formats a Date to YYYY-MM-DD format", () => {
      const date = new Date(2026, 9, 25); // Oct 25, 2026
      expect(formatDateStr(date)).toBe("2026-10-25");
    });
  });

  describe("exported row mappers", () => {
    it("maps itinerary_items DB row preserving lat, lng, date, time, and transportType", () => {
      const mapped = mapDbItineraryRow({
        id: "it-1",
        trip_id: "trip-1",
        user_id: "user-1",
        time: "11:30",
        place_name: "Tokyo Station",
        lat: 35.6812,
        lng: 139.7671,
        note: "Transfer",
        type: "Transport",
        transport_type: "Public",
        date: "2026-10-01",
      });

      expect(mapped).toEqual({
        id: "it-1",
        trip_id: "trip-1",
        user_id: "user-1",
        time: "11:30",
        placeName: "Tokyo Station",
        lat: 35.6812,
        lng: 139.7671,
        note: "Transfer",
        type: "Transport",
        transportType: "Public",
        date: "2026-10-01",
      });
    });

    it("maps expenses DB row decoding split metadata and numeric string fields", () => {
      const mapped = mapDbExpenseRow({
        id: "exp-9",
        trip_id: "trip-1",
        user_id: "user-a",
        user_name: "Alice",
        amount: "2400.5",
        currency: Currency.JPY,
        category: "Food",
        date: "2026-10-01",
        note: 'Sushi Dinner [split:{"p":"user-b","pn":"Bob","s":["user-a","user-b"]}]',
        exchange_rate: "0.215",
        created_at: "2026-10-01T12:00:00Z",
      });

      expect(mapped).toEqual({
        id: "exp-9",
        trip_id: "trip-1",
        user_id: "user-a",
        user_name: "Alice",
        amount: 2400.5,
        currency: Currency.JPY,
        category: "Food",
        date: "2026-10-01",
        note: "Sushi Dinner",
        paidBy: "user-b",
        paidByName: "Bob",
        splitWith: ["user-a", "user-b"],
        exchangeRate: 0.215,
        createdAt: "2026-10-01T12:00:00Z",
      });
    });

    it("maps flights DB row extracting baggage.exchangeRate and compound segments", () => {
      const mapped = mapDbFlightRow({
        id: "fl-1",
        user_id: "user-a",
        traveler_name: "Alice",
        outbound: {
          airline: "EVA + ANA",
          flightNumber: "BR198 + NH100",
          departureTime: "2026-10-01T08:50",
          arrivalTime: "2026-10-01T18:00",
          departureAirport: "TPE",
          arrivalAirport: "CTS",
          segments: [{ flightNumber: "BR198" }, { flightNumber: "NH100" }],
        },
        inbound: undefined,
        price: 120000,
        currency: Currency.JPY,
        cabin_class: "Business",
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 2, weight: "32kg" },
          exchangeRate: 0.21,
        },
        budget: 80000,
      });

      expect(mapped.cabinClass).toBe("Business");
      expect(mapped.exchangeRate).toBe(0.21);
      expect(mapped.budget).toBe(80000);
      expect(mapped.outbound.segments).toHaveLength(2);
    });

    it("maps checklist_items DB row cleanly", () => {
      const mapped = mapDbChecklistRow({
        id: "ci-1",
        trip_id: "trip-1",
        user_id: "user-a",
        text: "eSIM",
        is_completed: true,
        category: "Gear",
      });

      expect(mapped).toEqual({
        id: "ci-1",
        trip_id: "trip-1",
        user_id: "user-a",
        text: "eSIM",
        isCompleted: true,
        category: "Gear",
      });
    });
  });

  describe("granular single-row CRUD helpers", () => {
    it("upsertItineraryItems sends exact row columns and skips empty arrays", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
      } as any);

      await upsertItineraryItems("trip-1", "user-a", []);
      expect(fromSpy).not.toHaveBeenCalled();

      const items: Array<ItineraryItem & { date: string }> = [
        {
          id: "it-1",
          time: "10:00",
          placeName: "Senso-ji",
          lat: 35.7148,
          lng: 139.7967,
          note: "Temple",
          type: "Place",
          transportType: undefined,
          date: "2026-10-01",
        },
      ];
      await upsertItineraryItems("trip-1", "user-a", items);

      expect(fromSpy).toHaveBeenCalledWith("itinerary_items");
      expect(upsertMock).toHaveBeenCalledWith([
        {
          id: "it-1",
          trip_id: "trip-1",
          user_id: "user-a",
          date: "2026-10-01",
          time: "10:00",
          type: "Place",
          place_name: "Senso-ji",
          lat: 35.7148,
          lng: 139.7967,
          note: "Temple",
          transport_type: undefined,
        },
      ]);
    });

    it("upsertExpense preserves encoded split metadata and exchangeRate snapshot", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
      } as any);

      const expense: Expense = {
        id: "exp-1",
        user_id: "user-a",
        user_name: "Alice",
        amount: 3000,
        currency: Currency.JPY,
        category: "Food",
        date: "2026-10-01",
        note: "Izakaya",
        exchangeRate: 0.212,
        paidBy: "user-b",
        paidByName: "Bob",
        splitWith: ["user-a", "user-b"],
      };

      await upsertExpense("trip-1", "user-a", expense);

      expect(fromSpy).toHaveBeenCalledWith("expenses");
      expect(upsertMock).toHaveBeenCalledWith({
        id: "exp-1",
        trip_id: "trip-1",
        user_id: "user-a",
        user_name: "Alice",
        amount: 3000,
        currency: Currency.JPY,
        category: "Food",
        date: "2026-10-01",
        note: 'Izakaya [split:{"p":"user-b","pn":"Bob","s":["user-a","user-b"]}]',
        exchange_rate: 0.212,
      });
    });

    it("upsertFlight preserves compound segments, baggage exchangeRate, and budget", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
      } as any);

      const flight: FlightInfo = {
        id: "fl-1",
        user_id: "user-a",
        traveler_name: "Alice",
        price: 85000,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        cabinClass: "Economy",
        budget: 60000,
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 1, weight: "23kg" },
        },
        outbound: {
          airline: "EVA Air",
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
      };

      await upsertFlight("trip-1", "user-a", flight);

      expect(fromSpy).toHaveBeenCalledWith("flights");
      expect(upsertMock).toHaveBeenCalledWith({
        id: "fl-1",
        trip_id: "trip-1",
        user_id: "user-a",
        traveler_name: "Alice",
        outbound: flight.outbound,
        inbound: undefined,
        price: 85000,
        currency: Currency.JPY,
        cabin_class: "Economy",
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 1, weight: "23kg" },
          exchangeRate: 0.215,
        },
        budget: 60000,
      });
    });

    it("deleteFlight and deleteItineraryItem filter by both id and trip_id", async () => {
      const eqTripMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqTripMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        delete: deleteMock,
      } as any);

      await deleteFlight("fl-1", "trip-1");
      expect(fromSpy).toHaveBeenCalledWith("flights");
      expect(eqIdMock).toHaveBeenCalledWith("id", "fl-1");
      expect(eqTripMock).toHaveBeenCalledWith("trip_id", "trip-1");

      await deleteItineraryItem("it-1", "trip-1");
      expect(fromSpy).toHaveBeenCalledWith("itinerary_items");
    });

    it("upsertChecklistItems upserts targeted checklist rows", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
      } as any);

      await upsertChecklistItems("trip-1", "user-a", [
        {
          id: "ci-1",
          text: "Passport",
          isCompleted: true,
          category: "Documents",
        },
      ]);

      expect(fromSpy).toHaveBeenCalledWith("checklist_items");
      expect(upsertMock).toHaveBeenCalledWith([
        {
          id: "ci-1",
          trip_id: "trip-1",
          user_id: "user-a",
          text: "Passport",
          category: "Documents",
          is_completed: true,
        },
      ]);
    });

    it("updateTripMeta sends only patched fields and lowercases allowed_emails", async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        update: updateMock,
      } as any);

      // No-op when patch is empty
      await updateTripMeta("trip-1", {});
      expect(fromSpy).not.toHaveBeenCalled();

      await updateTripMeta("trip-1", {
        name: "Kyoto Spring",
        allowed_emails: ["USER@EXAMPLE.COM"],
      });

      expect(fromSpy).toHaveBeenCalledWith("trips");
      expect(updateMock).toHaveBeenCalledWith({
        name: "Kyoto Spring",
        allowed_emails: ["user@example.com"],
      });
      expect(eqMock).toHaveBeenCalledWith("id", "trip-1");
    });
  });

  describe("transformTripRow", () => {
    it("transforms raw database row into full frontend Trip model", () => {
      const mockRow: DbTripRow = {
        id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
        user_id: "user-123",
        name: "Tokyo Autumn Adventure",
        destination: "Tokyo, Japan",
        start_date: "2026-10-01",
        end_date: "2026-10-03",
        allowed_emails: ["USER1@EXAMPLE.COM", "User2@Domain.org"],
        trip_collaborators: [
          { user_id: "collab-1", email: "collab@test.com", role: "editor" },
        ],
        flights: [
          {
            id: "flight-1",
            user_id: "user-123",
            traveler_name: "Alice",
            outbound: { flightNumber: "BR198" },
            price: 15000,
            currency: Currency.TWD,
            cabin_class: "Economy",
            baggage: {
              carryOn: { count: 1, weight: "7kg" },
              checked: { count: 2, weight: "23kg" },
            },
          },
        ],
        checklist_items: [
          {
            id: "check-1",
            user_id: "user-123",
            text: "Passport",
            is_completed: true,
            category: "Documents",
          },
        ],
        expenses: [
          {
            id: "exp-1",
            user_id: "user-123",
            user_name: "Alice",
            amount: 500,
            currency: Currency.JPY,
            category: "Food",
            date: "2026-10-01",
            note: "Ramen",
            exchange_rate: 0.22,
          },
        ],
        itinerary_items: [
          {
            id: "item-2",
            trip_id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
            user_id: "user-123",
            time: "14:00",
            place_name: "Senso-ji",
            lat: 35.7148,
            lng: 139.7967,
            type: "Place",
            date: "2026-10-01",
          },
          {
            id: "item-1",
            trip_id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
            user_id: "user-123",
            time: "10:00",
            place_name: "Tokyo Skytree",
            lat: 35.7101,
            lng: 139.8107,
            type: "Place",
            date: "2026-10-01",
          },
        ],
      };

      const result = transformTripRow(mockRow);

      expect(result.id).toBe(mockRow.id);
      expect(result.name).toBe("Tokyo Autumn Adventure");
      // Check allowed emails lowercased
      expect(result.allowed_emails).toEqual(["user1@example.com", "user2@domain.org"]);
      // Check collaborators mapped
      expect(result.collaborators).toHaveLength(1);
      expect(result.collaborators[0].email).toBe("collab@test.com");
      // Check flight mapped
      expect(result.flights).toHaveLength(1);
      expect(result.flights[0].cabinClass).toBe("Economy");
      // Check checklist mapped
      expect(result.checklist).toHaveLength(1);
      expect(result.checklist[0].isCompleted).toBe(true);
      // Check itinerary days generated (3 days: Oct 1, Oct 2, Oct 3)
      expect(result.itinerary).toHaveLength(3);
      expect(result.itinerary[0].date).toBe("2026-10-01");
      // Verify items sorted by time (10:00 before 14:00)
      expect(result.itinerary[0].items).toHaveLength(2);
      expect(result.itinerary[0].items[0].placeName).toBe("Tokyo Skytree");
      expect(result.itinerary[0].items[1].placeName).toBe("Senso-ji");
    });
  });

  describe("domain repository barrel parity & CRUD coverage", () => {
    it("re-exports identical references from services/repos/* via storageService", () => {
      expect(storageService.supabase).toBe(supabaseClientRepo.supabase);
      expect(storageService.SUPABASE_URL).toBe(supabaseClientRepo.SUPABASE_URL);
      expect(storageService.isSupabaseConfigured).toBe(supabaseClientRepo.isSupabaseConfigured);
      expect(storageService.isValidUUID).toBe(supabaseClientRepo.isValidUUID);

      expect(storageService.mapDbItineraryRow).toBe(mappersRepo.mapDbItineraryRow);
      expect(storageService.mapDbExpenseRow).toBe(mappersRepo.mapDbExpenseRow);
      expect(storageService.mapDbFlightRow).toBe(mappersRepo.mapDbFlightRow);
      expect(storageService.mapDbChecklistRow).toBe(mappersRepo.mapDbChecklistRow);
      expect(storageService.buildFlightRowPayload).toBe(mappersRepo.buildFlightRowPayload);
      expect(storageService.encodeExpenseSplitMeta).toBe(mappersRepo.encodeExpenseSplitMeta);
      expect(storageService.decodeExpenseSplitMeta).toBe(mappersRepo.decodeExpenseSplitMeta);

      expect(storageService.upsertItineraryItems).toBe(itineraryRepo.upsertItineraryItems);
      expect(storageService.deleteItineraryItem).toBe(itineraryRepo.deleteItineraryItem);

      expect(storageService.upsertExpense).toBe(expenseRepo.upsertExpense);
      expect(storageService.deleteExpense).toBe(expenseRepo.deleteExpense);
      expect(storageService.saveExpenseOnly).toBe(expenseRepo.saveExpenseOnly);

      expect(storageService.upsertChecklistItems).toBe(checklistRepo.upsertChecklistItems);
      expect(storageService.addChecklistItem).toBe(checklistRepo.addChecklistItem);
      expect(storageService.updateChecklistItem).toBe(checklistRepo.updateChecklistItem);
      expect(storageService.deleteChecklistItem).toBe(checklistRepo.deleteChecklistItem);
      expect(storageService.ensureChecklistItems).toBe(checklistRepo.ensureChecklistItems);

      expect(storageService.upsertFlight).toBe(flightRepo.upsertFlight);
      expect(storageService.deleteFlight).toBe(flightRepo.deleteFlight);

      expect(storageService.getTrips).toBe(tripRepo.getTrips);
      expect(storageService.getTripById).toBe(tripRepo.getTripById);
      expect(storageService.createNewTrip).toBe(tripRepo.createNewTrip);
      expect(storageService.createFullTrip).toBe(tripRepo.createFullTrip);
      expect(storageService.saveTrip).toBe(tripRepo.saveTrip);
      expect(storageService.updateTripMeta).toBe(tripRepo.updateTripMeta);
      expect(storageService.deleteTrip).toBe(tripRepo.deleteTrip);
      expect(storageService.joinTrip).toBe(tripRepo.joinTrip);
      expect(storageService.leaveTrip).toBe(tripRepo.leaveTrip);
      expect(storageService.removeCollaboratorByEmail).toBe(tripRepo.removeCollaboratorByEmail);
      expect(storageService.findUserIdByEmail).toBe(tripRepo.findUserIdByEmail);
    });

    it("checklistRepo supports add, update, delete, and default item initialization", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const eqTripMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqTripMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      const eqUserCountMock = vi.fn().mockResolvedValue({ count: 0, error: null });
      const eqTripCountMock = vi.fn().mockReturnValue({ eq: eqUserCountMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqTripCountMock });

      const fromSpy = vi.spyOn(supabase, "from").mockReturnValue({
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
        select: selectMock,
      } as any);

      await addChecklistItem(
        { id: "ci-1", user_id: "user-a", text: "Adapter", isCompleted: false, category: "Gear" },
        "trip-1"
      );
      expect(fromSpy).toHaveBeenCalledWith("checklist_items");
      expect(insertMock).toHaveBeenCalledWith({
        id: "ci-1",
        trip_id: "trip-1",
        user_id: "user-a",
        text: "Adapter",
        category: "Gear",
        is_completed: false,
      });

      await updateChecklistItem("ci-1", "trip-1", { isCompleted: true, text: "Travel Adapter" });
      expect(updateMock).toHaveBeenCalledWith({
        is_completed: true,
        text: "Travel Adapter",
      });
      expect(eqIdMock).toHaveBeenCalledWith("id", "ci-1");
      expect(eqTripMock).toHaveBeenCalledWith("trip_id", "trip-1");

      await deleteChecklistItem("ci-1", "trip-1");
      expect(deleteMock).toHaveBeenCalled();

      await ensureChecklistItems("trip-1", "user-a");
      expect(selectMock).toHaveBeenCalledWith("*", { count: "exact", head: true });
      expect(insertMock).toHaveBeenCalledTimes(2);
    });

    it("expenseRepo saveExpenseOnly generates UUID for non-UUID ids and deleteExpense scopes by trip_id", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const eqTripMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqTripMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      vi.spyOn(supabase, "from").mockReturnValue({
        upsert: upsertMock,
        delete: deleteMock,
      } as any);

      await saveExpenseOnly("trip-1", {
        id: "temp-id",
        user_id: "user-a",
        user_name: "Alice",
        amount: 420,
        currency: Currency.TWD,
        category: "Transport",
        date: "2026-10-01",
        note: "Metro",
        exchangeRate: 1,
      });

      const savedPayload = upsertMock.mock.calls[0][0];
      expect(isValidUUID(savedPayload.id)).toBe(true);
      expect(savedPayload.trip_id).toBe("trip-1");

      await deleteExpense("exp-1", "trip-1");
      expect(eqIdMock).toHaveBeenCalledWith("id", "exp-1");
      expect(eqTripMock).toHaveBeenCalledWith("trip_id", "trip-1");
    });

    it("tripRepo handles createNewTrip, getTripById validation, deleteTrip, joinTrip, leaveTrip, and collaborator lookup/removal", async () => {
      const blankTrip = createNewTrip({
        destination: "Osaka",
        startDate: "2026-11-01",
        endDate: "2026-11-05",
      });
      expect(isValidUUID(blankTrip.id)).toBe(true);
      expect(blankTrip.name).toBe("Osaka");
      expect(blankTrip.itinerary).toEqual([]);

      // Invalid UUID returns null without hitting Supabase
      const fromSpy = vi.spyOn(supabase, "from");
      expect(await getTripById("not-a-uuid")).toBeNull();
      expect(fromSpy).not.toHaveBeenCalled();

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const eqSecondMock = vi.fn().mockResolvedValue({ error: null });
      const eqFirstMock = vi.fn().mockReturnValue({ eq: eqSecondMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqFirstMock });
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { user_id: "u-2" } });
      const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const ilikeMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqTripCollabMock = vi.fn().mockResolvedValue({
        data: [{ user_id: "u-2", email: "bob@example.com" }],
      });
      const eqCountUserMock = vi.fn().mockResolvedValue({ count: 3, error: null });
      const eqCountTripMock = vi.fn().mockReturnValue({ eq: eqCountUserMock });
      const selectMock = vi.fn().mockImplementation((cols: string) => {
        if (cols === "*") return { eq: eqCountTripMock };
        if (cols === "user_id") return { ilike: ilikeMock };
        return { eq: eqTripCollabMock };
      });

      fromSpy.mockReturnValue({
        upsert: upsertMock,
        delete: deleteMock,
        select: selectMock,
      } as any);

      await deleteTrip("trip-1", "user-a");
      expect(eqFirstMock).toHaveBeenCalledWith("id", "trip-1");
      expect(eqSecondMock).toHaveBeenCalledWith("user_id", "user-a");

      await joinTrip("trip-1", "user-a", "ALICE@EXAMPLE.COM", "editor");
      expect(upsertMock).toHaveBeenCalledWith(
        {
          trip_id: "trip-1",
          user_id: "user-a",
          role: "editor",
          email: "alice@example.com",
        },
        { onConflict: "trip_id,user_id" }
      );

      expect(await findUserIdByEmail("bob@example.com")).toBe("u-2");

      const removedId = await removeCollaboratorByEmail("trip-1", "BOB@example.com");
      expect(removedId).toBe("u-2");
      expect(deleteMock).toHaveBeenCalled();

      await leaveTrip("trip-1", "u-3");
      expect(fromSpy).toHaveBeenCalledWith("trip_collaborators");
    });
  });
});
