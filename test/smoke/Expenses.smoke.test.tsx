import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Expenses } from "../../components/Expenses";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip, User, Currency } from "../../types";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />,
}));

describe("Expenses Component Smoke Test", () => {
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    picture: ""
  };

  const mockTrip: Trip = {
    id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
    user_id: "user-123",
    name: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    flights: [],
    checklist: [],
    itinerary: [],
    expenses: [
      {
        id: "exp-1",
        user_id: "user-123",
        user_name: "Test User",
        amount: 1500,
        currency: Currency.JPY,
        category: "Food",
        date: "2026-10-01",
        note: "Tsukiji Sushi Feast",
        exchangeRate: 0.22
      }
    ]
  };

  it("renders expenses list and note without crashing", () => {
    render(
      <LocalizationProvider>
        <Expenses
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    // Note should be rendered
    expect(screen.getByText("Tsukiji Sushi Feast")).toBeInTheDocument();
    // Currency code should be visible
    expect(screen.getAllByText(/JPY/i).length).toBeGreaterThan(0);
  });

  it("renders empty expenses state cleanly", () => {
    const emptyTrip: Trip = {
      ...mockTrip,
      expenses: []
    };

    render(
      <LocalizationProvider>
        <Expenses
          trip={emptyTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    // Verify component mounts without throwing
    expect(document.body).toBeDefined();
  });
});
