export interface ParsedPlaceInfo {
  placeName: string;
  lat: number;
  lng: number;
  source: "data_pin" | "query" | "path" | "camera" | "raw_coords";
}

/**
 * Checks if a string looks like a Google Maps URL.
 */
export const isGoogleMapsUrl = (input: string): boolean => {
  if (!input) return false;
  const str = input.trim().toLowerCase();
  return (
    str.includes("google.") && (str.includes("/maps") || str.includes("maps?")) ||
    str.includes("maps.google.") ||
    str.includes("goo.gl/maps") ||
    str.includes("maps.app.goo.gl")
  );
};

/**
 * Checks if a string is a raw coordinate string (e.g. "25.0339, 121.5644" or "25.0339 121.5644").
 */
export const parseRawCoordinates = (input: string): { lat: number; lng: number } | null => {
  if (!input) return null;
  const trimmed = input.trim();
  const coordRegex = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;
  const match = trimmed.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
};

/**
 * Parses Google Maps URL and extracts place name and coordinates.
 * Prioritizes exact POI pin coordinates (!3d / !4d) over viewport camera (@lat,lng).
 */
export const parseGoogleMapsUrl = (url: string): ParsedPlaceInfo | null => {
  if (!url || !isGoogleMapsUrl(url)) return null;

  let placeName = "";
  let lat: number | null = null;
  let lng: number | null = null;
  let source: ParsedPlaceInfo["source"] = "camera";

  // 1. Extract place name from /place/<name>/ path
  const placeMatch = url.match(/\/place\/([^\/@?#]+)/);
  if (placeMatch && placeMatch[1]) {
    try {
      const rawName = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      // Check if place name is just coordinates (e.g. "25.0339,121.5644")
      if (!/^-?\d+(?:\.\d+)?[,\s]+-?\d+(?:\.\d+)?$/.test(rawName)) {
        placeName = rawName;
      }
    } catch (e) {
      console.warn("Failed to decode place name from Google Maps URL:", e);
    }
  }

  // 1.1 If no /place/ name, check query parameter q or query (e.g. ?q=Taipei+101)
  if (!placeName) {
    const queryNameMatch = url.match(/[?&](?:q|query)=([^&@#]+)/);
    if (queryNameMatch && queryNameMatch[1]) {
      try {
        const rawQuery = decodeURIComponent(queryNameMatch[1].replace(/\+/g, " ")).trim();
        // Skip if query is just coordinates (e.g. "loc:25.0339,121.5644" or "25.0339,121.5644")
        const cleanQuery = rawQuery.replace(/^loc:\s*/i, "");
        if (!/^-?\d+(?:\.\d+)?[,\s]+-?\d+(?:\.\d+)?$/.test(cleanQuery)) {
          placeName = cleanQuery;
        }
      } catch (e) {}
    }
  }

  // 2. Exact POI pin coordinates in data parameter (!3d<lat>!4d<lng> or !8m2!3d<lat>!4d<lng>)
  // In Google Maps URLs, the exact place pin coordinates are encoded in the data payload:
  // e.g. ...!3d47.6767073!4d8.6168959...
  const dataCoordsMatch = url.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  if (dataCoordsMatch) {
    const pLat = parseFloat(dataCoordsMatch[1]);
    const pLng = parseFloat(dataCoordsMatch[2]);
    if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
      lat = pLat;
      lng = pLng;
      source = "data_pin";
    }
  }

  // 3. Explicit coordinates in query string (e.g. ?q=25.0339,121.5644 or &ll=25.0339,121.5644)
  if (lat == null || lng == null) {
    const queryCoordsMatch = url.match(/[?&](?:q|query|ll|loc)=(?:loc:)?(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (queryCoordsMatch) {
      const qLat = parseFloat(queryCoordsMatch[1]);
      const qLng = parseFloat(queryCoordsMatch[2]);
      if (!isNaN(qLat) && !isNaN(qLng) && qLat >= -90 && qLat <= 90 && qLng >= -180 && qLng <= 180) {
        lat = qLat;
        lng = qLng;
        source = "query";
      }
    }
  }

  // 4. Coordinates in /place/<lat>,<lng> path
  if (lat == null || lng == null) {
    const pathCoordsMatch = url.match(/\/place\/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (pathCoordsMatch) {
      const pLat = parseFloat(pathCoordsMatch[1]);
      const pLng = parseFloat(pathCoordsMatch[2]);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
        lat = pLat;
        lng = pLng;
        source = "path";
      }
    }
  }

  // 5. Fallback: Camera viewport center (@<lat>,<lng>,<zoom>z)
  if (lat == null || lng == null) {
    const cameraCoordsMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (cameraCoordsMatch) {
      const cLat = parseFloat(cameraCoordsMatch[1]);
      const cLng = parseFloat(cameraCoordsMatch[2]);
      if (!isNaN(cLat) && !isNaN(cLng) && cLat >= -90 && cLat <= 90 && cLng >= -180 && cLng <= 180) {
        lat = cLat;
        lng = cLng;
        source = "camera";
      }
    }
  }

  if (lat != null && lng != null) {
    return {
      placeName: placeName || (source === "data_pin" || source === "query" ? "Google Maps 標記地點" : "Google Maps 位置"),
      lat,
      lng,
      source,
    };
  }

  return null;
};

/**
 * Universal resolver: checks raw coordinates first, then Google Maps URLs.
 */
export const resolveLocationInput = (input: string): ParsedPlaceInfo | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // Try raw coordinates
  const rawCoords = parseRawCoordinates(trimmed);
  if (rawCoords) {
    return {
      placeName: "自訂座標地點",
      lat: rawCoords.lat,
      lng: rawCoords.lng,
      source: "raw_coords",
    };
  }

  // Try Google Maps URL
  return parseGoogleMapsUrl(trimmed);
};
