import { ItineraryItem } from "../../types";
import { supabase } from "./supabaseClient";
import { buildItineraryRowPayload } from "./mappers";

/**
 * Upserts one or more itinerary items for a trip; skips empty batches.
 */
export const upsertItineraryItems = async (
  tripId: string,
  userId: string,
  items: Array<ItineraryItem & { date: string }>
): Promise<void> => {
  if (!items || items.length === 0) return;
  const payloads = items.map((item) =>
    buildItineraryRowPayload(item, tripId, userId)
  );
  const { error } = await supabase.from("itinerary_items").upsert(payloads);
  if (error) {
    console.error("Failed to upsert itinerary items:", error);
    throw error;
  }
};

/**
 * Deletes a single itinerary item scoped by id and trip_id.
 */
export const deleteItineraryItem = async (
  id: string,
  tripId: string
): Promise<void> => {
  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) throw error;
};
