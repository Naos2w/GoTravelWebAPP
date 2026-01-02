export enum Currency {
  TWD = "TWD",
  USD = "USD",
  JPY = "JPY",
  EUR = "EUR",
  KRW = "KRW",
}

export type Theme = "light" | "dark";
export type Language = "zh" | "en";

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface BaggageInfo {
  carryOn: { count: number; weight: string };
  checked: { count: number; weight: string };
}

export interface Expense {
  id: string;
  trip_id?: string;
  user_id?: string; // 支出建立者 ID
  user_name?: string; // 支出建立者名稱
  amount: number;
  currency: Currency;
  category:
    | "Accommodation"
    | "Transport"
    | "Food"
    | "Tickets"
    | "Shopping"
    | "Other";
  date: string;
  createdAt?: string;
  note: string;
  exchangeRate: number;
}

export interface FlightSegment {
  airline: string;
  airlineID?: string;
  airlineNameZh?: string;
  airlineNameEn?: string;
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
  id: string; // 機票 ID
  user_id: string; // 持有人 ID
  traveler_name: string; // 旅客姓名 (可與 User.name 不同)
  outbound: FlightSegment;
  inbound?: FlightSegment;
  price: number;
  currency: Currency;
  cabinClass: string;
  seat?: string;
  baggage: BaggageInfo;
  budget?: number;
}

export interface ChecklistItem {
  id: string;
  trip_id?: string;
  user_id?: string; // 新增：用於區分是誰的清單項目
  text: string;
  isCompleted: boolean;
  category: "Documents" | "Gear" | "Toiletries" | "Clothing" | "Other";
}

export type TransportType = "Public" | "Car" | "Bicycle" | "Walking" | "Flight";

export interface ItineraryItem {
  id: string;
  trip_id?: string;
  user_id?: string; // 新增：用於綁定行程建立者
  time: string;
  placeName: string;
  placeId?: string;
  note?: string;
  type: "Place" | "Transport" | "Food";
  transportType?: TransportType;
  date: string;
}

export interface DayPlan {
  date: string;
  items: ItineraryItem[];
}

export interface Collaborator {
  user_id: string;
  email: string;
  role: string;
}

export interface Trip {
  id: string;
  user_id?: string; // 旅程建立者 (Owner) UID
  name: string;
  startDate: string;
  endDate: string;
  destination: string;
  flights: FlightInfo[]; // 更改為數組以支援多人機票
  expenses: Expense[];
  checklist: ChecklistItem[];
  itinerary: DayPlan[];
  allowed_emails?: string[]; // New: List of emails allowed to view/edit
  collaborators?: Collaborator[]; // New: Mapping of user_id to email
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    google?: any;
  }
}
