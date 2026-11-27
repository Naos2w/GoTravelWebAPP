import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";

/**
 * Checks whether Supabase environment variables are configured with non-placeholder values.
 */
export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("placeholder") || key.includes("placeholder")) return false;
  return true;
};

/**
 * Shared Supabase client singleton used across all domain repositories.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: async (_name, _acquireTimeout, fn) => {
        return await fn();
      },
    },
  }
);

/**
 * Validates that a string conforms to standard 8-4-4-4-12 hexadecimal UUID format.
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
