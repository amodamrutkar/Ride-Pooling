# spandan.md — Optimization Core Lead (Routing, Dispatch Strategies, OR-Tools)
Read `00_MAIN_PRD.md` first (sections 3, 4, 6). If this file conflicts with it, the main PRD wins.

## Mission
Build the brain: five dispatch strategies behind one interface, fast candidate filtering, and an OR-Tools polish stage. Quality matters, but **a valid route end-to-end by hour 6–10 beats a perfect solver at hour 20**.

## You own
`backend/engine/routing/` (`matrix_provider.py`, `osrm.py`, `spatial_index.py`), `backend/engine/dispatch/`, `backend/engine/optimizer/ortools_vrptw.py`, `scripts/` arena benchmark with Amod.

## Depends on
- Ketan: `models.py` (hour 2), validator (hour 6), batcher calls your `dispatch()`.
- Amod: `FallbackMatrixProvider` + fixtures + vehicle motion.
- Kaushik: consumes your `RoutePlan` for fares.

## Interfaces (freeze at hour 2)
```python
class MatrixProvider(Protocol):
    def table(self, points: list[LatLon]) -> Matrix: ...   # durations_s[i][j], distances_m[i][j]

class Dispatcher(Protocol):
    name: str
    def dispatch(self, batch: list[Request], fleet: list[Vehicle], ctx: DispatchCtx) -> DispatchResult: ...
# ctx has: matrix provider, now_s, config (detour_cap, rate), validator callable
```
Every strategy must call the injected `validator` before returning a plan as accepted. Do **not** import validator internals.

## Deliverables
| # | Deliverable | Notes |
|---|---|---|
| 1 | `MatrixProvider` + `OsrmProvider` | Table API, batch points, disk cache (JSON keyed by rounded coords), 2 s timeout, auto-fallback to Amod's provider |
| 2 | `spatial_index.py` | Grid ≈ 500 m; index stops of active routes; `candidates(pickup, k=8)` returns vehicles with a stop in neighboring cells reachable within `max_wait_s`, plus idle vehicles |
| 3 | Strategy A `solo` | Nearest idle vehicle per rider |
| 4 | Strategy B `greedy_fcfs` | Nearest feasible vehicle, append pickup+drop at end |
| 5 | Strategy C `loud_insertion` | Try all (i, j) insertions, O(1) check with slack arrays, choose min added time; commit only if validator ✔ |
| 6 | Strategy D `batch_matching` | Matrix requests × vehicles of best insertion cost, `scipy.optimize.linear_sum_assignment`, apply winners, repeat rounds until no assignment improves |
| 7 | Strategy E `hybrid` | D, then OR-Tools on affected vehicles, warm-start, 1.5 s limit; keep only if validator ✔ and cost lower |
| 8 | Reason codes | Return `explain` string for each deferred/rejected request |
| 9 | Arena runner | `run_arena(scenario)` runs A–E on the same seeded scenario, returns metrics via Kaushik's module |

## Insertion algorithm (strategy C — the LOUD-inspired part)
For each vehicle route with stops `s0 (vehicle now), s1…sm`, precompute once per window:
- `arrival[k]`, `load[k]`
- `slack[k]` = max delay stop k and all later stops can absorb (min over later windows)
- `ride_slack[k]` = min remaining ride-time slack among riders onboard across position k (1.15 × direct − current ride)
Then for each pickup position `i` and drop position `j ≥ i`:
1. Compute added time using matrix lookups only (no routing call inside the loop).
2. Check: capacity on i..j, own pickup window, own ride time ≤ 1.15 × direct, added delay ≤ `slack`, delay inside i..j ≤ `ride_slack`.
3. Track min added cost. 
Complexity per route O(m²) with O(1) checks; per request only K candidate vehicles. Say "LOUD-inspired: bucketed candidates + exact best insertion". Real LOUD uses bucket contraction hierarchies — mention as future work.

## OR-Tools model (strategy E)
Docs: https://developers.google.com/optimization/routing/pickup_delivery
- Nodes: vehicle start (current position), each pickup, each drop. Use per-vehicle start/end (end = last drop, free ending via zero-cost dummy).
- Transit callback: matrix seconds (int). `Time` dimension with pickup windows; slack allowed for waiting.
- `Capacity` dimension: +seats on pickup, −seats on drop.
- For each rider: `AddPickupAndDelivery`, `same_vehicle`, `cumul(pickup) <= cumul(drop)`, and `cumul(drop) − cumul(pickup) <= int(1.15 * T_direct)`.
- Onboard riders: fix their drop in the vehicle's route; their ride-time cap uses elapsed ride so far.
- `AddDisjunction([pickup, drop], large_penalty)` so infeasible requests drop out instead of crashing.
- Search: `PATH_CHEAPEST_ARC`, metaheuristic `GUIDED_LOCAL_SEARCH`, `time_limit.FromMilliseconds(1500)`.
- Warm start with `ReadAssignmentFromRoutes`. Convert result → `RoutePlan` → validator.

## Hour plan
| Hours | Task |
|---|---|
| 0–2 | Freeze interfaces with Ketan; read OR-Tools pickup/delivery example |
| 2–6 | Matrix provider + cache; strategies A, B; first **valid route** for 1 vehicle, 3 requests |
| 6–10 | Strategy C + spatial index; hook into Ketan's batcher + validator; first end-to-end |
| 10–14 | Strategy D (Hungarian) and E (OR-Tools); reason codes; defer/reject behavior |
| 14–18 | Arena runner; timing; tune K, window; benchmark with Amod |
| 18–21 | Freeze. Bug fixes only. Precache demo matrix |
| 21–24 | Support rehearsal; explain algorithms to judges |

## Gates
- Hour 6: one vehicle, three requests → validator-approved route.
- Hour 10: strategy C works inside the full API.
- Hour 14: hybrid ≥ as good as greedy on demo scenario, or you know why not.

## Rules and tests
- Pure functions where possible; strategies receive and return plain models; no global state.
- Property test: for random seeded scenarios, every accepted plan passes the validator (A–E).
- Test: new request that would break an onboard rider's 15% → rejected with `WOULD_BREAK_COMMITMENT`; other vehicles' `version` unchanged.
- Test: solver timeout returns best-so-far or falls back to D, never raises to the API.
- Determinism: fixed random seed, stable tie-breaking by id.

## Fallbacks
- OR-Tools not converging → ship C + D; hybrid = D. Arena shows four strategies.
- Insertion bugs → use brute force over permutations for ≤ 6 stops as oracle in tests and as emergency strategy.
- OSRM slow → use cached matrix + fallback provider.

## Antigravity prompt (paste as is)
```
Folder structure first. Create on Desktop (or open existing): poolIQ/ with
 frontend/ (components/, pages/, utils/), animations/, backend/ (app/, engine/{routing,dispatch,optimizer}, tests),
 public/assets/, docs/, progress.md, activeContext.md.
If progress.md and activeContext.md exist, only add/update the "Spandan" section. If not, create them:
progress.md = Completed / In Progress / Pending / Next Steps; activeContext.md = current prompt, tech decisions,
folder structure, features, future scope. Structured, not empty, resumable. Update progress.md after each step.

Goal: build the optimization core of PoolIQ in Python 3.11. Read docs/00_MAIN_PRD.md sections 3, 4, 6 and docs/spandan.md fully.

Build in order: MatrixProvider interface + OSRM provider with disk cache and fallback -> spatial grid index for candidate vehicles
-> strategies: solo, greedy_fcfs, loud_insertion (exact best insertion with slack arrays, matrix lookups only),
batch_matching (scipy linear_sum_assignment over insertion costs), hybrid (batch_matching then OR-Tools pickup-and-delivery
VRPTW with time + capacity dimensions, ride-time cap 1.15 x direct, disjunction penalties, 1.5s limit, warm start).
Every strategy returns DispatchResult with reason codes and calls an injected validator before accepting a plan.
Write pytest tests incl. property tests with fixed seeds. Keep it simple, fast, deterministic. No web server code here.
After each step update progress.md.
```
