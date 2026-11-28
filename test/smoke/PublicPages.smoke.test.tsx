import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  CURATED_TRIP_TEMPLATES,
  createTripFromTemplate,
} from "../../src/shared/data/demoTemplates";
import {
  OnboardingTour,
  ONBOARDING_STORAGE_KEY,
  isOnboardingTourDone,
  markOnboardingTourDone,
  resetOnboardingTour,
} from "../../src/shared/components/OnboardingTour";
import { LegalPage, SiteFooter } from "../../src/pages/LegalPages";
import { GuidePage } from "../../src/pages/GuidePage";
import { TemplatesPage } from "../../src/pages/TemplatesPage";

describe("Public Pages, Curated Templates & OnboardingTour (Smoke Tests)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe("demoTemplates", () => {
    it("exposes 3 curated bilingual templates and builds valid unique Trip objects", () => {
      expect(CURATED_TRIP_TEMPLATES.map((t) => t.id)).toEqual([
        "tokyo-3d",
        "kansai-4d",
        "swiss-5d",
      ]);

      const tripA = createTripFromTemplate("tokyo-3d", "user-42", "Alice");
      const tripB = createTripFromTemplate("tokyo-3d", "user-42", "Alice");

      expect(tripA.id).not.toBe(tripB.id);
      expect(tripA.user_id).toBe("user-42");
      expect(tripA.name).toBe("東京 3 日精華散步");
      expect(tripA.flights).toHaveLength(1);
      expect(tripA.flights[0].outbound.departureAirport).toBe("TPE");
      expect(tripA.flights[0].outbound.arrivalAirport).toBe("NRT");
      expect(tripA.flights[0].traveler_name).toBe("Alice");
      expect(tripA.itinerary).toHaveLength(3);
      expect(tripA.itinerary[0].items.length).toBeGreaterThan(0);
      expect(tripA.itinerary[0].items[0].lat).toBeTypeOf("number");
      expect(tripA.itinerary[0].items[0].lng).toBeTypeOf("number");
      expect(tripA.expenses.length).toBeGreaterThan(0);
      expect(tripA.checklist.length).toBeGreaterThan(0);

      // Start date is scheduled ~30 days from today
      const expectedStart = new Date();
      expectedStart.setHours(12, 0, 0, 0);
      expectedStart.setDate(expectedStart.getDate() + 30);
      const yyyy = expectedStart.getFullYear();
      const mm = String(expectedStart.getMonth() + 1).padStart(2, "0");
      const dd = String(expectedStart.getDate()).padStart(2, "0");
      expect(tripA.startDate).toBe(`${yyyy}-${mm}-${dd}`);
    });
  });

  describe("GuidePage", () => {
    it("renders 5 core workflows, toggles accordion FAQ items, triggers replay tour, and mounts bottomSlot", () => {
      const onBack = vi.fn();
      const onNavigate = vi.fn();
      const onReplayTour = vi.fn();

      render(
        <GuidePage
          language="zh"
          onBack={onBack}
          onNavigate={onNavigate}
          onReplayTour={onReplayTour}
          bottomSlot={<div data-testid="mock-ad-slot">Sponsored Slot</div>}
        />
      );

      // 5 core workflows present
      expect(screen.getByTestId("guide-workflow-01")).toBeInTheDocument();
      expect(screen.getByTestId("guide-workflow-05")).toBeInTheDocument();

      // Replay onboarding tour CTA
      const replayBtn = screen.getByTestId("guide-replay-tour-btn");
      expect(replayBtn).toHaveTextContent("重新觀看新手導覽");
      fireEvent.click(replayBtn);
      expect(onReplayTour).toHaveBeenCalledTimes(1);

      // Accordion FAQ toggle: item 0 starts expanded, clicking item 2 opens it and closes item 0
      expect(screen.getByTestId("faq-panel-0")).toBeInTheDocument();
      expect(screen.queryByTestId("faq-panel-2")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("faq-trigger-2"));
      expect(screen.getByTestId("faq-panel-2")).toBeInTheDocument();
      expect(screen.queryByTestId("faq-panel-0")).not.toBeInTheDocument();

      // Clicking item 2 again collapses it
      fireEvent.click(screen.getByTestId("faq-trigger-2"));
      expect(screen.queryByTestId("faq-panel-2")).not.toBeInTheDocument();

      // Optional bottomSlot rendered safely
      expect(screen.getByTestId("mock-ad-slot")).toBeInTheDocument();

      // Back button works
      fireEvent.click(screen.getByTestId("public-shell-back-btn"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("TemplatesPage", () => {
    it("renders all 3 curated templates, switches day-by-day preview, and fires onUseTemplate", () => {
      const onUseTemplate = vi.fn();
      const onNavigate = vi.fn();

      render(
        <TemplatesPage
          language="zh"
          onBack={vi.fn()}
          onNavigate={onNavigate}
          onUseTemplate={onUseTemplate}
          bottomSlot={<div data-testid="templates-ad-slot">Ad Placeholder</div>}
        />
      );

      expect(screen.getByTestId("template-card-tokyo-3d")).toBeInTheDocument();
      expect(screen.getByTestId("template-card-kansai-4d")).toBeInTheDocument();
      expect(screen.getByTestId("template-card-swiss-5d")).toBeInTheDocument();

      // Switch Tokyo preview from Day 1 to Day 2
      const tokyoPreview = screen.getByTestId("template-tokyo-3d-day-preview");
      expect(tokyoPreview).toHaveTextContent("淺草寺");
      fireEvent.click(screen.getByTestId("template-tokyo-3d-day-2"));
      expect(tokyoPreview).toHaveTextContent("teamLab Planets TOKYO");

      // Click CTA on Swiss template
      const swissBtn = screen.getByTestId("use-template-btn-swiss-5d");
      expect(swissBtn).toHaveTextContent("一鍵套用此範本");
      fireEvent.click(swissBtn);
      expect(onUseTemplate).toHaveBeenCalledWith("swiss-5d");

      expect(screen.getByTestId("templates-ad-slot")).toBeInTheDocument();
    });
  });

  describe("LegalPage & SiteFooter", () => {
    it("renders about, privacy (disclosing Supabase, Google OAuth, GA4, AdSense), terms, and contact pages", async () => {
      const onNavigate = vi.fn();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      const { rerender } = render(
        <LegalPage
          page="about"
          language="zh"
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />
      );
      expect(screen.getByTestId("legal-page-about")).toBeInTheDocument();

      // Footer links trigger onNavigate
      fireEvent.click(screen.getByTestId("footer-link-privacy"));
      expect(onNavigate).toHaveBeenCalledWith("/privacy");

      // Privacy page explicitly discloses Supabase, Google OAuth, GA4, Google AdSense
      rerender(
        <LegalPage
          page="privacy"
          language="zh"
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />
      );
      const privacyEl = screen.getByTestId("legal-page-privacy");
      expect(privacyEl).toHaveTextContent(/Supabase/);
      expect(privacyEl).toHaveTextContent(/Google OAuth/);
      expect(privacyEl).toHaveTextContent(/Google Analytics 4/);
      expect(privacyEl).toHaveTextContent(/Google AdSense/);

      // Terms page
      rerender(
        <LegalPage
          page="terms"
          language="en"
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />
      );
      expect(screen.getByTestId("legal-page-terms")).toHaveTextContent(
        /Third-Party Flight/
      );

      // Contact page with copy email helper
      rerender(
        <LegalPage
          page="contact"
          language="zh"
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />
      );
      expect(screen.getByTestId("legal-page-contact")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("contact-copy-email-btn"));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("support@gotravel.app");
      });
    });

    it("renders all 6 public links inside SiteFooter", () => {
      const onNavigate = vi.fn();
      render(<SiteFooter language="en" onNavigate={onNavigate} />);

      for (const slug of [
        "guide",
        "templates",
        "about",
        "privacy",
        "terms",
        "contact",
      ]) {
        const link = screen.getByTestId(`footer-link-${slug}`);
        expect(link).toHaveAttribute("href", `/${slug}`);
      }
    });
  });

  describe("OnboardingTour", () => {
    it("renders via document.body portal (z-[9999]), progresses through all 4 steps, calls onNavigateTab, and persists completion", () => {
      const onClose = vi.fn();
      const onNavigateTab = vi.fn();

      expect(isOnboardingTourDone()).toBe(false);

      render(
        <OnboardingTour
          isOpen={true}
          onClose={onClose}
          language="zh"
          onNavigateTab={onNavigateTab}
        />
      );

      const backdrop = screen.getByTestId("onboarding-tour-backdrop");
      expect(backdrop.className).toContain("z-[9999]");
      expect(backdrop.parentElement).toBe(document.body);

      // Step 1
      expect(screen.getByTestId("onboarding-step-title")).toHaveTextContent(
        "新增景點與行程排程"
      );
      expect(
        screen.queryByTestId("onboarding-prev-btn")
      ).not.toBeInTheDocument();

      // Step 2
      fireEvent.click(screen.getByTestId("onboarding-next-btn"));
      expect(screen.getByTestId("onboarding-step-title")).toHaveTextContent(
        "切換地圖檢視路線與航線"
      );
      expect(onNavigateTab).toHaveBeenLastCalledWith("itinerary");

      // Step 3 (expenses tab)
      fireEvent.click(screen.getByTestId("onboarding-next-btn"));
      expect(screen.getByTestId("onboarding-step-title")).toHaveTextContent(
        "記帳與 AA 旅伴分帳"
      );
      expect(onNavigateTab).toHaveBeenLastCalledWith("expenses");

      // Back to Step 2 and forward again
      fireEvent.click(screen.getByTestId("onboarding-prev-btn"));
      expect(screen.getByTestId("onboarding-step-title")).toHaveTextContent(
        "切換地圖檢視路線與航線"
      );
      fireEvent.click(screen.getByTestId("onboarding-next-btn"));

      // Step 4 (final)
      fireEvent.click(screen.getByTestId("onboarding-next-btn"));
      expect(screen.getByTestId("onboarding-step-title")).toHaveTextContent(
        "列印與匯出分享"
      );
      expect(onNavigateTab).toHaveBeenLastCalledWith("itinerary");

      // Finish
      const finishBtn = screen.getByTestId("onboarding-finish-btn");
      expect(finishBtn).toHaveTextContent("開始使用");
      fireEvent.click(finishBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
      expect(isOnboardingTourDone()).toBe(true);
    });

    it("supports Skip and resetOnboardingTour helpers", () => {
      const onClose = vi.fn();

      render(
        <OnboardingTour isOpen={true} onClose={onClose} language="en" />
      );

      fireEvent.click(screen.getByTestId("onboarding-skip-btn"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(isOnboardingTourDone()).toBe(true);

      resetOnboardingTour();
      expect(isOnboardingTourDone()).toBe(false);

      markOnboardingTourDone();
      expect(isOnboardingTourDone()).toBe(true);
    });
  });
});
