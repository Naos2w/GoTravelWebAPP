import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTripNotesMarkdown,
  exportToAppleNotes,
  generateICalendar,
} from "../../services/exportService";
import { Trip, Currency } from "../../types";

describe("exportService", () => {
  const mockTrip: Trip = {
    id: "trip-uuid-1",
    user_id: "user-1",
    name: "2026 東京賞櫻之旅",
    destination: "東京, 日本",
    startDate: "2026-04-01",
    endDate: "2026-04-05",
    flights: [
      {
        id: "flight-1",
        user_id: "user-1",
        traveler_name: "小明",
        outbound: {
          airline: "星宇航空",
          flightNumber: "JX800",
          departureAirport: "TPE",
          arrivalAirport: "NRT",
          departureTime: "2026-04-01T08:30:00",
          arrivalTime: "2026-04-01T12:45:00",
          terminal: "1",
          gate: "B7",
        },
        inbound: {
          airline: "星宇航空",
          flightNumber: "JX801",
          departureAirport: "NRT",
          arrivalAirport: "TPE",
          departureTime: "2026-04-05T14:00:00",
          arrivalTime: "2026-04-05T17:00:00",
        },
        price: 16800,
        currency: Currency.TWD,
        cabinClass: "Economy",
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 2, weight: "23kg" },
        },
      },
    ],
    itinerary: [
      {
        date: "2026-04-01",
        items: [
          {
            id: "item-1",
            date: "2026-04-01",
            time: "15:00",
            placeName: "晴空塔 Skytree",
            type: "Place",
            transportType: "Public",
            lat: 35.710063,
            lng: 139.8107,
            note: "記得在 350F 咖啡廳看夕陽",
          },
        ],
      },
    ],
    checklist: [
      {
        id: "check-1",
        text: "護照與日本入境 Visit Japan Web",
        isCompleted: true,
        category: "Documents",
      },
      {
        id: "check-2",
        text: "Suica 西瓜卡加值",
        isCompleted: false,
        category: "Gear",
      },
    ],
    expenses: [
      {
        id: "exp-1",
        amount: 3500,
        currency: Currency.JPY,
        category: "Food",
        date: "2026-04-01",
        note: "炸豬排定食",
        exchangeRate: 0.21,
      },
    ],
  };

  describe("generateTripNotesMarkdown", () => {
    it("generates structured markdown with title, flights, itinerary, checklist, and expenses", () => {
      const md = generateTripNotesMarkdown(mockTrip);

      // Verify title & meta
      expect(md).toContain("# ✈️ 2026 東京賞櫻之旅");
      expect(md).toContain("📍 目的地：東京, 日本");
      expect(md).toContain("2026-04-01 ~ 2026-04-05");

      // Verify Flight details
      expect(md).toContain("## 🛫 航班資訊");
      expect(md).toContain("星宇航空 JX800");
      expect(md).toContain("TPE ➔ NRT");
      expect(md).toContain("T1 / Gate B7");

      // Verify Itinerary
      expect(md).toContain("## 🗺️ 每日行程時間軸");
      expect(md).toContain("Day 1 (2026-04-01)");
      expect(md).toContain("`15:00` 📍 **晴空塔 Skytree**");
      expect(md).toContain("記得在 350F 咖啡廳看夕陽");

      // Verify Checklist
      expect(md).toContain("## 🎒 行李與待辦清單");
      expect(md).toContain("[x] 護照與日本入境 Visit Japan Web");
      expect(md).toContain("[ ] Suica 西瓜卡加值");

      // Verify Expenses
      expect(md).toContain("## 💰 預算與記帳總覽");
    });
  });

  describe("generateICalendar", () => {
    it("generates a compliant RFC 5545 iCalendar string with VCALENDAR and VEVENT", () => {
      const ics = generateICalendar(mockTrip);

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("X-WR-CALNAME:2026 東京賞櫻之旅");

      // Verify attraction event
      expect(ics).toContain("SUMMARY:晴空塔 Skytree");
      expect(ics).toContain("GEO:35.710063;139.810700");
      expect(ics).toContain("TRIGGER:-PT30M");

      // Verify flight event
      expect(ics).toContain("SUMMARY:✈️ 星宇航空 JX800 (去程: TPE ➔ NRT)");
      expect(ics).toContain("LOCATION:TPE");
      expect(ics).toContain("TRIGGER:-PT120M");

      expect(ics).toContain("END:VCALENDAR");
    });
  });

  describe("exportToAppleNotes", () => {
    it("falls back to clipboard when navigator.share is unavailable", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        share: undefined,
        clipboard: { writeText: writeTextMock },
      });

      const result = await exportToAppleNotes(mockTrip);
      expect(result.success).toBe(true);
      expect(result.method).toBe("clipboard");
      expect(writeTextMock).toHaveBeenCalled();
    });

    it("calls navigator.share when available", async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        share: shareMock,
      });

      const result = await exportToAppleNotes(mockTrip);
      expect(result.success).toBe(true);
      expect(result.method).toBe("share");
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "2026 東京賞櫻之旅 - 行程筆記",
        })
      );
    });
  });
});
