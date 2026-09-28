import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checklist } from "../../components/Checklist";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip, User } from "../../types";

describe("Checklist Component Smoke Test", () => {
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
    expenses: [],
    itinerary: [],
    checklist: [
      {
        id: "check-1",
        user_id: "user-123",
        text: "Passport & Rail Pass",
        isCompleted: false,
        category: "Documents"
      }
    ]
  };

  it("renders checklist items and progress without crashing", () => {
    render(
      <LocalizationProvider>
        <Checklist
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    // Verify item text is rendered
    expect(screen.getByText("Passport & Rail Pass")).toBeInTheDocument();
    // Progress percentage indicator should be present
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });

  it("renders empty checklist cleanly", () => {
    const emptyTrip: Trip = {
      ...mockTrip,
      checklist: []
    };

    render(
      <LocalizationProvider>
        <Checklist
          trip={emptyTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });

  it("rapidly toggling items maintains user's latest state and resists stale prop overrides", () => {
    const onUpdateMock = vi.fn();
    const { rerender } = render(
      <LocalizationProvider>
        <Checklist
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={onUpdateMock}
        />
      </LocalizationProvider>
    );

    // Find the checkbox button for Passport & Rail Pass
    const itemText = screen.getByText("Passport & Rail Pass");
    const container = itemText.closest("div")!;
    const checkBtn = container.querySelector("button")!;
    fireEvent.click(checkBtn);

    // Text should immediately have line-through style and checkbox becomes completed
    expect(itemText).toHaveClass("line-through");

    // Simulate stale server echo arriving from props (still isCompleted: false)
    rerender(
      <LocalizationProvider>
        <Checklist
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={onUpdateMock}
        />
      </LocalizationProvider>
    );

    // Anti-revert lock should protect the state, remaining completed and strike-through
    expect(screen.getByText("Passport & Rail Pass")).toHaveClass("line-through");
  });
});
