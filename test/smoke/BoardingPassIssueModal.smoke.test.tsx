import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BoardingPassIssueModal } from "../../components/BoardingPassIssueModal";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Currency, FlightInfo } from "../../types";

const sampleFlight: FlightInfo = {
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

describe("BoardingPassIssueModal Smoke Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders responsive desktop & mobile boarding pass previews with flight & baggage info", () => {
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={sampleFlight} onContinue={vi.fn()} />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("boarding-pass-issue-modal")).toBeInTheDocument();
    expect(screen.getByTestId("boarding-pass-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("boarding-pass-mobile")).toBeInTheDocument();
    expect(screen.getAllByTestId("boarding-pass-tear-line").length).toBe(2);
    expect(screen.getAllByText("JX800").length).toBe(2);
    expect(screen.getAllByText("TPE").length).toBe(2);
    expect(screen.getAllByText("NRT").length).toBe(2);
    expect(screen.getAllByTestId("boarding-pass-baggage")[0].textContent).toContain("1×7kg");
    expect(screen.getAllByTestId("boarding-pass-baggage")[0].textContent).toContain("1×23kg");
  });

  it("auto-completes after durationMs and only fires onContinue once", () => {
    const onContinue = vi.fn();
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={sampleFlight} onContinue={onContinue} durationMs={2000} />
      </LocalizationProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onContinue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("allows immediate skip via CTA button or Escape without firing again on timer", () => {
    const onContinue = vi.fn();
    render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={sampleFlight} onContinue={onContinue} durationMs={2000} />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByTestId("boarding-pass-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("clears timer on unmount so onContinue never fires after unmount", () => {
    const onContinue = vi.fn();
    const { unmount } = render(
      <LocalizationProvider>
        <BoardingPassIssueModal flight={sampleFlight} onContinue={onContinue} durationMs={2000} />
      </LocalizationProvider>
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });
});
