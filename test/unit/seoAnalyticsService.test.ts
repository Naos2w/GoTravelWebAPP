import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { applyPageSeo, SeoRouteKey } from "../../src/shared/services/seoService";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  getCookieConsent,
  setCookieConsent,
  initThirdPartyScripts,
  trackEvent,
} from "../../src/shared/services/analyticsService";
import { CookieConsentBanner } from "../../src/shared/components/CookieConsentBanner";
import { AdSlot } from "../../src/shared/components/AdSlot";

describe("seoService & analyticsService (Unit Tests)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = "";
    document.title = "";
    delete window.gtag;
    delete window.dataLayer;
    delete window.adsbygoogle;
    for (const attr of Array.from(document.documentElement.attributes)) {
      if (attr.name.startsWith("data-gotravel-gtag-configured-")) {
        document.documentElement.removeAttribute(attr.name);
      }
    }
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("applyPageSeo", () => {
    it("creates meta description if missing and updates document.title for zh and en", () => {
      applyPageSeo("guide", "zh");
      expect(document.title).toContain("使用教學");
      expect(document.title).toContain("Go Travel");

      const meta = document.querySelector('meta[name="description"]');
      expect(meta).not.toBeNull();
      expect(meta?.getAttribute("content")).toContain("Google Maps");

      applyPageSeo("guide", "en");
      expect(document.title).toBe("User Guide & FAQ | Go Travel");
      expect(meta?.getAttribute("content")).toContain("Learn how to plan trips");
      expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    });

    it("supports all SeoRouteKey values and optional customTitle", () => {
      const routes: SeoRouteKey[] = [
        "landing",
        "list",
        "detail",
        "guide",
        "templates",
        "about",
        "privacy",
        "terms",
        "contact",
      ];

      for (const route of routes) {
        applyPageSeo(route, "en");
        expect(document.title).toContain("Go Travel");
        const content = document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content");
        expect(content && content.length).toBeGreaterThan(20);
      }

      applyPageSeo("detail", "zh", "東京五日行");
      expect(document.title).toBe("東京五日行 | Go Travel");

      applyPageSeo("detail", "en", "Kyoto Walk | Go Travel");
      expect(document.title).toBe("Kyoto Walk | Go Travel");
    });
  });

  describe("getCookieConsent & setCookieConsent", () => {
    it("returns null by default and ignores unrecognized stored values", () => {
      expect(getCookieConsent()).toBeNull();
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "invalid-value");
      expect(getCookieConsent()).toBeNull();
    });

    it("persists accepted and essential consent states", () => {
      setCookieConsent("essential");
      expect(getCookieConsent()).toBe("essential");

      setCookieConsent("accepted");
      expect(getCookieConsent()).toBe("accepted");
    });
  });

  describe("initThirdPartyScripts", () => {
    it("does not inject scripts when consent is missing or essential", () => {
      vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "G-TEST1234");
      vi.stubEnv("VITE_GOOGLE_ADS_ID", "AW-98765");
      vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-1234567890");

      initThirdPartyScripts();
      expect(document.head.querySelectorAll("script")).toHaveLength(0);

      setCookieConsent("essential");
      initThirdPartyScripts();
      expect(document.head.querySelectorAll("script")).toHaveLength(0);
    });

    it("does not inject scripts when env variables are empty even if accepted", () => {
      setCookieConsent("accepted");
      vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "");
      vi.stubEnv("VITE_GOOGLE_ADS_ID", "");
      vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "");

      initThirdPartyScripts();
      expect(document.head.querySelectorAll("script")).toHaveLength(0);
    });

    it("injects GA4, Google Ads, and AdSense scripts idempotently when accepted", () => {
      setCookieConsent("accepted");
      vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "G-TEST1234");
      vi.stubEnv("VITE_GOOGLE_ADS_ID", "AW-98765");
      vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-1234567890");

      initThirdPartyScripts();
      initThirdPartyScripts();

      const gtagScripts = document.head.querySelectorAll(
        'script[data-gotravel-script="gtag-js"]'
      );
      const adsenseScripts = document.head.querySelectorAll(
        'script[data-gotravel-script="adsense-js"]'
      );

      expect(gtagScripts).toHaveLength(1);
      expect(gtagScripts[0].getAttribute("src")).toBe(
        "https://www.googletagmanager.com/gtag/js?id=G-TEST1234"
      );
      expect(adsenseScripts).toHaveLength(1);
      expect(adsenseScripts[0].getAttribute("src")).toBe(
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890"
      );
      expect(typeof window.gtag).toBe("function");
      expect(Array.isArray(window.dataLayer)).toBe(true);
    });
  });

  describe("trackEvent", () => {
    it("safely no-ops when window.gtag is absent or consent is not accepted", () => {
      setCookieConsent("accepted");
      expect(() =>
        trackEvent("trip_created", { template: "tokyo-3d" })
      ).not.toThrow();

      const mockGtag = vi.fn();
      window.gtag = mockGtag;
      setCookieConsent("essential");
      trackEvent("trip_created", { template: "tokyo-3d" });
      expect(mockGtag).not.toHaveBeenCalled();

      window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
      trackEvent("trip_created", { template: "tokyo-3d" });
      expect(mockGtag).not.toHaveBeenCalled();
    });

    it("forwards events to window.gtag when consent is accepted", () => {
      const mockGtag = vi.fn();
      window.gtag = mockGtag;
      setCookieConsent("accepted");

      trackEvent("template_applied", { template_id: "swiss-5d", days: 5 });

      expect(mockGtag).toHaveBeenCalledTimes(1);
      expect(mockGtag).toHaveBeenCalledWith("event", "template_applied", {
        template_id: "swiss-5d",
        days: 5,
      });
    });
  });

  describe("CookieConsentBanner", () => {
    it("renders when consent is null, hides on choice, and initializes scripts when accepted", () => {
      vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "G-TEST1234");
      const onNavigatePrivacy = vi.fn();

      render(
        React.createElement(CookieConsentBanner, {
          language: "zh",
          onNavigatePrivacy,
        })
      );

      expect(screen.getByTestId("cookie-consent-banner")).toBeInTheDocument();
      fireEvent.click(screen.getByText("隱私權政策"));
      expect(onNavigatePrivacy).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId("cookie-accept-btn"));
      expect(getCookieConsent()).toBe("accepted");
      expect(screen.queryByTestId("cookie-consent-banner")).not.toBeInTheDocument();
      expect(
        document.head.querySelectorAll('script[data-gotravel-script="gtag-js"]')
      ).toHaveLength(1);
    });

    it("does not render when user already selected essential", () => {
      setCookieConsent("essential");
      render(
        React.createElement(CookieConsentBanner, {
          language: "en",
          onNavigatePrivacy: vi.fn(),
        })
      );
      expect(screen.queryByTestId("cookie-consent-banner")).not.toBeInTheDocument();
    });
  });

  describe("AdSlot", () => {
    it("returns null when AdSense env is missing or consent is not accepted", () => {
      setCookieConsent("accepted");
      const { rerender } = render(
        React.createElement(AdSlot, { slot: "1234567890", language: "zh" })
      );
      expect(screen.queryByTestId("ad-slot-container")).not.toBeInTheDocument();

      vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-1234567890");
      setCookieConsent("essential");
      rerender(
        React.createElement(AdSlot, { slot: "1234567890", language: "zh" })
      );
      expect(screen.queryByTestId("ad-slot-container")).not.toBeInTheDocument();
    });

    it("renders labeled aside and pushes to adsbygoogle when configured and accepted", () => {
      vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-1234567890");
      setCookieConsent("accepted");

      render(
        React.createElement(AdSlot, { slot: "1234567890", language: "en" })
      );
      const container = screen.getByTestId("ad-slot-container");
      expect(container).toHaveAttribute("aria-label", "Advertisement");
      expect(container).toHaveTextContent("Sponsored");
      expect(window.adsbygoogle).toHaveLength(1);
    });
  });
});
