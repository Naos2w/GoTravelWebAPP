---
applyTo: "components/**/*.tsx, App.tsx, contexts/**/*.tsx"
---
# Go-Travel Frontend Instructions

## Frontend Conventions
- Separate UI rendering logic from data fetching and mutation logic.
- Utilize React Context (`contexts/`) for global states like translation/localization.
- Implement **Optimistic UI Updates** (e.g. updating local state before completing database sync) to provide instant user feedback.
- Prefer Tailwind CSS utility classes for styling. Avoid inline styles unless dynamic calculations (e.g., coordinates, percentages in charts) are required.

## Verification
Run these checks before committing:
```bash
npm run type-check
npm run build
```

## Supabase Integration
- Never embed database credentials directly in the codebase. Always access them via Vite environment variables (`import.meta.env`).
- Ensure Supabase subscriptions are registered and torn down properly to prevent real-time client leaks.
