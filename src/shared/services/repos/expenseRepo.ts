import { Expense } from "../../../types";
import { supabase, isValidUUID } from "./supabaseClient";
import { buildExpenseRowPayload, encodeExpenseSplitMeta } from "./mappers";

/**
 * Persists a standalone expense row, generating a UUID if the expense lacks a valid one.
 */
export const saveExpenseOnly = async (
  tripId: string,
  expense: Expense
): Promise<void> => {
  const payload = {
    id: isValidUUID(expense.id) ? expense.id : crypto.randomUUID(),
    trip_id: tripId,
    user_id: expense.user_id,
    user_name: expense.user_name,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    note: encodeExpenseSplitMeta(expense),
    exchange_rate: expense.exchangeRate,
  };

  const { error } = await supabase.from("expenses").upsert(payload);
  if (error) throw error;
};

/**
 * Upserts a single expense row for a trip.
 */
export const upsertExpense = async (
  tripId: string,
  userId: string,
  expense: Expense
): Promise<void> => {
  const payload = buildExpenseRowPayload(expense, tripId, userId);
  const { error } = await supabase.from("expenses").upsert(payload);
  if (error) {
    console.error("Failed to upsert expense:", error);
    throw error;
  }
};

/**
 * Deletes a single expense scoped by id and trip_id.
 */
export const deleteExpense = async (
  id: string,
  tripId: string
): Promise<void> => {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);
  if (error) throw error;
};
