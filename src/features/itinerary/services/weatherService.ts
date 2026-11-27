export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunderstorm';

export interface DailyWeatherForecast {
  date: string;
  weatherCode: number;
  condition: WeatherCondition;
  tempMax: number;
  tempMin: number;
  precipProb: number;
}

const weatherCache = new Map<string, DailyWeatherForecast | null>();

/**
 * Classifies WMO Weather interpretation codes from Open-Meteo into UI buckets.
 */
export const classifyWmoCode = (code: number): WeatherCondition => {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'rain';
};

export const clearWeatherCache = (): void => {
  weatherCache.clear();
};

/**
 * Fetches daily weather forecast from Open-Meteo (free, 0 token, no API key required).
 * Returns null gracefully when coordinates are invalid, the date is outside the forecast window, or the user is offline.
 */
export const fetchDayWeather = async (
  lat: number,
  lng: number,
  date: string
): Promise<DailyWeatherForecast | null> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${date}`;
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey) ?? null;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat.toString())}` +
      `&longitude=${encodeURIComponent(lng.toString())}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${date}&end_date=${date}`;

    const res = await fetch(url);
    if (!res.ok) {
      // Cache null for out-of-range forecast window responses (400) to avoid repeated failed lookups
      if (res.status === 400) {
        weatherCache.set(cacheKey, null);
      }
      return null;
    }

    const data = await res.json();
    const daily = data?.daily;
    if (!daily) {
      return null;
    }

    const weatherCode = Number(daily.weathercode?.[0]);
    const rawMax = Number(daily.temperature_2m_max?.[0]);
    const rawMin = Number(daily.temperature_2m_min?.[0]);

    if (!Number.isFinite(weatherCode) || !Number.isFinite(rawMax) || !Number.isFinite(rawMin)) {
      return null;
    }

    const rawPrecip = Number(daily.precipitation_probability_max?.[0]);
    const forecast: DailyWeatherForecast = {
      date,
      weatherCode,
      condition: classifyWmoCode(weatherCode),
      tempMax: Math.round(rawMax),
      tempMin: Math.round(rawMin),
      precipProb: Number.isFinite(rawPrecip) ? Math.max(0, Math.min(100, Math.round(rawPrecip))) : 0,
    };

    weatherCache.set(cacheKey, forecast);
    return forecast;
  } catch {
    return null;
  }
};
