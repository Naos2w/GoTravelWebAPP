import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlightManager } from "../../components/FlightManager";
import { BoardingPass } from "../../components/BoardingPass";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip, User, FlightSegment, Currency } from "../../types";

describe("FlightManager & BoardingPass Smoke Tests", () => {
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Alex Chen",
    picture: ""
  };

  const mockSegment: FlightSegment = {
    airline: "EVA Air",
    airlineID: "BR",
    airlineNameZh: "長榮航空",
    airlineNameEn: "EVA Air",
    flightNumber: "BR198",
    departureTime: "2026-10-01T08:50",
    arrivalTime: "2026-10-01T13:15",
    departureAirport: "TPE",
    arrivalAirport: "NRT",
    terminal: "2",
    gate: "C7",
    status: "Scheduled",
    baggage: {
      carryOn: { count: 1, weight: "7kg" },
      checked: { count: 2, weight: "23kg" }
    }
  };

  const mockTrip: Trip = {
    id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
    user_id: "user-123",
    name: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    expenses: [],
    checklist: [],
    itinerary: [],
    flights: [
      {
        id: "flight-1",
        user_id: "user-123",
        traveler_name: "Alex Chen",
        outbound: mockSegment,
        price: 18000,
        currency: Currency.TWD,
        cabinClass: "Economy",
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 2, weight: "23kg" }
        }
      }
    ]
  };

  it("renders BoardingPass component with flight information", () => {
    render(
      <LocalizationProvider>
        <BoardingPass
          segment={mockSegment}
          passengerName="Alex Chen"
          cabinClass="Economy"
        />
      </LocalizationProvider>
    );

    expect(screen.getAllByText("BR198").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TPE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NRT").length).toBeGreaterThan(0);
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
  });

  it("renders airline logo on a light surface in light and dark mode", () => {
    render(
      <LocalizationProvider>
        <BoardingPass segment={mockSegment} passengerName="Alex Chen" cabinClass="Economy" />
      </LocalizationProvider>
    );

    const container = screen.getByTestId("airline-logo-container");
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.className).toContain("bg-white");
    expect(container.className).toContain("dark:bg-white/95");
  });

  it("renders FlightManager without crashing", () => {
    render(
      <LocalizationProvider>
        <FlightManager
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    expect(screen.getAllByText("BR198").length).toBeGreaterThan(0);
  });

  it("opens the boarding pass print animation from the Print Pass button and closes it cleanly", () => {
    render(
      <LocalizationProvider>
        <FlightManager trip={mockTrip} currentUser={mockUser} onUpdate={vi.fn()} />
      </LocalizationProvider>
    );

    expect(screen.queryByTestId("boarding-pass-issue-modal")).toBeNull();
    fireEvent.click(screen.getByTestId("replay-boarding-pass-btn"));
    expect(screen.getByTestId("boarding-pass-issue-modal")).toBeInTheDocument();
    expect(screen.getByTestId("boarding-pass-continue").textContent).toMatch(/關閉預覽|Close Preview/);

    fireEvent.click(screen.getByTestId("boarding-pass-continue"));
    expect(screen.queryByTestId("boarding-pass-issue-modal")).toBeNull();
    expect(screen.getAllByText("BR198").length).toBeGreaterThan(0);
  });

  it("auto-opens edit mode, focuses ticket price, updates baggage on cabin change, and calls onGuidedPriceSaved", () => {
    const onUpdate = vi.fn();
    const onGuidedPriceSaved = vi.fn();
    const zeroPriceTrip: Trip = {
      ...mockTrip,
      flights: [
        {
          ...mockTrip.flights![0],
          price: 0,
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
          outbound: {
            ...mockSegment,
            baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
          },
        },
      ],
    };

    render(
      <LocalizationProvider>
        <FlightManager
          trip={zeroPriceTrip}
          currentUser={mockUser}
          onUpdate={onUpdate}
          autoEditFlightId="flight-1"
          onGuidedPriceSaved={onGuidedPriceSaved}
        />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("guide-price-hint")).toBeInTheDocument();
    const priceInput = screen.getByTestId("flight-price-input") as HTMLInputElement;
    expect(document.activeElement).toBe(priceInput);

    // Switching Economy -> Business updates untouched BR baggage preset to 2x7kg / 2x32kg
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const cabinSelect = selects.find((s) => s.value === "Economy")!;
    fireEvent.change(cabinSelect, { target: { value: "Business" } });

    fireEvent.change(priceInput, { target: { value: "24500" } });
    fireEvent.click(screen.getByRole("button", { name: /確認|Confirm|Save/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const savedTrip = onUpdate.mock.calls[0][0] as Trip;
    expect(savedTrip.flights![0].price).toBe(24500);
    expect(savedTrip.flights![0].outbound.baggage).toEqual({
      carryOn: { count: 2, weight: "7kg" },
      checked: { count: 2, weight: "32kg" },
    });
    expect(onGuidedPriceSaved).toHaveBeenCalledTimes(1);
  });
});
