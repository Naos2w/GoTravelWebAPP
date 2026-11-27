import { ItineraryItem, TransportType } from '../../../types';
import { DateTimeUtils } from '../../../shared/services/dateTimeUtils';

export type ReorderTravelLookup = (
  from: ItineraryItem,
  to: ItineraryItem,
  transportType?: TransportType
) => Promise<number>;

const parseTimeMins = (time: string): number => {
  const [h, m] = (time || '09:00').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 9 * 60;
  return h * 60 + m;
};

const formatMins24 = (totalMins: number): string => {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60).toString().padStart(2, '0');
  const m = (normalized % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const roundUpTo5 = (mins: number): number => Math.ceil(mins / 5) * 5;

/**
 * Recalculates a Transport item's midpoint time and duration string between two adjacent anchors.
 */
export const recalculateTransportSegment = (
  prev: ItineraryItem,
  transport: ItineraryItem,
  next: ItineraryItem
): ItineraryItem => {
  if (transport.transportType === 'Flight') return transport;

  const startMins = parseTimeMins(prev.time);
  let endMins = parseTimeMins(next.time);
  if (endMins < startMins) endMins += 1440;

  const midMin = Math.floor((startMins + endMins) / 2) % 1440;
  return {
    ...transport,
    time: formatMins24(midMin),
    note: DateTimeUtils.getDuration(prev.time, next.time),
  };
};

/**
 * Reorders itinerary anchor items (Place/Food) relative to targetId and direction,
 * preserves the earliest affected slot start time, cascades subsequent times using
 * travel durations, and recalculates adjacent Transport segments.
 */
export const reorderAnchorsWithSmartTime = async (
  items: ItineraryItem[],
  movedId: string,
  targetId: string,
  direction: 'above' | 'below',
  getTravelMins: ReorderTravelLookup
): Promise<ItineraryItem[]> => {
  if (movedId === targetId) return items;

  const originalAnchors = items.filter((i) => i.type !== 'Transport');
  const oldIdx = originalAnchors.findIndex((i) => i.id === movedId);
  const originalTargetIdx = originalAnchors.findIndex((i) => i.id === targetId);
  if (oldIdx === -1 || originalTargetIdx === -1) return items;

  // Snapshot any transport item immediately following each original anchor
  const transportAfterOriginal = new Map<string, ItineraryItem>();
  for (let idx = 0; idx < items.length - 1; idx++) {
    const curr = items[idx];
    const next = items[idx + 1];
    if (curr.type !== 'Transport' && next.type === 'Transport') {
      transportAfterOriginal.set(curr.id, next);
    }
  }

  const reordered: ItineraryItem[] = originalAnchors.map((a) => ({ ...a }));
  const [movedItem] = reordered.splice(oldIdx, 1);
  const updatedTargetIdx = reordered.findIndex((i) => i.id === targetId);
  if (updatedTargetIdx === -1) return items;

  const insertIdx = direction === 'above' ? updatedTargetIdx : updatedTargetIdx + 1;
  reordered.splice(insertIdx, 0, movedItem);

  const newIdx = reordered.findIndex((i) => i.id === movedId);
  if (newIdx === oldIdx) return items;

  const minIdx = Math.min(oldIdx, newIdx);
  const maxIdx = Math.max(oldIdx, newIdx);

  // Preserve the earliest impacted slot's original start time
  const baseStartTime = originalAnchors[minIdx].time;
  if (reordered[minIdx].transportType !== 'Flight') {
    reordered[minIdx] = { ...reordered[minIdx], time: baseStartTime };
  }

  // Cascade forward through the affected range and resolve any downstream overlaps
  for (let i = minIdx + 1; i < reordered.length; i++) {
    const curr = reordered[i];
    if (curr.transportType === 'Flight') continue;

    const prev = reordered[i - 1];
    const prevMins = parseTimeMins(prev.time);
    const attachedTransport = transportAfterOriginal.get(prev.id);
    const travelMins = await getTravelMins(prev, curr, attachedTransport?.transportType);
    const minNextMins = roundUpTo5(prevMins + Math.max(5, travelMins));
    const existingMins = parseTimeMins(curr.time);

    if (i <= maxIdx || existingMins < minNextMins) {
      reordered[i] = { ...curr, time: formatMins24(minNextMins) };
    }
  }

  // Rebuild full list, re-attaching and recalculating Transport items between neighbors
  const result: ItineraryItem[] = [];
  for (let i = 0; i < reordered.length; i++) {
    const curr = reordered[i];
    result.push(curr);

    const next = reordered[i + 1];
    if (next) {
      const candidateTransport = transportAfterOriginal.get(curr.id);
      if (candidateTransport) {
        if (candidateTransport.transportType === 'Flight') {
          if (curr.transportType === 'Flight' && next.transportType === 'Flight') {
            result.push(candidateTransport);
          }
        } else {
          result.push(recalculateTransportSegment(curr, candidateTransport, next));
        }
      }
    }
  }

  return result;
};
