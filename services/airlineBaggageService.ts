import { BaggageInfo } from '../types';

type Allowance = { count: number; weight: string };

/** Low-cost carriers: the same cabin allowance regardless of cabin class (no checked bag included). */
const LCC_PRESETS: Record<string, { carryOn: Allowance; checked: Allowance }> = {
  IT: { carryOn: { count: 2, weight: '10kg' }, checked: { count: 0, weight: '0kg' } }, // Tigerair Taiwan
  TR: { carryOn: { count: 2, weight: '10kg' }, checked: { count: 0, weight: '0kg' } }, // Scoot
  MM: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // Peach
  GK: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // Jetstar Japan
  '3K': { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // Jetstar Asia
  JQ: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // Jetstar
  AK: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // AirAsia
  D7: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // AirAsia X
  FD: { carryOn: { count: 2, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // Thai AirAsia
  '7C': { carryOn: { count: 1, weight: '10kg' }, checked: { count: 0, weight: '0kg' } }, // Jeju Air
  TW: { carryOn: { count: 1, weight: '10kg' }, checked: { count: 0, weight: '0kg' } }, // T'way
  LJ: { carryOn: { count: 1, weight: '10kg' }, checked: { count: 0, weight: '0kg' } }, // Jin Air
  UO: { carryOn: { count: 1, weight: '7kg' }, checked: { count: 0, weight: '0kg' } }, // HK Express
};

/**
 * Full-service carriers with two 23kg checked bags in Economy on typical long-haul routes.
 * Other full-service carriers (JX, BR, CI, JL, NH, CX, SQ, KE, OZ, TG, ...) and unknown
 * airlines use the single-23kg Asia-regional default.
 */
const FULL_SERVICE_TWO_BAGS = ['AC', 'UA', 'DL', 'AA', 'LH', 'LX', 'BA', 'AF', 'QF'];

const isPremiumCabin = (cabinClass?: string): boolean => {
  const c = (cabinClass || '').trim().toLowerCase();
  return c.startsWith('business') || c.startsWith('first');
};

const premiumBaggage = (): BaggageInfo => ({
  carryOn: { count: 2, weight: '7kg' },
  checked: { count: 2, weight: '32kg' },
});

/**
 * Returns a sensible default baggage allowance for an airline (IATA code) and cabin class.
 * Always returns a fresh object so callers may mutate or store it safely.
 */
export const getDefaultBaggage = (airlineID?: string, cabinClass?: string): BaggageInfo => {
  const code = (airlineID || '').trim().toUpperCase();

  const lcc = LCC_PRESETS[code];
  if (lcc) {
    return {
      carryOn: { ...lcc.carryOn },
      checked: { ...lcc.checked },
    };
  }

  if (isPremiumCabin(cabinClass)) return premiumBaggage();

  if (FULL_SERVICE_TWO_BAGS.includes(code)) {
    return { carryOn: { count: 1, weight: '7kg' }, checked: { count: 2, weight: '23kg' } };
  }

  return { carryOn: { count: 1, weight: '7kg' }, checked: { count: 1, weight: '23kg' } };
};

/** Best-effort IATA airline code from a flight number such as "BR198" or "3K512" ('' when unknown). */
export const inferAirlineId = (flightNumber?: string): string => {
  const m = /^\s*([A-Za-z0-9]{2})\s*\d{1,4}[A-Za-z]?\s*$/.exec(flightNumber || '');
  return m ? m[1].toUpperCase() : '';
};

/** Compares two baggage allowances by value (used to detect whether the user customised the preset). */
export const isSameBaggage = (a?: BaggageInfo, b?: BaggageInfo): boolean => {
  if (!a || !b) return false;
  const norm = (w?: string) => parseFloat((w || '').replace(/[^0-9.]/g, '')) || 0;
  return (
    (a.carryOn?.count || 0) === (b.carryOn?.count || 0) &&
    norm(a.carryOn?.weight) === norm(b.carryOn?.weight) &&
    (a.checked?.count || 0) === (b.checked?.count || 0) &&
    norm(a.checked?.weight) === norm(b.checked?.weight)
  );
};

/** One-line human summary, e.g. "手提 1×7kg · 託運 1×23kg" labels supplied by the caller. */
export const formatBaggageSummary = (
  baggage: BaggageInfo | undefined,
  labels: { carryOn: string; checked: string; none: string }
): string => {
  const part = (label: string, a?: Allowance) =>
    a && a.count > 0 ? `${label} ${a.count}×${a.weight || ''}`.trim() : `${label} ${labels.none}`;
  return `${part(labels.carryOn, baggage?.carryOn)} · ${part(labels.checked, baggage?.checked)}`;
};
