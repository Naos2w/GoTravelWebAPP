import { ChecklistItem } from "../../types";
import { supabase } from "./supabaseClient";
import { buildChecklistRowPayload } from "./mappers";

/**
 * Ensures a collaborator has default checklist items initialized for the given trip.
 */
export const ensureChecklistItems = async (
  tripId: string,
  userId: string
): Promise<void> => {
  // Check if this user already has checklist items for this trip
  const { count, error: countError } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (countError) {
    console.error("Error checking checklist items count:", countError);
    // TODO: [Error Handling] Propagate DB count error to the UI
    throw countError;
  }

  // If no items found, insert defaults specifically for this user
  if (count === null || count === 0) {
    const defaultItems = [
      { text: "Passport & Visa", category: "Documents" },
      { text: "Phone Charger", category: "Gear" },
      { text: "Clothes", category: "Clothing" },
      { text: "Toothbrush", category: "Toiletries" },
      { text: "Cash / Credit Cards", category: "Other" },
    ];

    const payload = defaultItems.map((item) => ({
      trip_id: tripId,
      user_id: userId,
      text: item.text,
      category: item.category,
      is_completed: false,
    }));

    const { error: insertError } = await supabase
      .from("checklist_items")
      .insert(payload);
    if (insertError) {
      console.error("Auto checklist init failed:", insertError);
      // TODO: [Error Handling] Propagate checklist insert error to the UI
      throw insertError;
    }
  }
};

/**
 * Upserts one or more checklist items for a trip; skips empty batches.
 */
export const upsertChecklistItems = async (
  tripId: string,
  userId: string,
  items: ChecklistItem[]
): Promise<void> => {
  if (!items || items.length === 0) return;
  const payloads = items.map((c) => buildChecklistRowPayload(c, tripId, userId));
  const { error } = await supabase.from("checklist_items").upsert(payloads);
  if (error) {
    console.error("Failed to upsert checklist items:", error);
    throw error;
  }
};

/**
 * Inserts a single checklist item for a trip.
 */
export const addChecklistItem = async (
  item: ChecklistItem,
  tripId: string
): Promise<void> => {
  const { error } = await supabase
    .from("checklist_items")
    .insert(buildChecklistRowPayload(item, tripId));
  if (error) {
    console.error("Failed to insert checklist item:", error);
    throw error;
  }
};

/**
 * Updates mutable fields on a single checklist item scoped by id and trip_id.
 */
export const updateChecklistItem = async (
  id: string,
  tripId: string,
  updates: Partial<Pick<ChecklistItem, "isCompleted" | "text" | "category">>
): Promise<void> => {
  const payload: Record<string, any> = {};
  if (updates.isCompleted !== undefined) payload.is_completed = updates.isCompleted;
  if (updates.text !== undefined) payload.text = updates.text;
  if (updates.category !== undefined) payload.category = updates.category;

  const { error } = await supabase
    .from("checklist_items")
    .update(payload)
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) {
    console.error("Failed to update checklist item:", error);
    throw error;
  }
};

/**
 * Deletes a single checklist item scoped by id and trip_id.
 */
export const deleteChecklistItem = async (
  id: string,
  tripId: string
): Promise<void> => {
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) throw error;
};
