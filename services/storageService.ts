import { Trip, ChecklistItem, FlightInfo, Currency } from '../types';

const STORAGE_KEY = 'go_travel_data_v1';

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: '1', text: '護照 (Passport)', isCompleted: false, category: 'Documents' },
  { id: '2', text: '簽證 (Visa)', isCompleted: false, category: 'Documents' },
  { id: '3', text: '機票電子檔 (E-Ticket)', isCompleted: false, category: 'Documents' },
  { id: '4', text: '住宿確認單 (Hotel Booking)', isCompleted: false, category: 'Documents' },
  { id: '5', text: '旅遊保險 (Insurance)', isCompleted: false, category: 'Documents' },
  { id: '6', text: '萬用轉接頭 (Adapter)', isCompleted: false, category: 'Gear' },
  { id: '7', text: 'SIM 卡 / eSIM', isCompleted: false, category: 'Gear' },
];

export const getTrips = (): Trip[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTrip = (trip: Trip): void => {
  const trips = getTrips();
  const index = trips.findIndex(t => t.id === trip.id);
  if (index >= 0) {
    trips[index] = trip;
  } else {
    // New trip
    if (trip.checklist.length === 0) {
      trip.checklist = [...DEFAULT_CHECKLIST];
    }
    trips.push(trip);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
};

export const deleteTrip = (id: string): void => {
  const trips = getTrips().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
};

export const createNewTrip = (data: { destination: string; startDate: string; endDate: string }): Trip => {
  return {
    id: Date.now().toString(),
    name: data.destination,
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
    coverImage: `https://picsum.photos/800/400?random=${Date.now()}`,
    expenses: [],
    checklist: [...DEFAULT_CHECKLIST],
    itinerary: [],
    // Initialize empty flight structure
    flight: {
      price: 0,
      currency: Currency.TWD,
      cabinClass: 'Economy',
      outbound: {
        airline: '',
        flightNumber: '',
        departureTime: '',
        arrivalTime: '',
        departureAirport: '',
        arrivalAirport: ''
      },
      inbound: {
         airline: '',
         flightNumber: '',
         departureTime: '',
         arrivalTime: '',
         departureAirport: '',
         arrivalAirport: ''
       },
      baggage: {
        carryOn: { count: 1, weight: '7kg' },
        checked: { count: 1, weight: '23kg' }
      }
    }
  };
};
