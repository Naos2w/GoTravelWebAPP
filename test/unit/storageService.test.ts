import { describe, it, expect } from "vitest";
import { isValidUUID, formatDateStr, transformTripRow, DbTripRow } from "../../services/storageService";
import { Currency } from "../../types";

describe("storageService", () => {
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
          { user_id: "collab-1", email: "collab@test.com", role: "editor" }
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
            baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 2, weight: "23kg" } }
          }
        ],
        checklist_items: [
          {
            id: "check-1",
            user_id: "user-123",
            text: "Passport",
            is_completed: true,
            category: "Documents"
          }
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
            exchange_rate: 0.22
          }
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
            date: "2026-10-01"
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
            date: "2026-10-01"
          }
        ]
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
});
