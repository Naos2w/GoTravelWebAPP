# Copilot Instructions for Go-Travel

This repository contains the `go-travel` project, an itinerary and expense management web application. Follow the instruction files under `.github/instructions/` for code styling, state coordination, Leaflet maps, and database conventions.

## Tech Stack & Architecture
- **Frontend Stack**: React (v19), TypeScript, Vite, Tailwind CSS, Recharts, React Leaflet.
- **Backend / Database Services**: Supabase (PostgreSQL, Realtime subscriptions, Auth, Storage).

## Priority Rules
- Keep all comments and documentation in English.
- Avoid using `any` type in TypeScript; write strong typings for database schemas and component state.
- Coordinate state updates cleanly, leveraging optimistic updates for instant UI transitions.
- Safely handle Leaflet containers to prevent initialization leaks or crashes.

## PR and Review
- PR titles must follow: `Naos/xxx`, where `xxx` describes the change in kebab-case English.
- Squash noisy commits into one single reviewable commit.
- Confirm that both typescript type-check and vite build pass.

## Skill-Mapped Instruction Files
- `.github/instructions/gotravel-core.instructions.md`
- `.github/instructions/gotravel-frontend.instructions.md`
- `.github/instructions/gotravel-supabase-services.instructions.md`
- `.github/instructions/gotravel-skill-code-formatting.instructions.md`
- `.github/instructions/gotravel-skill-react-conventions.instructions.md`
- `.github/instructions/gotravel-skill-git-commit-format.instructions.md`
- `.github/instructions/gotravel-skill-leaflet-map-management.instructions.md`
- `.github/instructions/gotravel-skill-react-state-management.instructions.md`
- `.github/instructions/gotravel-skill-supabase-api-safety.instructions.md`
- `.github/instructions/gotravel-skill-vite-react-development.instructions.md`
