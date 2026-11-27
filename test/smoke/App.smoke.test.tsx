import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act, fireEvent, within } from "@testing-library/react";

let authStateListener: ((event: string, session: any) => void) | null = null;

// Mock supabase client to avoid external network calls during smoke tests
vi.mock("../../src/shared/services/storageService", async () => {
  const actual = await vi.importActual<typeof import("../../src/shared/services/storageService")>(
    "../../src/shared/services/storageService"
  );
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue("ok"),
  };
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          authStateListener = cb;
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          };
        }),
      },
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    },
    getTrips: vi.fn().mockResolvedValue([]),
    getTripById: vi.fn().mockResolvedValue(null),
    createNewTrip: vi.fn().mockImplementation((partial: any) => ({
      id: "trip-new-1",
      name: partial.destination || "",
      destination: partial.destination || "",
      startDate: partial.startDate || "",
      endDate: partial.endDate || "",
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [],
      budget: 50000,
    })),
    createFullTrip: vi.fn().mockResolvedValue(undefined),
    joinTrip: vi.fn().mockResolvedValue(undefined),
    saveTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    leaveTrip: vi.fn().mockResolvedValue(undefined),
    deleteExpense: vi.fn().mockResolvedValue(undefined),
    deleteItineraryItem: vi.fn().mockResolvedValue(undefined),
    deleteFlight: vi.fn().mockResolvedValue(undefined),
    deleteChecklistItem: vi.fn().mockResolvedValue(undefined),
    updateChecklistItem: vi.fn().mockResolvedValue(undefined),
    addChecklistItem: vi.fn().mockResolvedValue(undefined),
    upsertItineraryItems: vi.fn().mockResolvedValue(undefined),
    upsertExpense: vi.fn().mockResolvedValue(undefined),
    upsertFlight: vi.fn().mockResolvedValue(undefined),
    upsertChecklistItems: vi.fn().mockResolvedValue(undefined),
    updateTripMeta: vi.fn().mockResolvedValue(undefined),
    isSupabaseConfigured: vi.fn().mockReturnValue(true),
  };
});

// Mock leaflet & MapView to avoid canvas/DOM errors in jsdom
vi.mock("../../src/features/itinerary/MapView", () => ({
  MapView: ({ onAddSearchResult }: any) => (
    <div data-testid="mock-map-view">
      Mock Map
      {onAddSearchResult && (
        <button
          type="button"
          data-testid="mock-map-add-stop"
          onClick={() => onAddSearchResult("Fushimi Inari", undefined, undefined)}
        >
          Mock Add Stop
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../src/features/flights/services/tdxService", () => ({
  fetchTdxFlights: vi.fn(),
}));

vi.mock("../../src/features/itinerary/services/searchPlaceService", () => ({
  searchFreePlaces: vi.fn().mockResolvedValue([]),
}));

import App from "../../src/app/App";

describe("App Component (Smoke Test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("should mount and transition from loading to landing page when unauthenticated", async () => {
    render(<App />);

    // Initially or during loading, should not crash
    await waitFor(() => {
      // Landing page renders Go Travel title and version badge
      expect(screen.getByText("Go Travel")).toBeInTheDocument();
      expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
    });
  });

  it("renders mobile navigation and FAB without crashing when authenticated", async () => {
    const { supabase, getTrips } = await import("../../src/shared/services/storageService");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: { full_name: "Test Traveler" }
          }
        } as any
      },
      error: null
    });
    vi.mocked(getTrips).mockResolvedValue([
      {
        id: "trip-1",
        user_id: "user-123",
        name: "Kyoto Adventure",
        destination: "Kyoto, Japan",
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        expenses: [],
        flights: [],
        checklist: [],
        itinerary: []
      }
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Kyoto Adventure")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /新增旅程|New Trip/i }).length).toBeGreaterThan(0);
    });
  });

  it("does not enter full-screen loading state when onAuthStateChange fires SIGNED_IN or TOKEN_REFRESHED for the active user", async () => {
    const { supabase, getTrips } = await import("../../src/shared/services/storageService");
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      user_metadata: { full_name: "Test Traveler" },
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: { user: mockUser } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([
      {
        id: "trip-1",
        user_id: "user-123",
        name: "Kyoto Adventure",
        destination: "Kyoto, Japan",
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        expenses: [],
        flights: [],
        checklist: [],
        itinerary: [],
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Kyoto Adventure")).toBeInTheDocument();
    });

    // Simulate window refocus / background token refresh emitting SIGNED_IN
    if (authStateListener) {
      act(() => {
        authStateListener!("SIGNED_IN", { user: mockUser });
      });
    }

    // Must NOT flash full screen syncing spinner
    expect(screen.queryByText(/同步中\.\.\.|Syncing\.\.\./i)).not.toBeInTheDocument();
    expect(screen.getByText("Kyoto Adventure")).toBeInTheDocument();
  });

  it("allows deleting a trip from the Your Trips list view using DeleteTripModal", async () => {
    const { supabase, getTrips, deleteTrip } = await import("../../src/shared/services/storageService");
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      user_metadata: { full_name: "Test Traveler" },
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: { user: mockUser } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([
      {
        id: "trip-to-delete",
        user_id: "user-123",
        name: "Osaka Food Tour",
        destination: "Osaka, Japan",
        startDate: "2026-12-10",
        endDate: "2026-12-15",
        expenses: [],
        flights: [],
        checklist: [],
        itinerary: [],
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Osaka Food Tour")).toBeInTheDocument();
    });

    // In normal mode, delete button is hidden
    expect(screen.queryByTestId("trip-delete-btn")).not.toBeInTheDocument();

    // Click the Edit Mode button in header to reveal delete icons
    const toggleEditBtn = screen.getByTestId("toggle-edit-mode-btn");
    act(() => {
      toggleEditBtn.click();
    });

    // Delete button on the trip card should now be visible
    const deleteBtn = screen.getByTestId("trip-delete-btn");
    expect(deleteBtn).toBeInTheDocument();

    act(() => {
      deleteBtn.click();
    });

    // DeleteTripModal should open with warning
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/刪除此旅程|Delete Trip/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Osaka Food Tour/).length).toBeGreaterThan(0);
    });

    // Find and click the confirm button inside the modal
    const modalConfirmBtn = screen.getByTestId("confirm-trip-action-btn");

    await act(async () => {
      modalConfirmBtn.click();
    });

    await waitFor(() => {
      expect(deleteTrip).toHaveBeenCalledWith("trip-to-delete", "user-123");
      expect(screen.queryByText("Osaka Food Tour")).not.toBeInTheDocument();
    });
  });

  it("toggles profile dropdown menu with theme, language, and logout options", async () => {
    const { supabase, getTrips } = await import("../../src/shared/services/storageService");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "traveler@example.com",
            user_metadata: { full_name: "Modern Voyager", avatar_url: "https://example.com/avatar.jpg" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Modern Voyager" })).toBeInTheDocument();
    });

    const profileBtn = screen.getByRole("button", { name: "Modern Voyager" });

    // Menu should be closed initially
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Click to open menu
    act(() => {
      profileBtn.click();
    });

    // Menu should open displaying theme, language, and logout
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("traveler@example.com")).toBeInTheDocument();
    expect(screen.getByText(/外觀模式|Appearance/i)).toBeInTheDocument();
    expect(screen.getByText(/語言|Language/i)).toBeInTheDocument();
    expect(screen.getByText(/登出|Log Out/i)).toBeInTheDocument();
  });

  it("renders Instagram-style mobile dock profile button and toggles upward popover in trip detail view", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    const mockTrip = {
      id: "trip-dock-1",
      user_id: "user-dock-123",
      name: "Tokyo Adventure",
      destination: "Tokyo, Japan",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [],
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-dock-123",
            email: "dockuser@example.com",
            user_metadata: { full_name: "Dock Voyager" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip);

    render(<App />);

    // Wait for trip to render and click to enter detail view
    await waitFor(() => {
      expect(screen.getByText("Tokyo Adventure")).toBeInTheDocument();
    });

    const tripCardTitle = screen.getByText("Tokyo Adventure");
    act(() => {
      tripCardTitle.click();
    });

    // In detail view, mobile dock profile button must be present
    await waitFor(() => {
      expect(screen.getByTestId("mobile-dock-profile-btn")).toBeInTheDocument();
    });

    const mobileDockProfileBtn = screen.getByTestId("mobile-dock-profile-btn");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Click mobile dock profile button
    act(() => {
      mobileDockProfileBtn.click();
    });

    // Popover opens with user info and settings
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("dockuser@example.com")).toBeInTheDocument();
    expect(screen.getByText(/外觀模式|Appearance/i)).toBeInTheDocument();
    expect(screen.getByText(/匯出行程|Export Trip/i)).toBeInTheDocument();
  });

  it("supports press-and-slide scrubbing on mobile dock with synchronized screen follow and tab switching", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    const mockTrip = {
      id: "trip-scrub-1",
      user_id: "user-scrub-123",
      name: "Kyoto Spring",
      destination: "Kyoto, Japan",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [],
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-scrub-123",
            email: "scrub@example.com",
            user_metadata: { full_name: "Scrub Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Kyoto Spring")).toBeInTheDocument();
    });

    act(() => {
      screen.getByText("Kyoto Spring").click();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Mobile Navigation")).toBeInTheDocument();
    });

    const mobileNav = screen.getByLabelText("Mobile Navigation");
    const activePill = screen.getByTestId("mobile-dock-active-pill");
    const screenFollowWrapper = screen.getByTestId("tab-screen-follow-wrapper");

    vi.spyOn(mobileNav, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 312,
      top: 0,
      right: 312,
      bottom: 56,
      height: 56,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // Start on slot 0 (clientX = 31) -> drag to slot 2.2 (clientX = 141, checklist)
    act(() => {
      fireEvent.pointerDown(mobileNav, { pointerId: 1, clientX: 31 });
      fireEvent.pointerMove(mobileNav, { pointerId: 1, clientX: 141 });
    });

    // While scrubbing, pill follows fractional position and screen wrapper tracks sub-slot drag
    expect(activePill.style.transform).toContain("translate3d(220.00%");
    expect(activePill.style.transform).toContain("scale(1.06)");
    expect(screenFollowWrapper.style.transform).toContain("translate3d(-11.2px");

    // Release pointer -> snaps to slot 2 (200%) and clears temporary drag offset
    act(() => {
      fireEvent.pointerUp(mobileNav, { pointerId: 1, clientX: 141 });
    });

    expect(activePill.style.transform).toContain("translate3d(200.00%");
    expect(activePill.style.transform).toContain("scale(1)");
    expect(screenFollowWrapper.style.transform).toBe("");
  });

  it("synchronizes URL path across /trips, /trips/:tripId, and upgrades legacy ?tripId= links", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    const mockTrip = {
      id: "trip-route-42",
      user_id: "user-route-1",
      name: "Zurich Alps",
      destination: "Zurich, Switzerland",
      startDate: "2026-12-01",
      endDate: "2026-12-05",
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [],
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-route-1",
            email: "router@example.com",
            user_metadata: { full_name: "Route Explorer" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip);

    // 1. Authenticated user lands on / -> redirected to /trips
    const { unmount } = render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Zurich Alps")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/trips");
    });

    // 2. Selecting trip navigates URL to /trips/:tripId
    act(() => {
      screen.getByText("Zurich Alps").click();
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe("/trips/trip-route-42");
    });

    unmount();

    // 3. Opening legacy /?tripId=... upgrades URL cleanly to /trips/:tripId
    window.history.replaceState(null, "", "/?tripId=trip-route-42");
    render(<App />);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/trips/trip-route-42");
      expect(window.location.search).toBe("");
    });
  });

  it("never locks tabs when flight price is 0", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    const zeroPriceTrip = {
      id: "trip-zero-price",
      user_id: "user-zp-1",
      name: "Osaka Trip",
      destination: "KIX",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
      expenses: [],
      checklist: [],
      itinerary: [{ date: "2026-10-01", items: [] }],
      flights: [
        {
          id: "flight-zp-1",
          user_id: "user-zp-1",
          traveler_name: "Test Traveler",
          price: 0,
          currency: "TWD",
          cabinClass: "Economy",
          outbound: {
            airline: "EVA Air",
            airlineID: "BR",
            flightNumber: "BR132",
            departureTime: "2026-10-01T08:30",
            arrivalTime: "2026-10-01T12:10",
            departureAirport: "TPE",
            arrivalAirport: "KIX",
          },
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
        },
      ],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-zp-1",
            email: "zp@example.com",
            user_metadata: { full_name: "Test Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([zeroPriceTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(zeroPriceTrip as any);

    render(<App />);
    await waitFor(() => expect(screen.getByText("Osaka Trip")).toBeInTheDocument());
    act(() => {
      screen.getByText("Osaka Trip").click();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Mobile Navigation")).toBeInTheDocument();
    });

    for (const label of [/概覽|Overview/i, /行程|Itinerary/i, /清單|Checklist/i, /花費|Expenses/i, /機票|Tickets/i]) {
      for (const btn of screen.getAllByRole("button", { name: label })) {
        expect(btn).not.toBeDisabled();
      }
    }

    // Freely switch to Itinerary tab even though price === 0
    fireEvent.click(screen.getAllByRole("button", { name: /行程|Itinerary/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/Day\s*1/i).length).toBeGreaterThan(0);
    });
  });

  const openUnpricedTrip = async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    const trip = {
      id: "trip-pill",
      user_id: "user-pill-1",
      name: "Sapporo Trip",
      destination: "CTS",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
      expenses: [],
      checklist: [],
      itinerary: [{ date: "2026-10-01", items: [] }],
      flights: [
        {
          id: "flight-pill-1",
          user_id: "user-pill-1",
          traveler_name: "Pill Traveler",
          price: 0,
          currency: "TWD",
          cabinClass: "Economy",
          outbound: {
            airline: "EVA Air",
            airlineID: "BR",
            flightNumber: "BR108",
            departureTime: "2026-10-01T08:30",
            arrivalTime: "2026-10-01T12:10",
            departureAirport: "TPE",
            arrivalAirport: "CTS",
          },
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
        },
      ],
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-pill-1",
            email: "pill@example.com",
            user_metadata: { full_name: "Pill Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([trip as any]);
    vi.mocked(getTripById).mockResolvedValue(trip as any);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Sapporo Trip")).toBeInTheDocument());
    act(() => {
      screen.getByText("Sapporo Trip").click();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Mobile Navigation")).toBeInTheDocument();
    });
  };

  it("shows the mobile price pill for an existing unpriced flight (no fresh creation) and jumps to price edit", async () => {
    await openUnpricedTrip();
    const pill = await screen.findByTestId("mobile-itinerary-price-cta");
    expect(pill.className).toContain("sm:hidden");

    fireEvent.click(within(pill).getByRole("button", { name: /填機票金額|Add price/i }));
    await waitFor(() => {
      expect(screen.getByTestId("flight-price-input")).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByTestId("flight-price-input"));
    expect(screen.queryByTestId("mobile-itinerary-price-cta")).not.toBeInTheDocument();
  });

  it("dismisses the mobile price pill cleanly with the close button", async () => {
    await openUnpricedTrip();
    const pill = await screen.findByTestId("mobile-itinerary-price-cta");
    fireEvent.click(within(pill).getByRole("button", { name: /關閉提示|Dismiss tip/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("mobile-itinerary-price-cta")).not.toBeInTheDocument();
    });
  });

  it("runs guided post-flight-creation flow: BoardingPassIssueModal -> Itinerary banner -> Flights price edit -> Overview", async () => {
    const { supabase, getTrips, getTripById, createFullTrip } = await import("../../src/shared/services/storageService");
    const { fetchTdxFlights } = await import("../../src/features/flights/services/tdxService");

    let createdTrip: any = null;
    vi.mocked(createFullTrip).mockImplementation(async (trip: any) => {
      createdTrip = trip;
    });
    vi.mocked(getTripById).mockImplementation(async () => createdTrip);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-guide-1",
            email: "guide@example.com",
            user_metadata: { full_name: "Guide Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([]);
    vi.mocked(fetchTdxFlights)
      .mockResolvedValueOnce([
        {
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
          baggage: { carryOn: { count: 1, weight: "" }, checked: { count: 0, weight: "" } },
        },
      ])
      .mockResolvedValueOnce([
        {
          airline: "EVA Air",
          airlineID: "BR",
          airlineNameZh: "長榮航空",
          airlineNameEn: "EVA Air",
          flightNumber: "BR197",
          departureTime: "2026-10-05T14:15",
          arrivalTime: "2026-10-05T17:00",
          departureAirport: "NRT",
          arrivalAirport: "TPE",
          terminal: "1",
          gate: "B2",
          status: "Scheduled",
          baggage: { carryOn: { count: 1, weight: "" }, checked: { count: 0, weight: "" } },
        },
      ]);

    const { container } = render(<App />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /新增旅程|New Trip/i }).length).toBeGreaterThan(0);
    });

    // Open TripForm and import outbound + inbound flights
    fireEvent.click(screen.getAllByRole("button", { name: /新增旅程|New Trip/i })[0]);
    fireEvent.click(screen.getByRole("tab", { name: /航班匯入|Import Flights/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "NRT" })[1]);
    fireEvent.change(screen.getByPlaceholderText("YYYY/MM/DD"), { target: { value: "20261001" } });
    fireEvent.change(container.querySelector("#outbound-flight-number")!, { target: { value: "BR198" } });
    fireEvent.click(screen.getByRole("button", { name: /^搜尋$|^Search$/i }));

    await waitFor(() => expect(screen.getByText("BR198")).toBeInTheDocument());
    fireEvent.click(screen.getByText("BR198"));
    fireEvent.click(screen.getByRole("button", { name: /下一步：設定回程|Next: Set Inbound/i }));

    fireEvent.change(screen.getByPlaceholderText("YYYY/MM/DD"), { target: { value: "20261005" } });
    fireEvent.change(container.querySelector("#inbound-flight-number")!, { target: { value: "BR197" } });
    fireEvent.click(screen.getByRole("button", { name: /^搜尋$|^Search$/i }));

    await waitFor(() => expect(screen.getByText("BR197")).toBeInTheDocument());
    fireEvent.click(screen.getByText("BR197"));
    fireEvent.click(screen.getByRole("button", { name: /前往確認|Go to Review/i }));
    fireEvent.click(screen.getByRole("button", { name: /確認|Confirm/i }));

    // 1. BoardingPassIssueModal opens with auto-filled BR Economy baggage (1x7kg / 1x23kg)
    await waitFor(() => {
      expect(screen.getByTestId("boarding-pass-issue-modal")).toBeInTheDocument();
    });
    expect(screen.getAllByTestId("boarding-pass-baggage")[0].textContent).toContain("1×23kg");

    // 2. Continue -> Itinerary tab with dismissible guided banner
    fireEvent.click(screen.getByTestId("boarding-pass-continue"));
    await waitFor(() => {
      expect(screen.getByTestId("guide-itinerary-banner")).toBeInTheDocument();
    });

    // 3. Mobile header pill renders alongside the desktop banner (jsdom ignores media queries);
    // clicking it jumps to Flights tab edit mode and focuses the price input
    const mobileCta = screen.getByTestId("mobile-itinerary-price-cta");
    expect(mobileCta).toBeInTheDocument();
    expect(mobileCta.className).toContain("sm:hidden");
    expect(screen.getByTestId("guide-itinerary-banner").className).toContain("hidden sm:flex");
    fireEvent.click(within(mobileCta).getByRole("button", { name: /填機票金額|Add price/i }));
    await waitFor(() => {
      expect(screen.getByTestId("guide-price-hint")).toBeInTheDocument();
    });
    const priceInput = screen.getByTestId("flight-price-input") as HTMLInputElement;
    expect(document.activeElement).toBe(priceInput);

    // 4. Enter price & save -> returns to Overview tab with success toast
    fireEvent.change(priceInput, { target: { value: "16500" } });
    fireEvent.click(screen.getByRole("button", { name: /確認|Confirm|Save/i }));
    await waitFor(() => {
      expect(screen.getByText(/機票金額已儲存|Ticket price saved/i)).toBeInTheDocument();
    });
  });

  it("quick-creates a trip without flights directly onto the Overview tab without boarding pass animation", async () => {
    const { supabase, getTrips, getTripById, createFullTrip } = await import("../../src/shared/services/storageService");
    let createdTrip: any = null;
    vi.mocked(createFullTrip).mockImplementation(async (trip: any) => {
      createdTrip = trip;
    });
    vi.mocked(getTripById).mockImplementation(async () => createdTrip);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-quick-1",
            email: "quick@example.com",
            user_metadata: { full_name: "Quick Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([]);

    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /新增旅程|New Trip/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /新增旅程|New Trip/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/例如：東京 5 日遊|e\.g\., Tokyo 5 Days/i), {
      target: { value: "Taipei Weekend" },
    });
    const [startInput, endInput] = screen.getAllByPlaceholderText("YYYY/MM/DD");
    fireEvent.change(startInput, { target: { value: "20261101" } });
    fireEvent.change(endInput, { target: { value: "20261103" } });
    fireEvent.click(screen.getByRole("button", { name: /建立旅程|Create Trip/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Taipei Weekend").length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("boarding-pass-issue-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guide-itinerary-banner")).not.toBeInTheDocument();
  });

  it("deduplicates trip IDs and skips Realtime list refresh during trip creation so no duplicate trip card appears", async () => {
    const { supabase, getTrips, getTripById, createFullTrip } = await import("../../src/shared/services/storageService");
    let globalTripsInsertHandler: ((payload: any) => void) | null = null;
    const globalChannel = {
      on: vi.fn().mockImplementation(function (this: any, type: string, filter: any, cb: (payload: any) => void) {
        if (type === "postgres_changes" && filter?.table === "trips") {
          globalTripsInsertHandler = cb;
        }
        return this;
      }),
      subscribe: vi.fn().mockReturnThis(),
    };
    const activeChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    vi.mocked(supabase.channel).mockImplementation((name: string) =>
      name.startsWith("global-trips-") ? (globalChannel as any) : (activeChannel as any)
    );

    const duplicatePartialTrip = {
      id: "trip-new-1",
      user_id: "user-dedupe-1",
      name: "Taipei Weekend",
      destination: "Taipei Weekend",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [],
    };

    let createdTrip: any = null;
    let resolveCreateFullTrip!: () => void;
    vi.mocked(createFullTrip).mockImplementation(
      (trip: any) =>
        new Promise<void>((resolve) => {
          createdTrip = trip;
          resolveCreateFullTrip = resolve;
        })
    );
    vi.mocked(getTripById).mockImplementation(async () => createdTrip);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-dedupe-1",
            email: "dedupe@example.com",
            user_metadata: { full_name: "Dedupe Traveler" },
          },
        } as any,
      },
      error: null,
    });
    // Return duplicate partial rows with the same ID as the newly created trip
    vi.mocked(getTrips).mockResolvedValue([duplicatePartialTrip, duplicatePartialTrip]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Taipei Weekend" })).toHaveLength(1);
    });
    const initialGetTripsCalls = vi.mocked(getTrips).mock.calls.length;

    // Open TripForm and submit while createFullTrip stays in flight
    fireEvent.click(screen.getAllByRole("button", { name: /新增旅程|New Trip/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/例如：東京 5 日遊|e\.g\., Tokyo 5 Days/i), {
      target: { value: "Taipei Weekend" },
    });
    const [startInput, endInput] = screen.getAllByPlaceholderText("YYYY/MM/DD");
    fireEvent.change(startInput, { target: { value: "20261101" } });
    fireEvent.change(endInput, { target: { value: "20261103" } });

    const submitBtn = screen.getByRole("button", { name: /建立旅程|Create Trip/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createFullTrip).toHaveBeenCalledTimes(1);
    });

    // Simulate Realtime INSERT firing mid-creation; refreshList() must skip while creatingTripRef is true
    expect(globalTripsInsertHandler).not.toBeNull();
    act(() => {
      globalTripsInsertHandler!({ eventType: "INSERT", new: { id: "trip-new-1" } });
    });
    expect(vi.mocked(getTrips).mock.calls.length).toBe(initialGetTripsCalls);

    await act(async () => {
      resolveCreateFullTrip();
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/trips/trip-new-1");
    });

    // Navigate back to the trips list and verify only one trip card exists for trip-new-1
    const backBtn = document.querySelector("nav button") as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/trips");
      expect(screen.getAllByRole("heading", { name: "Taipei Weekend" })).toHaveLength(1);
    });
  });

  it("patches itinerary_items, expenses, and flights incrementally via Realtime without triggering 6-table refetch and ignores unrelated DELETE IDs", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");

    type HandlerKey = `${string}:${string}`;
    const activeHandlers = new Map<HandlerKey, (payload: any) => void>();
    let activeSubscribeCb: ((status: string) => void) | null = null;

    const activeChannel = {
      on: vi.fn().mockImplementation(function (this: any, type: string, filter: any, cb: (payload: any) => void) {
        if (type === "postgres_changes" && filter?.table && filter?.event) {
          activeHandlers.set(`${filter.table}:${filter.event}`, cb);
        }
        return this;
      }),
      subscribe: vi.fn().mockImplementation(function (this: any, cb?: (status: string) => void) {
        activeSubscribeCb = cb || null;
        return this;
      }),
      send: vi.fn().mockResolvedValue("ok"),
    };
    const globalChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    vi.mocked(supabase.channel).mockImplementation((name: string) =>
      name.startsWith("realtime-sync-") ? (activeChannel as any) : (globalChannel as any)
    );

    const mockTrip = {
      id: "trip-rt-1",
      user_id: "user-rt-1",
      name: "Tokyo Live",
      destination: "Tokyo, Japan",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      allowed_emails: ["rt@example.com"],
      expenses: [
        {
          id: "exp-existing",
          user_id: "user-rt-1",
          user_name: "RT User",
          amount: 1000,
          currency: "TWD",
          category: "Food",
          date: "2026-10-01",
          note: "Existing Coffee",
          exchangeRate: 1,
        },
      ],
      flights: [
        {
          id: "flight-existing",
          user_id: "user-rt-1",
          traveler_name: "RT User",
          price: 15000,
          currency: "TWD",
          cabinClass: "Economy",
          outbound: {
            airline: "EVA Air",
            flightNumber: "BR198",
            departureTime: "2026-10-01T08:50",
            arrivalTime: "2026-10-01T13:15",
            departureAirport: "TPE",
            arrivalAirport: "NRT",
          },
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
        },
      ],
      checklist: [
        {
          id: "check-existing",
          user_id: "user-rt-1",
          text: "Passport",
          isCompleted: false,
          category: "Documents",
        },
      ],
      itinerary: [
        {
          date: "2026-10-01",
          items: [
            {
              id: "it-existing",
              user_id: "user-rt-1",
              time: "09:00",
              placeName: "Senso-ji",
              type: "Place",
              date: "2026-10-01",
            },
          ],
        },
        { date: "2026-10-02", items: [] },
      ],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-rt-1",
            email: "rt@example.com",
            user_metadata: { full_name: "RT User" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);

    render(<App />);
    await waitFor(() => expect(screen.getByText("Tokyo Live")).toBeInTheDocument());

    act(() => {
      screen.getByText("Tokyo Live").click();
    });

    // Switch to Itinerary tab to verify live UI patching
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /行程|Itinerary/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /行程|Itinerary/i })[0]);
    await waitFor(() => expect(screen.getByText("Senso-ji")).toBeInTheDocument());

    // Capture baseline getTripById call count after initial trip entry
    const baselineRefetchCalls = vi.mocked(getTripById).mock.calls.length;

    // 1. Itinerary INSERT (from collaborator) -> appears immediately without calling getTripById
    act(() => {
      activeHandlers.get("itinerary_items:INSERT")?.({
        new: {
          id: "it-collab-5",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          time: "14:00",
          place_name: "Shibuya Sky",
          lat: 35.6584,
          lng: 139.7022,
          type: "Place",
          date: "2026-10-01",
        },
      });
    });
    await waitFor(() => expect(screen.getByText("Shibuya Sky")).toBeInTheDocument());
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);

    // 2. Itinerary UPDATE -> updates name in place without duplicates
    act(() => {
      activeHandlers.get("itinerary_items:UPDATE")?.({
        new: {
          id: "it-collab-5",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          time: "15:00",
          place_name: "Shibuya Sky Sunset",
          lat: 35.6584,
          lng: 139.7022,
          type: "Place",
          date: "2026-10-01",
        },
      });
    });
    await waitFor(() => {
      expect(screen.getAllByText("Shibuya Sky Sunset")).toHaveLength(1);
    });
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);

    // 3. Unrelated DELETE IDs across all tables -> completely ignored (zero getTripById calls!)
    act(() => {
      activeHandlers.get("itinerary_items:DELETE")?.({ old: { id: "other-trip-it-999" } });
      activeHandlers.get("expenses:DELETE")?.({ old: { id: "other-trip-exp-999" } });
      activeHandlers.get("flights:DELETE")?.({ old: { id: "other-trip-fl-999" } });
      activeHandlers.get("checklist_items:DELETE")?.({ old: { id: "other-trip-ci-999" } });
    });
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);
    expect(screen.getByText("Shibuya Sky Sunset")).toBeInTheDocument();

    // 4. Local Itinerary DELETE -> removes only that item without refetching
    act(() => {
      activeHandlers.get("itinerary_items:DELETE")?.({ old: { id: "it-collab-5" } });
    });
    await waitFor(() => {
      expect(screen.queryByText("Shibuya Sky Sunset")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Senso-ji")).toBeInTheDocument();
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);

    // 5. Expenses INSERT / UPDATE / DELETE incrementally on Expenses tab
    fireEvent.click(screen.getAllByRole("button", { name: /花費|Expenses/i })[0]);
    await waitFor(() => expect(screen.getByText("Existing Coffee")).toBeInTheDocument());

    act(() => {
      activeHandlers.get("expenses:INSERT")?.({
        new: {
          id: "exp-collab-2",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          user_name: "Bob",
          amount: 2500,
          currency: "JPY",
          category: "Food",
          date: "2026-10-01",
          note: "Ramen Bowl",
          exchange_rate: 0.22,
          created_at: "2026-10-01T12:00:00Z",
        },
      });
    });
    await waitFor(() => expect(screen.getByText("Ramen Bowl")).toBeInTheDocument());

    act(() => {
      activeHandlers.get("expenses:UPDATE")?.({
        new: {
          id: "exp-collab-2",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          user_name: "Bob",
          amount: 3200,
          currency: "JPY",
          category: "Food",
          date: "2026-10-01",
          note: "Deluxe Ramen",
          exchange_rate: 0.22,
          created_at: "2026-10-01T12:00:00Z",
        },
      });
    });
    await waitFor(() => expect(screen.getByText("Deluxe Ramen")).toBeInTheDocument());

    act(() => {
      activeHandlers.get("expenses:DELETE")?.({ old: { id: "exp-collab-2" } });
    });
    await waitFor(() => expect(screen.queryByText("Deluxe Ramen")).not.toBeInTheDocument());
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);

    // 6. Flights INSERT / UPDATE / DELETE incrementally on Flights tab
    fireEvent.click(screen.getAllByRole("button", { name: /機票|Tickets/i })[0]);
    await waitFor(() => expect(screen.getAllByText("BR198").length).toBeGreaterThan(0));

    act(() => {
      activeHandlers.get("flights:INSERT")?.({
        new: {
          id: "flight-collab-2",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          traveler_name: "Bob",
          price: 18000,
          currency: "TWD",
          cabin_class: "Economy",
          outbound: {
            airline: "Starlux",
            flightNumber: "JX800",
            departureTime: "2026-10-01T08:30",
            arrivalTime: "2026-10-01T12:45",
            departureAirport: "TPE",
            arrivalAirport: "NRT",
          },
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
        },
      });
    });
    await waitFor(() => expect(screen.getAllByText("JX800").length).toBeGreaterThan(0));

    act(() => {
      activeHandlers.get("flights:UPDATE")?.({
        new: {
          id: "flight-collab-2",
          trip_id: "trip-rt-1",
          user_id: "user-collab",
          traveler_name: "Bob",
          price: 19500,
          currency: "TWD",
          cabin_class: "Business",
          outbound: {
            airline: "Starlux",
            flightNumber: "JX802",
            departureTime: "2026-10-01T10:30",
            arrivalTime: "2026-10-01T14:45",
            departureAirport: "TPE",
            arrivalAirport: "NRT",
          },
          baggage: { carryOn: { count: 1, weight: "7kg" }, checked: { count: 2, weight: "32kg" } },
        },
      });
    });
    await waitFor(() => expect(screen.getAllByText("JX802").length).toBeGreaterThan(0));

    act(() => {
      activeHandlers.get("flights:DELETE")?.({ old: { id: "flight-collab-2" } });
    });
    await waitFor(() => expect(screen.queryByText("JX802")).not.toBeInTheDocument());
    expect(vi.mocked(getTripById).mock.calls.length).toBe(baselineRefetchCalls);
    expect(activeSubscribeCb).not.toBeNull();
  });

  it("handles offline -> online transitions, channel error status, and one-click retry resync in the header", async () => {
    const { supabase, getTrips, getTripById } = await import("../../src/shared/services/storageService");
    let activeSubscribeCb: ((status: string) => void) | null = null;

    const activeChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation(function (this: any, cb?: (status: string) => void) {
        activeSubscribeCb = cb || null;
        return this;
      }),
      send: vi.fn().mockResolvedValue("ok"),
    };
    const globalChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    vi.mocked(supabase.channel).mockImplementation((name: string) =>
      name.startsWith("realtime-sync-") ? (activeChannel as any) : (globalChannel as any)
    );

    const mockTrip = {
      id: "trip-net-1",
      user_id: "user-net-1",
      name: "Hokkaido Winter",
      destination: "Sapporo, Japan",
      startDate: "2026-12-01",
      endDate: "2026-12-03",
      allowed_emails: ["net@example.com"],
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [{ date: "2026-12-01", items: [] }],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-net-1",
            email: "net@example.com",
            user_metadata: { full_name: "Net Traveler" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);

    const onLineSpy = vi.spyOn(window.navigator, "onLine", "get");
    onLineSpy.mockReturnValue(true);

    try {
      render(<App />);
      await waitFor(() => expect(screen.getByText("Hokkaido Winter")).toBeInTheDocument());

      act(() => {
        screen.getByText("Hokkaido Winter").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("sync-status-pill")).toHaveAttribute("data-sync-status", "synced");
      });

      // 1. Browser goes offline -> status pill switches to offline
      onLineSpy.mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await waitFor(() => {
        const pill = screen.getByTestId("sync-status-pill");
        expect(pill).toHaveAttribute("data-sync-status", "offline");
        expect(pill.className).toContain("whitespace-nowrap");
      });

      const callsBeforeOnline = vi.mocked(getTripById).mock.calls.length;
      const tripsCallsBeforeOnline = vi.mocked(getTrips).mock.calls.length;

      // 2. Browser comes back online -> triggers resync & restores synced status
      onLineSpy.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await waitFor(() => {
        expect(vi.mocked(getTripById).mock.calls.length).toBeGreaterThan(callsBeforeOnline);
        expect(vi.mocked(getTrips).mock.calls.length).toBeGreaterThan(tripsCallsBeforeOnline);
        expect(screen.getByTestId("sync-status-pill")).toHaveAttribute("data-sync-status", "synced");
      });

      // 3. Realtime channel drops (CHANNEL_ERROR) -> exposes one-click retry button
      act(() => {
        activeSubscribeCb?.("CHANNEL_ERROR");
      });
      await waitFor(() => {
        const retryBtn = screen.getByTestId("sync-retry-btn");
        expect(retryBtn).toHaveAttribute("data-sync-status", "error");
        expect(retryBtn.className).toContain("whitespace-nowrap");
      });

      const callsBeforeRetry = vi.mocked(getTripById).mock.calls.length;
      const tripsCallsBeforeRetry = vi.mocked(getTrips).mock.calls.length;

      // 4. Clicking retry resyncs active trip + trips list and restores synced state
      fireEvent.click(screen.getByTestId("sync-retry-btn"));
      await waitFor(() => {
        expect(vi.mocked(getTripById).mock.calls.length).toBeGreaterThan(callsBeforeRetry);
        expect(vi.mocked(getTrips).mock.calls.length).toBeGreaterThan(tripsCallsBeforeRetry);
        expect(screen.getByTestId("sync-status-pill")).toHaveAttribute("data-sync-status", "synced");
      });

      // 5. Tab becoming visible triggers gentle resync
      const callsBeforeVisible = vi.mocked(getTripById).mock.calls.length;
      const visSpy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      try {
        act(() => {
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await waitFor(() => {
          expect(vi.mocked(getTripById).mock.calls.length).toBeGreaterThan(callsBeforeVisible);
        });
      } finally {
        visSpy.mockRestore();
      }
    } finally {
      onLineSpy.mockRestore();
    }
  });

  it("uses granular upsertExpense (never saveTrip), rolls back on write error, and exposes sync retry button", async () => {
    const { supabase, getTrips, getTripById, upsertExpense, saveTrip } = await import(
      "../../src/shared/services/storageService"
    );

    const mockTrip = {
      id: "trip-gran-1",
      user_id: "user-gran-1",
      name: "Fukuoka Eats",
      destination: "Fukuoka, Japan",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      allowed_emails: ["gran@example.com"],
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [{ date: "2026-11-01", items: [] }],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-gran-1",
            email: "gran@example.com",
            user_metadata: { full_name: "Granular User" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);
    vi.mocked(upsertExpense).mockRejectedValueOnce(new Error("Simulated DB timeout"));

    render(<App />);
    await waitFor(() => expect(screen.getByText("Fukuoka Eats")).toBeInTheDocument());

    act(() => {
      screen.getByText("Fukuoka Eats").click();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /花費|Expenses/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /花費|Expenses/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /新增支出|Add Expense/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /新增支出|Add Expense/i }));

    const amountInput = screen.getByPlaceholderText("0");
    const noteInput = screen.getByPlaceholderText(/備註|Note/i);
    fireEvent.change(amountInput, { target: { value: "850" } });
    fireEvent.change(noteInput, { target: { value: "Hakata Ramen" } });
    fireEvent.click(screen.getByRole("button", { name: /^確認$|^Save$/i }));

    await waitFor(() => {
      expect(upsertExpense).toHaveBeenCalledTimes(1);
      expect(saveTrip).not.toHaveBeenCalled();
      expect(screen.getByTestId("sync-retry-btn")).toHaveAttribute("data-sync-status", "error");
    });

    // Failed optimistic insert must be rolled back from UI
    expect(screen.queryByText("Hakata Ramen")).not.toBeInTheDocument();

    // Clicking retry resyncs and clears error state
    fireEvent.click(screen.getByTestId("sync-retry-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("sync-status-pill")).toHaveAttribute("data-sync-status", "synced");
    });
  });

  it("preserves concurrent Realtime expense and itinerary INSERTs arriving during an async Itinerary save (zero spurious deletes)", async () => {
    const {
      supabase,
      getTrips,
      getTripById,
      upsertItineraryItems,
      deleteExpense,
      deleteItineraryItem,
    } = await import("../../src/shared/services/storageService");
    const { searchFreePlaces } = await import("../../src/features/itinerary/services/searchPlaceService");

    type HandlerKey = `${string}:${string}`;
    const activeHandlers = new Map<HandlerKey, (payload: any) => void>();
    const activeChannel = {
      on: vi.fn().mockImplementation(function (this: any, type: string, filter: any, cb: (payload: any) => void) {
        if (type === "postgres_changes" && filter?.table && filter?.event) {
          activeHandlers.set(`${filter.table}:${filter.event}`, cb);
        }
        return this;
      }),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    const globalChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    vi.mocked(supabase.channel).mockImplementation((name: string) =>
      name.startsWith("realtime-sync-") ? (activeChannel as any) : (globalChannel as any)
    );

    let resolveGeocode!: (results: any[]) => void;
    vi.mocked(searchFreePlaces).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGeocode = resolve;
        })
    );

    const mockTrip = {
      id: "trip-async-race-1",
      user_id: "user-b",
      name: "Kyoto Concurrent",
      destination: "Kyoto, Japan",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      allowed_emails: ["b@example.com", "a@example.com"],
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [
        {
          date: "2026-10-01",
          items: [
            {
              id: "it-initial",
              user_id: "user-b",
              time: "09:00",
              placeName: "Kiyomizu-dera",
              lat: 34.9949,
              lng: 135.785,
              type: "Place",
              date: "2026-10-01",
            },
          ],
        },
        { date: "2026-10-02", items: [] },
      ],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-b",
            email: "b@example.com",
            user_metadata: { full_name: "User B" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);

    render(<App />);
    await waitFor(() => expect(screen.getByText("Kyoto Concurrent")).toBeInTheDocument());
    act(() => {
      screen.getByText("Kyoto Concurrent").click();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /行程|Itinerary/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /行程|Itinerary/i })[0]);
    await waitFor(() => expect(screen.getByText("Kiyomizu-dera")).toBeInTheDocument());

    // User B triggers Add Stop from MapView and clicks Save (suspends on searchFreePlaces await)
    await waitFor(() => expect(screen.getByTestId("mock-map-add-stop")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("mock-map-add-stop"));
    await waitFor(() => expect(screen.getByDisplayValue("Fushimi Inari")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^確認$|^Save$/i }));

    await waitFor(() => expect(searchFreePlaces).toHaveBeenCalledTimes(1));

    // While User B's async geocode is in flight, User A inserts an expense & an itinerary stop via Realtime!
    act(() => {
      activeHandlers.get("expenses:INSERT")?.({
        new: {
          id: "exp-collab-live",
          trip_id: "trip-async-race-1",
          user_id: "user-a",
          user_name: "User A",
          amount: 1800,
          currency: "JPY",
          category: "Food",
          date: "2026-10-01",
          note: "Matcha Parfait",
          exchange_rate: 0.22,
          created_at: "2026-10-01T11:00:00Z",
        },
      });
      activeHandlers.get("itinerary_items:INSERT")?.({
        new: {
          id: "it-collab-live",
          trip_id: "trip-async-race-1",
          user_id: "user-a",
          time: "16:00",
          place_name: "Arashiyama Bamboo Grove",
          lat: 35.017,
          lng: 135.6713,
          type: "Place",
          date: "2026-10-01",
        },
      });
    });

    await waitFor(() => expect(screen.getByText("Arashiyama Bamboo Grove")).toBeInTheDocument());

    // Now User B's geocode resolves and Itinerary calls onUpdate
    await act(async () => {
      resolveGeocode([{ lat: 34.9671, lng: 135.7727 }]);
    });

    await waitFor(() => {
      expect(upsertItineraryItems).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Fushimi Inari")).toBeInTheDocument();
    });

    // CRITICAL: User A's concurrent rows must NEVER be deleted or dropped!
    expect(deleteExpense).not.toHaveBeenCalled();
    expect(deleteItineraryItem).not.toHaveBeenCalled();
    expect(screen.getByText("Arashiyama Bamboo Grove")).toBeInTheDocument();

    // Switch to Expenses tab to verify User A's concurrent Realtime expense is still intact
    fireEvent.click(screen.getAllByRole("button", { name: /花費|Expenses/i })[0]);
    await waitFor(() => expect(screen.getByText("Matcha Parfait")).toBeInTheDocument());
  });

  it("surgically rolls back a failed granular write without wiping concurrent Realtime-inserted rows", async () => {
    const { supabase, getTrips, getTripById, upsertExpense } = await import(
      "../../src/shared/services/storageService"
    );

    type HandlerKey = `${string}:${string}`;
    const activeHandlers = new Map<HandlerKey, (payload: any) => void>();
    const activeChannel = {
      on: vi.fn().mockImplementation(function (this: any, type: string, filter: any, cb: (payload: any) => void) {
        if (type === "postgres_changes" && filter?.table && filter?.event) {
          activeHandlers.set(`${filter.table}:${filter.event}`, cb);
        }
        return this;
      }),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    const globalChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    vi.mocked(supabase.channel).mockImplementation((name: string) =>
      name.startsWith("realtime-sync-") ? (activeChannel as any) : (globalChannel as any)
    );

    let rejectWrite!: (err: Error) => void;
    vi.mocked(upsertExpense).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        })
    );

    const mockTrip = {
      id: "trip-rollback-1",
      user_id: "user-rb-1",
      name: "Osaka Rollback",
      destination: "Osaka, Japan",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      allowed_emails: ["rb@example.com", "collab@example.com"],
      expenses: [],
      flights: [],
      checklist: [],
      itinerary: [{ date: "2026-11-01", items: [] }],
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-rb-1",
            email: "rb@example.com",
            user_metadata: { full_name: "Rollback User" },
          },
        } as any,
      },
      error: null,
    });
    vi.mocked(getTrips).mockResolvedValue([mockTrip as any]);
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);

    render(<App />);
    await waitFor(() => expect(screen.getByText("Osaka Rollback")).toBeInTheDocument());
    act(() => {
      screen.getByText("Osaka Rollback").click();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /花費|Expenses/i }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /花費|Expenses/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /新增支出|Add Expense/i })).toBeInTheDocument();
    });

    // User B adds an expense whose DB write stays in flight
    fireEvent.click(screen.getByRole("button", { name: /新增支出|Add Expense/i }));
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "500" } });
    fireEvent.change(screen.getByPlaceholderText(/備註|Note/i), {
      target: { value: "Failing Takoyaki" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^確認$|^Save$/i }));

    await waitFor(() => expect(screen.getByText("Failing Takoyaki")).toBeInTheDocument());

    // While Failing Takoyaki write is in flight, User A inserts an expense via Realtime
    act(() => {
      activeHandlers.get("expenses:INSERT")?.({
        new: {
          id: "exp-collab-survive",
          trip_id: "trip-rollback-1",
          user_id: "user-collab",
          user_name: "User A",
          amount: 1200,
          currency: "JPY",
          category: "Food",
          date: "2026-11-01",
          note: "Collab Okonomiyaki",
          exchange_rate: 0.22,
          created_at: "2026-11-01T13:00:00Z",
        },
      });
    });
    await waitFor(() => expect(screen.getByText("Collab Okonomiyaki")).toBeInTheDocument());

    // Now User B's write fails -> ONLY Failing Takoyaki rolls back; Collab Okonomiyaki MUST survive!
    await act(async () => {
      rejectWrite(new Error("Write rejected"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Failing Takoyaki")).not.toBeInTheDocument();
      expect(screen.getByTestId("sync-retry-btn")).toHaveAttribute("data-sync-status", "error");
    });
    expect(screen.getByText("Collab Okonomiyaki")).toBeInTheDocument();
  });
});

