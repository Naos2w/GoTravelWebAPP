import { Currency } from "../../../types";

export const EXCHANGE_RATE_STORAGE_KEY = "go_travel_exchange_rates_v1";
export const TRIP_LOCKED_RATES_PREFIX = "go_travel_trip_locked_rates_";
export const EXCHANGE_RATE_TTL_MS = 6 * 60 * 60 * 1000;

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.TWD]: "NT$",
  [Currency.USD]: "US$",
  [Currency.JPY]: "¥",
  [Currency.EUR]: "€",
  [Currency.KRW]: "₩",
  [Currency.CHF]: "CHF",
  [Currency.GBP]: "£",
  [Currency.HKD]: "HK$",
  [Currency.THB]: "฿",
  [Currency.SGD]: "S$",
  [Currency.AUD]: "A$",
  [Currency.CAD]: "C$",
};

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

/**
 * Formats a numeric amount cleanly for display according to currency precision conventions.
 */
export const formatCurrencyAmount = (amount: number, currency: Currency): string => {
  if (!Number.isFinite(amount)) return "0";
  if (currency === Currency.TWD || currency === Currency.JPY || currency === Currency.KRW) {
    return Math.round(amount).toLocaleString();
  }
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/**
 * Formats an amount prefixed with its currency symbol (e.g. NT$ 1,200 or CHF 35.5).
 */
export const formatWithCurrencySymbol = (amount: number, currency: Currency): string => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${formatCurrencyAmount(amount, currency)}`;
};

const readTripLockedRatesStorage = (tripId: string): Partial<Record<Currency, number>> => {
  try {
    const raw = localStorage.getItem(`${TRIP_LOCKED_RATES_PREFIX}${tripId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Locks a currency-to-TWD rate snapshot for a specific trip in localStorage if not already locked,
 * ensuring future views of this trip keep consistent historical conversion rates.
 */
export const lockTripRate = (tripId: string, currency: Currency, rate: number): void => {
  if (!tripId || currency === Currency.TWD || !Number.isFinite(rate) || rate <= 0) return;
  try {
    const existing = readTripLockedRatesStorage(tripId);
    if (typeof existing[currency] === "number" && (existing[currency] as number) > 0) {
      return;
    }
    const next = { ...existing, [currency]: rate };
    localStorage.setItem(`${TRIP_LOCKED_RATES_PREFIX}${tripId}`, JSON.stringify(next));
  } catch {
    // Ignore quota/storage errors
  }
};

/**
 * Resolves the effective currency-to-TWD rate table for a trip, prioritizing:
 * 1. Explicit per-trip locked snapshots saved in localStorage
 * 2. Historical exchangeRate values already saved on trip expenses/flights
 * 3. Live / cached global rates merged over fallbacks
 */
export const getTripLockedRates = (
  tripId: string,
  expenses: { currency: Currency; exchangeRate?: number }[],
  flights: { currency: Currency; exchangeRate?: number }[],
  liveRates?: Record<Currency, number>
): Record<Currency, number> => {
  const baseRates: Record<Currency, number> = {
    ...(liveRates || getCachedRatesToTwd()),
  };
  baseRates[Currency.TWD] = 1;

  // Recover locked rates synced via Supabase expenses & flights
  [...flights, ...expenses].forEach((item) => {
    if (
      item.currency &&
      item.currency !== Currency.TWD &&
      typeof item.exchangeRate === "number" &&
      Number.isFinite(item.exchangeRate) &&
      item.exchangeRate > 0
    ) {
      baseRates[item.currency] = item.exchangeRate;
    }
  });

  // Apply explicit per-trip locked display rates from localStorage
  const storedLocked = readTripLockedRatesStorage(tripId);
  (Object.keys(storedLocked) as Currency[]).forEach((cur) => {
    const val = storedLocked[cur];
    if (cur !== Currency.TWD && typeof val === "number" && Number.isFinite(val) && val > 0) {
      baseRates[cur] = val;
    }
  });

  return baseRates;
};

/**
 * Converts a TWD-normalized amount into the selected target currency using locked/effective rates.
 */
export const convertFromTwd = (
  twdAmount: number,
  targetCurrency: Currency,
  tripRates: Record<Currency, number>
): number => {
  if (targetCurrency === Currency.TWD) return twdAmount;
  const rate = tripRates[targetCurrency] || getRateToTwd(targetCurrency);
  return rate > 0 ? twdAmount / rate : twdAmount;
};
