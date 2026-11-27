import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Expenses } from "../../src/features/expenses/Expenses";
import { LocalizationProvider } from "../../src/shared/contexts/LocalizationContext";
import { Trip, User, Currency } from "../../src/types";
import { EXCHANGE_RATE_STORAGE_KEY } from "../../src/features/expenses/services/exchangeRateService";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />,
}));

describe("Expenses Component Smoke Test", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it("renders AA Splitwise settlement transfers when multiple members share an expense", () => {
    const sharedTrip: Trip = {
      ...mockTrip,
      collaborators: [
        { user_id: "user-123", email: "alice@example.com", role: "owner" },
        { user_id: "user-456", email: "bob@example.com", role: "editor" },
      ],
      expenses: [
        {
          id: "exp-shared-1",
          user_id: "user-123",
          user_name: "Test User",
          paidBy: "user-123",
          paidByName: "Test User",
          splitWith: ["user-123", "user-456"],
          amount: 1000,
          currency: Currency.TWD,
          category: "Food",
          date: "2026-10-01",
          note: "Wagyu Yakiniku",
          exchangeRate: 1,
        },
      ],
    };

    render(
      <LocalizationProvider>
        <Expenses
          trip={sharedTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    const settlementCard = screen.getByTestId("splitwise-settlement-card");
    expect(settlementCard).toBeInTheDocument();
    expect(settlementCard.textContent).toContain("NT$ 500");
    expect(settlementCard.textContent).toContain("bob");
  });

  it("keeps historical expenses locked at their saved exchangeRate and locks current live rate when adding CHF expense", async () => {
    localStorage.setItem(
      EXCHANGE_RATE_STORAGE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        rates: {
          JPY: 0.3, // Different from exp-1's locked 0.22
          CHF: 37.5,
        },
      })
    );

    const onUpdate = vi.fn();
    render(
      <LocalizationProvider>
        <Expenses
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={onUpdate}
        />
      </LocalizationProvider>
    );

    // 1. Existing 1500 JPY expense was locked at 0.22 (NT$ 330), NOT recalculated with current 0.30 (450)
    expect(screen.getAllByText(/NT\$ 330/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/NT\$ 450/)).not.toBeInTheDocument();
    expect(screen.getByTestId("trip-locked-rates-summary").textContent).toContain("1 JPY = NT$ 0.22");
    expect(screen.getByText(/\(@ 0\.22\)/)).toBeInTheDocument();

    // 2. Open Add Entry form, select CHF, enter amount 100 -> shows live rate & locks 37.5 on save
    fireEvent.click(screen.getByRole("button", { name: /新增支出|Add Entry/i }));
    fireEvent.click(screen.getByRole("button", { name: "TWD" }));
    fireEvent.click(screen.getByRole("button", { name: "CHF" }));

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "100" } });

    const noteInput = screen.getByPlaceholderText(/請輸入備註|Description/i);
    fireEvent.change(noteInput, { target: { value: "Geneva Train" } });

    await waitFor(() => {
      const preview = screen.getByTestId("exchange-rate-preview");
      expect(preview.textContent).toContain("1 CHF ≈ NT$ 37.5");
      expect(preview.textContent).toContain("NT$ 3,750");
    });

    fireEvent.click(screen.getByRole("button", { name: /^確認$|^Save$/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updatedTripArg = onUpdate.mock.calls[0][0] as Trip;
    const savedExpense = updatedTripArg.expenses[0];
    expect(savedExpense.currency).toBe(Currency.CHF);
    expect(savedExpense.amount).toBe(100);
    expect(savedExpense.exchangeRate).toBe(37.5);
    expect(localStorage.getItem(`go-travel-last-currency-${mockTrip.id}`)).toBe(Currency.CHF);

    // 3. Reopening Add Entry remembers CHF automatically as the form currency
    fireEvent.click(screen.getByRole("button", { name: /新增支出|Add Entry/i }));
    expect(screen.getByRole("button", { name: "CHF" })).toBeInTheDocument();
  });

  it("allows switching display currency directly from the Total Cost card selector using locked trip rates", () => {
    localStorage.setItem(
      EXCHANGE_RATE_STORAGE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        rates: {
          CHF: 33.0,
        },
      })
    );

    render(
      <LocalizationProvider>
        <Expenses
          trip={mockTrip}
          currentUser={mockUser}
          onUpdate={vi.fn()}
        />
      </LocalizationProvider>
    );

    const heroTotal = screen.getByTestId("hero-total-amount");
    expect(heroTotal.textContent).toBe("NT$ 330");

    // Switch display currency to JPY via top-right selector -> uses exp-1's locked 0.22 rate (330 / 0.22 = 1,500)
    fireEvent.click(screen.getByTestId("display-currency-select"));
    fireEvent.click(screen.getByRole("button", { name: "JPY" }));
    expect(screen.getByTestId("hero-total-amount").textContent).toBe("¥ 1,500");

    // Switch display currency to CHF -> 330 / 33.0 = CHF 10
    fireEvent.click(screen.getByTestId("display-currency-select"));
    fireEvent.click(screen.getByRole("button", { name: "CHF" }));
    expect(screen.getByTestId("hero-total-amount").textContent).toBe("CHF 10");
  });
});
