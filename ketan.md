# ketan.md — Backend Platform, Batcher, Validator & Security Lead
Read `00_MAIN_PRD.md` first (sections 3, 4.1, 4.4, 6, 12). If this file conflicts with it, the main PRD wins.

## Mission
You own the **spine**: the API, the shared data models, the sliding-window batcher, the independent validator, and security. If your contract is clear at hour 2, four people can work in parallel. You are also the team's overall helper — unblock others fast.

## You own
`backend/app/` (`main.py`, routes, `models.py`, persistence, security), `backend/engine/batching/sliding_window.py`, `backend/engine/validator/validator.py`, `docs/security.md`.

## Depends on
- Spandan: `Dispatcher.dispatch()` (use a mock dispatcher until hour 6).
- Kaushik: `compute_fares()` and `compute_metrics()`.
- Amod: sim clock, scenarios, vehicle motion.

## Deliverables
### 1. Models + contract (hour 0–2, **highest priority**)
`backend/app/models.py` in Pydantic v2 exactly matching main PRD §6: `LatLon, Request, Vehicle, Stop, RoutePlan, DispatchResult, FareBreakdown, Metrics, WindowState, ValidationReport`. Export OpenAPI JSON to `docs/openapi.json`. Announce "contract frozen" in chat. Changes after hour 2 need the whole team's OK.

### 2. FastAPI app
Endpoints in main PRD §6. State kept in an in-memory `World` object, snapshotted to SQLite every window flush (for restart). CORS allowlist for the frontend origin only. `GET /api/state` must be cheap (<20 ms): return cached serialized state.
Mock mode first: `/api/state` returns Amod's fixture so Nakul is never blocked.

### 3. Sliding-window batcher (`sliding_window.py`)
```python
class WindowBatcher:
    def add(self, req, now_s) -> None
    def tick(self, now_s) -> BatchDecision | None   # returns batch + flush_reason
    def state(self, now_s) -> WindowState
```
Flush when: **TIMER** (window W elapsed, default 30 s sim), **SIZE** (≥ N_max=12), **URGENCY** (any request's `pickup_deadline − best_case_eta` ≤ margin, default 20 s sim). Deferred requests are re-added until `pickup_deadline` passes, then rejected with `WINDOW_MISSED`. Pure, clock injected, no threads in the logic.

### 4. Independent validator (`validator.py`)
Pure function: `validate(stops, requests, matrix, vehicle_state, config) -> ValidationReport`. **Must not import anything from `engine/dispatch` or `engine/optimizer`.**
Check for every rider on the route (including already onboard):
1. each pickup exists once and precedes its drop
2. onboard seats ≤ capacity after every stop
3. pickup arrival within `[request_time, request_time + max_wait_s]`
4. `drop_arrival − pickup_arrival ≤ (1 + detour_cap) × T_direct` (for onboard riders use time already ridden)
5. no unknown request ids; no negative times
Output violations with codes, rider ids, and numbers (e.g. "R2 detour 19.1% > 15%"). Also fills `per_rider{detour_pct, wait_s}` used by the UI badge.
Write tests with **hand-made bad routes** for each rule. A validator that never fails is worthless.

### 5. Orchestrator
`World.tick(now)`: batcher → dispatcher → validator (inside strategies) → commit plans (bump `version` only for changed routes) → fares for newly formed groups → metrics → cache state. Existing commitments never change unless the new plan is ✔.
`/api/diff/{request_id}`: store previous plan versions for the vehicles touched by the last dispatch.

### 6. Security checklist (`docs/security.md`, 1 page — judges like this)
- Pydantic bounds: lat/lon within the scenario bounding box, seats 1–4, max 500 requests per scenario, string ids ≤ 32 chars.
- Rate limiting on write endpoints (e.g. `slowapi`), body size limit.
- Solver time limit enforced; run optimizer in a worker with timeout so a bad input can't hang the API.
- Admin actions (`/api/scenarios/*/load`, `/api/sim/control`) behind a bearer token from `.env`; `.env` in `.gitignore`; no secrets in repo.
- Pin dependencies; run `pip-audit` once; enable GitHub Dependabot (Amod).
- Privacy: synthetic riders only, pseudonymous ids, no personal data stored, no real GPS.
- Security headers via middleware; no stack traces in responses; structured logs.
- One-slide threat model: abusive request flooding, malformed coordinates, solver DoS, tampered fare. 

## Hour plan
| Hours | Task |
|---|---|
| 0–2 | models.py, OpenAPI export, mock `/api/state`, repo skeleton with Amod |
| 2–6 | Validator + bad-route tests; WindowBatcher + tests; FastAPI endpoints with mock dispatcher |
| 6–10 | Plug Spandan's dispatcher and Kaushik's fares; end-to-end in browser |
| 10–14 | Urgency flush, defer/reject flow, diff endpoint, SQLite snapshot |
| 14–18 | Security pass, rate limits, error handling, performance check `/api/state` |
| 18–21 | Freeze; run full acceptance list from main PRD §12; fix integration bugs |
| 21–24 | Clean-clone run test; support rehearsal; backup machine ready |

## Gates
- Hour 2: contract frozen, mock API live.
- Hour 6: validator catches every bad-route test; batcher flushes on all 3 reasons in tests.
- Hour 10: full pipeline works with real dispatcher.

## Acceptance tests you own
Main PRD §12: precedence, capacity, windows, detour, infeasible → defer → reject with other routes' `version` unchanged, determinism, optimizer timeout does not freeze the API.

## Fallbacks
- Spandan late → ship a mock dispatcher that uses C-style naive insertion so UI and fares keep moving.
- SQLite issues → drop persistence; in-memory is enough for the demo.
- Auth/rate limit friction → keep them behind env flags, default on for final build only after demo is stable.

## Antigravity prompt (paste as is)
```
Folder structure first. Create on Desktop (or open existing): poolIQ/ with
 frontend/ (components/, pages/, utils/), animations/, backend/ (app/, engine/{batching,validator,dispatch,routing,optimizer,pricing,metrics,sim}, data/, tests),
 public/assets/, docs/, progress.md, activeContext.md.
If progress.md and activeContext.md exist, only add/update the "Ketan" section. If not, create them:
progress.md = Completed / In Progress / Pending / Next Steps; activeContext.md = current prompt, tech decisions,
folder structure, features, future scope. Structured, not empty, resumable. Update progress.md after each step.

Goal: build the backend spine of PoolIQ with FastAPI + Pydantic v2 (Python 3.11). Read docs/00_MAIN_PRD.md sections 3, 4.1, 4.4, 6, 12 and docs/ketan.md fully.

Build in order: models.py exactly matching main PRD section 6 + OpenAPI export -> FastAPI app with mock /api/state from a fixture
-> independent validator (no imports from dispatch/optimizer; checks precedence, capacity, pickup windows, ride-time <= 1.15 x direct,
per-rider detour/wait) with pytest tests using deliberately bad routes -> WindowBatcher (timer, size, urgency flush; clock injected; pure)
-> World.tick orchestrator (batcher -> dispatcher -> commit only validated plans -> fares -> metrics) -> /api/diff, SQLite snapshot
-> security: pydantic bounds, CORS allowlist, rate limiting, bearer token for admin routes, solver timeout, no stack traces, docs/security.md.
Keep it simple and fast, no Docker, no microservices. After each step update progress.md.
```
