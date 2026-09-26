import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TAIWAN_AIRPORTS, parseTdxTime, fetchTdxFlights } from "../../services/tdxService";

describe("tdxService", () => {
  describe("TAIWAN_AIRPORTS", () => {
    it("recognizes major Taiwanese international and domestic airports", () => {
      expect(TAIWAN_AIRPORTS.has("TPE")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("KHH")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("TSA")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("RMQ")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("HUN")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("TTT")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("MZG")).toBe(true);
      expect(TAIWAN_AIRPORTS.has("KNH")).toBe(true);
    });

    it("does not match foreign airports", () => {
      expect(TAIWAN_AIRPORTS.has("NRT")).toBe(false);
      expect(TAIWAN_AIRPORTS.has("HND")).toBe(false);
      expect(TAIWAN_AIRPORTS.has("ICN")).toBe(false);
      expect(TAIWAN_AIRPORTS.has("LAX")).toBe(false);
    });
  });

  describe("parseTdxTime", () => {
    it("formats standard same-day departure/arrival times", () => {
      expect(parseTdxTime("2026-10-15", "14:30")).toBe("2026-10-15T14:30");
      expect(parseTdxTime("2026-10-15", "08:05")).toBe("2026-10-15T08:05");
    });

    it("handles next-day offset (+1 day) correctly", () => {
      // 2026-10-15 + 1 day = 2026-10-16
      expect(parseTdxTime("2026-10-15", "01:30+1")).toBe("2026-10-16T01:30");
    });

    it("handles month transition when offset crosses into next month", () => {
      // October 31 + 1 day = November 01
      expect(parseTdxTime("2026-10-31", "02:00+1")).toBe("2026-11-01T02:00");
    });

    it("returns default T00:00 when time is empty or missing", () => {
      expect(parseTdxTime("2026-10-15", "")).toBe("2026-10-15T00:00");
    });
  });

  describe("fetchTdxFlights routing logic", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("bypasses TDX for foreign airports and uses Aviationstack route", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });
      globalThis.fetch = mockFetch;

      const results = await fetchTdxFlights("NRT", "TPE", "2026-10-15");
      expect(results).toEqual([]);
      // Should have called Aviationstack API, not TDX Connect
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("aviationstack.com");
    });
  });
});
