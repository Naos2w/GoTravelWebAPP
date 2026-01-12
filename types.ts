
export enum Currency {
  TWD = 'TWD',
  USD = 'USD',
  JPY = 'JPY',
  EUR = 'EUR',
  KRW = 'KRW'
}

export type Theme = 'light' | 'dark';
export type Language = 'zh' | 'en';

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
  baggage?: BaggageInfo; 
}

export interface FlightInfo {
  outbound: FlightSegment;
  inbound?: FlightSegment;
  price: number;
  currency: Currency;
  cabinClass: string;
  seat?: string;
  baggage: BaggageInfo; 
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  category: 'Documents' | 'Gear' | 'Toiletries' | 'Clothing' | 'Other';
}

export type TransportType = 'Public' | 'Car' | 'Bicycle' | 'Walking' | 'Flight';

export interface ItineraryItem {
  id: string;
  time: string;
  placeName: string;
  placeId?: string; 
  note?: string;
  type: 'Place' | 'Transport' | 'Food';
  transportType?: TransportType;
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

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
