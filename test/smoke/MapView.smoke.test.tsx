import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MapView,
  LEG_ROUTE_CACHE,
  buildFlightArc,
  computeFlightBearing,
  createCustomIcon,
} from "../../components/MapView";
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
  getSize: vi.fn().mockReturnValue({ x: 400, y: 600 }),
  getContainer: vi.fn().mockReturnValue(document.createElement("div")),
  invalidateSize: vi.fn(),
};

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, preferCanvas }: any) => (
    <div data-testid="map-container" data-prefer-canvas={String(preferCanvas)}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, position, icon }: any) => (
    <div
      data-testid="marker"
      data-position={position ? JSON.stringify(position) : ""}
      data-icon={icon ? JSON.stringify(icon) : ""}
    >
      {children}
    </div>
  ),
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
    divIcon: (opts: any) => opts ?? {},
    latLngBounds: () => ({
      extend: vi.fn(),
      isValid: vi.fn().mockReturnValue(true),
      toBBoxString: vi.fn().mockReturnValue("0,0,1,1"),
    }),
  },
  divIcon: (opts: any) => opts ?? {},
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
    mockMapInstance.invalidateSize.mockClear();
    mockMapInstance.getZoom.mockReturnValue(14);
    mockMapInstance.getCenter.mockReturnValue({ lat: 35.71, lng: 139.79 });
    mockMapInstance.getSize.mockReturnValue({ x: 400, y: 600 });
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

  it("flies to a regional stop (0.05 <= distDeg < 2) with a snappy duration <= 0.8s", () => {
    const regionalItems: ItineraryItem[] = [
      ...mockItems,
      {
        id: "item-regional",
        trip_id: "trip-1",
        user_id: "user-1",
        time: "15:00",
        placeName: "Yokohama Station",
        lat: 35.4658,
        lng: 139.6223,
        type: "Place",
        date: "2026-10-01",
      },
    ];
    mockMapInstance.getZoom.mockReturnValue(14);
    render(
      <LocalizationProvider>
        <MapView items={regionalItems} activeItemId="item-regional" />
      </LocalizationProvider>
    );

    expect(mockMapInstance.stop).toHaveBeenCalled();
    expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
      [35.4658, 139.6223],
      15,
      expect.objectContaining({ animate: true, easeLinearity: 0.25 })
    );
    const flyOptions = mockMapInstance.flyTo.mock.calls[0][2];
    expect(flyOptions.duration).toBeLessThanOrEqual(0.8);
    expect(mockMapInstance.setView).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
  });

  it("avoids flyTo and animated fitBounds when map container is hidden (0x0 on mobile list mode)", () => {
    const flightItems: ItineraryItem[] = [
      {
        id: "f-dep",
        time: "08:10",
        placeName: "TPE Airport",
        type: "Place",
        transportType: "Flight",
        note: "Flight: BR106",
        date: "2026-04-01",
      },
      {
        id: "f-arr",
        time: "11:20",
        placeName: "FUK Airport",
        type: "Place",
        transportType: "Flight",
        note: "Arrival",
        date: "2026-04-01",
      },
    ];

    mockMapInstance.getSize.mockReturnValue({ x: 0, y: 0 });
    mockMapInstance.getCenter.mockReturnValue({ lat: 25.0797, lng: 121.2342 });

    const { rerender } = render(
      <LocalizationProvider>
        <MapView items={flightItems} activeItemId={null} />
      </LocalizationProvider>
    );

    // Must never call fitBounds or flyTo on a 0x0 hidden container
    expect(mockMapInstance.fitBounds).not.toHaveBeenCalled();
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();

    // Selecting an airport card while map is hidden (0x0) must use non-animated setView safely
    rerender(
      <LocalizationProvider>
        <MapView items={flightItems} activeItemId="f-arr" />
      </LocalizationProvider>
    );

    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
    expect(mockMapInstance.setView).toHaveBeenCalledWith(
      [33.5859, 130.4507],
      14,
      { animate: false }
    );
  });

  it("uses setView instead of unstable flyTo when jumping to a far-away airport (distDeg >= 2)", () => {
    const flightItems: ItineraryItem[] = [
      {
        id: "f-dep",
        time: "08:10",
        placeName: "TPE Airport",
        type: "Place",
        transportType: "Flight",
        date: "2026-04-01",
      },
      {
        id: "f-arr",
        time: "11:20",
        placeName: "FUK Airport",
        type: "Place",
        transportType: "Flight",
        date: "2026-04-01",
      },
    ];

    mockMapInstance.getSize.mockReturnValue({ x: 390, y: 600 });
    mockMapInstance.getCenter.mockReturnValue({ lat: 25.0797, lng: 121.2342 });

    render(
      <LocalizationProvider>
        <MapView items={flightItems} activeItemId="f-arr" />
      </LocalizationProvider>
    );

    expect(mockMapInstance.stop).toHaveBeenCalled();
    expect(mockMapInstance.flyTo).not.toHaveBeenCalled();
    expect(mockMapInstance.panTo).not.toHaveBeenCalled();
    expect(mockMapInstance.setView).toHaveBeenCalledWith(
      [33.5859, 130.4507],
      14,
      expect.objectContaining({ animate: true })
    );
  });

  it("calls invalidateSize({ animate: false }) when container transitions from 0x0 to visible", () => {
    let resizeCallback: ((entries: any[]) => void) | null = null;
    class MockResizeObserver {
      constructor(cb: (entries: any[]) => void) {
        resizeCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver as any);
    mockMapInstance.getSize.mockReturnValue({ x: 0, y: 0 });

    render(
      <LocalizationProvider>
        <MapView items={mockItems} />
      </LocalizationProvider>
    );

    mockMapInstance.getSize.mockReturnValue({ x: 390, y: 600 });
    resizeCallback?.([{ contentRect: { width: 390, height: 600 } }]);

    expect(mockMapInstance.invalidateSize).toHaveBeenCalledWith({ animate: false });
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

  it("falls back to routed-foot when the car road ends >200m from the pin (Wasserauen -> Ebenalp)", async () => {
    const baseItem = mockItems[0];
    const wasserauenItems: ItineraryItem[] = [
      { ...baseItem, id: "w-1", placeName: "Wasserauen", lat: 47.2833, lng: 9.4083 },
      { ...baseItem, id: "w-t", type: "Transport", transportType: "Public", time: "10:00" } as ItineraryItem,
      { ...baseItem, id: "w-2", placeName: "Ebenalp", lat: 47.2849, lng: 9.4176, time: "11:00" },
    ];
    // [lng, lat]: car road stops ~360m short of the Ebenalp pin; the foot trail reaches the pin
    const carRoad = [[9.4083, 47.2833], [9.4130, 47.2840]];
    const footTrail = [[9.4083, 47.2833], [9.4110, 47.2838], [9.4150, 47.2844], [9.4176, 47.2849]];
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const coordinates = String(url).includes("routed-car") ? carRoad : footTrail;
      return {
        json: async () => ({ code: "Ok", routes: [{ distance: 1500, duration: 600, geometry: { coordinates } }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocalizationProvider>
        <MapView items={wasserauenItems} />
      </LocalizationProvider>
    );

    const expected = footTrail.map(([lng, lat]) => [lat, lng]);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes("routed-car"))).toBe(true);
      expect(urls.some((u) => u.includes("routed-foot"))).toBe(true);
      const polylines = screen.getAllByTestId("polyline");
      expect(polylines.length).toBeGreaterThanOrEqual(2);
      polylines.forEach((pl) => {
        expect(JSON.parse(pl.getAttribute("data-positions") || "[]")).toEqual(expected);
      });
    });
  });

  it("enriches legacy airport stops missing lat/lng and renders a flight polyline without calling OSRM", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const legacyFlightDay: ItineraryItem[] = [
      {
        id: "f-dep",
        time: "08:10",
        placeName: "TPE Airport",
        type: "Place",
        transportType: "Flight",
        note: "Flight: BR106",
        date: "2026-04-01",
      },
      {
        id: "f-mid",
        time: "09:45",
        placeName: "Flight",
        type: "Transport",
        transportType: "Flight",
        note: "2h 10m",
        date: "2026-04-01",
      },
      {
        id: "f-arr",
        time: "11:20",
        placeName: "FUK Airport",
        type: "Place",
        transportType: "Flight",
        note: "Arrival",
        date: "2026-04-01",
      },
    ];

    render(
      <LocalizationProvider>
        <MapView items={legacyFlightDay} />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(screen.queryByText(/新增帶有坐標的地點即可在地圖上查看/)).not.toBeInTheDocument();
    // 2 airport markers + 1 midpoint flight badge marker
    expect(screen.getAllByTestId("marker").length).toBe(3);

    const polylines = screen.getAllByTestId("polyline");
    expect(polylines.length).toBe(2);
    const positions: [number, number][] = JSON.parse(polylines[0].getAttribute("data-positions") || "[]");
    expect(positions.length).toBe(41);
    expect(positions[0]).toEqual([25.0797, 121.2342]);
    expect(positions[positions.length - 1]).toEqual([33.5859, 130.4507]);

    // Curved arc midpoint at t = 0.5 must bow away from the straight chord
    const straightMidLat = (25.0797 + 33.5859) / 2;
    const straightMidLng = (121.2342 + 130.4507) / 2;
    const arcMid = positions[Math.floor(positions.length / 2)];
    expect(arcMid[0]).toBeGreaterThan(straightMidLat);
    expect(arcMid[1]).not.toBeCloseTo(straightMidLng, 2);

    // Midpoint flight badge sits on the curved arc's t=0.5 point and rotates the plane along flight bearing
    const markers = screen.getAllByTestId("marker");
    const badgeMarker = markers.find((m) => (m.getAttribute("data-icon") || "").includes("飛行"));
    expect(badgeMarker).toBeDefined();
    expect(JSON.parse(badgeMarker!.getAttribute("data-position") || "[]")).toEqual(arcMid);
    const badgeIcon = JSON.parse(badgeMarker!.getAttribute("data-icon") || "{}");
    expect(badgeIcon.html).toContain("transform: rotate(");

    // Flight legs must never hit OSRM
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds smooth curved flight arcs for regional and long-haul routes with accurate bearing", () => {
    const longHaulArc = buildFlightArc([25.0797, 121.2342], [49.1967, -123.1815]);
    expect(longHaulArc.length).toBe(41);
    expect(longHaulArc[0]).toEqual([25.0797, 121.2342]);
    expect(longHaulArc[longHaulArc.length - 1]).toEqual([49.1967, -123.1815]);
    expect(longHaulArc[20][0]).toBeGreaterThan((25.0797 + 49.1967) / 2);

    // Due North = 0 deg, Due East = 90 deg, TPE -> FUK ~ NE (~43 deg)
    expect(computeFlightBearing([25, 121], [35, 121])).toBeCloseTo(0, 1);
    expect(computeFlightBearing([25, 121], [25, 131])).toBeCloseTo(90, 1);
    const tpeFukBearing = computeFlightBearing([25.0797, 121.2342], [33.5859, 130.4507]);
    expect(tpeFukBearing).toBeGreaterThan(35);
    expect(tpeFukBearing).toBeLessThan(55);
  });

  it("renders non-blinking static focus halo and dead-center concentric marker numbers", () => {
    render(
      <LocalizationProvider>
        <MapView items={mockItems} activeItemId="item-1" />
      </LocalizationProvider>
    );

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(1);
    const activeIcon = JSON.parse(markers[0].getAttribute("data-icon") || "{}");
    expect(activeIcon.html).not.toMatch(/animate-ping|animate-pulse|animate-pulse-soft/);
    expect(activeIcon.html).toContain("display:flex;align-items:center;justify-content:center;");
    expect(activeIcon.html).toContain("line-height:1;padding:0;margin:0;");
    expect(activeIcon.html).toContain("box-shadow:0 0 14px");
    expect(activeIcon.iconSize).toEqual([44, 44]);
    expect(activeIcon.iconAnchor).toEqual([22, 22]);

    const inactiveIcon = createCustomIcon(1, "Food", false) as any;
    expect(inactiveIcon.html).not.toMatch(/animate-ping|animate-pulse|animate-pulse-soft/);
    expect(inactiveIcon.html).toContain("display:flex;align-items:center;justify-content:center;");
    expect(inactiveIcon.iconSize).toEqual([28, 28]);
    expect(inactiveIcon.iconAnchor).toEqual([14, 14]);
  });
});

