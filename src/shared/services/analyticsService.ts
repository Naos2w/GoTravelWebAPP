export type CookieConsentState = "accepted" | "essential" | null;

export const COOKIE_CONSENT_STORAGE_KEY = "gotravel_cookie_consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: unknown[];
  }
}

const normalizeEnv = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim() : "";

/**
 * Reads the persisted cookie consent decision from localStorage.
 */
export const getCookieConsent = (): CookieConsentState => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (raw === "accepted" || raw === "essential") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Persists the user's cookie consent decision in localStorage.
 */
export const setCookieConsent = (state: "accepted" | "essential"): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, state);
  } catch {
    // Ignore storage quota or private-browsing errors
  }
};

const injectScriptOnce = (
  scriptId: string,
  src: string,
  extraAttrs?: Record<string, string>
): void => {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[data-gotravel-script="${scriptId}"]`)) {
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.setAttribute("data-gotravel-script", scriptId);
  if (extraAttrs) {
    for (const [k, v] of Object.entries(extraAttrs)) {
      script.setAttribute(k, v);
    }
  }
  document.head.appendChild(script);
};

/**
 * Lazily injects GA4, Google Ads, and Google AdSense scripts ONLY when:
 * 1. The corresponding VITE_* environment variable is non-empty, AND
 * 2. The user has explicitly granted `"accepted"` cookie consent.
 * Safe and idempotent across repeated calls.
 */
export const initThirdPartyScripts = (): void => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (getCookieConsent() !== "accepted") return;

  const ga4Id = normalizeEnv(import.meta.env.VITE_GA4_MEASUREMENT_ID);
  const googleAdsId = normalizeEnv(import.meta.env.VITE_GOOGLE_ADS_ID);
  const adsenseClientId = normalizeEnv(import.meta.env.VITE_ADSENSE_CLIENT_ID);

  const primaryGtagId = ga4Id || googleAdsId;
  if (primaryGtagId) {
    const isNewGtagBootstrap = !document.querySelector(
      'script[data-gotravel-script="gtag-js"]'
    );

    injectScriptOnce(
      "gtag-js",
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryGtagId)}`
    );

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };
    }

    if (isNewGtagBootstrap) {
      window.gtag("js", new Date());
    }

    const configuredIds = new Set<string>();
    if (ga4Id) configuredIds.add(ga4Id);
    if (googleAdsId) configuredIds.add(googleAdsId);

    for (const id of configuredIds) {
      const markerAttr = `data-gotravel-gtag-configured-${id}`;
      if (!document.documentElement.hasAttribute(markerAttr)) {
        document.documentElement.setAttribute(markerAttr, "true");
        window.gtag("config", id);
      }
    }
  }

  if (adsenseClientId) {
    injectScriptOnce(
      "adsense-js",
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`,
      { crossorigin: "anonymous" }
    );
  }
};

/**
 * Dispatches an analytics event via `window.gtag` when consent is `"accepted"`.
 * Safely no-ops if consent is not granted or `window.gtag` is unavailable.
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean>
): void => {
  if (typeof window === "undefined") return;
  if (getCookieConsent() !== "accepted") return;
  if (typeof window.gtag !== "function") return;

  try {
    window.gtag("event", eventName, params ?? {});
  } catch {
    // Never allow analytics failures to affect user flows
  }
};
