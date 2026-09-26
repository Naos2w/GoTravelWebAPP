import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock supabase client to avoid external network calls during smoke tests
vi.mock("../../services/storageService", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    getTrips: vi.fn().mockResolvedValue([]),
    getTripById: vi.fn().mockResolvedValue(null),
  },
  isSupabaseConfigured: vi.fn().mockReturnValue(true),
}));

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
});
