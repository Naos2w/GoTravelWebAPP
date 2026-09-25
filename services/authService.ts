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
 * Initiates Google OAuth login via Supabase.
 * Checks for proper configuration and saves redirect target.
 */
export const signInWithGoogle = async (redirectTripId?: string | null): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  if (redirectTripId) {
    saveRedirectTripId(redirectTripId);
  } else {
    const params = new URLSearchParams(window.location.search);
    const urlTripId = params.get("tripId");
    if (urlTripId) {
      saveRedirectTripId(urlTripId);
    }
  }

  // Use clean origin + pathname so redirect URL matches standard Supabase whitelist
  const redirectUrl = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
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
