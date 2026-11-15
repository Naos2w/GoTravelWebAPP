export type AppView = "landing" | "list" | "detail";

export interface ParsedRoute {
  view: AppView;
  tripId: string | null;
  isLegacyQueryUrl: boolean;
}

const safeDecodeSegment = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * Resolves the application view and optional tripId from URL pathname and query string.
 * Supports:
 * - /                 -> landing
 * - /trips            -> list
 * - /trips/:tripId    -> detail
 * - /?tripId=:tripId  -> detail (legacy share link compatibility)
 */
export const parseRouteFromLocation = (
  locationObj: { pathname: string; search: string } = window.location
): ParsedRoute => {
  const params = new URLSearchParams(locationObj.search || "");
  const queryTripId = params.get("tripId");
  if (queryTripId && queryTripId.trim()) {
    return {
      view: "detail",
      tripId: queryTripId.trim(),
      isLegacyQueryUrl: true,
    };
  }

  const rawPath = locationObj.pathname || "/";
  const normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;

  if (normalizedPath === "/trips") {
    return {
      view: "list",
      tripId: null,
      isLegacyQueryUrl: false,
    };
  }

  const tripMatch = normalizedPath.match(/^\/trips\/([^/?#]+)$/);
  if (tripMatch && tripMatch[1]) {
    return {
      view: "detail",
      tripId: safeDecodeSegment(tripMatch[1]),
      isLegacyQueryUrl: false,
    };
  }

  return {
    view: "landing",
    tripId: null,
    isLegacyQueryUrl: false,
  };
};

/**
 * Builds canonical path for a given AppView and optional tripId.
 */
export const buildPathForRoute = (
  view: AppView,
  tripId?: string | null
): string => {
  if (view === "detail" && tripId) {
    return `/trips/${encodeURIComponent(tripId)}`;
  }
  if (view === "list") {
    return "/trips";
  }
  return "/";
};

/**
 * Builds a shareable trip permalink using path-based routing (/trips/:tripId).
 */
export const buildTripShareUrl = (
  tripId: string,
  origin: string = window.location.origin
): string => {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/trips/${encodeURIComponent(tripId)}`;
};

/**
 * Synchronizes the browser address bar with the current route using History API.
 * Strips legacy ?tripId= query parameters once migrated to /trips/:tripId.
 */
export const syncUrlWithRoute = (
  view: AppView,
  tripId?: string | null,
  mode: "push" | "replace" = "replace"
): void => {
  const targetPath = buildPathForRoute(view, tripId);
  const params = new URLSearchParams(window.location.search || "");
  const hasLegacyQuery = params.has("tripId");
  const hasAuthHash =
    window.location.hash.includes("access_token") ||
    window.location.hash.includes("refresh_token");

  if (view === "landing" && hasAuthHash) {
    return;
  }

  if (window.location.pathname === targetPath && !hasLegacyQuery && !hasAuthHash) {
    return;
  }

  params.delete("tripId");
  const remainingSearch = params.toString();
  const nextUrl = `${targetPath}${remainingSearch ? `?${remainingSearch}` : ""}`;

  if (mode === "push") {
    window.history.pushState({}, "", nextUrl);
  } else {
    window.history.replaceState({}, "", nextUrl);
  }
};
