import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MapView, LEG_ROUTE_CACHE } from "../../components/MapView";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { ItineraryItem } from "../../types";

const mockMapInstance = {
  setView: vi.fn(),
  panTo: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  stop: vi.fn(),
  getCenter: vi.fn().mockReturnValue({ lat: 35.71, lng: 139.79 }),
  getZoom: vi.fn().mockReturnValue(14),
  getContainer: vi.fn().mockReturnValue(document.createElement("div")),
  invalidateSize: vi.fn(),
};

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, preferCanvas }: any) => (
    <div data-testid="map-container" data-prefer-canvas={String(preferCanvas)}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Polyline: ({ pathOptions, color, positions }: any) => (
    <div
      data-testid="polyline"
      data-top-level-color={color ?? ""}
      data-positions={positions ? JSON.stringify(positions) : ""}
      data-path-options={pathOptions ? JSON.stringify(pathOptions) : ""}
    />
  ),
  useMap: () => mockMapInstance,
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
  beforeEach(() => {
    LEG_ROUTE_CACHE.clear();
    mockMapInstance.flyTo.mockClear();
    mockMapInstance.setView.mockClear();
    mockMapInstance.panTo.mockClear();
    mockMapInstance.fitBounds.mockClear();
    mockMapInstance.stop.mockClear();
    mockMapInstance.getZoom.mockReturnValue(14);
    mockMapInstance.getCenter.mockReturnValue({ lat: 35.71, lng: 139.79 });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline OSRM test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("renders immediate route polylines even when OSRM fails and uses snappy stop flyTo transition", () => {
    const twoStopItems: ItineraryItem[] = [
      ...mockItems,
      {
        id: "item-2",
        trip_id: "trip-1",
        user_id: "user-1",
        time: "11:00",
        placeName: "Tokyo Skytree",
        lat: 35.7101,
        lng: 139.8107,
        type: "Place",
        date: "2026-10-01",
      },
    ];

    mockMapInstance.getZoom.mockReturnValue(14);
    render(
      <LocalizationProvider>
        <MapView items={twoStopItems} activeItemId="item-1" />
      </LocalizationProvider>
    );

    // Canvas renderer is enabled
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-prefer-canvas", "true");

    // Dual-layer glowing polylines must immediately render without disappearing while OSRM fails/loads
    const polylines = screen.getAllByTestId("polyline");
    expect(polylines.length).toBeGreaterThanOrEqual(2);
    polylines.forEach((pl) => {
      expect(pl).toHaveAttribute("data-top-level-color", "");
      const opts = JSON.parse(pl.getAttribute("data-path-options") || "{}");
      expect(opts.color).toBeTruthy();
      expect(opts.weight).toBeGreaterThan(0);
      expect(opts.opacity).toBeGreaterThan(0);
    });

    // Nearby stop at zoom 14: setView straight to zoom 15 (no flyTo zoom-out bounce)
    expect(mockMapInstance.stop).toHaveBeenCalled();
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
    expect(mockMapInstance.setView).toHaveBeenCalledWith(
      [35.7148, 139.7967],
      15,
      expect.objectContaining({ animate: true })
    );
  });

  it("pans (no zoom change) to a nearby stop when already at zoom 15", () => {
    mockMapInstance.getZoom.mockReturnValue(15);
    render(
      <LocalizationProvider>
        <MapView items={mockItems} activeItemId="item-1" />
      </LocalizationProvider>
    );

    expect(mockMapInstance.stop).toHaveBeenCalled();
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();
    expect(mockMapInstance.setView).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).toHaveBeenCalledWith(
      [35.7148, 139.7967],
      expect.objectContaining({ animate: true, duration: 0.45, easeLinearity: 0.25 })
    );
  });

  it("flies to a far stop with a snappy duration <= 0.8s", () => {
    const farItems: ItineraryItem[] = [
      ...mockItems,
      {
        id: "item-far",
        trip_id: "trip-1",
        user_id: "user-1",
        time: "15:00",
        placeName: "Kyoto Station",
        lat: 34.9858,
        lng: 135.7588,
        type: "Place",
        date: "2026-10-01",
      },
    ];
    mockMapInstance.getZoom.mockReturnValue(14);
    render(
      <LocalizationProvider>
        <MapView items={farItems} activeItemId="item-far" />
      </LocalizationProvider>
    );

    expect(mockMapInstance.stop).toHaveBeenCalled();
    expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
      [34.9858, 135.7588],
      15,
      expect.objectContaining({ animate: true, easeLinearity: 0.25 })
    );
    const flyOptions = mockMapInstance.flyTo.mock.calls[0][2];
    expect(flyOptions.duration).toBeLessThanOrEqual(0.8);
    expect(mockMapInstance.setView).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
  });

  it("rejects degenerate 0-length OSRM routes (car-free towns) and keeps a valid 2-point polyline", async () => {
    const zermattItems: ItineraryItem[] = [
      { ...mockItems[0], id: "z-1", placeName: "Zermatt Station", lat: 46.0207, lng: 7.7491 },
      { ...mockItems[0], id: "z-2", placeName: "Gornergrat Bahn", lat: 46.0238, lng: 7.7527, time: "11:00" },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 0,
            duration: 0,
            geometry: { coordinates: [[7.751462, 46.026536], [7.751462, 46.026536]] },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocalizationProvider>
        <MapView items={zermattItems} />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /自動 \(依行程\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /全域走路/i }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes("routing.openstreetmap.de/routed-foot/route/v1/foot/"))).toBe(true);
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(LEG_ROUTE_CACHE.size).toBe(0);
    const polylines = screen.getAllByTestId("polyline");
    expect(polylines.length).toBeGreaterThanOrEqual(2);
    polylines.forEach((pl) => {
      const positions = JSON.parse(pl.getAttribute("data-positions") || "[]");
      expect(positions).toEqual([[46.0207, 7.7491], [46.0238, 7.7527]]);
    });
  });
});

