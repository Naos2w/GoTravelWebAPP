export interface AirportCoords {
  lat: number;
  lng: number;
}

/**
 * WGS-84 coordinates for major international and regional airports keyed by 3-letter IATA code.
 */
export const AIRPORT_COORDS: Record<string, AirportCoords> = {
  // Taiwan
  TPE: { lat: 25.0797, lng: 121.2342 }, // Taiwan Taoyuan International
  TSA: { lat: 25.0694, lng: 121.5525 }, // Taipei Songshan
  KHH: { lat: 22.5771, lng: 120.3500 }, // Kaohsiung International
  RMQ: { lat: 24.2647, lng: 120.6206 }, // Taichung International
  TNN: { lat: 22.9504, lng: 120.2058 }, // Tainan
  HUN: { lat: 24.0231, lng: 121.6178 }, // Hualien
  TTT: { lat: 22.7550, lng: 121.1017 }, // Taitung
  MZG: { lat: 23.5687, lng: 119.6283 }, // Penghu (Magong)
  KNH: { lat: 24.4279, lng: 118.3592 }, // Kinmen

  // Japan
  NRT: { lat: 35.7720, lng: 140.3929 }, // Narita International
  HND: { lat: 35.5494, lng: 139.7798 }, // Tokyo Haneda
  KIX: { lat: 34.4347, lng: 135.2441 }, // Kansai International
  ITM: { lat: 34.7855, lng: 135.4382 }, // Osaka Itami
  FUK: { lat: 33.5859, lng: 130.4507 }, // Fukuoka
  CTS: { lat: 42.7752, lng: 141.6923 }, // New Chitose (Sapporo)
  OKA: { lat: 26.1958, lng: 127.6459 }, // Naha (Okinawa)
  NGO: { lat: 34.8584, lng: 136.8054 }, // Chubu Centrair (Nagoya)
  KOJ: { lat: 31.8034, lng: 130.7194 }, // Kagoshima
  KMJ: { lat: 32.8373, lng: 130.8551 }, // Kumamoto
  SDJ: { lat: 38.1397, lng: 140.9169 }, // Sendai
  HIJ: { lat: 34.4361, lng: 132.9194 }, // Hiroshima
  TAK: { lat: 34.2142, lng: 134.0156 }, // Takamatsu
  OKJ: { lat: 34.7570, lng: 133.8553 }, // Okayama
  FSZ: { lat: 34.7961, lng: 138.1894 }, // Mt. Fuji Shizuoka
  KMQ: { lat: 36.3946, lng: 136.4065 }, // Komatsu

  // Korea
  ICN: { lat: 37.4602, lng: 126.4407 }, // Incheon International
  GMP: { lat: 37.5583, lng: 126.7906 }, // Gimpo International
  PUS: { lat: 35.1796, lng: 128.9382 }, // Gimhae International (Busan)
  CJU: { lat: 33.5113, lng: 126.4930 }, // Jeju International
  TAE: { lat: 35.8941, lng: 128.6589 }, // Daegu International

  // Hong Kong, Macau & China
  HKG: { lat: 22.3080, lng: 113.9185 }, // Hong Kong International
  MFM: { lat: 22.1496, lng: 113.5916 }, // Macau International
  PVG: { lat: 31.1443, lng: 121.8083 }, // Shanghai Pudong
  SHA: { lat: 31.1979, lng: 121.3363 }, // Shanghai Hongqiao
  PEK: { lat: 40.0799, lng: 116.6031 }, // Beijing Capital
  PKX: { lat: 39.5098, lng: 116.4105 }, // Beijing Daxing
  CAN: { lat: 23.3924, lng: 113.2988 }, // Guangzhou Baiyun
  SZX: { lat: 22.6393, lng: 113.8107 }, // Shenzhen Bao'an
  CTU: { lat: 30.5785, lng: 103.9471 }, // Chengdu Shuangliu

  // Southeast Asia
  SIN: { lat: 1.3644, lng: 103.9915 },  // Singapore Changi
  BKK: { lat: 13.6900, lng: 100.7501 }, // Bangkok Suvarnabhumi
  DMK: { lat: 13.9126, lng: 100.6067 }, // Bangkok Don Mueang
  CNX: { lat: 18.7668, lng: 98.9626 },  // Chiang Mai
  HKT: { lat: 8.1132, lng: 98.3169 },   // Phuket
  KUL: { lat: 2.7456, lng: 101.7072 },  // Kuala Lumpur International
  PEN: { lat: 5.2971, lng: 100.2769 },  // Penang
  BKI: { lat: 5.9372, lng: 116.0512 },  // Kota Kinabalu
  SGN: { lat: 10.8188, lng: 106.6519 }, // Ho Chi Minh City Tan Son Nhat
  HAN: { lat: 21.2212, lng: 105.8072 }, // Hanoi Noi Bai
  DAD: { lat: 16.0439, lng: 108.1994 }, // Da Nang
  MNL: { lat: 14.5086, lng: 121.0198 }, // Manila Ninoy Aquino
  CEB: { lat: 10.3075, lng: 123.9794 }, // Mactan-Cebu
  CGK: { lat: -6.1256, lng: 106.6559 }, // Jakarta Soekarno-Hatta
  DPS: { lat: -8.7482, lng: 115.1672 }, // Bali Ngurah Rai

  // Europe
  ZRH: { lat: 47.4647, lng: 8.5492 },   // Zurich
  GVA: { lat: 46.2381, lng: 6.1090 },   // Geneva
  LHR: { lat: 51.4700, lng: -0.4543 },  // London Heathrow
  LGW: { lat: 51.1537, lng: -0.1821 },  // London Gatwick
  CDG: { lat: 49.0097, lng: 2.5479 },   // Paris Charles de Gaulle
  FRA: { lat: 50.0379, lng: 8.5622 },   // Frankfurt
  MUC: { lat: 48.3537, lng: 11.7750 },  // Munich
  AMS: { lat: 52.3105, lng: 4.7683 },   // Amsterdam Schiphol
  FCO: { lat: 41.8003, lng: 12.2389 },  // Rome Fiumicino
  MXP: { lat: 45.6301, lng: 8.7255 },   // Milan Malpensa
  BCN: { lat: 41.2974, lng: 2.0833 },   // Barcelona-El Prat
  MAD: { lat: 40.4983, lng: -3.5676 },  // Madrid-Barajas
  VIE: { lat: 48.1103, lng: 16.5697 },  // Vienna International
  PRG: { lat: 50.1008, lng: 14.2600 },  // Prague Vaclav Havel
  IST: { lat: 41.2753, lng: 28.7519 },  // Istanbul

  // North America
  YVR: { lat: 49.1967, lng: -123.1815 }, // Vancouver International
  YZF: { lat: 62.4628, lng: -114.4403 }, // Yellowknife
  YYZ: { lat: 43.6777, lng: -79.6248 },  // Toronto Pearson
  YYC: { lat: 51.1215, lng: -114.0076 }, // Calgary International
  YUL: { lat: 45.4706, lng: -73.7408 },  // Montreal-Trudeau
  LAX: { lat: 33.9416, lng: -118.4085 }, // Los Angeles International
  SFO: { lat: 37.6213, lng: -122.3790 }, // San Francisco International
  SEA: { lat: 47.4502, lng: -122.3088 }, // Seattle-Tacoma
  JFK: { lat: 40.6413, lng: -73.7781 },  // New York JFK
  EWR: { lat: 40.6895, lng: -74.1745 },  // Newark Liberty
  ORD: { lat: 41.9742, lng: -87.9073 },  // Chicago O'Hare
  DFW: { lat: 32.8998, lng: -97.0403 },  // Dallas/Fort Worth
  IAH: { lat: 29.9902, lng: -95.3368 },  // Houston George Bush
  HNL: { lat: 21.3187, lng: -157.9225 }, // Honolulu Daniel K. Inouye

  // Oceania & Middle East
  SYD: { lat: -33.9399, lng: 151.1753 }, // Sydney Kingsford Smith
  MEL: { lat: -37.6690, lng: 144.8410 }, // Melbourne
  BNE: { lat: -27.3942, lng: 153.1218 }, // Brisbane
  AKL: { lat: -37.0082, lng: 174.7850 }, // Auckland
  DXB: { lat: 25.2532, lng: 55.3657 },  // Dubai International
  DOH: { lat: 25.2731, lng: 51.6081 },  // Doha Hamad International
};

/**
 * Look up airport coordinates by 3-letter IATA code (case-insensitive).
 */
export function getAirportCoords(iataCode?: string): AirportCoords | undefined {
  if (!iataCode) return undefined;
  const normalized = iataCode.trim().toUpperCase();
  if (!normalized) return undefined;
  const coords = AIRPORT_COORDS[normalized];
  return coords ? { lat: coords.lat, lng: coords.lng } : undefined;
}

/**
 * Resolve airport coordinates from an itinerary place name such as "TPE Airport",
 * "FUK Airport", or "TPE" without falsely matching unrelated place names.
 */
export function resolveAirportCoordsFromPlaceName(placeName?: string): AirportCoords | undefined {
  if (!placeName) return undefined;
  const trimmed = placeName.trim();
  if (!trimmed) return undefined;

  const directMatch = trimmed.match(/^([A-Za-z]{3})(?:\s+(?:international\s+)?airport|\s*機場)?$/i);
  if (directMatch) {
    return getAirportCoords(directMatch[1]);
  }

  if (/(?:airport|機場)/i.test(trimmed)) {
    const parenMatch = trimmed.match(/\(([A-Za-z]{3})\)/);
    if (parenMatch) {
      return getAirportCoords(parenMatch[1]);
    }
  }

  return undefined;
}

/**
 * Enrich an airport Place itinerary item that is missing coordinates with fallback
 * airport coordinates so previously-created trips display airport pins immediately.
 */
export function enrichAirportCoords<
  T extends {
    type?: string;
    transportType?: string;
    placeName?: string;
    lat?: number;
    lng?: number;
  }
>(item: T): T & Partial<AirportCoords> {
  if (item.type !== 'Place') return item;

  const hasValidCoords =
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(Number(item.lat)) &&
    Number.isFinite(Number(item.lng));
  if (hasValidCoords) return item;

  const isFlightOrAirport =
    item.transportType === 'Flight' ||
    /\bairport$/i.test((item.placeName || '').trim());
  if (!isFlightOrAirport) return item;

  const fallback = resolveAirportCoordsFromPlaceName(item.placeName);
  if (!fallback) return item;

  return { ...item, lat: fallback.lat, lng: fallback.lng };
}
