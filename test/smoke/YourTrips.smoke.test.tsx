import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripCard, getTripTiming, getTripCollaboratorCount, getTripPlacesCount } from "../../components/TripCard";
import { DeleteTripModal } from "../../components/DeleteTripModal";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { Trip } from "../../types";

const mockTrip: Trip = {
  id: "trip-1",
  user_id: "user-owner",
  name: "Tokyo Getaway",
  destination: "Tokyo, Japan",
  startDate: "2026-12-01",
  endDate: "2026-12-05",
  expenses: [],
  flights: [],
  checklist: [],
  itinerary: [
    {
      date: "2026-12-01",
      items: [
        {
          id: "item-1",
          time: "10:00",
          placeName: "Senso-ji",
          type: "Place",
          date: "2026-12-01",
        },
      ],
    },
  ],
  allowed_emails: ["owner@example.com", "friend@example.com"],
};

describe("Your Trips UI & Deletion Smoke Tests", () => {
  describe("Trip Timing & Counting Utilities", () => {
    it("computes places and collaborators correctly", () => {
      expect(getTripPlacesCount(mockTrip)).toBe(1);
      expect(getTripCollaboratorCount(mockTrip)).toBe(2);
    });

    it("handles future, ongoing, and past dates gracefully", () => {
      const future = getTripTiming("2099-01-01", "2099-01-05");
      expect(future.status).toBe("upcoming");
      expect(future.daysUntilStart).toBeGreaterThan(0);
      expect(future.durationDays).toBe(5);

      const past = getTripTiming("2000-01-01", "2000-01-05");
      expect(past.status).toBe("past");
      expect(past.durationDays).toBe(5);
    });
  });

  describe("TripCard Component", () => {
    it("renders trip details, destination, and badges without crashing", () => {
      const onSelect = vi.fn();
      const onDeleteClick = vi.fn();

      render(
        <LocalizationProvider>
          <TripCard
            trip={mockTrip}
            currentUserId="user-owner"
            onSelect={onSelect}
            onDeleteClick={onDeleteClick}
            calculateTripTotal={() => 12500}
            getGradient={() => "from-blue-500 to-cyan-400"}
          />
        </LocalizationProvider>
      );

      expect(screen.getByText("Tokyo Getaway")).toBeInTheDocument();
      expect(screen.getByText("Tokyo, Japan")).toBeInTheDocument();
      expect(screen.getByText("NT$ 12,500")).toBeInTheDocument();
      expect(screen.getByText(/擁有者|Owner/)).toBeInTheDocument();
    });

    it("stops propagation when clicking delete button without triggering card selection", () => {
      const onSelect = vi.fn();
      const onDeleteClick = vi.fn();

      render(
        <LocalizationProvider>
          <TripCard
            trip={mockTrip}
            currentUserId="user-owner"
            onSelect={onSelect}
            onDeleteClick={onDeleteClick}
            calculateTripTotal={() => 0}
            getGradient={() => "from-blue-500 to-cyan-400"}
          />
        </LocalizationProvider>
      );

      const deleteBtn = screen.getByTestId("trip-delete-btn");
      fireEvent.click(deleteBtn);

      expect(onDeleteClick).toHaveBeenCalledWith(mockTrip);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("shows leave trip button when user is a collaborator", () => {
      const onSelect = vi.fn();
      const onDeleteClick = vi.fn();

      render(
        <LocalizationProvider>
          <TripCard
            trip={mockTrip}
            currentUserId="user-guest"
            onSelect={onSelect}
            onDeleteClick={onDeleteClick}
            calculateTripTotal={() => 0}
            getGradient={() => "from-blue-500 to-cyan-400"}
          />
        </LocalizationProvider>
      );

      expect(screen.getByTestId("trip-leave-btn")).toBeInTheDocument();
    });
  });

  describe("DeleteTripModal Component", () => {
    it("renders owner delete warning and triggers confirmation", () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <LocalizationProvider>
          <DeleteTripModal
            isOpen={true}
            trip={mockTrip}
            currentUserId="user-owner"
            onClose={onClose}
            onConfirm={onConfirm}
          />
        </LocalizationProvider>
      );

      expect(screen.getByText(/刪除此旅程|Delete Trip/)).toBeInTheDocument();
      expect(screen.getAllByText(/Tokyo Getaway/).length).toBeGreaterThan(0);

      const confirmBtn = screen.getByTestId("confirm-trip-action-btn");
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalled();
    });

    it("renders collaborator leave warning for non-owners", () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <LocalizationProvider>
          <DeleteTripModal
            isOpen={true}
            trip={mockTrip}
            currentUserId="user-other"
            onClose={onClose}
            onConfirm={onConfirm}
          />
        </LocalizationProvider>
      );

      expect(screen.getByText(/退出此旅程|Leave Trip/)).toBeInTheDocument();
      const leaveBtn = screen.getByTestId("confirm-trip-action-btn");
      fireEvent.click(leaveBtn);
      expect(onConfirm).toHaveBeenCalled();
    });

    it("closes modal on cancel click or Escape key", () => {
      const onClose = vi.fn();

      render(
        <LocalizationProvider>
          <DeleteTripModal
            isOpen={true}
            trip={mockTrip}
            currentUserId="user-owner"
            onClose={onClose}
            onConfirm={vi.fn()}
          />
        </LocalizationProvider>
      );

      const cancelBtn = screen.getByTestId("cancel-trip-action-btn");
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });
});
