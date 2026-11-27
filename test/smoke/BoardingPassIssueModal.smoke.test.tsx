import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  BoardingPassIssueModal,
  DWELL_AFTER_LAST_MS,
  PRINT_DURATION_MS,
  STAGGER_MS,
  getTotalIssueDurationMs,
} from "../../components/BoardingPassIssueModal";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Currency, FlightInfo } from "../../types";

const oneWayFlight: FlightInfo = {
  id: "flight-1",
  user_id: "user-1",
  traveler_name: "Alex Chen",
  price: 0,
  currency: Currency.TWD,
  cabinClass: "Economy",
  outbound: {
    airline: "STARLUX Airlines",
    airlineID: "JX",
    airlineNameZh: "星宇航空",
    airlineNameEn: "STARLUX Airlines",
    flightNumber: "JX800",
    departureTime: "2026-10-01T08:30",
    arrivalTime: "2026-10-01T12:45",
    departureAirport: "TPE",
    arrivalAirport: "NRT",
    terminal: "1",
    gate: "A3",
    status: "Scheduled",
    baggage: {
      carryOn: { count: 1, weight: "7kg" },
      checked: { count: 1, weight: "23kg" },
    },
  },
  baggage: {
    carryOn: { count: 1, weight: "7kg" },
    checked: { count: 1, weight: "23kg" },
  },
};

const roundTripFlight: FlightInfo = {
  ...oneWayFlight,
  id: "flight-rt",
  inbound: {
    airline: "STARLUX Airlines",
    airlineID: "JX",
    airlineNameZh: "星宇航空",
    airlineNameEn: "STARLUX Airlines",
    flightNumber: "JX801",
    departureTime: "2026-10-05T14:10",
    arrivalTime: "2026-10-05T16:55",
    departureAirport: "NRT",
    arrivalAirport: "TPE",
    terminal: "2",
    gate: "B5",
    status: "Scheduled",
    baggage: {
      carryOn: { count: 1, weight: "7kg" },
      checked: { count: 1, weight: "23kg" },
    },
  },
};

const layoverFlight: FlightInfo = {
  ...oneWayFlight,
  id: "flight-layover",
  outbound: {
    ...oneWayFlight.outbound,
    flightNumber: "JX800 + JL101",
    arrivalAirport: "CTS",
    segments: [
      oneWayFlight.outbound,
      {
        airline: "Japan Airlines",
        airlineID: "JL",
        airlineNameZh: "日本航空",
        airlineNameEn: "Japan Airlines",
        flightNumber: "JL101",
        departureTime: "2026-10-01T15:00",
        arrivalTime: "2026-10-01T16:45",
        departureAirport: "NRT",
        arrivalAirport: "CTS",
        status: "Scheduled",
      },
    ],
  },
  inbound: roundTripFlight.inbound,
};

describe("BoardingPassIssueModal Smoke Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders both outbound and inbound tickets sequentially with status pill and baggage info", () => {
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("boarding-pass-issue-modal")).toBeInTheDocument();
    // 2 passes (outbound + inbound) rendered in both desktop and mobile containers
    const desktopPasses = screen.getAllByTestId("boarding-pass-desktop");
    const mobilePasses = screen.getAllByTestId("boarding-pass-mobile");
    expect(desktopPasses).toHaveLength(2);
    expect(mobilePasses).toHaveLength(2);
    expect(desktopPasses[0]).toHaveAttribute("data-direction", "outbound");
    expect(desktopPasses[1]).toHaveAttribute("data-direction", "inbound");
    expect(desktopPasses[0].style.animationDelay).toBe("0ms");
    expect(desktopPasses[1].style.animationDelay).toBe(`${STAGGER_MS}ms`);

    expect(screen.getAllByTestId("boarding-pass-tear-line")).toHaveLength(4);
    expect(screen.getAllByText("JX800")).toHaveLength(2);
    expect(screen.getAllByText("JX801")).toHaveLength(2);
    expect(screen.getAllByTestId("boarding-pass-baggage")[0].textContent).toContain("1×7kg");
    expect(screen.getAllByTestId("boarding-pass-baggage")[0].textContent).toContain("1×23kg");

    // Live status pill progresses 1/2 -> 2/2 -> all issued
    expect(screen.getByTestId("boarding-pass-status").textContent).toContain("1 / 2");

    act(() => {
      vi.advanceTimersByTime(STAGGER_MS);
    });
    expect(screen.getByTestId("boarding-pass-status").textContent).toContain("2 / 2");

    act(() => {
      vi.advanceTimersByTime(PRINT_DURATION_MS);
    });
    expect(screen.getByTestId("boarding-pass-status").textContent).toContain("✓");
  });

  it("portals into document.body with light/dark glass backdrop classes", () => {
    const { container } = render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    const modal = screen.getByTestId("boarding-pass-issue-modal");
    expect(container.contains(modal)).toBe(false);
    expect(modal.parentElement).toBe(document.body);
    expect(modal.className).toContain("bg-[#F5F5F7]/90");
    expect(modal.className).toContain("dark:bg-[#060709]/85");
    expect(modal.className).toContain("z-[9999]");
  });

  it("renders carry-on (Briefcase) and checked (Luggage) icon badges on desktop and mobile passes", () => {
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    const carryOn = screen.getAllByTestId("bp-baggage-carryon");
    const checked = screen.getAllByTestId("bp-baggage-checked");
    // 2 passes x (desktop + mobile)
    expect(carryOn).toHaveLength(4);
    expect(checked).toHaveLength(4);
    carryOn.forEach((el) => {
      expect(el.querySelector("svg.lucide-briefcase")).not.toBeNull();
      expect(el.textContent).toContain("1×7kg");
      expect(el.className).toContain("tabular-nums");
    });
    checked.forEach((el) => {
      expect(el.querySelector("svg.lucide-luggage")).not.toBeNull();
      expect(el.textContent).toContain("1×23kg");
    });
  });

  it("renders a muted 0 checked badge for low-cost carriers with no checked bag", () => {
    const lccFlight: FlightInfo = {
      ...oneWayFlight,
      baggage: { carryOn: { count: 2, weight: "7kg" }, checked: { count: 0, weight: "0kg" } },
    };
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={lccFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    const checked = screen.getAllByTestId("bp-baggage-checked")[0];
    expect(checked.textContent).toBe("0");
    expect(checked.className).toContain("text-slate-400");
    expect(screen.getAllByTestId("bp-baggage-carryon")[0].textContent).toContain("2×7kg");
  });

  it("uses a close-preview CTA in previewMode", () => {
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={oneWayFlight} onContinue={vi.fn()} previewMode />
      </LocalizationProvider>
    );
    expect(screen.getByTestId("boarding-pass-continue").textContent).toMatch(/關閉預覽|Close Preview/);
  });

  it("expands multi-segment layover flights into individual boarding passes", () => {
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={layoverFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    expect(screen.getAllByTestId("boarding-pass-desktop")).toHaveLength(3);
    expect(screen.getAllByTestId("boarding-pass-mobile")).toHaveLength(3);
    expect(screen.getAllByText("JX800")).toHaveLength(2);
    expect(screen.getAllByText("JL101")).toHaveLength(2);
    expect(screen.getAllByText("JX801")).toHaveLength(2);
    expect(screen.getByTestId("boarding-pass-status").textContent).toContain("1 / 3");
  });

  it("does not auto-close before all tickets finish printing plus 2.2s dwell", () => {
    const onContinue = vi.fn();
    const expectedTotal = getTotalIssueDurationMs(2, false);
    expect(expectedTotal).toBe(STAGGER_MS + PRINT_DURATION_MS + DWELL_AFTER_LAST_MS);

    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={onContinue} />
      </LocalizationProvider>
    );

    // Still open at 2000ms (past the old 2s total, still dwelling after ticket 2 prints at 1500ms)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onContinue).not.toHaveBeenCalled();

    // Still open 1ms before full print + 2.2s dwell completes
    act(() => {
      vi.advanceTimersByTime(expectedTotal - 2000 - 1);
    });
    expect(onContinue).not.toHaveBeenCalled();

    // Completes right at full duration and only fires once
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion by showing all tickets immediately and dwelling 2.2s", () => {
    const onContinue = vi.fn();
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <LocalizationProvider>
          <BoardingPassIssueModal flight={roundTripFlight} onContinue={onContinue} />
        </LocalizationProvider>
      );

      expect(screen.getByTestId("boarding-pass-status").textContent).toContain("✓");
      expect(screen.getAllByTestId("boarding-pass-desktop")).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(DWELL_AFTER_LAST_MS - 1);
      });
      expect(onContinue).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = origMatchMedia;
    }
  });

  it("allows immediate skip via CTA button or Escape without firing again on timer", () => {
    const onContinue = vi.fn();
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={onContinue} />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByTestId("boarding-pass-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("allows immediate skip via Escape key right away", () => {
    const onContinue = vi.fn();
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={onContinue} />
      </LocalizationProvider>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onContinue).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("clears all timers on unmount so onContinue never fires after unmount", () => {
    const onContinue = vi.fn();
    const { unmount } = render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={roundTripFlight} onContinue={onContinue} />
      </LocalizationProvider>
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });
});
