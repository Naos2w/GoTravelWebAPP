import { supabase } from "./storageService";
import { User } from "../types";

const REDIRECT_TRIP_KEY = "go_travel_auth_redirect_trip_id";

/**
 * Checks if Supabase URL and Anon Key are properly configured.
 */
export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("placeholder") || key.includes("placeholder")) return false;
  return true;
};

/**
 * Safely parses a Supabase User object into our application's User type,
 * with fallbacks to avoid crashes when full_name or picture are missing.
 */
export const parseSupabaseUser = (supabaseUser: any): User => {
  if (!supabaseUser) {
    return {
      id: "",
      name: "Guest",
      email: "",
      picture: "",
    };
  }

  const meta = supabaseUser.user_metadata || {};
  const email = supabaseUser.email || "";
  const name =
    meta.full_name ||
    meta.name ||
    (email ? email.split("@")[0] : "") ||
    "User";

  const picture =
    meta.avatar_url ||
    meta.picture ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  return {
    id: supabaseUser.id,
    name,
    email,
    picture,
  };
};

/**
 * Saves a deep link tripId into sessionStorage so it survives OAuth redirection.
 */
export const saveRedirectTripId = (tripId: string): void => {
  try {
    sessionStorage.setItem(REDIRECT_TRIP_KEY, tripId);
  } catch (e) {
    console.warn("Failed to store redirect tripId in sessionStorage", e);
  }
};

/**
 * Consumes (reads and deletes) the stored deep link tripId.
 */
export const consumeRedirectTripId = (): string | null => {
  try {
    const tripId = sessionStorage.getItem(REDIRECT_TRIP_KEY);
    if (tripId) {
      sessionStorage.removeItem(REDIRECT_TRIP_KEY);
      return tripId;
    }
  } catch (e) {
    console.warn("Failed to consume redirect tripId from sessionStorage", e);
  }
  return null;
};

/**
 * Extracts a target tripId from either legacy query parameter (?tripId=...)
 * or path-based route (/trips/:tripId).
 */
export const extractTripIdFromLocation = (
  locationObj: { pathname: string; search: string } = window.location
): string | null => {
  const params = new URLSearchParams(locationObj.search || "");
  const queryTripId = params.get("tripId");
  if (queryTripId && queryTripId.trim()) {
    return queryTripId.trim();
  }

  const pathMatch = (locationObj.pathname || "").match(/^\/trips\/([^/?#]+)/);
  if (pathMatch && pathMatch[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }

  return null;
};

/**
 * Returns the clean origin URL for Supabase OAuth / Magic Link `redirectTo`
 * so dynamic subpaths (e.g. /trips/:tripId) never cause whitelist mismatches
 * that fall back to the production Site URL.
 */
export const getAuthRedirectUrl = (
  customEnvRedirect?: string,
  origin: string = window.location.origin
): string => {
  const envRedirect = customEnvRedirect ?? import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (typeof envRedirect === "string" && envRedirect.trim()) {
    return envRedirect.trim().replace(/\/+$/, "");
  }
  return origin.replace(/\/+$/, "");
};

const preserveDeepLinkTripId = (redirectTripId?: string | null): void => {
  const targetTripId = redirectTripId || extractTripIdFromLocation();
  if (targetTripId) {
    saveRedirectTripId(targetTripId);
  }
};

/**
 * Initiates Google OAuth login via Supabase.
 * Checks for proper configuration and saves redirect target.
 */
export const signInWithGoogle = async (redirectTripId?: string | null): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  preserveDeepLinkTripId(redirectTripId);
  const redirectUrl = getAuthRedirectUrl();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) throw error;
};

/**
 * Initiates Email Magic Link (OTP) passwordless sign in.
 * Sends a one-time sign-in link to user's email.
 */
export const signInWithEmail = async (
  email: string,
  redirectTripId?: string | null
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    throw new Error("INVALID_EMAIL");
  }

  preserveDeepLinkTripId(redirectTripId);
  const redirectUrl = getAuthRedirectUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;
};

/**
 * Resilient sign-out function.
 * Even if Supabase server returns 403 Forbidden (e.g. expired or invalid token),
 * this ensures local storage tokens and local state are cleared cleanly.
 */
export const signOutSafely = async (): Promise<void> => {
  try {
    // Attempt local-scope signOut first to guarantee client session is dropped
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("Server sign-out rejected or failed, executing local fallback:", err);
  } finally {
    // Thorough cleanup of any Supabase tokens in localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase.auth.token"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Failed to clear localStorage auth keys:", e);
    }

    // Clean any OAuth access_token or error from URL hash
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }
};
