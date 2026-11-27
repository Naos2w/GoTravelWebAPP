import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TAIWAN_AIRPORTS, parseTdxTime } from "../../src/features/flights/services/tdxService";

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
      vi.resetModules();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    const loadFetchTdxFlights = async () => {
      const mod = await import("../../src/features/flights/services/tdxService");
      return mod.fetchTdxFlights;
    };

    const stubTdxEnv = () => {
      vi.stubEnv("VITE_TDX_CLIENT_ID", "test-client-id");
      vi.stubEnv("VITE_TDX_CLIENT_SECRET", "test-client-secret");
    };

    const makeJsonResponse = (body: unknown, ok = true, status = 200) => ({
      ok,
      status,
      json: async () => body
    });

    it("queries TDX first for outbound Taiwan flights (TPE -> NRT)", async () => {
      stubTdxEnv();
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes("openid-connect/token")) {
          return makeJsonResponse({ access_token: "tok-1", expires_in: 3600 });
        }
        if (url.includes("GeneralSchedule/International")) {
          return makeJsonResponse([
            {
              AirlineID: "BR",
              FlightNumber: "BR198",
              DepartureAirportID: "TPE",
              ArrivalAirportID: "NRT",
              DepartureTime: "08:50",
              ArrivalTime: "13:15",
              Terminal: "2",
              CodeShare: []
            }
          ]);
        }
        if (url.includes("/Air/Airline/BR")) {
          return makeJsonResponse([{ AirlineName: { Zh_tw: "長榮航空", En: "EVA Air" } }]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const results = await fetchTdxFlights(" tpe ", " nrt ", "2026-10-15");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        airline: "長榮航空",
        airlineID: "BR",
        flightNumber: "BR198",
        departureAirport: "TPE",
        arrivalAirport: "NRT",
        departureTime: "2026-10-15T08:50",
        arrivalTime: "2026-10-15T13:15"
      });
      const calledUrls = mockFetch.mock.calls.map(([u]) => String(u));
      expect(calledUrls.some(u => u.includes("openid-connect/token"))).toBe(true);
      const scheduleUrl = calledUrls.find(u => u.includes("GeneralSchedule/International"))!;
      expect(decodeURIComponent(scheduleUrl)).toContain("DepartureAirportID eq 'TPE' and ArrivalAirportID eq 'NRT'");
      expect(calledUrls.some(u => u.includes("aviationstack.com"))).toBe(false);
    });

    it("queries TDX first for Taiwan-bound inbound flights (NRT -> TPE and FUK -> TPE)", async () => {
      stubTdxEnv();
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes("openid-connect/token")) {
          return makeJsonResponse({ access_token: "tok-2", expires_in: 3600 });
        }
        if (url.includes("GeneralSchedule/International")) {
          const decoded = decodeURIComponent(url);
          if (decoded.includes("DepartureAirportID eq 'NRT' and ArrivalAirportID eq 'TPE'")) {
            return makeJsonResponse([
              {
                AirlineID: "CI",
                FlightNumber: "CI101",
                DepartureAirportID: "NRT",
                ArrivalAirportID: "TPE",
                DepartureTime: "14:35",
                ArrivalTime: "17:15",
                Terminal: "2",
                CodeShare: []
              }
            ]);
          }
          if (decoded.includes("DepartureAirportID eq 'FUK' and ArrivalAirportID eq 'TPE'")) {
            return makeJsonResponse([
              {
                AirlineID: "JX",
                FlightNumber: "JX841",
                DepartureAirportID: "FUK",
                ArrivalAirportID: "TPE",
                DepartureTime: "14:40",
                ArrivalTime: "16:15",
                Terminal: "I",
                CodeShare: []
              }
            ]);
          }
        }
        if (url.includes("/Air/Airline/CI")) {
          return makeJsonResponse([{ AirlineName: { Zh_tw: "中華航空", En: "China Airlines" } }]);
        }
        if (url.includes("/Air/Airline/JX")) {
          return makeJsonResponse([{ AirlineName: { Zh_tw: "星宇航空", En: "STARLUX Airlines" } }]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const nrtToTpe = await fetchTdxFlights("NRT", "TPE", "2026-10-15");
      const fukToTpe = await fetchTdxFlights(" fuk ", " tpe ", "2026-10-15");

      expect(nrtToTpe).toHaveLength(1);
      expect(nrtToTpe[0]).toMatchObject({
        flightNumber: "CI101",
        departureAirport: "NRT",
        arrivalAirport: "TPE"
      });
      expect(fukToTpe).toHaveLength(1);
      expect(fukToTpe[0]).toMatchObject({
        flightNumber: "JX841",
        departureAirport: "FUK",
        arrivalAirport: "TPE"
      });

      const calledUrls = mockFetch.mock.calls.map(([u]) => String(u));
      expect(calledUrls.some(u => u.includes("GeneralSchedule/International"))).toBe(true);
      expect(calledUrls.some(u => u.includes("aviationstack.com"))).toBe(false);
    });

    it("falls back to Aviationstack when TDX returns empty array for Taiwan-bound inbound flights", async () => {
      stubTdxEnv();
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes("openid-connect/token")) {
          return makeJsonResponse({ access_token: "tok-3", expires_in: 3600 });
        }
        if (url.includes("GeneralSchedule/International")) {
          return makeJsonResponse([]);
        }
        if (url.includes("aviationstack.com")) {
          return makeJsonResponse({
            data: [
              {
                airline: { name: "EVA Air", iata: "BR" },
                flight: { iata: "BR105", number: "105" },
                departure: { iata: "FUK", scheduled: "2026-10-15T12:20:00+09:00", terminal: "I", gate: "52" },
                arrival: { iata: "TPE", scheduled: "2026-10-15T13:55:00+08:00" },
                flight_status: "scheduled"
              }
            ]
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const results = await fetchTdxFlights("FUK", "TPE", "2026-10-15");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        flightNumber: "BR105",
        departureAirport: "FUK",
        arrivalAirport: "TPE"
      });
      const calledUrls = mockFetch.mock.calls.map(([u]) => String(u));
      expect(calledUrls[0]).toContain("openid-connect/token");
      expect(calledUrls[1]).toContain("GeneralSchedule/International");
      expect(calledUrls[2]).toContain("aviationstack.com");
    });

    it("falls back to Aviationstack when TDX request fails for Taiwan-bound inbound flights", async () => {
      stubTdxEnv();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes("openid-connect/token")) {
          return makeJsonResponse({ access_token: "tok-4", expires_in: 3600 });
        }
        if (url.includes("GeneralSchedule/International")) {
          return makeJsonResponse({}, false, 500);
        }
        if (url.includes("aviationstack.com")) {
          return makeJsonResponse({
            data: [
              {
                airline: { name: "China Airlines", iata: "CI" },
                flight: { iata: "CI101", number: "101" },
                departure: { iata: "NRT", scheduled: "2026-10-15T14:35:00+09:00", terminal: "2", gate: "" },
                arrival: { iata: "TPE", scheduled: "2026-10-15T17:15:00+08:00" },
                flight_status: "scheduled"
              }
            ]
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const results = await fetchTdxFlights("NRT", "TPE", "2026-10-15");

      expect(results).toHaveLength(1);
      expect(results[0].flightNumber).toBe("CI101");
      const calledUrls = mockFetch.mock.calls.map(([u]) => String(u));
      expect(calledUrls[0]).toContain("openid-connect/token");
      expect(calledUrls[1]).toContain("GeneralSchedule/International");
      expect(calledUrls[2]).toContain("aviationstack.com");
      expect(errorSpy).toHaveBeenCalled();
    });

    it("falls back to Aviationstack when TDX token credentials are missing", async () => {
      vi.stubEnv("VITE_TDX_CLIENT_ID", "");
      vi.stubEnv("VITE_TDX_CLIENT_SECRET", "");
      const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ data: [] }));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const results = await fetchTdxFlights("NRT", "TPE", "2026-10-15");

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(String(mockFetch.mock.calls[0][0])).toContain("aviationstack.com");
    });

    it("bypasses TDX directly and calls Aviationstack for foreign-to-foreign flights (NRT -> ICN)", async () => {
      stubTdxEnv();
      const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ data: [] }));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const fetchTdxFlights = await loadFetchTdxFlights();
      const results = await fetchTdxFlights("NRT", "ICN", "2026-10-15");

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain("aviationstack.com");
      expect(calledUrl).toContain("dep_iata=NRT");
      expect(calledUrl).toContain("arr_iata=ICN");
    });
  });
});
