---
applyTo: "services/storageService.ts, App.tsx"
---
# Skill Mapping: supabase-api-safety

To ensure database security, prevent unauthorized data access, and safely handle authentication, follow these safety practices.

## Row Level Security (RLS) Compliance
- Ensure all Supabase tables (trips, expenses, checklists, itinerary) have Row Level Security enabled in the Supabase console.
- Queries executed in the client should always pass filters corresponding to the authenticated user ID (e.g. `supabase.from('trips').select().eq('user_id', currentUser.id)`).
- Handle guest users explicitly by restricting access to read-only views (e.g. `isGuest` prop should disable creation/editing forms and hide action buttons).

## Safe Client Usage
- Use a single, shared Supabase client instance created at `services/storageService.ts`. Do not initialize multiple client instances across various parts of the codebase.
- Always validate connection credentials using environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

## Error and Session Boundaries
- Listen to auth state transitions (`supabase.auth.onAuthStateChange`) to cleanly sign out users or update UI state when tokens expire.
- If a database query fails with unauthorized or forbidden codes, redirect to the authentication portal or clear local session state.
