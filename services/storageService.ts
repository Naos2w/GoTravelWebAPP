
import { createClient } from '@supabase/supabase-js';
import { Trip, ChecklistItem, Currency, Expense, ItineraryItem, DayPlan, FlightInfo } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const isValidUUID = (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const transformTripRow = (row: any): Trip => {
  const start = new Date(row.start_date + 'T00:00:00');
  const end = new Date(row.end_date + 'T00:00:00');
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const itinerary: DayPlan[] = [];
  const itineraryMap: Record<string, ItineraryItem[]> = {};
  
  for (let i = 0; i < diffDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + i);
    const dateKey = formatDateStr(currentDate);
    itineraryMap[dateKey] = [];
  }

  (row.itinerary_items || []).forEach((it: any) => {
    if (itineraryMap[it.date]) {
      itineraryMap[it.date].push({
        id: it.id,
        trip_id: it.trip_id,
        user_id: it.user_id, // Map user_id
        time: it.time,
        placeName: it.place_name,
        note: it.note,
        type: it.type,
        transportType: it.transport_type,
        date: it.date
      });
    }
  });

  Object.entries(itineraryMap).forEach(([date, items]) => {
    itinerary.push({
      date,
      items: items.sort((a, b) => a.time.localeCompare(b.time))
    });
  });

  itinerary.sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    allowed_emails: row.allowed_emails || [],
    flights: (row.flights || []).map((f: any) => ({
      id: f.id,
      user_id: f.user_id,
      traveler_name: f.traveler_name,
      outbound: f.outbound,
      inbound: f.inbound,
      price: f.price,
      currency: f.currency,
      cabinClass: f.cabin_class,
      baggage: f.baggage,
      budget: f.budget
    })),
    checklist: (row.checklist_items || []).map((ci: any) => ({
      id: ci.id,
      user_id: ci.user_id, // Map user_id
      text: ci.text,
      isCompleted: ci.is_completed,
      category: ci.category
    })),
    expenses: (row.expenses || []).map((ex: any) => ({
      id: ex.id,
      user_id: ex.user_id,
      user_name: ex.user_name,
      amount: parseFloat(ex.amount),
      currency: ex.currency,
      category: ex.category,
      date: ex.date,
      note: ex.note,
      exchangeRate: parseFloat(ex.exchange_rate),
      createdAt: ex.created_at
    })),
    itinerary
  };
};

export const joinTrip = async (tripId: string, userId: string): Promise<void> => {
  try {
    // 1. Join Collaborators
    const { error } = await supabase.from('trip_collaborators').upsert({
      trip_id: tripId,
      user_id: userId,
      role: 'editor' 
    }, { onConflict: 'trip_id,user_id' });

    if (error) throw error;

    // 2. Check if user already has checklist items
    const { count } = await supabase.from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('user_id', userId);

    // 3. Insert default checklist if none exists
    if (count === 0) {
       const defaultItems = [
         { text: 'Passport & Visa', category: 'Documents' },
         { text: 'Phone Charger', category: 'Gear' },
         { text: 'Clothes', category: 'Clothing' },
         { text: 'Toothbrush', category: 'Toiletries' }
       ];
       
       const payload = defaultItems.map(item => ({
          trip_id: tripId,
          user_id: userId,
          text: item.text,
          category: item.category,
          is_completed: false
       }));
       
       await supabase.from('checklist_items').insert(payload);
    }
  } catch (e) {
    console.error("Failed to join trip:", e);
  }
};

export const leaveTrip = async (tripId: string, userId: string): Promise<void> => {
  try {
    // 1. Remove from collaborators
    await supabase.from('trip_collaborators').delete().eq('trip_id', tripId).eq('user_id', userId);
    
    // 2. Clean up ALL user-specific data from this trip
    await Promise.all([
      supabase.from('checklist_items').delete().eq('trip_id', tripId).eq('user_id', userId),
      supabase.from('expenses').delete().eq('trip_id', tripId).eq('user_id', userId),
      supabase.from('flights').delete().eq('trip_id', tripId).eq('user_id', userId),
      supabase.from('itinerary_items').delete().eq('trip_id', tripId).eq('user_id', userId)
    ]);
    
  } catch (e) {
    console.error("Failed to leave trip:", e);
  }
};

export const getTrips = async (userId: string): Promise<Trip[]> => {
  if (!userId || SUPABASE_URL.includes('placeholder')) return [];
  try {
    // 1. Get trips owned by user
    const { data: ownedTrips, error: ownerError } = await supabase
      .from('trips')
      .select(`*, checklist_items (*), itinerary_items (*), expenses (*), flights (*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ownerError) throw ownerError;

    // 2. Get trips where user is a collaborator
    const { data: collabData, error: collabError } = await supabase
      .from('trip_collaborators')
      .select(`trip_id`)
      .eq('user_id', userId);

    if (collabError) throw collabError;

    let sharedTrips: Trip[] = [];
    if (collabData && collabData.length > 0) {
       const tripIds = collabData.map((c: any) => c.trip_id);
       const { data: sharedTripsData, error: sharedError } = await supabase
         .from('trips')
         .select(`*, checklist_items (*), itinerary_items (*), expenses (*), flights (*)`)
         .in('id', tripIds)
         .order('created_at', { ascending: false });
       
       if (sharedError) throw sharedError;
       sharedTrips = (sharedTripsData || []).map(transformTripRow);
    }

    const owned = (ownedTrips || []).map(transformTripRow);
    
    // Merge and deduplicate just in case
    const allTripsMap = new Map<string, Trip>();
    owned.forEach(t => allTripsMap.set(t.id, t));
    sharedTrips.forEach(t => allTripsMap.set(t.id, t));

    return Array.from(allTripsMap.values());
  } catch (err) {
    console.error('Failed to get trips:', err);
    throw err;
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  if (!tripId || !isValidUUID(tripId)) return null;
  try {
    const { data, error } = await supabase
      .from('trips')
      .select(`*, checklist_items (*), itinerary_items (*), expenses (*), flights (*)`)
      .eq('id', tripId)
      .maybeSingle();

    if (error || !data) return null;
    return transformTripRow(data);
  } catch (err) {
    return null;
  }
};

export const saveExpenseOnly = async (tripId: string, expense: Expense): Promise<void> => {
  const payload = {
    id: isValidUUID(expense.id) ? expense.id : crypto.randomUUID(),
    trip_id: tripId,
    user_id: expense.user_id,
    user_name: expense.user_name,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    note: expense.note,
    exchange_rate: expense.exchangeRate
  };
  
  const { error } = await supabase.from('expenses').upsert(payload);
  if (error) throw error;
};

export const saveFlightOnly = async (tripId: string, flight: FlightInfo): Promise<void> => {
  const payload = {
    id: isValidUUID(flight.id) ? flight.id : crypto.randomUUID(),
    trip_id: tripId,
    user_id: flight.user_id,
    traveler_name: flight.traveler_name,
    outbound: flight.outbound,
    inbound: flight.inbound,
    price: flight.price,
    currency: flight.currency,
    cabin_class: flight.cabinClass,
    baggage: flight.baggage,
    budget: flight.budget
  };
  
  const { error } = await supabase.from('flights').upsert(payload);
  if (error) throw error;
};

export const saveTrip = async (trip: Trip, userId: string): Promise<void> => {
  if (!userId || SUPABASE_URL.includes('placeholder')) throw new Error("Database configuration missing.");

  const { error: tripError } = await supabase
    .from('trips')
    .upsert({
      id: trip.id,
      user_id: trip.user_id || userId,
      name: trip.name,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      allowed_emails: trip.allowed_emails || []
    });

  if (tripError) throw tripError;

  // Handle Checklist
  await supabase.from('checklist_items').delete().eq('trip_id', trip.id);
  if (trip.checklist && trip.checklist.length > 0) {
    const checklistPayload = trip.checklist.map(ci => ({
      id: isValidUUID(ci.id) ? ci.id : crypto.randomUUID(),
      trip_id: trip.id,
      user_id: ci.user_id || userId, // Ensure user_id is saved
      text: ci.text,
      is_completed: ci.isCompleted,
      category: ci.category
    }));
    await supabase.from('checklist_items').insert(checklistPayload);
  }

  // Handle Expenses
  await supabase.from('expenses').delete().eq('trip_id', trip.id);
  if (trip.expenses && trip.expenses.length > 0) {
    const expensesPayload = trip.expenses.map(ex => ({
      id: isValidUUID(ex.id) ? ex.id : crypto.randomUUID(),
      trip_id: trip.id,
      user_id: ex.user_id,
      user_name: ex.user_name,
      amount: ex.amount,
      currency: ex.currency,
      category: ex.category,
      date: ex.date,
      note: ex.note,
      exchange_rate: ex.exchangeRate
    }));
    await supabase.from('expenses').insert(expensesPayload);
  }

  // Handle Flights
  await supabase.from('flights').delete().eq('trip_id', trip.id);
  if (trip.flights && trip.flights.length > 0) {
    const flightsPayload = trip.flights.map(f => ({
      id: isValidUUID(f.id) ? f.id : crypto.randomUUID(),
      trip_id: trip.id,
      user_id: f.user_id,
      traveler_name: f.traveler_name,
      outbound: f.outbound,
      inbound: f.inbound,
      price: f.price,
      currency: f.currency,
      cabin_class: f.cabinClass,
      baggage: f.baggage,
      budget: f.budget
    }));
    await supabase.from('flights').insert(flightsPayload);
  }

  // Handle Itinerary
  await supabase.from('itinerary_items').delete().eq('trip_id', trip.id);
  const itineraryPayload: any[] = [];
  if (trip.itinerary) {
    trip.itinerary.forEach(day => {
      day.items.forEach(item => {
        itineraryPayload.push({
          id: isValidUUID(item.id) ? item.id : crypto.randomUUID(),
          trip_id: trip.id,
          user_id: item.user_id || userId, // Keep ownership
          date: day.date,
          time: item.time,
          place_name: item.placeName,
          note: item.note,
          type: item.type,
          transport_type: item.transportType
        });
      });
    });
  }
  if (itineraryPayload.length > 0) {
    await supabase.from('itinerary_items').insert(itineraryPayload);
  }
};

export const deleteTrip = async (id: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

export const createNewTrip = (data: { destination: string; startDate: string; endDate: string }): Trip => {
  return {
    id: crypto.randomUUID(),
    name: data.destination,
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
    expenses: [],
    checklist: [],
    itinerary: [],
    flights: [],
    allowed_emails: []
  };
};

export const exportData = (trips: Trip[]) => {
  const blob = new Blob([JSON.stringify(trips)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `go-travel-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};