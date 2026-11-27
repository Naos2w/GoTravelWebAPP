import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseSupabaseUser,
  saveRedirectTripId,
  consumeRedirectTripId,
  isSupabaseConfigured,
  extractTripIdFromLocation,
  getAuthRedirectUrl,
  signInWithGoogle,
  signInWithEmail,
} from "../../src/shared/services/authService";
import { supabase } from "../../src/shared/services/storageService";

describe("authService (Unit Tests)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  describe("parseSupabaseUser", () => {
    it("should parse a complete Supabase user properly", () => {
      const mockSupabaseUser = {
        id: "user-123",
        email: "traveler@example.com",
        user_metadata: {
          full_name: "Alice Wang",
          avatar_url: "https://example.com/avatar.jpg",
        },
      };

      const user = parseSupabaseUser(mockSupabaseUser);
      expect(user.id).toBe("user-123");
      expect(user.name).toBe("Alice Wang");
      expect(user.email).toBe("traveler@example.com");
      expect(user.picture).toBe("https://example.com/avatar.jpg");
    });

    it("should fallback gracefully if user metadata is empty", () => {
      const mockSupabaseUser = {
        id: "user-456",
        email: "bob@test.com",
      };

      const user = parseSupabaseUser(mockSupabaseUser);
      expect(user.id).toBe("user-456");
      expect(user.name).toBe("bob");
      expect(user.email).toBe("bob@test.com");
      expect(user.picture).toContain("dicebear.com");
    });

    it("should handle null or undefined input safely without throwing", () => {
      const user = parseSupabaseUser(null);
      expect(user.id).toBe("");
      expect(user.name).toBe("Guest");
      expect(user.email).toBe("");
    });
  });

  describe("redirectTripId in sessionStorage", () => {
    it("should save and consume redirect tripId correctly", () => {
      const tripId = "5bf223d6-4053-4a75-a38f-1c51596b1c5c";

      saveRedirectTripId(tripId);
      expect(sessionStorage.getItem("go_travel_auth_redirect_trip_id")).toBe(tripId);

      const consumed = consumeRedirectTripId();
      expect(consumed).toBe(tripId);

      // Verify it is one-time consumption (removed after read)
      expect(consumeRedirectTripId()).toBeNull();
      expect(sessionStorage.getItem("go_travel_auth_redirect_trip_id")).toBeNull();
    });

    it("should return null if no redirect tripId was stored", () => {
      expect(consumeRedirectTripId()).toBeNull();
    });
  });

  describe("isSupabaseConfigured", () => {
    it("should return a boolean based on environment configuration", () => {
      const configured = isSupabaseConfigured();
      expect(typeof configured).toBe("boolean");
    });
  });

  describe("getAuthRedirectUrl & extractTripIdFromLocation", () => {
    it("should return clean origin without dynamic subpaths or trailing slash", () => {
      window.history.replaceState(null, "", "/trips/trip-abc");
      const redirectUrl = getAuthRedirectUrl("", "https://dev-preview.vercel.app/");
      expect(redirectUrl).toBe("https://dev-preview.vercel.app");
    });

    it("should prefer VITE_AUTH_REDIRECT_URL / custom env override when set", () => {
      const redirectUrl = getAuthRedirectUrl("https://staging.gotravel.app/", "http://localhost:3000");
      expect(redirectUrl).toBe("https://staging.gotravel.app");

      vi.stubEnv("VITE_AUTH_REDIRECT_URL", "https://uat.example.com/");
      expect(getAuthRedirectUrl(undefined, "http://localhost:3000")).toBe("https://uat.example.com");
    });

    it("should extract tripId from both legacy query string and /trips/:tripId path", () => {
      expect(
        extractTripIdFromLocation({ pathname: "/", search: "?tripId=legacy-123" })
      ).toBe("legacy-123");

      expect(
        extractTripIdFromLocation({ pathname: "/trips/trip-xyz-789", search: "" })
      ).toBe("trip-xyz-789");

      expect(
        extractTripIdFromLocation({ pathname: "/trips", search: "" })
      ).toBeNull();
    });

    it("signInWithGoogle and signInWithEmail pass clean origin redirectTo and save path tripId", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://demo-project.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-value");

      const oauthSpy = vi
        .spyOn(supabase.auth, "signInWithOAuth")
        .mockResolvedValue({ data: { provider: "google", url: "https://mock" }, error: null } as any);
      const otpSpy = vi
        .spyOn(supabase.auth, "signInWithOtp")
        .mockResolvedValue({ data: { user: null, session: null }, error: null } as any);

      window.history.replaceState(null, "", "/trips/trip-oauth-99");
      await signInWithGoogle();

      expect(oauthSpy).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: window.location.origin.replace(/\/+$/, ""),
        },
      });
      expect(consumeRedirectTripId()).toBe("trip-oauth-99");

      window.history.replaceState(null, "", "/trips/trip-email-88");
      await signInWithEmail("traveler@example.com");

      expect(otpSpy).toHaveBeenCalledWith({
        email: "traveler@example.com",
        options: {
          emailRedirectTo: window.location.origin.replace(/\/+$/, ""),
        },
      });
      expect(consumeRedirectTripId()).toBe("trip-email-88");
    });
  });
});
