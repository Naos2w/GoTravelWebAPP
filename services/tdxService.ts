
import { FlightSegment } from "../types";

// 改為記憶體緩存，移除 localStorage 依賴
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

const airlineCache = new Map<string, {zh: string, en: string}>();

async function getTdxToken(): Promise<string | null> {
  const clientId = import.meta.env.VITE_TDX_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_TDX_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  
  // 檢查記憶體中的 Token 是否有效
  if (cachedToken && tokenExpiry && now < (tokenExpiry - 60000)) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await fetch('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) throw new Error("TDX Authentication failed.");

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in * 1000);

    return cachedToken;
  } catch (e) {
    console.error("TDX Auth Error:", e);
    return null;
  }
}

async function fetchAirlineName(airlineID: string, token: string): Promise<{zh: string, en: string}> {
  if (airlineCache.has(airlineID)) {
    return airlineCache.get(airlineID)!;
  }

  try {
    const url = `https://tdx.transportdata.tw/api/basic/v2/Air/Airline/${airlineID}?$format=JSON`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      const item = Array.isArray(data) ? data[0] : data;
      const names = {
        zh: item?.AirlineName?.Zh_tw || airlineID,
        en: item?.AirlineName?.En || airlineID
      };
      airlineCache.set(airlineID, names);
      return names;
    }
  } catch (e) {
    console.error(`Error fetching airline ${airlineID}:`, e);
  }
  
  return { zh: airlineID, en: airlineID };
}

export async function fetchAviationstackFlights(
  origin: string,
  destination: string,
  date: string,
  flightNumber?: string
): Promise<FlightSegment[]> {
  const accessKey = import.meta.env.VITE_AVIATIONSTACK_ACCESS_KEY || "092fc341d83894107f3ee1a229c65fa2";
  if (!accessKey) {
    console.warn("Aviationstack Access Key not configured.");
    return [];
  }

  try {
    let url = `http://api.aviationstack.com/v1/flights?access_key=${accessKey}`;
    
    if (flightNumber && flightNumber.trim()) {
      url += `&flight_iata=${encodeURIComponent(flightNumber.trim().toUpperCase())}`;
    } else if (origin && destination) {
      url += `&dep_iata=${encodeURIComponent(origin.trim().toUpperCase())}&arr_iata=${encodeURIComponent(destination.trim().toUpperCase())}`;
    } else {
      return [];
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Aviationstack API Request failed: ${response.status}`);

    const data = await response.json();
    if (!data || !Array.isArray(data.data)) return [];

    const mapped = data.data.map((item: any) => {
      const depScheduled = item.departure?.scheduled || '';
      const arrScheduled = item.arrival?.scheduled || '';
      
      const depTimePart = depScheduled.includes('T') ? depScheduled.split('T')[1] : '00:00:00';
      const arrTimePart = arrScheduled.includes('T') ? arrScheduled.split('T')[1] : '00:00:00';
      
      const depTime = `${date}T${depTimePart.substring(0, 5)}`;
      const arrTime = `${date}T${arrTimePart.substring(0, 5)}`;

      const airlineName = item.airline?.name || item.airline?.iata || item.airline?.icao || '';
      const flightNo = item.flight?.iata || (item.airline?.iata && item.flight?.number ? `${item.airline.iata}${item.flight.number}` : item.flight?.number || '');

      return {
        airline: airlineName,
        airlineID: item.airline?.iata || '',
        airlineNameZh: airlineName,
        airlineNameEn: airlineName,
        flightNumber: flightNo,
        departureTime: depTime,
        arrivalTime: arrTime,
        departureAirport: item.departure?.iata || origin,
        arrivalAirport: item.arrival?.iata || destination,
        terminal: item.departure?.terminal || '',
        gate: item.departure?.gate || '',
        status: item.flight_status || 'scheduled',
        baggage: {
          carryOn: { count: 1, weight: '' },
          checked: { count: 0, weight: '' }
        }
      };
    }).filter((f: FlightSegment) => {
      let matches = true;
      if (origin) matches = matches && f.departureAirport.toUpperCase() === origin.toUpperCase();
      if (destination) matches = matches && f.arrivalAirport.toUpperCase() === destination.toUpperCase();
      if (flightNumber) {
        const cleanF = f.flightNumber.toUpperCase().replace(/\s+/g, '');
        const cleanSearch = flightNumber.toUpperCase().replace(/\s+/g, '');
        matches = matches && cleanF === cleanSearch;
      }
      return matches;
    });

    const uniqueSegments: FlightSegment[] = [];
    const seenSignatures = new Set<string>();
    for (const f of mapped) {
      const signature = `${f.flightNumber}-${f.departureAirport}-${f.arrivalAirport}-${f.departureTime}-${f.arrivalTime}`;
      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        uniqueSegments.push(f);
      }
    }
    return uniqueSegments;
  } catch (e) {
    console.error("Aviationstack Data Fetch Error:", e);
    return [];
  }
}

export async function fetchTdxFlights(
  origin: string,
  destination: string,
  date: string,
  flightNumber?: string
): Promise<FlightSegment[]> {
  const token = await getTdxToken();
  if (!token) {
    return fetchAviationstackFlights(origin, destination, date, flightNumber);
  }

  try {
    let filter = `DepartureAirportID eq '${origin}' and ArrivalAirportID eq '${destination}' and ScheduleStartDate le ${date} and ScheduleEndDate ge ${date}`;
    
    if (flightNumber && flightNumber.trim()) {
      filter += ` and FlightNumber eq '${flightNumber.trim().toUpperCase()}'`;
    }

    const select = `AirlineID,FlightNumber,DepartureAirportID,ArrivalAirportID,DepartureTime,ArrivalTime,Terminal,CodeShare`;
    const url = `https://tdx.transportdata.tw/api/basic/v2/Air/GeneralSchedule/International?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$format=JSON`;

    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`TDX API Request failed: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return fetchAviationstackFlights(origin, destination, date, flightNumber);
    }

    const uniqueAirlines = Array.from(new Set(data.map((item: any) => item.AirlineID)));
    await Promise.all(uniqueAirlines.map(id => fetchAirlineName(id, token)));

    return data.map((item: any) => {
      const depTime = `${date}T${item.DepartureTime}`;
      const arrTime = `${date}T${item.ArrivalTime}`;
      const names = airlineCache.get(item.AirlineID) || { zh: item.AirlineID, en: item.AirlineID };

      return {
        airline: names.zh, 
        airlineID: item.AirlineID,
        airlineNameZh: names.zh,
        airlineNameEn: names.en,
        flightNumber: item.FlightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        departureAirport: item.DepartureAirportID,
        arrivalAirport: item.ArrivalAirportID,
        terminal: item.Terminal || '',
        gate: '', 
        status: (item.CodeShare && item.CodeShare.length > 0) ? 'Codeshare' : 'Scheduled',
        baggage: {
          carryOn: { count: 1, weight: '' },
          checked: { count: 0, weight: '' }
        }
      };
    });
  } catch (e) {
    console.error("TDX Data Fetch Error, falling back to Aviationstack:", e);
    return fetchAviationstackFlights(origin, destination, date, flightNumber);
  }
}
