import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BudgetModal } from "../../components/BudgetModal";
import { ShareModal } from "../../components/ShareModal";
import { TripForm } from "../../components/TripForm";
import { CustomDateTimeInput } from "../../components/CustomDateTimeInput";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip, User } from "../../types";

describe("Modals & Input Components Smoke Tests", () => {
  const mockUser: User = {
    id: "user-123",
    email: "owner@test.com",
    name: "Trip Owner",
    picture: ""
  };

  const mockTrip: Trip = {
    id: "5bf223d6-4053-4a75-a38f-1c51596b1c5c",
    user_id: "user-123",
    name: "Kyoto Serenity",
    destination: "Kyoto, Japan",
    startDate: "2026-10-01",
    endDate: "2026-10-05",
    flights: [],
    expenses: [],
    checklist: [],
    itinerary: [],
    allowed_emails: ["collab@test.com"],
    collaborators: [
      { user_id: "user-456", email: "collab@test.com", role: "editor" }
    ]
  };

  describe("BudgetModal", () => {
    it("renders budget input and saves value", () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      render(
        <LocalizationProvider>
          <BudgetModal
            initialValue="50000"
            onSave={handleSave}
            onClose={handleClose}
          />
        </LocalizationProvider>
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(50000);

      const saveBtn = screen.getByRole("button", { name: /確認|Confirm/i });
      fireEvent.click(saveBtn);
      expect(handleSave).toHaveBeenCalledWith("50000");
    });
  });

  describe("ShareModal", () => {
    it("renders share dialog and collaborator email", () => {
      render(
        <LocalizationProvider>
          <ShareModal
            trip={mockTrip}
            user={mockUser}
            onClose={vi.fn()}
            onInvite={vi.fn()}
            onRemoveInvite={vi.fn()}
            copyLink={vi.fn()}
          />
        </LocalizationProvider>
      );

      expect(screen.getByText("collab@test.com")).toBeInTheDocument();
    });
  });

  describe("TripForm", () => {
    it("renders trip creation modal fields", () => {
      render(
        <LocalizationProvider>
          <TripForm
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </LocalizationProvider>
      );

      expect(screen.getByText("新增旅程")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("KIX")).toBeInTheDocument();
    });
  });

  describe("CustomDateTimeInput", () => {
    it("renders datetime input with formatted values", () => {
      render(
        <LocalizationProvider>
          <CustomDateTimeInput
            value="2026-10-01T14:30:00"
            onChange={vi.fn()}
            label="Departure Time"
          />
        </LocalizationProvider>
      );

      expect(screen.getByText("14:30")).toBeInTheDocument();
    });
  });
});
