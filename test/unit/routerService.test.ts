import { describe, it, expect, beforeEach } from "vitest";
import {
  AppView,
  isPublicContentView,
  parseRouteFromLocation,
  buildPathForRoute,
  buildTripShareUrl,
  syncUrlWithRoute,
} from "../../src/shared/services/routerService";

describe("routerService (Unit Tests)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  describe("parseRouteFromLocation", () => {
    it("resolves / to landing view", () => {
      expect(parseRouteFromLocation({ pathname: "/", search: "" })).toEqual({
        view: "landing",
        tripId: null,
        isLegacyQueryUrl: false,
      });
    });

    it("resolves /trips and /trips/ to list view", () => {
      expect(parseRouteFromLocation({ pathname: "/trips", search: "" })).toEqual({
        view: "list",
        tripId: null,
        isLegacyQueryUrl: false,
      });
      expect(parseRouteFromLocation({ pathname: "/trips/", search: "" })).toEqual({
        view: "list",
        tripId: null,
        isLegacyQueryUrl: false,
      });
    });

    it("resolves /trips/:tripId and trailing-slash variant to detail view", () => {
      expect(
        parseRouteFromLocation({ pathname: "/trips/abc-123", search: "" })
      ).toEqual({
        view: "detail",
        tripId: "abc-123",
        isLegacyQueryUrl: false,
      });

      expect(
        parseRouteFromLocation({ pathname: "/trips/abc-123/", search: "" })
      ).toEqual({
        view: "detail",
        tripId: "abc-123",
        isLegacyQueryUrl: false,
      });
    });

    it("recognizes legacy /?tripId=... links for backward compatibility", () => {
      expect(
        parseRouteFromLocation({ pathname: "/", search: "?tripId=legacy-456" })
      ).toEqual({
        view: "detail",
        tripId: "legacy-456",
        isLegacyQueryUrl: true,
      });
    });

    it("resolves all 6 public content routes and trailing-slash variants", () => {
      const publicViews: AppView[] = [
        "guide",
        "templates",
        "about",
        "privacy",
        "terms",
        "contact",
      ];

      for (const view of publicViews) {
        expect(isPublicContentView(view)).toBe(true);
        expect(
          parseRouteFromLocation({ pathname: `/${view}`, search: "" })
        ).toEqual({
          view,
          tripId: null,
          isLegacyQueryUrl: false,
        });
        expect(
          parseRouteFromLocation({ pathname: `/${view}/`, search: "" })
        ).toEqual({
          view,
          tripId: null,
          isLegacyQueryUrl: false,
        });
      }

      expect(isPublicContentView("landing")).toBe(false);
      expect(isPublicContentView("list")).toBe(false);
      expect(isPublicContentView("detail")).toBe(false);
    });
  });

  describe("buildPathForRoute & buildTripShareUrl", () => {
    it("builds canonical paths for each view including public content pages", () => {
      expect(buildPathForRoute("landing")).toBe("/");
      expect(buildPathForRoute("list")).toBe("/trips");
      expect(buildPathForRoute("detail", "trip-99")).toBe("/trips/trip-99");
      expect(buildPathForRoute("detail", null)).toBe("/");
      expect(buildPathForRoute("guide")).toBe("/guide");
      expect(buildPathForRoute("templates")).toBe("/templates");
      expect(buildPathForRoute("about")).toBe("/about");
      expect(buildPathForRoute("privacy")).toBe("/privacy");
      expect(buildPathForRoute("terms")).toBe("/terms");
      expect(buildPathForRoute("contact")).toBe("/contact");
    });

    it("builds clean path-based share URLs", () => {
      expect(buildTripShareUrl("trip-uuid-1", "https://gotravel.example.com/")).toBe(
        "https://gotravel.example.com/trips/trip-uuid-1"
      );
    });
  });

  describe("syncUrlWithRoute", () => {
    it("updates browser pathname and strips legacy ?tripId= query param", () => {
      window.history.replaceState(null, "", "/?tripId=legacy-456&utm_source=share");
      syncUrlWithRoute("detail", "legacy-456", "replace");

      expect(window.location.pathname).toBe("/trips/legacy-456");
      expect(window.location.search).toBe("?utm_source=share");
    });

    it("supports push navigation between /trips and /trips/:tripId", () => {
      syncUrlWithRoute("list", null, "replace");
      expect(window.location.pathname).toBe("/trips");

      syncUrlWithRoute("detail", "trip-789", "push");
      expect(window.location.pathname).toBe("/trips/trip-789");
    });
  });
});
