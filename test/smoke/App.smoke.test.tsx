import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

let authStateListener: ((event: string, session: any) => void) | null = null;

// Mock supabase client to avoid external network calls during smoke tests
vi.mock("../../services/storageService", () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
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
    updateChecklistItem: vi.fn().mockResolvedValue(undefined),
    addChecklistItem: vi.fn().mockResolvedValue(undefined),
    isSupabaseConfigured: vi.fn().mockReturnValue(true),
  };
});

// Mock leaflet & MapView to avoid canvas/DOM errors in jsdom
vi.mock("../../components/MapView", () => ({
  MapView: () => <div data-testid="mock-map-view">Mock Map</div>,
}));

import App from "../../App";

describe("App Component (Smoke Test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const { supabase, getTrips } = await import("../../services/storageService");
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
    const { supabase, getTrips } = await import("../../services/storageService");
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
});
