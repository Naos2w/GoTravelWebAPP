
export enum Currency {
  TWD = 'TWD',
  USD = 'USD',
  JPY = 'JPY',
  EUR = 'EUR',
  KRW = 'KRW'
}

export interface BaggageInfo {
  carryOn: { count: number; weight: string };
  checked: { count: number; weight: string };
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  category: 'Accommodation' | 'Transport' | 'Food' | 'Tickets' | 'Shopping' | 'Other';
  date: string;
  note: string;
  exchangeRate: number; // Rate to TWD at time of entry
}

export interface FlightSegment {
  airline: string;
  airlineID?: string;
  airlineNameZh?: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  terminal?: string;
  gate?: string;
  status?: string;
  baggage?: BaggageInfo; // Added baggage info per segment
}

export interface FlightInfo {
  outbound: FlightSegment;
  inbound?: FlightSegment;
  price: number;
  currency: Currency;
  cabinClass: string;
  seat?: string;
  // Global baggage is now deprecated in favor of segment-specific baggage
  baggage: BaggageInfo; 
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  category: 'Documents' | 'Gear' | 'Toiletries' | 'Clothing' | 'Other';
}

export interface ItineraryItem {
  id: string;
  time: string;
  placeName: string;
  placeId?: string; // For Google Maps
  note?: string;
  type: 'Place' | 'Transport' | 'Food';
}

export interface DayPlan {
  date: string;
  items: ItineraryItem[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  destination: string;
  coverImage: string;
  flight?: FlightInfo;
  expenses: Expense[];
  checklist: ChecklistItem[];
  itinerary: DayPlan[];
}

export interface WeatherData {
  date: string;
  tempMax: number;
  tempMin: number;
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Snowy';
  rainChance: number;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
