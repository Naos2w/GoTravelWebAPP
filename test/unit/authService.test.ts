import { describe, it, expect, beforeEach } from "vitest";
import {
  parseSupabaseUser,
  saveRedirectTripId,
  consumeRedirectTripId,
  isSupabaseConfigured,
} from "../../services/authService";

describe("authService (Unit Tests)", () => {
  beforeEach(() => {
    sessionStorage.clear();
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
});
