import { describe, it, expect, vi } from 'vitest';
import { reorderAnchorsWithSmartTime } from '../../src/features/itinerary/services/itineraryReorderService';
import { ItineraryItem } from '../../src/types';

const makeStop = (id: string, placeName: string, time: string): ItineraryItem => ({
  id,
  time,
  placeName,
  type: 'Place',
  date: '2026-10-01',
  lat: 35.68,
  lng: 139.76,
});

const makeTransport = (id: string, time: string, note = '30m'): ItineraryItem => ({
  id,
  time,
  placeName: 'Moving',
  type: 'Transport',
  transportType: 'Public',
  note,
  date: '2026-10-01',
});

describe('itineraryReorderService', () => {
  it('moves a later stop upward and cascades travel-adjusted times while keeping slot start time', async () => {
    const items: ItineraryItem[] = [
      makeStop('a', 'Senso-ji', '09:00'),
      makeTransport('t1', '09:30', '1h0m'),
      makeStop('b', 'Tokyo Skytree', '10:00'),
      makeStop('c', 'Ueno Park', '12:00'),
    ];

    const getTravel = vi.fn().mockResolvedValue(20);
    const updated = await reorderAnchorsWithSmartTime(items, 'c', 'a', 'above', getTravel);

    const anchors = updated.filter((i) => i.type !== 'Transport');
    expect(anchors.map((a) => a.id)).toEqual(['c', 'a', 'b']);
    // Slot 0 keeps original 09:00 start time; subsequent stops shift by +20m each
    expect(anchors[0].time).toBe('09:00');
    expect(anchors[1].time).toBe('09:20');
    expect(anchors[2].time).toBe('09:40');

    // Transport item t1 after 'a' is preserved and recalculated between 'a' (09:20) and 'b' (09:40)
    const t1 = updated.find((i) => i.id === 't1')!;
    expect(t1).toBeDefined();
    expect(t1.time).toBe('09:30');
    expect(t1.note).toBe('20m');
  });

  it('moves the first stop downward below second stop, shifts second stop up to 09:00, and keeps non-overlapping later stops', async () => {
    const items: ItineraryItem[] = [
      makeStop('a', 'Spot A', '09:00'),
      makeStop('b', 'Spot B', '10:30'),
      makeStop('c', 'Spot C', '13:00'),
    ];

    const getTravel = vi.fn().mockResolvedValue(25);
    const updated = await reorderAnchorsWithSmartTime(items, 'a', 'b', 'below', getTravel);

    const anchors = updated.filter((i) => i.type !== 'Transport');
    expect(anchors.map((a) => a.id)).toEqual(['b', 'a', 'c']);
    expect(anchors[0].time).toBe('09:00');
    expect(anchors[1].time).toBe('09:25');
    // Spot C at 13:00 does not collide with 09:25 + 25m, so it stays 13:00
    expect(anchors[2].time).toBe('13:00');
  });

  it('pushes downstream stops when shifted time overlaps with later schedule', async () => {
    const items: ItineraryItem[] = [
      makeStop('a', 'Spot A', '09:00'),
      makeStop('b', 'Spot B', '09:30'),
      makeStop('c', 'Spot C', '09:40'),
    ];

    const getTravel = vi.fn().mockResolvedValue(30);
    const updated = await reorderAnchorsWithSmartTime(items, 'a', 'b', 'below', getTravel);

    const anchors = updated.filter((i) => i.type !== 'Transport');
    expect(anchors.map((a) => a.id)).toEqual(['b', 'a', 'c']);
    expect(anchors[0].time).toBe('09:00');
    expect(anchors[1].time).toBe('09:30');
    // Spot C (originally 09:40) collides with 09:30 + 30m so cascades to 10:00
    expect(anchors[2].time).toBe('10:00');
  });
});
