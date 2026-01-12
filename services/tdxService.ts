import { FlightSegment } from "../types";

const TOKEN_KEY = 'tdx_access_token';
const EXPIRY_KEY = 'tdx_token_expiry';

// Cache for airline names to minimize API calls
const airlineCache = new Map<string, string>();

async function getTdxToken(): Promise<string | null> {
  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) return null;

  const cachedToken = localStorage.getItem(TOKEN_KEY);
  const expiryStr = localStorage.getItem(EXPIRY_KEY);
  const now = Date.now();
  
  if (cachedToken && expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (now < (expiry - 60000)) return cachedToken;
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
    const token = data.access_token;
    const newTokenExpiry = now + (data.expires_in * 1000);

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, newTokenExpiry.toString());

    return token;
  } catch (e) {
    console.error("TDX Auth Error:", e);
    return null;
  }
}

/**
 * Fetch Airline Chinese Name from TDX
 */
async function fetchAirlineName(airlineID: string, token: string): Promise<string> {
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
      // data is an array or a single object depending on endpoint version, usually single object for /{ID}
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.AirlineName?.Zh_tw) {
        airlineCache.set(airlineID, item.AirlineName.Zh_tw);
        return item.AirlineName.Zh_tw;
      }
    }
  } catch (e) {
    console.error(`Error fetching airline ${airlineID}:`, e);
  }
  
  return airlineID; // Fallback to ID
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
    
    // Add exact flight number filtering if provided
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

    // Fetch unique airline names in parallel
    const uniqueAirlines = Array.from(new Set(data.map((item: any) => item.AirlineID)));
    await Promise.all(uniqueAirlines.map(id => fetchAirlineName(id, token)));

    return data.map((item: any) => {
      const depTime = `${date}T${item.DepartureTime}`;
      const arrTime = `${date}T${item.ArrivalTime}`;

      return {
        airline: airlineCache.get(item.AirlineID) || item.AirlineID, 
        airlineID: item.AirlineID,
        airlineNameZh: airlineCache.get(item.AirlineID),
        flightNumber: item.FlightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        departureAirport: item.DepartureAirportID,
        arrivalAirport: item.ArrivalAirportID,
        terminal: item.Terminal || '',
        gate: '', 
        status: (item.CodeShare && item.CodeShare.length > 0) ? 'Codeshare' : 'Scheduled'
      };
    });
  } catch (e) {
    console.error("TDX Data Fetch Error:", e);
    return [];
  }
}