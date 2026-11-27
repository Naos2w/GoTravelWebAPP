import { DayPlan, ItineraryItem, Language, TransportType, Trip } from "../../../types";
import { enrichAirportCoords } from "../../flights/services/airportCoordsService";
import { sanitizeFilenameBase, triggerBlobDownload } from "./exportHelpers";

const MAX_GOOGLE_MAPS_WAYPOINTS = 8;

const TRAVEL_MODE_MAP: Record<TransportType, string> = {
  Public: "transit",
  Car: "driving",
  Bicycle: "bicycling",
  Walking: "walking",
  Flight: "transit",
};

function hasValidCoordinates(item: { lat?: number; lng?: number }): item is { lat: number; lng: number } {
  return (
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(Number(item.lat)) &&
    Number.isFinite(Number(item.lng))
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveDayTravelMode(items: ItineraryItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.transportType || item.transportType === "Flight") continue;
    const mode = TRAVEL_MODE_MAP[item.transportType];
    if (mode) {
      counts.set(mode, (counts.get(mode) || 0) + 1);
    }
  }
  let bestMode = "transit";
  let bestCount = 0;
  counts.forEach((count, mode) => {
    if (count > bestCount) {
      bestMode = mode;
      bestCount = count;
    }
  });
  return bestMode;
}

function resolveStopLocation(item: ItineraryItem): string | null {
  const enriched = enrichAirportCoords(item);
  if (hasValidCoordinates(enriched)) {
    return `${Number(enriched.lat)},${Number(enriched.lng)}`;
  }
  const name = (enriched.placeName || "").trim();
  return name || null;
}

/**
 * Builds an official zero-cost Google Maps multi-stop route URL for a single day.
 * Enriches airport coordinates automatically and caps intermediate waypoints at 8.
 */
export function buildGoogleMapsDayRouteUrl(day: DayPlan): string | null {
  const items = day?.items || [];
  const stops = items
    .filter((item) => item.type !== "Transport")
    .map(resolveStopLocation)
    .filter((loc): loc is string => loc !== null);

  if (stops.length === 0) {
    return null;
  }

  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1).slice(0, MAX_GOOGLE_MAPS_WAYPOINTS);
  const travelMode = resolveDayTravelMode(items);

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }
  params.set("travelmode", travelMode);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Generates an XML 1.0 / KML 2.2 document organized into per-day Folders
 * for importing the full trip into Google My Maps or Google Earth.
 */
export function generateTripKml(trip: Trip, lang: Language): string {
  const docName = escapeXml(trip.name || (lang === "zh" ? "Go Travel 旅程" : "Go Travel Trip"));
  const docDesc = escapeXml(
    [trip.destination, trip.startDate && trip.endDate ? `${trip.startDate} ~ ${trip.endDate}` : ""]
      .filter(Boolean)
      .join(" | ")
  );

  const folders = (trip.itinerary || []).map((day, dayIndex) => {
    const dayLabel = day.date
      ? `Day ${dayIndex + 1} (${day.date})`
      : `Day ${dayIndex + 1}`;

    const placemarks = (day.items || [])
      .filter((item) => item.type !== "Transport")
      .map((item) => {
        const enriched = enrichAirportCoords(item);
        if (!hasValidCoordinates(enriched)) {
          return "";
        }
        const name = escapeXml(enriched.placeName || (lang === "zh" ? "未命名景點" : "Unnamed Stop"));
        const descParts = [enriched.time, enriched.type, enriched.note?.trim()].filter(Boolean);
        const description = escapeXml(descParts.join(" · "));
        const lng = Number(enriched.lng);
        const lat = Number(enriched.lat);

        return [
          "      <Placemark>",
          `        <name>${name}</name>`,
          `        <description>${description}</description>`,
          "        <Point>",
          `          <coordinates>${lng},${lat},0</coordinates>`,
          "        </Point>",
          "      </Placemark>",
        ].join("\n");
      })
      .filter(Boolean)
      .join("\n");

    return [
      "    <Folder>",
      `      <name>${escapeXml(dayLabel)}</name>`,
      placemarks,
      "    </Folder>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "  <Document>",
    `    <name>${docName}</name>`,
    `    <description>${docDesc}</description>`,
    ...folders,
    "  </Document>",
    "</kml>",
  ].join("\n");
}

/**
 * Downloads the generated trip KML file for Google My Maps import.
 */
export function downloadTripKml(trip: Trip, lang: Language): void {
  const kml = generateTripKml(trip, lang);
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
  const filename = `${sanitizeFilenameBase(trip.name, "trip")}.kml`;
  triggerBlobDownload(blob, filename);
}
