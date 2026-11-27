/**
 * Backward-compatible barrel re-exporting all domain repositories, mappers,
 * and the shared Supabase client from `services/repos/*`.
 */

export {
  supabase,
  SUPABASE_URL,
  isSupabaseConfigured,
  isValidUUID,
} from "./repos/supabaseClient";

export {
  formatDateStr,
  type DbTripRow,
  mapDbItineraryRow,
  mapDbFlightRow,
  mapDbChecklistRow,
  mapDbExpenseRow,
  transformTripRow,
  buildItineraryRowPayload,
  buildExpenseRowPayload,
  buildFlightRowPayload,
  buildChecklistRowPayload,
  encodeExpenseSplitMeta,
  decodeExpenseSplitMeta,
} from "./repos/mappers";

export {
  upsertItineraryItems,
  deleteItineraryItem,
} from "./repos/itineraryRepo";

export {
  saveExpenseOnly,
  upsertExpense,
  deleteExpense,
} from "./repos/expenseRepo";

export {
  ensureChecklistItems,
  upsertChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "./repos/checklistRepo";

export {
  upsertFlight,
  deleteFlight,
} from "./repos/flightRepo";

export {
  joinTrip,
  findUserIdByEmail,
  leaveTrip,
  removeCollaboratorByEmail,
  removeCollaborator,
  getTrips,
  getTripById,
  updateTripMeta,
  saveTrip,
  deleteTrip,
  createNewTrip,
  createFullTrip,
} from "./repos/tripRepo";
