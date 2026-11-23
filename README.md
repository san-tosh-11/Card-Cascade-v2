# CardCascade — SprintSense Kanban & Sprint Planner (v2)

Responsive Kanban board and agile sprint planner: HTML5 drag-and-drop, WIP-limit warnings, story-point estimation,
a live Chart.js burndown with a pace forecast, undo, JSON backup and a CSS-variable dark mode.
Full-stack: React frontend + Express backend sharing one business-logic module.

## Tech stack
| Layer | Used |
|---|---|
| Frontend | **React** (useState, useEffect, **Context**, **React Router**), **HTML5 Drag & Drop**, **CSS Custom Properties**, **Tailwind CSS** |
| Charts | **Chart.js** (burndown + projection, developer doughnut, velocity bars) |
| Backend | **Node.js + Express** (state, card moves, burndown/forecast calculation, paginated card search) |
| Storage | localStorage (browser) + atomic JSON-file store on the server; relational schema + indexes in `server/schema.sql` |
| Tests | **Vitest** (64 tests) |
| Build | Vite |

## Run it (Node.js 18+)
```bash
npm install
npm run dev        # React app http://localhost:5173  +  Express API :4000
npm test           # 64 unit + handler tests
```
Single process (built app served by Express): `npm start` → http://localhost:4000.
The React app also works without the server (automatic localStorage fallback).

> Make sure the main page file is named **`index.html`** (not `index.htm`), otherwise Vite shows a 404.

## Pages
`/board` Kanban + filters · `/planner` sprint dates, estimates, WIP limits, backup · `/burndown` ideal vs actual vs projected + forecast ·
`/insights` developer load + velocity trend · `/retro` retrospective board with auto-generate

## Architecture (3 tiers, separation of concerns)
```
React UI (pages, components, Context)  ──►  src/lib/*  (pure logic, validation, seed)  ◄──  Express (server/*)
                                              ▲ shared "isomorphic" code ▲
```
| File | Responsibility |
|---|---|
| `src/lib/sprintLogic.js` | Pure sprint logic: card moves/re-ordering, WIP status, burndown, snapshots, velocity, forecast, auto-retro |
| `src/lib/validation.js` | Strict schema validation + sanitising (shared by client and server) |
| `src/lib/persistence.js` | Storage adapter (API → localStorage), validates everything it reads, reports sync status |
| `src/context/BoardContext.jsx` | App state, undo stack, drag state, toasts, global error handlers |
| `server/handlers.js` | Framework-independent request handlers (`{status, body}`), fully unit-tested |
| `server/app.js` | Express wiring: request ids, access log, security headers, rate limit, routes, 404 + global error handler |
| `server/store.js` | Atomic file persistence (temp file + rename); invalid files fall back to sample data |
| `server/logger.js`, `rateLimit.js`, `security.js` | Observability, flood protection, hardening headers |

## Quality measures
**Testing** (`npm test`, Vitest): `tests/logic.test.js` (25: moves, re-ordering, WIP, burndown, snapshots, sprint completion, auto-retro, forecast),
`tests/validation.test.js` (20: every rule, sanitising, prototype-pollution payloads), `tests/server.test.js` (19: all handlers, pagination, persistence, corrupted files, logger, rate limiter, headers).

**Input validation & security**
- Every trust boundary is validated against a strict schema: `PUT /api/state`, move payloads, imported JSON files, and data read from localStorage / disk.
- Invalid requests get `400` with a list of reasons; unknown fields are stripped (`sanitizeState`); ids/colors/dates are pattern-checked; size limits everywhere (500 cards, 1 MB body, text lengths).
- Rate limiting (300 req/min/IP, `429` + `Retry-After`), hardening headers (`nosniff`, `X-Frame-Options`, `no-store` on the API), `x-powered-by` disabled, no stack traces sent to clients, React escapes all user text (no `dangerouslySetInnerHTML`).
- No secrets in the code base; data directory is git-ignored.

**Error handling & resilience**
- React `ErrorBoundary` (recovery screen with "Try again / Reset saved data"), global `error` / `unhandledrejection` handlers → toast.
- Save problems (storage full, server down, server rejected the update) are shown to the user; a status badge in the header shows *Saved locally / Synced / Offline / Save problem*.
- Corrupted saved data is detected, replaced by the sample sprint and the user is told. Server writes are atomic.

**Observability**: structured logs (console + `server/data/server.log` as JSON lines): request id, method, path, status, duration; card moves (from → to, WIP, remaining points); rejected payloads; WIP breaches; unhandled errors. `LOG_LEVEL=debug|info|warn|error`.

**Scalability**: `GET /api/cards?colId=&assignee=&q=&page=&limit=` (paginated, `limit` ≤ 200); the board shows 25 cards per column with "Show N more"; `server/schema.sql` defines the indexes
(`sprint, column, position`; assignee; completed date; burndown `sprint, day`; one active sprint).

**Beyond CRUD**: **Auto-Retro** (builds retrospective notes from velocity, WIP breaches, load and burndown) · **Sprint forecast** (extrapolates the burn rate, draws a projected line and says whether the sprint finishes on time) ·
**Undo** (Ctrl/Cmd+Z, 30 steps) · **JSON export/import** with validation · developer-load flag (> 30 % of points).

## API
`GET /api/health` · `GET|PUT /api/state` · `GET /api/burndown` · `GET /api/forecast` · `GET /api/wip` · `GET /api/cards` (paginated) · `POST /api/cards/:id/move {colId, beforeId}` · `POST /api/reset`

## Demo script
1. `/board`: **Sprint 14, 42 total, 18 remaining, Day 6** — forecast says the sprint is slightly at risk.
2. Drag **User Auth API** (5 pts) In Progress → Done: remaining becomes 13.
3. `/burndown`: actual line drops to 13, forecast turns "On pace to finish around day 8.7".
4. Press **Undo** (or Ctrl+Z) to see 18 again. Drag extra cards into Review for the red WIP warning.
5. Try a blank card title / reversed sprint dates (validation messages), toggle theme, Planner → Export JSON.
