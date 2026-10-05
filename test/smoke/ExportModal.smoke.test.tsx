import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportModal } from "../../components/ExportModal";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip, Currency } from "../../types";

describe("ExportModal Smoke Test", () => {
  const mockTrip: Trip = {
    id: "trip-uuid-1",
    user_id: "user-1",
    name: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    flights: [
      {
        id: "flight-1",
        user_id: "user-1",
        traveler_name: "Alex",
        outbound: {
          airline: "EVA Air",
          flightNumber: "BR198",
          departureAirport: "TPE",
          arrivalAirport: "NRT",
          departureTime: "2026-10-01T08:50",
          arrivalTime: "2026-10-01T13:15",
        },
        price: 18000,
        currency: Currency.TWD,
        cabinClass: "Economy",
        baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 2, weight: "23kg" } },
      },
    ],
    checklist: [],
    itinerary: [
      {
        date: "2026-10-01",
        items: [
          {
            id: "stop-1",
            placeName: "Shinjuku Gyoen",
            time: "14:00",
            type: "Place",
            date: "2026-10-01",
          },
        ],
      },
    ],
    expenses: [],
  };

  it("renders export options when open", () => {
    const handleClose = vi.fn();
    render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrip}
          isOpen={true}
          onClose={handleClose}
        />
      </LocalizationProvider>
    );

    // Verify Title & Options
    expect(screen.getByText("匯出與手機同步")).toBeInTheDocument();
    expect(screen.getByText(/Apple Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple \/ 系統行事曆/i)).toBeInTheDocument();
    expect(screen.getByText(/複製完整 Markdown 格式/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrip}
          isOpen={false}
          onClose={vi.fn()}
        />
      </LocalizationProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  it("triggers close when clicking the close button", () => {
    const handleClose = vi.fn();
    render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrip}
          isOpen={true}
          onClose={handleClose}
        />
      </LocalizationProvider>
    );

    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
