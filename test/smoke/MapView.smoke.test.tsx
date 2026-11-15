import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapView } from "../../components/MapView";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { ItineraryItem } from "../../types";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({
    setView: vi.fn(),
    panTo: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: vi.fn().mockReturnValue(12),
    getContainer: vi.fn().mockReturnValue(document.createElement("div")),
    invalidateSize: vi.fn(),
  }),
}));

vi.mock("leaflet", () => ({
  default: {
    divIcon: () => ({}),
    latLngBounds: () => ({
      extend: vi.fn(),
      isValid: vi.fn().mockReturnValue(true),
      toBBoxString: vi.fn().mockReturnValue("0,0,1,1"),
    }),
  },
  divIcon: () => ({}),
  latLngBounds: () => ({
    extend: vi.fn(),
    isValid: vi.fn().mockReturnValue(true),
    toBBoxString: vi.fn().mockReturnValue("0,0,1,1"),
  }),
}));

describe("MapView Component Smoke Test", () => {
  const mockItems: ItineraryItem[] = [
    {
      id: "item-1",
      trip_id: "trip-1",
      user_id: "user-1",
      time: "09:00",
      placeName: "Senso-ji Temple",
      lat: 35.7148,
      lng: 139.7967,
      type: "Place",
      date: "2026-10-01"
    }
  ];

  it("renders map container and place items without crashing", () => {
    render(
      <LocalizationProvider>
        <MapView
          items={mockItems}
          onAddSearchResult={vi.fn()}
        />
      </LocalizationProvider>
    );

    // Map container mock is rendered
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("renders empty map view when items are empty", () => {
    render(
      <LocalizationProvider>
        <MapView
          items={[]}
        />
      </LocalizationProvider>
    );

    expect(screen.getByPlaceholderText(/搜尋地點/)).toBeInTheDocument();
    expect(screen.getByText(/新增帶有坐標的地點即可在地圖上查看/)).toBeInTheDocument();
  });

  it("keeps routing mode selector collapsed by default and toggles on click", () => {
    render(
      <LocalizationProvider>
        <MapView
          items={mockItems}
          hasBottomCards={true}
        />
      </LocalizationProvider>
    );

    const selector = screen.getByTestId("routing-mode-selector");
    expect(selector).toHaveClass("bottom-[130px]");

    // Default collapsed: only the active auto button is shown inside selector
    expect(selector.querySelectorAll("button")).toHaveLength(1);
    const autoBtn = screen.getByRole("button", { name: /自動 \(依行程\)/i });
    expect(autoBtn).toHaveAttribute("aria-expanded", "false");

    // Click to expand all 5 routing options
    fireEvent.click(autoBtn);
    expect(selector.querySelectorAll("button")).toHaveLength(5);

    // Select walking mode -> updates active button and collapses menu
    const walkBtn = screen.getByRole("button", { name: /全域走路/i });
    fireEvent.click(walkBtn);
    expect(selector.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /全域走路/i })).toHaveAttribute("aria-expanded", "false");
  });
});
