---
applyTo: "services/**/*.ts"
---
# Go-Travel Supabase Services Instructions

## Supabase Service Guidelines
- Keep database query and storage bucket logic encapsulated inside `services/storageService.ts` and `services/geminiService.ts`.
- Always handle Supabase query errors explicitly. Log errors in developer console and return friendly fallback objects or rejection messages to the UI.
- Structure files/images uploaded to Supabase Storage with clean folder naming conventions (e.g. `trips/{tripId}/receipts/{fileName}`).
- Handle connection issues gracefully, ensuring that if Supabase is offline or auth expires, the application reverts to read-only or displays a login dialog.

## Verification
Run these locally before pushing:
```bash
npm run type-check
npm run build
```
