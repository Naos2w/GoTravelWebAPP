
import { FlightSegment } from "../types";

// 改為記憶體緩存，移除 localStorage 依賴
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

const airlineCache = new Map<string, {zh: string, en: string}>();

async function getTdxToken(): Promise<string | null> {
  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;
  
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

export async function fetchTdxFlights(
  origin: string,
  destination: string,
  date: string,
  flightNumber?: string
): Promise<FlightSegment[]> {
  const token = await getTdxToken();
  if (!token) return [];

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
    if (!Array.isArray(data)) return [];

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
    console.error("TDX Data Fetch Error:", e);
    return [];
  }
}
