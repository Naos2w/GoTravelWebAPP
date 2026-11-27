import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyWmoCode, fetchDayWeather, clearWeatherCache } from '../../src/features/itinerary/services/weatherService';

describe('weatherService', () => {
  beforeEach(() => {
    clearWeatherCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies WMO weather codes accurately', () => {
    expect(classifyWmoCode(0)).toBe('clear');
    expect(classifyWmoCode(1)).toBe('clear');
    expect(classifyWmoCode(2)).toBe('cloudy');
    expect(classifyWmoCode(45)).toBe('cloudy');
    expect(classifyWmoCode(61)).toBe('rain');
    expect(classifyWmoCode(80)).toBe('rain');
    expect(classifyWmoCode(73)).toBe('snow');
    expect(classifyWmoCode(86)).toBe('snow');
    expect(classifyWmoCode(95)).toBe('thunderstorm');
  });

  it('fetches, parses, and caches Open-Meteo daily forecast', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          weathercode: [61],
          temperature_2m_max: [24.6],
          temperature_2m_min: [17.2],
          precipitation_probability_max: [75],
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const first = await fetchDayWeather(35.6586, 139.7454, '2026-10-01');
    expect(first).toEqual({
      date: '2026-10-01',
      weatherCode: 61,
      condition: 'rain',
      tempMax: 25,
      tempMin: 17,
      precipProb: 75,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Subsequent lookup within same quantized area hits cache
    const second = await fetchDayWeather(35.6589, 139.7451, '2026-10-01');
    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null gracefully for out-of-range dates (HTTP 400) or network failures', async () => {
    const outOfRangeFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', outOfRangeFetch);

    const res400 = await fetchDayWeather(35.65, 139.74, '2028-01-01');
    expect(res400).toBeNull();
    // Cached null on 400 prevents repeat fetches
    await fetchDayWeather(35.65, 139.74, '2028-01-01');
    expect(outOfRangeFetch).toHaveBeenCalledTimes(1);

    clearWeatherCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    const resOffline = await fetchDayWeather(35.65, 139.74, '2026-10-01');
    expect(resOffline).toBeNull();
  });
});
