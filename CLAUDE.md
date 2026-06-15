# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Serve the production build locally
```

No test runner is configured. There are no lint scripts — Vite's dev server reports JSX/import errors at runtime.

## Environment

Requires a `.env.local` file (never commit it):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

The same two variables must be set in Vercel for production deploys.

## Architecture

### State management — `src/hooks/useCanvas.js`

All canvas state lives in a single `useState` inside `useCanvas`. Every mutation goes through `commit(prev, changes)` which pushes a snapshot onto `past[]` for undo/redo (max 50 entries). **UI-only state** (tool, selectedId, cableStart) must NOT call `commit` — it bypasses history. The hook exposes `deleteById(id)` for atomic removal without depending on `selectedId`.

Canvas data shape:
```js
{ elements, cables, comments, anchors, selectedId, cableStart, tool, cableType, past, future }
```

`symbols` is a separate `useState` (not part of undo history).

### Canvas rendering — `src/components/Canvas/CanvasStage.jsx`

Uses `react-konva` with **3 layers**: Grid / All content / Remote cursors. All elements, cables, comments and anchors render in the middle layer. Keyboard shortcuts (Ctrl+Z, Delete, R, S, C, N…) are registered on `window` via `useEffect`.

Cable routes are pre-computed as `allCableRoutes` (simple orthogonal) then passed as `priorRoutes` to each `CableElement` which calls `routeOrthogonalAvoid` with element bounding boxes to avoid symbol overlap.

### Routing — `src/utils/routing.js`

- `routeOrthogonal(x1,y1,x2,y2)` — simple Z-shape (3 segments)
- `routeOrthogonalAvoid(x1,y1,x2,y2, priorRoutes, elementBoxes)` — shifts `midX` up to 16 times (±20 px steps) to avoid collinear cable overlap and symbol AABBs
- `getBornePosition(element, symbol, borneIdx)` — returns the world position of a borne, accounting for element rotation
- `buildElementBoxes(elements, symbols, excludeIds)` — AABB list for avoidance (excludes connected elements)

### Supabase schema

Two tables:
- `schemas` — stores canvas JSON (`{ elements, cables, comments, anchors }`) per user, with RLS `owner_id = auth.uid()`
- `symbol_library` — shared symbol library; any authenticated user can read/insert/update/delete

**Seeding**: `INITIAL_SYMBOLS` are inserted into `symbol_library` only when the table is completely empty (first ever login). After that, user deletions are permanent — the seed never re-runs.

**Symbol PNG storage**: Supabase Storage bucket `symbols` (public). Local PNGs in `public/symbols/` serve as fallback for the 4 built-in symbols.

### Symbol identity

Each symbol has:
- `id` — slug (`interrupteur_aerien_bt`) for built-ins, UUID for user-uploaded
- `bornes[]` — connection points `{ x, y, name }` in local coordinates
- `defaultRotation` — applied when first placed on canvas
- `_fromDb: true` — set when loaded from Supabase (controls DB sync on save/update)

### Realtime collaboration — `src/hooks/useRealtime.js`

Uses Supabase Realtime broadcast channel `schema:<schemaId>`. Broadcasts cursor positions and canvas state changes. Remote cursors render in Layer 3.

### Auto-save & dirty tracking — `src/components/Toolbar/Toolbar.jsx`

Dirty state is tracked by comparing a JSON fingerprint (`canvasDataStr`) against `lastSavedRef`. A 30-second debounce timer triggers auto-save when `isDirty && schemaId`. The unsaved indicator (`●`) pulses orange in the toolbar.

### Auth flow — `src/components/Auth/AuthModal.jsx`

Modes: `login` | `register` | `reset` | `confirm`. After successful registration, switches to `confirm` mode (shows email confirmation screen). Supabase error messages are translated to French via `ERROR_MAP`.

## Deployment

Hosted on Vercel, connected to GitHub (`alanarcouet-cyber/schema-elec`, branch `main`). Every push to `main` triggers an automatic redeploy. DB migrations must be run manually in the Supabase SQL editor — see `supabase/schema.sql`.
