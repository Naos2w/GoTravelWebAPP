import { describe, it, expect, beforeEach } from "vitest";
import {
  detectPwaEnvironment,
  parsePwaLaunchIntent,
  buildAppleShortcutsLinks,
  extractFirstHttpUrl,
  deriveSharedPlaceName,
  pickBestTripForShortcut,
  cleanPwaLaunchUrl,
} from "../../src/shared/services/pwaService";
import { Trip } from "../../src/types";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  lineIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Line/14.2.0",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 320.0.0.15.109 (iPhone15,2; iOS 17_4)",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 [FBAN/FBIOS;FBAV/450.0.0.48.108;FBBV/564789]",
  wechatAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47.2560",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

describe("pwaService (Unit Tests)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  describe("detectPwaEnvironment", () => {
    it("detects iOS Safari (non-standalone)", () => {
      expect(detectPwaEnvironment(UA.iosSafari, false)).toEqual({
        isStandalone: false,
        isIos: true,
        isAndroid: false,
        isInAppBrowser: false,
        inAppBrowserName: null,
        isSafari: true,
      });
    });

    it("detects iOS Chrome as iOS but not Safari", () => {
      const env = detectPwaEnvironment(UA.iosChrome, false);
      expect(env.isIos).toBe(true);
      expect(env.isSafari).toBe(false);
      expect(env.isInAppBrowser).toBe(false);
    });

    it("detects Android Chrome accurately", () => {
      expect(detectPwaEnvironment(UA.androidChrome, false)).toEqual({
        isStandalone: false,
        isIos: false,
        isAndroid: true,
        isInAppBrowser: false,
        inAppBrowserName: null,
        isSafari: false,
      });
    });

    it("detects LINE, Instagram, Facebook, and WeChat in-app browsers", () => {
      const lineEnv = detectPwaEnvironment(UA.lineIos, false);
      expect(lineEnv.isInAppBrowser).toBe(true);
      expect(lineEnv.inAppBrowserName).toBe("LINE");
      expect(lineEnv.isSafari).toBe(false);

      const igEnv = detectPwaEnvironment(UA.instagramIos, false);
      expect(igEnv.isInAppBrowser).toBe(true);
      expect(igEnv.inAppBrowserName).toBe("Instagram");
      expect(igEnv.isSafari).toBe(false);

      const fbEnv = detectPwaEnvironment(UA.facebookIos, false);
      expect(fbEnv.isInAppBrowser).toBe(true);
      expect(fbEnv.inAppBrowserName).toBe("Facebook");
      expect(fbEnv.isSafari).toBe(false);

      const wxEnv = detectPwaEnvironment(UA.wechatAndroid, false);
      expect(wxEnv.isInAppBrowser).toBe(true);
      expect(wxEnv.inAppBrowserName).toBe("WeChat");
      expect(wxEnv.isAndroid).toBe(true);
    });

    it("respects explicit standalone override and navigator.standalone", () => {
      expect(detectPwaEnvironment(UA.iosSafari, true).isStandalone).toBe(true);

      const origStandalone = (navigator as Navigator & { standalone?: boolean })
        .standalone;
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        value: true,
      });
      try {
        expect(detectPwaEnvironment(UA.iosSafari).isStandalone).toBe(true);
      } finally {
        Object.defineProperty(navigator, "standalone", {
          configurable: true,
          value: origStandalone,
        });
      }
    });
  });

  describe("parsePwaLaunchIntent", () => {
    it("parses home screen shortcuts for today, expenses, and flights", () => {
      expect(parsePwaLaunchIntent("/", "?shortcut=today")).toEqual({
        type: "shortcut",
        shortcut: "today",
        tab: "itinerary",
      });
      expect(parsePwaLaunchIntent("/", "?shortcut=expenses")).toEqual({
        type: "shortcut",
        shortcut: "expenses",
        tab: "expenses",
      });
      expect(parsePwaLaunchIntent("/", "?shortcut=flights")).toEqual({
        type: "shortcut",
        shortcut: "flights",
        tab: "flights",
      });
      expect(parsePwaLaunchIntent("/", "?shortcut=unknown")).toBeNull();
      expect(parsePwaLaunchIntent("/trips", "")).toBeNull();
    });

    it("parses Android Google Maps share_target when URL is inside text", () => {
      const intent = parsePwaLaunchIntent(
        "/share-target",
        "?title=Ichiran+Shinjuku&text=Check+out+Ichiran+Shinjuku+https%3A%2F%2Fmaps.app.goo.gl%2Fabcd1234"
      );

      expect(intent).toEqual({
        type: "share-target",
        title: "Ichiran Shinjuku",
        text: "Check out Ichiran Shinjuku https://maps.app.goo.gl/abcd1234",
        url: "",
        extractedUrl: "https://maps.app.goo.gl/abcd1234",
      });
    });

    it("parses iOS Shortcuts /share-target?url=... and ?shareUrl=... variants", () => {
      const direct = parsePwaLaunchIntent(
        "/share-target/",
        "?url=https%3A%2F%2Fmaps.google.com%2F%3Fq%3DTaipei%2B101&title=Taipei+101"
      );
      expect(direct).toEqual({
        type: "share-target",
        title: "Taipei 101",
        text: "",
        url: "https://maps.google.com/?q=Taipei+101",
        extractedUrl: "https://maps.google.com/?q=Taipei+101",
      });

      const queryVariant = parsePwaLaunchIntent(
        "/",
        "?shareUrl=https%3A%2F%2Fmaps.app.goo.gl%2Fxyz999"
      );
      expect(queryVariant).toEqual({
        type: "share-target",
        title: "",
        text: "",
        url: "https://maps.app.goo.gl/xyz999",
        extractedUrl: "https://maps.app.goo.gl/xyz999",
      });
    });
  });

  describe("extractFirstHttpUrl & deriveSharedPlaceName", () => {
    it("extracts first http(s) URL and trims trailing punctuation", () => {
      expect(
        extractFirstHttpUrl("Meet here: https://maps.app.goo.gl/abc123.")
      ).toBe("https://maps.app.goo.gl/abc123");
      expect(extractFirstHttpUrl("no link here")).toBe("");
    });

    it("derives clean place names from title, text, or Google Maps URL", () => {
      expect(
        deriveSharedPlaceName(
          "Shinjuku Gyoen - Google Maps",
          "",
          "https://maps.app.goo.gl/abc"
        )
      ).toBe("Shinjuku Gyoen");

      expect(
        deriveSharedPlaceName(
          "",
          "一蘭拉麵 新宿店 https://maps.app.goo.gl/abc",
          "https://maps.app.goo.gl/abc"
        )
      ).toBe("一蘭拉麵 新宿店");

      expect(
        deriveSharedPlaceName(
          "",
          "",
          "https://www.google.com/maps/place/Tokyo+Tower/@35.6585805,139.7454329,17z"
        )
      ).toBe("Tokyo Tower");
    });
  });

  describe("buildAppleShortcutsLinks", () => {
    it("returns normalized deep-link URLs without trailing slash duplication", () => {
      expect(buildAppleShortcutsLinks("https://gotravel.example.com/")).toEqual({
        today: "https://gotravel.example.com/?shortcut=today",
        flights: "https://gotravel.example.com/?shortcut=flights",
        expenses: "https://gotravel.example.com/?shortcut=expenses",
        quickSavePlace: "https://gotravel.example.com/share-target?url=",
      });
    });
  });

  describe("pickBestTripForShortcut & cleanPwaLaunchUrl", () => {
    const makeTrip = (
      id: string,
      startDate: string,
      endDate: string
    ): Trip => ({
      id,
      name: id,
      destination: "Japan",
      startDate,
      endDate,
      flights: [],
      expenses: [],
      checklist: [],
      itinerary: [],
    });

    it("prefers current trip, then ongoing, then nearest upcoming, then first", () => {
      const trips = [
        makeTrip("past", "2026-01-01", "2026-01-05"),
        makeTrip("future-far", "2026-12-01", "2026-12-05"),
        makeTrip("ongoing", "2026-05-01", "2026-05-10"),
        makeTrip("future-near", "2026-06-01", "2026-06-05"),
      ];

      expect(pickBestTripForShortcut(trips, "past", "2026-05-05")?.id).toBe("past");
      expect(pickBestTripForShortcut(trips, null, "2026-05-05")?.id).toBe(
        "ongoing"
      );
      expect(pickBestTripForShortcut(trips, null, "2026-05-20")?.id).toBe(
        "future-near"
      );
      expect(pickBestTripForShortcut(trips, null, "2027-01-01")?.id).toBe(
        "past"
      );
      expect(pickBestTripForShortcut([], null, "2026-05-05")).toBeNull();
    });

    it("strips PWA query params and normalizes /share-target path", () => {
      window.history.replaceState(
        null,
        "",
        "/share-target?url=https%3A%2F%2Fmaps.app.goo.gl%2Fabc&title=Test&keep=1"
      );
      cleanPwaLaunchUrl("/trips/trip-1");
      expect(window.location.pathname).toBe("/trips/trip-1");
      expect(window.location.search).toBe("?keep=1");
    });
  });
});
