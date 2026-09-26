import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
