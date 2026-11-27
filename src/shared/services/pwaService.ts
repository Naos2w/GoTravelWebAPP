import { Trip } from "../../types";
import { parseGoogleMapsUrl } from "../../features/itinerary/services/mapUrlService";

export type InAppBrowserName = "LINE" | "Instagram" | "Facebook" | "WeChat" | null;

export interface PwaEnvironment {
  isStandalone: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  inAppBrowserName: InAppBrowserName;
  isSafari: boolean;
}

export type PwaShortcutTab = "itinerary" | "expenses" | "flights";

export type PwaLaunchIntent =
  | {
      type: "shortcut";
      shortcut: "today" | "expenses" | "flights";
      tab: PwaShortcutTab;
    }
  | {
      type: "share-target";
      title: string;
      text: string;
      url: string;
      extractedUrl: string;
    }
  | null;

export interface AppleShortcutsLinks {
  today: string;
  flights: string;
  expenses: string;
  quickSavePlace: string;
}

const HTTP_URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;
const TRAILING_PUNCTUATION_REGEX = /[.,;:!?)]+$/;

/**
 * Extracts the first valid http/https URL from an arbitrary string.
 */
export const extractFirstHttpUrl = (raw?: string | null): string => {
  if (!raw) return "";
  const match = raw.match(HTTP_URL_REGEX);
  if (!match || !match[0]) return "";
  return match[0].replace(TRAILING_PUNCTUATION_REGEX, "");
};

/**
 * Detects PWA runtime environment: standalone mode, iOS / Android,
 * social In-App Browsers (LINE / Instagram / Facebook / WeChat), and Safari.
 */
export const detectPwaEnvironment = (
  ua?: string,
  isStandaloneOverride?: boolean
): PwaEnvironment => {
  const userAgent =
    typeof ua === "string"
      ? ua
      : typeof navigator !== "undefined"
        ? navigator.userAgent || ""
        : "";

  let isStandalone = false;
  if (typeof isStandaloneOverride === "boolean") {
    isStandalone = isStandaloneOverride;
  } else {
    const matchMediaStandalone =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosNavigatorStandalone =
      typeof navigator !== "undefined" &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    isStandalone = Boolean(matchMediaStandalone || iosNavigatorStandalone);
  }

  let inAppBrowserName: InAppBrowserName = null;
  if (/\bLine\//i.test(userAgent)) {
    inAppBrowserName = "LINE";
  } else if (/MicroMessenger/i.test(userAgent)) {
    inAppBrowserName = "WeChat";
  } else if (/Instagram/i.test(userAgent)) {
    inAppBrowserName = "Instagram";
  } else if (/FBAN|FBAV|FB_IAB|FBIOS|\bMessenger\b/i.test(userAgent)) {
    inAppBrowserName = "Facebook";
  }

  const isInAppBrowser = inAppBrowserName !== null;

  const isIosUa = /iPhone|iPad|iPod/i.test(userAgent);
  const isIpadDesktopUa =
    ua === undefined &&
    typeof navigator !== "undefined" &&
    navigator.platform === "MacIntel" &&
    (navigator.maxTouchPoints || 0) > 1;
  const isIos = isIosUa || isIpadDesktopUa;

  const isAndroid = /Android/i.test(userAgent);

  const isNonSafariBrowser =
    /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android|Edg\/|OPR\/|Firefox|SamsungBrowser/i.test(
      userAgent
    );
  const isSafari =
    /Safari/i.test(userAgent) && !isInAppBrowser && !isNonSafariBrowser;

  return {
    isStandalone,
    isIos,
    isAndroid,
    isInAppBrowser,
    inAppBrowserName,
    isSafari,
  };
};

/**
 * Parses PWA launch intents from URL pathname & search query:
 * - `/?shortcut=today|expenses|flights` -> `{ type: 'shortcut', shortcut, tab }`
 * - `/share-target?title=...&text=...&url=...` or `?shareUrl=...`
 *   -> `{ type: 'share-target', title, text, url, extractedUrl }`
 */
export const parsePwaLaunchIntent = (
  pathname?: string,
  search?: string
): PwaLaunchIntent => {
  const rawPathname =
    typeof pathname === "string"
      ? pathname
      : typeof window !== "undefined"
        ? window.location.pathname || "/"
        : "/";
  const rawSearch =
    typeof search === "string"
      ? search
      : typeof window !== "undefined"
        ? window.location.search || ""
        : "";

  const normalizedPath =
    rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") : rawPathname;
  const params = new URLSearchParams(rawSearch);

  const shareUrlParam = (params.get("shareUrl") || "").trim();
  const isShareTargetPath = normalizedPath === "/share-target";

  if (isShareTargetPath || shareUrlParam.length > 0) {
    const title = (params.get("title") || "").trim();
    const text = (params.get("text") || "").trim();
    const url = (params.get("url") || shareUrlParam || "").trim();
    const extractedUrl =
      extractFirstHttpUrl(url) ||
      extractFirstHttpUrl(text) ||
      extractFirstHttpUrl(title);

    return {
      type: "share-target",
      title,
      text,
      url,
      extractedUrl,
    };
  }

  const shortcut = (params.get("shortcut") || "").trim().toLowerCase();
  if (shortcut === "today") {
    return { type: "shortcut", shortcut: "today", tab: "itinerary" };
  }
  if (shortcut === "expenses") {
    return { type: "shortcut", shortcut: "expenses", tab: "expenses" };
  }
  if (shortcut === "flights") {
    return { type: "shortcut", shortcut: "flights", tab: "flights" };
  }

  return null;
};

/**
 * Builds clean deep-link URLs for iPhone Apple Shortcuts.
 */
export const buildAppleShortcutsLinks = (origin: string): AppleShortcutsLinks => {
  const cleanOrigin = (origin || "").trim().replace(/\/+$/, "");
  return {
    today: `${cleanOrigin}/?shortcut=today`,
    flights: `${cleanOrigin}/?shortcut=flights`,
    expenses: `${cleanOrigin}/?shortcut=expenses`,
    quickSavePlace: `${cleanOrigin}/share-target?url=`,
  };
};

const stripMapsSuffix = (raw: string): string =>
  raw
    .replace(/\s*[-–—|]\s*Google\s*(Maps|地圖)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Derives a clean default place name from a shared title, text, and extracted URL.
 */
export const deriveSharedPlaceName = (
  title?: string,
  text?: string,
  extractedUrl?: string
): string => {
  const cleanTitle = stripMapsSuffix(title || "");
  if (cleanTitle && !/^https?:\/\//i.test(cleanTitle)) {
    return cleanTitle;
  }

  const textWithoutUrl = stripMapsSuffix(
    (text || "").replace(HTTP_URL_REGEX, " ")
  );
  if (textWithoutUrl) {
    return textWithoutUrl;
  }

  if (extractedUrl) {
    const parsed = parseGoogleMapsUrl(extractedUrl);
    if (parsed?.placeName) {
      return parsed.placeName;
    }
  }

  return "";
};

const getLocalTodayDateStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Picks the best trip to open for a PWA app shortcut:
 * current trip -> ongoing trip -> nearest upcoming trip -> most recent trip.
 */
export const pickBestTripForShortcut = (
  trips: Trip[],
  currentTripId?: string | null,
  todayStr: string = getLocalTodayDateStr()
): Trip | null => {
  if (!trips || trips.length === 0) return null;

  if (currentTripId) {
    const active = trips.find((t) => t.id === currentTripId);
    if (active) return active;
  }

  const ongoing = trips.find(
    (t) =>
      Boolean(t.startDate) &&
      Boolean(t.endDate) &&
      t.startDate <= todayStr &&
      todayStr <= t.endDate
  );
  if (ongoing) return ongoing;

  const upcoming = trips
    .filter((t) => Boolean(t.startDate) && t.startDate > todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (upcoming.length > 0) return upcoming[0];

  return trips[0];
};

/**
 * Removes PWA launch query params (?shortcut=, ?url=, ?title=, ?text=, ?shareUrl=)
 * and normalizes /share-target path via history.replaceState.
 */
export const cleanPwaLaunchUrl = (fallbackPath?: string): void => {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname || "/";
  const normalizedPath =
    currentPath.length > 1 ? currentPath.replace(/\/+$/, "") : currentPath;
  const params = new URLSearchParams(window.location.search || "");

  const pwaKeys = ["shortcut", "url", "title", "text", "shareUrl"];
  const hadPwaParam = pwaKeys.some((k) => params.has(k));
  const wasSharePath = normalizedPath === "/share-target";

  if (!hadPwaParam && !wasSharePath) return;

  pwaKeys.forEach((k) => params.delete(k));
  const nextPath = wasSharePath ? fallbackPath || "/" : currentPath;
  const remaining = params.toString();
  const nextUrl = `${nextPath}${remaining ? `?${remaining}` : ""}${window.location.hash || ""}`;

  window.history.replaceState({}, "", nextUrl);
};
