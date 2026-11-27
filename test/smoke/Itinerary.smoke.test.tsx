import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Itinerary } from "../../src/features/itinerary/Itinerary";
import { LocalizationProvider } from "../../src/shared/contexts/LocalizationContext";
import { Trip, User } from "../../src/types";

// Mock MapView to avoid Leaflet canvas initialization in jsdom
vi.mock("../../src/features/itinerary/MapView", () => ({
  MapView: () => <div data-testid="mock-mapview">Mocked MapView</div>,
}));

describe("Itinerary Component Smoke Test", () => {
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    picture: ""
  };

  const mockTrip: Trip = {
    id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
    user_id: "user-123",
    name: "Tokyo Explorer",
    destination: "Tokyo, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-02",
    flights: [],
    expenses: [],
    checklist: [],
    itinerary: [
      {
        date: "2026-10-01",
        items: [
          {
            id: "item-1",
            trip_id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
            user_id: "user-123",
            time: "09:00",
            placeName: "Tokyo Tower",
            lat: 35.6586,
            lng: 139.7454,
            type: "Place",
            transportType: "Public",
            date: "2026-10-01"
          }
        ]
      },
      {
        date: "2026-10-02",
        items: []
      }
    ]
  };

  it("renders itinerary days and places without crashing", async () => {
    const handleUpdate = vi.fn();

    await act(async () => {
      render(
        <LocalizationProvider>
          <Itinerary
            trip={mockTrip}
            currentUser={mockUser}
            onUpdate={handleUpdate}
          />
        </LocalizationProvider>
      );
    });

    // Should display Day 1 tab or date indicator
    expect(screen.getAllByText(/Day 1/i).length).toBeGreaterThan(0);
    // Should display the added place
    expect(screen.getByText("Tokyo Tower")).toBeInTheDocument();
    // Should display time
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("renders empty day view gracefully", async () => {
    const emptyTrip: Trip = {
      ...mockTrip,
      itinerary: [
        {
          date: "2026-10-01",
          items: []
        }
      ]
    };

    await act(async () => {
      render(
        <LocalizationProvider>
          <Itinerary
            trip={emptyTrip}
            currentUser={mockUser}
            onUpdate={vi.fn()}
          />
        </LocalizationProvider>
      );
    });

    expect(screen.getAllByText(/Day 1/i).length).toBeGreaterThan(0);
  });

  it("renders floating bottom cards in map mode without crashing", async () => {
    await act(async () => {
      render(
        <LocalizationProvider>
          <Itinerary
            trip={mockTrip}
            currentUser={mockUser}
            onUpdate={vi.fn()}
          />
        </LocalizationProvider>
      );
    });

    // Toggle to map mode via map button
    const mapBtn = screen.getByRole("button", { name: /地圖|Map/i });
    await act(async () => {
      mapBtn.click();
    });

    // Should display STOP 1 badge and stop counter
    expect(screen.getByText("STOP 1")).toBeInTheDocument();
    expect(screen.getByText(/1 個景點|1 Stops/i)).toBeInTheDocument();
  });

  it("handles tapping airport cards in both mobile list mode and mobile map mode without crashing", async () => {
    const flightTrip: Trip = {
      ...mockTrip,
      itinerary: [
        {
          date: "2026-10-01",
          items: [
            {
              id: "f-dep",
              trip_id: mockTrip.id,
              user_id: mockUser.id,
              time: "08:10",
              placeName: "TPE Airport",
              type: "Place",
              transportType: "Flight",
              note: "Flight: BR106",
              date: "2026-10-01",
            },
            {
              id: "f-mid",
              trip_id: mockTrip.id,
              user_id: mockUser.id,
              time: "09:45",
              placeName: "Flight",
              type: "Transport",
              transportType: "Flight",
              note: "2h 10m",
              date: "2026-10-01",
            },
            {
              id: "f-arr",
              trip_id: mockTrip.id,
              user_id: mockUser.id,
              time: "11:20",
              placeName: "FUK Airport",
              type: "Place",
              transportType: "Flight",
              note: "Arrival",
              date: "2026-10-01",
            },
          ],
        },
      ],
    };

    await act(async () => {
      render(
        <LocalizationProvider>
          <Itinerary
            trip={flightTrip}
            currentUser={mockUser}
            onUpdate={vi.fn()}
          />
        </LocalizationProvider>
      );
    });

    // Tap airport cards in mobile list mode
    await act(async () => {
      screen.getByText("TPE Airport").click();
    });
    await act(async () => {
      screen.getByText("FUK Airport").click();
    });

    // Switch to mobile map mode and tap airport cards in the floating carousel
    const mapBtn = screen.getByRole("button", { name: /地圖|Map/i });
    await act(async () => {
      mapBtn.click();
    });

    const fukMatches = screen.getAllByText("FUK Airport");
    expect(fukMatches.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      fukMatches[0].click();
    });
    expect(screen.getByText("STOP 2")).toBeInTheDocument();
  });
});
