
import { createClient } from '@supabase/supabase-js';
import { Trip, ChecklistItem, Currency, Expense, ItineraryItem, DayPlan } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 檢查字串是否為有效的 UUID 格式
 */
const isValidUUID = (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * 格式化日期為 YYYY-MM-DD (本地時間)
 */
const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getTrips = async (userId: string): Promise<Trip[]> => {
  if (!userId) return [];
  try {
    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select(`
        *,
        checklist_items (*),
        itinerary_items (*),
        expenses (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (tripsError) throw tripsError;

    return (tripsData || []).map((row: any) => {
      // 1. 根據開始與結束日期計算總天數
      const start = new Date(row.start_date + 'T00:00:00');
      const end = new Date(row.end_date + 'T00:00:00');
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // 2. 預先產生所有日期的結構
      const itinerary: DayPlan[] = [];
      const itineraryMap: Record<string, ItineraryItem[]> = {};
      
      for (let i = 0; i < diffDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() + i);
        const dateKey = formatDateStr(currentDate);
        itineraryMap[dateKey] = [];
      }

      // 3. 將資料庫讀出的項目填入對應日期
      (row.itinerary_items || []).forEach((it: any) => {
        if (itineraryMap[it.date]) {
          itineraryMap[it.date].push({
            id: it.id,
            trip_id: it.trip_id,
            time: it.time,
            placeName: it.place_name,
            note: it.note,
            type: it.type,
            transportType: it.transport_type,
            date: it.date
          });
        }
      });

      // 4. 重組為 DayPlan 陣列並排序時間
      Object.entries(itineraryMap).forEach(([date, items]) => {
        itinerary.push({
          date,
          items: items.sort((a, b) => a.time.localeCompare(b.time))
        });
      });

      // 最後根據日期本身排序行程表
      itinerary.sort((a, b) => a.date.localeCompare(b.date));

      return {
        id: row.id,
        name: row.name,
        destination: row.destination,
        startDate: row.start_date,
        endDate: row.end_date,
        coverImage: row.cover_image,
        flight: row.flight,
        checklist: (row.checklist_items || []).map((ci: any) => ({
          id: ci.id,
          text: ci.text,
          isCompleted: ci.is_completed,
          category: ci.category
        })),
        expenses: (row.expenses || []).map((ex: any) => ({
          id: ex.id,
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
    });
  } catch (err) {
    console.error('Failed to get trips:', err);
    return [];
  }
};

export const saveTrip = async (trip: Trip, userId: string): Promise<void> => {
  if (!userId) throw new Error("User ID is missing.");

  // 1. 更新行程主表
  const { error: tripError } = await supabase
    .from('trips')
    .upsert({
      id: trip.id,
      user_id: userId,
      name: trip.name,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      cover_image: trip.coverImage,
      flight: trip.flight
    });

  if (tripError) throw tripError;

  // 2. 同步 Checklist Items
  if (trip.checklist && trip.checklist.length > 0) {
    const checklistPayload = trip.checklist.map(ci => ({
      ...(isValidUUID(ci.id) ? { id: ci.id } : {}),
      trip_id: trip.id,
      text: ci.text,
      is_completed: ci.isCompleted,
      category: ci.category
    }));
    const { error: ciError } = await supabase.from('checklist_items').upsert(checklistPayload);
    if (ciError) console.error("Checklist sync error:", ciError);
  }

  // 3. 同步 Expenses
  if (trip.expenses && trip.expenses.length > 0) {
    const expensesPayload = trip.expenses.map(ex => ({
      ...(isValidUUID(ex.id) ? { id: ex.id } : {}),
      trip_id: trip.id,
      amount: ex.amount,
      currency: ex.currency,
      category: ex.category,
      date: ex.date,
      note: ex.note,
      exchange_rate: ex.exchangeRate
    }));
    const { error: exError } = await supabase.from('expenses').upsert(expensesPayload);
    if (exError) console.error("Expenses sync error:", exError);
  }

  // 4. 同步 Itinerary Items
  const itineraryPayload: any[] = [];
  if (trip.itinerary) {
    trip.itinerary.forEach(day => {
      day.items.forEach(item => {
        itineraryPayload.push({
          ...(isValidUUID(item.id) ? { id: item.id } : {}),
          trip_id: trip.id,
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
    const { error: itError } = await supabase.from('itinerary_items').upsert(itineraryPayload);
    if (itError) console.error("Itinerary sync error:", itError);
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
    coverImage: `https://picsum.photos/800/400?random=${Date.now()}`,
    expenses: [],
    checklist: [],
    itinerary: []
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
