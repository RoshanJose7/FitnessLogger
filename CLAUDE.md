# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run lint      # ESLint checks
npm run preview   # Preview production build
# Regenerate PWA icons from public/favicon.svg (run after changing the icon):
npx pwa-assets-generator --preset minimal-2023 public/favicon.svg
```

No test suite is configured.

## Architecture

React 19 + Vite SPA that connects directly to Supabase (no backend server). Auth state and route definitions live in `src/App.jsx`; all data access is direct Supabase client calls—there is no API abstraction layer.

**Entry point:** `index.html` → `src/main.jsx` → `src/App.jsx`

**Routing:** React Router v7 with a `ProtectedRoute` wrapper that guards all authenticated pages. The `Layout` component provides responsive nav (bottom on mobile, top on desktop).

**State:** React hooks for local state; React Query for server-state caching. No global state library.

**Key directories:**
- `src/pages/` — one file per route (Dashboard, WorkoutLog, NutritionLog, History, Login). History uses `React.lazy()` with a Suspense boundary.
- `src/components/` — shared UI (Layout, ProtectedRoute, RestTimer)
- `src/lib/` — Supabase client (`supabase.js`), auth helpers (`auth.js`), and shared constants like protein/water targets (`exercises.js`)
- `supabase/schema.sql` — database schema reference

**Environment:** Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (see `.env.example`).

**PWA:** Configured via `vite-plugin-pwa` (generateSW mode). The service worker precaches all static assets and uses NetworkFirst for Supabase API calls. `src/components/InstallPrompt.jsx` handles "Add to Home Screen" for both Android (beforeinstallprompt) and iOS (manual share-sheet hint). Icons live in `public/` and are generated from `public/favicon.svg` via `@vite-pwa/assets-generator`.

**Deployment:** Netlify SPA with a redirect rule in `public/_redirects` to handle client-side routing.
