import { resolveLocationInput, ParsedPlaceInfo } from "./mapUrlService";

export interface PlaceSearchResult {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  lon: number; // alias for Leaflet lon compatibility
  source: "google_url" | "raw_coords" | "osm" | "photon";
  distanceKm?: number;
}

interface SearchOptions {
  lat?: number;
  lng?: number;
  viewbox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  language?: string;
  limit?: number;
}

/**
 * Calculates distance (km) between two points using Haversine formula
 */
const calculateDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Clean place name from full address string
 */
const extractPlaceTitle = (displayName: string): { title: string; subtitle: string } => {
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { title: displayName, subtitle: "" };
  }
  const title = parts[0];
  const subtitle = parts.slice(1, 4).join(", ");
  return { title, subtitle };
};

/**
 * Intelligent, 100% free place search engine.
 * Combines client-side URL parsing, OpenStreetMap Nominatim, and Komoot Photon.
 * Zero Google API keys or token costs required.
 */
export const searchFreePlaces = async (
  query: string,
  options?: SearchOptions
): Promise<PlaceSearchResult[]> => {
  if (!query || !query.trim()) return [];
  const trimmed = query.trim();

  // 1. Check if user pasted a Google Maps URL or raw coordinates (Instant & 0 API cost)
  const resolved = resolveLocationInput(trimmed);
  if (resolved) {
    const isUrl = resolved.source === "data_pin" || resolved.source === "camera" || resolved.source === "query" || resolved.source === "path";
    return [
      {
        title: resolved.placeName,
        subtitle:
          resolved.source === "data_pin"
            ? "Google Maps 精確標記位置 (Exact Pin)"
            : isUrl
            ? "來自 Google Maps 連結"
            : "貼上的自訂座標",
        lat: resolved.lat,
        lng: resolved.lng,
        lon: resolved.lng,
        source: isUrl ? "google_url" : "raw_coords",
      },
    ];
  }

  const { lat, lng, viewbox, language = "zh-TW", limit = 6 } = options || {};
  const seenCoordinates = new Set<string>();
  const results: (PlaceSearchResult & { distanceKm?: number })[] = [];

  // 2. Build Nominatim request with viewbox bias and multilingual headers
  let viewboxParam = "";
  if (viewbox) {
    viewboxParam = `&viewbox=${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}&bounded=0`;
  } else if (lat != null && lng != null) {
    const delta = 0.5; // ~55km bounding box around map center
    viewboxParam = `&viewbox=${lng - delta},${lat + delta},${lng + delta},${lat - delta}&bounded=0`;
  }

  const nominatimPromise = fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=${limit}${viewboxParam}`,
    {
      headers: {
        "User-Agent": "GoTravelApp/1.0 (Contact: admin@gotravel.app)",
        "Accept-Language": language.startsWith("en") ? "en,zh-TW;q=0.5" : "zh-TW,zh;q=0.9,en;q=0.6",
      },
    }
  )
    .then((res) => (res.ok ? res.json() : []))
    .catch((err) => {
      console.warn("Nominatim search error:", err);
      return [];
    });

  // 3. Build Photon request with lat/lon bias (Komoot's Elasticsearch OSM index)
  let photonBias = "";
  if (lat != null && lng != null) {
    photonBias = `&lat=${lat}&lon=${lng}`;
  }
  const photonPromise = fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=${limit}${photonBias}`
  )
    .then((res) => (res.ok ? res.json() : { features: [] }))
    .catch((err) => {
      console.warn("Photon search error:", err);
      return { features: [] };
    });

  // Execute in parallel
  const [nomData, photonData] = await Promise.all([nominatimPromise, photonPromise]);

  // Process Nominatim results
  if (Array.isArray(nomData)) {
    for (const item of nomData) {
      const pLat = parseFloat(item.lat);
      const pLng = parseFloat(item.lon);
      if (isNaN(pLat) || isNaN(pLng)) continue;

      const coordKey = `${pLat.toFixed(3)},${pLng.toFixed(3)}`;
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        const { title, subtitle } = extractPlaceTitle(item.display_name || "");
        const distanceKm = lat != null && lng != null ? calculateDistanceKm(lat, lng, pLat, pLng) : undefined;
        results.push({
          title,
          subtitle,
          lat: pLat,
          lng: pLng,
          lon: pLng,
          source: "osm",
          distanceKm,
        });
      }
    }
  }

  // Process Photon results
  if (photonData?.features && Array.isArray(photonData.features)) {
    for (const f of photonData.features) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const pLng = coords[0];
      const pLat = coords[1];
      if (isNaN(pLat) || isNaN(pLng)) continue;

      const coordKey = `${pLat.toFixed(3)},${pLng.toFixed(3)}`;
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        const props = f.properties || {};
        const title = props.name || props.street || "景點位置";
        const addrParts = [props.street, props.city, props.state, props.country].filter(Boolean);
        const subtitle = addrParts.join(", ");
        const distanceKm = lat != null && lng != null ? calculateDistanceKm(lat, lng, pLat, pLng) : undefined;

        results.push({
          title,
          subtitle,
          lat: pLat,
          lng: pLng,
          lon: pLng,
          source: "photon",
          distanceKm,
        });
      }
    }
  }

  // Sort by distance if map center is available
  if (lat != null && lng != null) {
    results.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }

  return results.slice(0, limit);
};
