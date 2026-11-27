import { FlightInfo } from "../../types";
import { supabase } from "./supabaseClient";
import { buildFlightRowPayload } from "./mappers";

/**
 * Upserts a single flight row for a trip.
 */
export const upsertFlight = async (
  tripId: string,
  userId: string,
  flight: FlightInfo
): Promise<void> => {
  const payload = buildFlightRowPayload(flight, tripId, userId);
  const { error } = await supabase.from("flights").upsert(payload);
  if (error) {
    console.error("Failed to upsert flight:", error);
    throw error;
  }
};

/**
 * Deletes a single flight scoped by id and trip_id.
 */
export const deleteFlight = async (
  id: string,
  tripId: string
): Promise<void> => {
  const { error } = await supabase
    .from("flights")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) {
    console.error("Failed to delete flight:", error);
    throw error;
  }
};
