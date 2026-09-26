import { describe, it, expect } from "vitest";
import {
  isGoogleMapsUrl,
  parseRawCoordinates,
  parseGoogleMapsUrl,
  resolveLocationInput,
} from "../../services/mapUrlService";

describe("mapUrlService (Unit Tests)", () => {
  describe("isGoogleMapsUrl", () => {
    it("should identify valid Google Maps URLs", () => {
      expect(
        isGoogleMapsUrl("https://www.google.com/maps/place/Tokyo+Tower/@35.6585805,139.7454329,17z")
      ).toBe(true);
      expect(isGoogleMapsUrl("https://maps.app.goo.gl/abcdef123456")).toBe(true);
      expect(isGoogleMapsUrl("https://goo.gl/maps/xyz987")).toBe(true);
      expect(isGoogleMapsUrl("https://maps.google.com/?q=25.0339,121.5644")).toBe(true);
    });

    it("should reject non-Google Maps URLs or standard strings", () => {
      expect(isGoogleMapsUrl("https://openstreetmap.org")).toBe(false);
      expect(isGoogleMapsUrl("Tokyo Tower")).toBe(false);
      expect(isGoogleMapsUrl("")).toBe(false);
    });
  });

  describe("parseRawCoordinates", () => {
    it("should parse comma-separated lat/lng correctly", () => {
      const coords = parseRawCoordinates("25.0339, 121.5644");
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeCloseTo(25.0339);
      expect(coords?.lng).toBeCloseTo(121.5644);
    });

    it("should parse space-separated lat/lng correctly", () => {
      const coords = parseRawCoordinates("-33.8688 151.2093");
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeCloseTo(-33.8688);
      expect(coords?.lng).toBeCloseTo(151.2093);
    });

    it("should reject invalid coordinate ranges or text", () => {
      expect(parseRawCoordinates("100.5, 50.0")).toBeNull(); // lat > 90
      expect(parseRawCoordinates("30.0, 200.0")).toBeNull(); // lng > 180
      expect(parseRawCoordinates("Taipei 101")).toBeNull();
      expect(parseRawCoordinates("")).toBeNull();
    });
  });

  describe("parseGoogleMapsUrl", () => {
    it("should prioritize exact POI pin coordinates (!3d / !4d) over viewport camera (@)", () => {
      // Pin is at (35.6585805, 139.7454329), while viewport camera is at (35.6500000, 139.7400000)
      const url =
        "https://www.google.com/maps/place/Tokyo+Tower/@35.6500000,139.7400000,15z/data=!3m1!4b1!4m6!3m5!1s0x60188bbd9009ec09:0x481a93f0d2a409dd!8m2!3d35.6585805!4d139.7454329";

      const parsed = parseGoogleMapsUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.placeName).toBe("Tokyo Tower");
      expect(parsed?.lat).toBeCloseTo(35.6585805);
      expect(parsed?.lng).toBeCloseTo(139.7454329);
      expect(parsed?.source).toBe("data_pin");
    });

    it("should fall back to camera coordinates (@lat,lng) if data pin is not present", () => {
      const url = "https://www.google.com/maps/place/Kyoto/@35.0116,135.7681,14z";

      const parsed = parseGoogleMapsUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.placeName).toBe("Kyoto");
      expect(parsed?.lat).toBeCloseTo(35.0116);
      expect(parsed?.lng).toBeCloseTo(135.7681);
      expect(parsed?.source).toBe("camera");
    });

    it("should extract coordinates from ?q=lat,lng query format", () => {
      const url = "https://maps.google.com/?q=25.0330,121.5654";
      const parsed = parseGoogleMapsUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.lat).toBeCloseTo(25.033);
      expect(parsed?.lng).toBeCloseTo(121.5654);
    });
  });

  describe("resolveLocationInput", () => {
    it("should resolve Google Maps URL input directly", () => {
      const url = "https://maps.google.com/?q=25.0330,121.5654";
      const result = resolveLocationInput(url);
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(25.033);
      expect(result?.lng).toBeCloseTo(121.5654);
    });

    it("should resolve raw coordinates directly", () => {
      const result = resolveLocationInput("35.6895, 139.6917");
      expect(result).not.toBeNull();
      expect(result?.placeName).toBe("自訂座標地點");
      expect(result?.source).toBe("raw_coords");
    });

    it("should return null for non-coordinate general search keywords", () => {
      expect(resolveLocationInput("Tokyo Tower")).toBeNull();
    });
  });
});
