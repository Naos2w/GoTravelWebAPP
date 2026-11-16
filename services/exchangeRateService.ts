import { Currency } from "../types";

export const EXCHANGE_RATE_STORAGE_KEY = "go_travel_exchange_rates_v1";
export const EXCHANGE_RATE_TTL_MS = 6 * 60 * 60 * 1000;

export const FALLBACK_RATES_TO_TWD: Record<Currency, number> = {
  [Currency.TWD]: 1,
  [Currency.USD]: 31.5,
  [Currency.JPY]: 0.21,
  [Currency.EUR]: 34.2,
  [Currency.KRW]: 0.024,
  [Currency.CHF]: 36.5,
  [Currency.GBP]: 40.5,
  [Currency.HKD]: 4.05,
  [Currency.THB]: 0.92,
  [Currency.SGD]: 23.8,
  [Currency.AUD]: 20.8,
  [Currency.CAD]: 23.0,
};

interface CachedRatesPayload {
  updatedAt: number;
  rates: Partial<Record<Currency, number>>;
}

const readCachePayload = (): CachedRatesPayload | null => {
  try {
    const raw = localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.updatedAt === "number" &&
      parsed.rates &&
      typeof parsed.rates === "object"
    ) {
      return parsed as CachedRatesPayload;
    }
  } catch {
    // Ignore storage read/parse errors
  }
  return null;
};

/**
 * Returns TWD-normalized exchange rates from localStorage cache merged over fallback rates.
 */
export const getCachedRatesToTwd = (): Record<Currency, number> => {
  const payload = readCachePayload();
  if (!payload) return { ...FALLBACK_RATES_TO_TWD };

  const merged: Record<Currency, number> = { ...FALLBACK_RATES_TO_TWD };
  (Object.values(Currency) as Currency[]).forEach((cur) => {
    if (cur === Currency.TWD) {
      merged[cur] = 1;
      return;
    }
    const candidate = payload.rates[cur];
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      merged[cur] = candidate;
    }
  });
  return merged;
};

/**
 * Resolves the TWD multiplier (1 unit of `currency` = X TWD).
 */
export const getRateToTwd = (
  currency: Currency | string,
  customRates?: Record<string, number>
): number => {
  if (currency === Currency.TWD) return 1;

  const customCandidate = customRates?.[currency];
  if (typeof customCandidate === "number" && Number.isFinite(customCandidate) && customCandidate > 0) {
    return customCandidate;
  }

  const cached = getCachedRatesToTwd()[currency as Currency];
  if (typeof cached === "number" && Number.isFinite(cached) && cached > 0) {
    return cached;
  }

  return FALLBACK_RATES_TO_TWD[currency as Currency] ?? 1;
};

/**
 * Uses locked historical exchangeRate on saved flights if present; otherwise falls back to current rate.
 */
export const resolveHistoricalFlightRate = (
  flight: { currency: Currency | string; exchangeRate?: number },
  customRates?: Record<string, number>
): number => {
  if (flight.currency === Currency.TWD) return 1;
  if (
    typeof flight.exchangeRate === "number" &&
    Number.isFinite(flight.exchangeRate) &&
    flight.exchangeRate > 0
  ) {
    return flight.exchangeRate;
  }
  return getRateToTwd(flight.currency, customRates);
};

/**
 * Fetches live exchange rates from ExchangeRate-API Open Access (`base = TWD`),
 * converts each rate into "1 foreign currency = X TWD", and caches in localStorage.
 */
export const fetchLiveRatesToTwd = async (
  force = false
): Promise<Record<Currency, number>> => {
  const existing = readCachePayload();
  if (!force && existing && Date.now() - existing.updatedAt < EXCHANGE_RATE_TTL_MS) {
    return getCachedRatesToTwd();
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/TWD");
    if (!response.ok) {
      return getCachedRatesToTwd();
    }

    const data = await response.json();
    const apiRates = data?.rates;
    if (!apiRates || typeof apiRates !== "object") {
      return getCachedRatesToTwd();
    }

    const nextRates: Record<Currency, number> = { ...getCachedRatesToTwd() };
    (Object.values(Currency) as Currency[]).forEach((cur) => {
      if (cur === Currency.TWD) {
        nextRates[cur] = 1;
        return;
      }
      const twdToCur = apiRates[cur];
      if (typeof twdToCur === "number" && Number.isFinite(twdToCur) && twdToCur > 0) {
        nextRates[cur] = Number((1 / twdToCur).toPrecision(5));
      }
    });

    try {
      localStorage.setItem(
        EXCHANGE_RATE_STORAGE_KEY,
        JSON.stringify({ updatedAt: Date.now(), rates: nextRates })
      );
    } catch {
      // Ignore quota/storage errors
    }

    return nextRates;
  } catch {
    return getCachedRatesToTwd();
  }
};
