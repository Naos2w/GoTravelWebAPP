---
applyTo: "components/**/*.tsx, services/**/*.ts, App.tsx"
---
# Go-Travel Core Instructions

## Architecture
- Use React (v19) functional components and hooks for UI structure and state management.
- Use Vite as the build tool and bundler.
- Keep frontend views (`components/`) separated from data access layers (`services/`).
- Use Supabase Client (`services/storageService.ts`) for all database CRUD operations, storage bucket uploads, and real-time syncing.
- RLS (Row Level Security) must be respected: Guest users have read-only permissions, and authenticated users can mutate data they own.

## Quality
- Keep all comments and docs in English.
- Use strict TypeScript; avoid `any` to prevent compilation and runtime errors.
- Ensure all resources and files compile correctly under `npm run type-check`.
- Prefer minimal, focused changes to components and utilities.

## PR
- Use PR title format `Naos/xxx`.
- `xxx` must summarize the main change in kebab-case English.
- Consolidate noisy branch commits into a clean reviewable commit before sending the PR.
