import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Currency } from "../../src/types";
import {
  EXCHANGE_RATE_STORAGE_KEY,
  FALLBACK_RATES_TO_TWD,
  getCachedRatesToTwd,
  getRateToTwd,
  resolveHistoricalFlightRate,
  fetchLiveRatesToTwd,
  getTripLockedRates,
  lockTripRate,
  convertFromTwd,
  formatCurrencyAmount,
  formatWithCurrencySymbol,
} from "../../src/features/expenses/services/exchangeRateService";

describe("exchangeRateService (Unit Tests)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("provides fallback rates for all supported travel currencies including CHF, GBP, THB, HKD", () => {
    expect(FALLBACK_RATES_TO_TWD[Currency.TWD]).toBe(1);
    expect(FALLBACK_RATES_TO_TWD[Currency.CHF]).toBeGreaterThan(0);
    expect(FALLBACK_RATES_TO_TWD[Currency.GBP]).toBeGreaterThan(0);
    expect(FALLBACK_RATES_TO_TWD[Currency.THB]).toBeGreaterThan(0);
    expect(FALLBACK_RATES_TO_TWD[Currency.HKD]).toBeGreaterThan(0);
    expect(getRateToTwd(Currency.JPY)).toBe(FALLBACK_RATES_TO_TWD[Currency.JPY]);
  });

  it("fetches live rates from open.er-api.com (base TWD), inverts to TWD per unit, and caches in localStorage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: "success",
        rates: {
          TWD: 1,
          USD: 0.03125, // 1 USD = 32 TWD
          JPY: 4.5, // 1 JPY ≈ 0.22222 TWD
          CHF: 0.027027, // 1 CHF ≈ 37 TWD
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const rates = await fetchLiveRatesToTwd(true);
    expect(fetchMock).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/TWD");
    expect(rates[Currency.TWD]).toBe(1);
    expect(rates[Currency.USD]).toBeCloseTo(32, 3);
    expect(rates[Currency.CHF]).toBeCloseTo(37, 1);

    const cachedRaw = localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    expect(cachedRaw).toBeTruthy();
    expect(getCachedRatesToTwd()[Currency.USD]).toBeCloseTo(32, 3);
  });

  it("returns cached/fallback rates cleanly when fetch fails offline", async () => {
    localStorage.setItem(
      EXCHANGE_RATE_STORAGE_KEY,
      JSON.stringify({
        updatedAt: 0, // expired TTL so it attempts fetch
        rates: { CHF: 38.4 },
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));

    const rates = await fetchLiveRatesToTwd();
    expect(rates[Currency.CHF]).toBe(38.4);
  });

  it("locks historical flight exchange rates so future market shifts do not alter saved totals", () => {
    const currentMarketRates = {
      [Currency.CHF]: 40.0,
      [Currency.JPY]: 0.25,
    };

    // Flight saved previously at 36.2 TWD/CHF keeps its locked rate 36.2 even though market is now 40.0
    expect(
      resolveHistoricalFlightRate(
        { currency: Currency.CHF, exchangeRate: 36.2 },
        currentMarketRates
      )
    ).toBe(36.2);

    // TWD flight is always 1
    expect(
      resolveHistoricalFlightRate(
        { currency: Currency.TWD, exchangeRate: 1 },
        currentMarketRates
      )
    ).toBe(1);

    // Legacy flight without locked rate falls back to market/cached rate
    expect(
      resolveHistoricalFlightRate({ currency: Currency.JPY }, currentMarketRates)
    ).toBe(0.25);
  });

  it("maintains per-trip locked exchange rate snapshots and converts from TWD accurately", () => {
    const tripId = "trip-rate-lock-1";
    lockTripRate(tripId, Currency.CHF, 36.0);

    const rates = getTripLockedRates(
      tripId,
      [{ currency: Currency.JPY, exchangeRate: 0.215 }],
      [],
      { ...FALLBACK_RATES_TO_TWD, [Currency.CHF]: 40.0, [Currency.JPY]: 0.25 }
    );

    // Explicitly locked CHF rate in localStorage and saved JPY expense rate override newer live rates
    expect(rates[Currency.CHF]).toBe(36.0);
    expect(rates[Currency.JPY]).toBe(0.215);
    expect(rates[Currency.TWD]).toBe(1);

    // 3600 TWD at locked 36.0 CHF = 100 CHF
    expect(convertFromTwd(3600, Currency.CHF, rates)).toBe(100);
    expect(convertFromTwd(3600, Currency.TWD, rates)).toBe(3600);

    expect(formatCurrencyAmount(1000.6, Currency.JPY)).toBe("1,001");
    expect(formatCurrencyAmount(123.456, Currency.CHF)).toBe("123.46");
    expect(formatWithCurrencySymbol(3600, Currency.TWD)).toBe("NT$ 3,600");
    expect(formatWithCurrencySymbol(100, Currency.CHF)).toBe("CHF 100");
  });
});
