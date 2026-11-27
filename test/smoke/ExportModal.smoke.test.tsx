import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportModal } from "../../src/features/trips/ExportModal";
import { LocalizationProvider } from "../../src/shared/contexts/LocalizationContext";
import { Trip, Currency } from "../../src/types";
import * as mapExportService from "../../src/features/export/services/mapExportService";
import * as calendarChecklistExportService from "../../src/features/export/services/calendarChecklistExportService";
import * as printBookletService from "../../src/features/export/services/printBookletService";
import * as canvasExportService from "../../src/features/export/services/canvasExportService";

describe("ExportModal / PrintExportStudio Smoke Test", () => {
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
        inbound: {
          airline: "EVA Air",
          flightNumber: "BR197",
          departureAirport: "NRT",
          arrivalAirport: "TPE",
          departureTime: "2026-10-03T14:15",
          arrivalTime: "2026-10-03T16:55",
        },
        price: 18000,
        currency: Currency.TWD,
        cabinClass: "Economy",
        baggage: {
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 2, weight: "23kg" },
        },
      },
    ],
    checklist: [
      {
        id: "chk-1",
        text: "Passport",
        isCompleted: true,
        category: "Documents",
      },
      {
        id: "chk-2",
        text: "Power Bank",
        isCompleted: false,
        category: "Gear",
      },
    ],
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
            lat: 35.6852,
            lng: 139.71,
          },
          {
            id: "stop-2",
            placeName: "Ichiran Shinjuku",
            time: "18:00",
            type: "Food",
            date: "2026-10-01",
            lat: 35.6909,
            lng: 139.7013,
          },
        ],
      },
      {
        date: "2026-10-02",
        items: [],
      },
    ],
    expenses: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <LocalizationProvider>
        <ExportModal trip={mockTrip} isOpen={false} onClose={vi.fn()} />
      </LocalizationProvider>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders PrintExportStudio in a portal with 3 tabs and closes on button, backdrop, and Escape", () => {
    const handleClose = vi.fn();
    render(
      <LocalizationProvider>
        <ExportModal trip={mockTrip} isOpen={true} onClose={handleClose} />
      </LocalizationProvider>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("列印與匯出中心")).toBeInTheDocument();
    expect(screen.getByTestId("studio-tab-images")).toBeInTheDocument();
    expect(screen.getByTestId("studio-tab-maps")).toBeInTheDocument();
    expect(screen.getByTestId("studio-tab-sync")).toBeInTheDocument();

    // Close via Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Close via backdrop click
    fireEvent.click(screen.getByTestId("print-export-studio-backdrop"));
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Close via close button
    fireEvent.click(screen.getByLabelText("Close"));
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it("supports switching card types (receipt, boarding-pass, lockscreen, story) and exporting PNG on Image Printer tab", async () => {
    const shareSpy = vi
      .spyOn(canvasExportService, "shareOrDownloadCanvas")
      .mockResolvedValue("downloaded");
    const onNotify = vi.fn();

    render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrip}
          isOpen={true}
          onClose={vi.fn()}
          onNotify={onNotify}
        />
      </LocalizationProvider>
    );

    // Default card is receipt & clean fallback preview renders in jsdom
    expect(screen.getByTestId("card-selector-receipt")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("canvas-fallback-preview")).toBeInTheDocument();

    // Switch to boarding-pass
    fireEvent.click(screen.getByTestId("card-selector-boarding-pass"));
    expect(screen.getByTestId("card-selector-boarding-pass")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Switch to lockscreen — Day selector pill row appears
    fireEvent.click(screen.getByTestId("card-selector-lockscreen"));
    expect(screen.getByTestId("card-selector-lockscreen")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("image-day-pill-0")).toBeInTheDocument();
    expect(screen.getByTestId("image-day-pill-1")).toBeInTheDocument();

    // Switch to story — Day selector stays visible
    fireEvent.click(screen.getByTestId("card-selector-story"));
    expect(screen.getByTestId("card-selector-story")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByTestId("image-day-pill-1"));

    // Trigger Share / Save PNG and await async completion
    fireEvent.click(screen.getByTestId("share-save-png-btn"));
    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith(expect.any(String), "success");
    });
  });

  it("supports Travel Booklet PDF, Google Maps Day Route (active & empty day), and KML download on Maps & PDF tab", () => {
    const bookletSpy = vi
      .spyOn(printBookletService, "openPrintableTravelBooklet")
      .mockReturnValue(true);
    const kmlSpy = vi
      .spyOn(mapExportService, "downloadTripKml")
      .mockImplementation(() => {});

    render(
      <LocalizationProvider>
        <ExportModal trip={mockTrip} isOpen={true} onClose={vi.fn()} />
      </LocalizationProvider>
    );

    // Switch to Maps & PDF tab
    fireEvent.click(screen.getByTestId("studio-tab-maps"));
    expect(screen.getByTestId("studio-panel-maps")).toBeInTheDocument();

    // Printable Booklet PDF
    fireEvent.click(screen.getByTestId("print-booklet-btn"));
    expect(bookletSpy).toHaveBeenCalledWith(mockTrip, "zh");

    // Day 1 has 2 stops -> Google Maps route link enabled
    const routeLink = screen.getByTestId("gmaps-day-route-link");
    expect(routeLink).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir/")
    );
    expect(routeLink).toHaveAttribute("target", "_blank");

    // Switch to Day 2 (0 stops) -> disabled route button + hint
    fireEvent.click(screen.getByTestId("map-day-pill-1"));
    expect(screen.getByTestId("gmaps-day-route-disabled")).toBeDisabled();
    expect(screen.getByText("此日期尚無可導航的景點")).toBeInTheDocument();

    // Download .kml
    fireEvent.click(screen.getByTestId("download-kml-btn"));
    expect(kmlSpy).toHaveBeenCalledWith(mockTrip, "zh");
  });

  it("auto-chunks a day with >10 stops into multiple Google Maps leg buttons with a chunk notice", () => {
    const busyDayTrip: Trip = {
      ...mockTrip,
      itinerary: [
        {
          date: "2026-10-01",
          items: Array.from({ length: 14 }, (_, idx) => ({
            id: `busy-${idx}`,
            placeName: `Tokyo Spot ${idx + 1}`,
            time: `${String(8 + idx).padStart(2, "0")}:00`,
            type: "Place" as const,
            date: "2026-10-01",
            lat: 35.65 + idx * 0.005,
            lng: 139.7 + idx * 0.005,
          })),
        },
      ],
    };

    render(
      <LocalizationProvider>
        <ExportModal trip={busyDayTrip} isOpen={true} onClose={vi.fn()} />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByTestId("studio-tab-maps"));

    expect(screen.getByTestId("gmaps-chunk-notice")).toHaveTextContent(
      "超過 Google Maps 單次 10 站上限，已自動拆分為 2 段連續導航"
    );

    const seg1 = screen.getByTestId("gmaps-day-route-segment-1");
    const seg2 = screen.getByTestId("gmaps-day-route-segment-2");

    expect(seg1).toHaveTextContent("第 1 段 (站 1–10)");
    expect(seg1).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir/"));
    expect(seg2).toHaveTextContent("第 2 段 (站 10–14)");
    expect(seg2).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir/"));
  });

  it("supports classic Notes/ICS/Markdown, 1-tap Google Calendar flight links, and Checklist Notes/VTODO sync on Calendar & Notes tab", async () => {
    const vtodoSpy = vi
      .spyOn(calendarChecklistExportService, "downloadChecklistVtodoIcs")
      .mockImplementation(() => {});
    const checklistShareSpy = vi
      .spyOn(calendarChecklistExportService, "shareChecklistToNotes")
      .mockResolvedValue("copied");
    const onNotify = vi.fn();

    render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrip}
          isOpen={true}
          onClose={vi.fn()}
          onNotify={onNotify}
        />
      </LocalizationProvider>
    );

    // Switch to Calendar & Notes tab
    fireEvent.click(screen.getByTestId("studio-tab-sync"));
    expect(screen.getByTestId("studio-panel-sync")).toBeInTheDocument();

    // Classic export options preserved
    expect(screen.getByText(/Apple Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple \/ 系統行事曆/i)).toBeInTheDocument();
    expect(screen.getByText(/複製完整 Markdown 格式/i)).toBeInTheDocument();

    // Google Calendar 1-tap flight links (outbound & inbound)
    const outboundGcal = screen.getByTestId("gcal-flight-link-flight-1-out");
    expect(outboundGcal).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com/calendar/render")
    );
    expect(outboundGcal).toHaveAttribute("target", "_blank");

    const inboundGcal = screen.getByTestId("gcal-flight-link-flight-1-in");
    expect(inboundGcal).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com/calendar/render")
    );

    // Checklist Keep/Notes share & VTODO .ics download
    fireEvent.click(screen.getByTestId("share-checklist-notes-btn"));
    await waitFor(() => {
      expect(checklistShareSpy).toHaveBeenCalledWith(mockTrip, "zh");
      expect(onNotify).toHaveBeenCalledWith(expect.any(String), "success");
    });

    fireEvent.click(screen.getByTestId("download-checklist-vtodo-btn"));
    expect(vtodoSpy).toHaveBeenCalledWith(mockTrip, "zh");
  });
});
