import { describe, it, expect } from "vitest";
import {
  AIRPORT_COORDS,
  getAirportCoords,
  resolveAirportCoordsFromPlaceName,
  enrichAirportCoords,
} from "../../services/airportCoordsService";

describe("airportCoordsService", () => {
  it("contains at least 70 major international airports with valid WGS-84 coordinates", () => {
    const entries = Object.entries(AIRPORT_COORDS);
    expect(entries.length).toBeGreaterThanOrEqual(70);
    for (const [code, coords] of entries) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(typeof coords.lat).toBe("number");
      expect(typeof coords.lng).toBe("number");
      expect(coords.lat).toBeGreaterThanOrEqual(-90);
      expect(coords.lat).toBeLessThanOrEqual(90);
      expect(coords.lng).toBeGreaterThanOrEqual(-180);
      expect(coords.lng).toBeLessThanOrEqual(180);
    }
  });

  it("returns accurate coordinates for TPE, FUK, YVR, YZF, and ZRH", () => {
    const tpe = getAirportCoords("TPE");
    expect(tpe).toBeDefined();
    expect(tpe!.lat).toBeCloseTo(25.08, 1);
    expect(tpe!.lng).toBeCloseTo(121.23, 1);

    const fuk = getAirportCoords("FUK");
    expect(fuk).toBeDefined();
    expect(fuk!.lat).toBeCloseTo(33.59, 1);
    expect(fuk!.lng).toBeCloseTo(130.45, 1);

    const yvr = getAirportCoords("YVR");
    expect(yvr).toBeDefined();
    expect(yvr!.lat).toBeCloseTo(49.2, 1);
    expect(yvr!.lng).toBeCloseTo(-123.18, 1);

    const yzf = getAirportCoords("YZF");
    expect(yzf).toBeDefined();
    expect(yzf!.lat).toBeCloseTo(62.46, 1);
    expect(yzf!.lng).toBeCloseTo(-114.44, 1);

    const zrh = getAirportCoords("ZRH");
    expect(zrh).toBeDefined();
    expect(zrh!.lat).toBeCloseTo(47.46, 1);
    expect(zrh!.lng).toBeCloseTo(8.55, 1);
  });

  it("handles case insensitivity and surrounding whitespace", () => {
    expect(getAirportCoords("tpe")).toEqual(getAirportCoords("TPE"));
    expect(getAirportCoords("  fuk  ")).toEqual(getAirportCoords("FUK"));
    expect(getAirportCoords("Yvr")).toEqual(getAirportCoords("YVR"));
  });

  it("returns undefined for unknown or empty IATA codes", () => {
    expect(getAirportCoords(undefined)).toBeUndefined();
    expect(getAirportCoords("")).toBeUndefined();
    expect(getAirportCoords("   ")).toBeUndefined();
    expect(getAirportCoords("ZZZ")).toBeUndefined();
    expect(getAirportCoords("INVALID")).toBeUndefined();
  });

  it("resolves coordinates from airport place names cleanly", () => {
    expect(resolveAirportCoordsFromPlaceName("FUK Airport")).toEqual(getAirportCoords("FUK"));
    expect(resolveAirportCoordsFromPlaceName("TPE Airport")).toEqual(getAirportCoords("TPE"));
    expect(resolveAirportCoordsFromPlaceName("fuk airport")).toEqual(getAirportCoords("FUK"));
    expect(resolveAirportCoordsFromPlaceName("  TPE  ")).toEqual(getAirportCoords("TPE"));
    expect(resolveAirportCoordsFromPlaceName("KIX International Airport")).toEqual(getAirportCoords("KIX"));
    expect(resolveAirportCoordsFromPlaceName("Taoyuan Airport (TPE)")).toEqual(getAirportCoords("TPE"));
  });

  it("does not falsely match non-airport place names or unknown codes", () => {
    expect(resolveAirportCoordsFromPlaceName(undefined)).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("")).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("ZZZ Airport")).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("Tokyo Tower")).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("MAD Ramen")).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("CAN Coffee")).toBeUndefined();
    expect(resolveAirportCoordsFromPlaceName("SEA Seafood")).toBeUndefined();
  });

  it("enriches legacy airport Place items missing lat/lng without overwriting existing coordinates", () => {
    const legacyFlightStop = {
      id: "1",
      type: "Place" as const,
      transportType: "Flight" as const,
      placeName: "FUK Airport",
    };
    const enriched = enrichAirportCoords(legacyFlightStop);
    expect(enriched.lat).toBe(getAirportCoords("FUK")!.lat);
    expect(enriched.lng).toBe(getAirportCoords("FUK")!.lng);

    const existingCoordsStop = {
      id: "2",
      type: "Place" as const,
      transportType: "Flight" as const,
      placeName: "FUK Airport",
      lat: 33.59,
      lng: 130.45,
    };
    expect(enrichAirportCoords(existingCoordsStop)).toBe(existingCoordsStop);

    const transportItem = {
      id: "3",
      type: "Transport" as const,
      transportType: "Flight" as const,
      placeName: "FUK Airport",
    };
    expect(enrichAirportCoords(transportItem)).toBe(transportItem);

    const nonAirportPlace = {
      id: "4",
      type: "Place" as const,
      placeName: "TPE",
    };
    expect(enrichAirportCoords(nonAirportPlace)).toBe(nonAirportPlace);
  });
});
