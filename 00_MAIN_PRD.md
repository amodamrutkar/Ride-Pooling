# PoolIQ — Explainable Ride-Pooling Dispatch Engine
**Main PRD · Problem 6: Algorithmic Transit Ride-Pooling, Dynamic Batching & Fair Fare Allocation Engine**
Team: Nakul (frontend) · Kaushik (idea/pitch + fairness math) · Spandan (optimizer core) · Ketan (platform, validator, security) · Amod (repo, sim, tests, CI)
Format: 24-hour build · 3 winners out of 50 · Version 1.0

> **One-line pitch:** *PoolIQ batches ride requests in a sliding window, routes them with a multi-algorithm VRPTW engine (LOUD-inspired insertion + batch matching + OR-Tools polish), proves every route with an independent validator, and splits the fare with Shapley values — and shows all of it live.*

---

## 0. How to read these docs
1. `00_MAIN_PRD.md` (this file) = the single source of truth. Contracts, algorithms, scope.
2. `nakul.md`, `kaushik.md`, `spandan.md`, `ketan.md`, `amod.md` = personal PRDs. Each has tasks, hour gates, files owned, and a paste-ready Antigravity prompt.
3. If a personal PRD conflicts with this file, **this file wins**. Change this file first, then tell the team.

---

## 1. Review of the original plan (`smart_ride_pooling_24_hour_hackathon_plan.md`)

### Keep (it was good)
- End-to-end first, fancy later. Hour gates. Owner per testable deliverable.
- OR-Tools + OSRM + FastAPI + React + Leaflet. Right stack, one core language (Python).
- Independent validator ("never trust the solver"). Cached/fallback matrix. Reject instead of breaking commitments.
- Only report savings measured on the same scenario.

### Gaps and fixes (this is what the problem statement actually asks for)
| # | Gap in old plan | Fix in this PRD |
|---|---|---|
| 1 | Problem says **"dynamic sliding-window batching"**. Old plan only had per-request insertion. | Real **adaptive sliding-window batcher** (§4.1) with early-flush rules and a visible window timeline in the UI. |
| 2 | Problem says **"mobile interface"**. Old plan had only a dashboard. | Responsive **Rider view** (`/rider`) built as a mobile-first page in the same React app (§8). |
| 3 | Only OR-Tools. You said you want a **multi-algorithm approach** and like LOUD. | 5 pluggable dispatch strategies + an **Algorithm Arena** that benchmarks them on the same scenario (§4.3, §4.6). |
| 4 | Shapley cost function was vague ("distance × rate"). | Precise coalition value `v(S)` and a **Fairness Audit** (efficiency, symmetry, null player, individual rationality) (§5). |
| 5 | Problem says **"marginal detour contribution"**. | `v(S)` is the optimal route cost of S alone, so φᵢ is literally the average marginal route cost rider i adds. |
| 6 | Time windows and 15% detour mixed up. | Clear definitions: pickup window, ride-time cap = 1.15 × direct (§3). |
| 7 | Rejection = failure. | **Defer-then-reject** (rolling horizon): a request waits for later windows until its latest feasible time. Explainable reason codes. |
| 8 | No scalability or security story. | Spatial candidate filtering, bounded OR-Tools subproblems, zone sharding story (§7), security checklist (Ketan). |
| 9 | Mapbox/Leaflet "live route graphs". | Leaflet + animated vehicle movement + route diff (before/after). |

### Correction to be honest about LOUD
The uploaded PDF mentions LOUD only in passing. From the source paper (Buchhold, Sanders, Wagner — *Fast, Exact and Scalable Dynamic Ridesharing*, ALENEX 2021): LOUD = **L**ocal b**U**ckets **D**ispatching. It finds the **provably best insertion** of a new request into any vehicle route, using **bucket-based contraction hierarchies** on the road graph, and answers a request in under a millisecond on a 10,000-vehicle Berlin scenario. Follow-up: **KaRRi** (KIT) extends it to multiple pickup/dropoff locations.
**We do not implement contraction hierarchies in 24 hours.** We implement a **LOUD-inspired** dispatcher: same idea (per-stop spatial buckets → small candidate set → evaluate *all* insertion positions exactly → take the cheapest feasible one), running on an OSRM/fallback travel-time matrix. In the pitch say **"LOUD-inspired"**, never "we implemented LOUD". Judges who know the paper will respect that.

---

## 2. Cross-check: existing solutions, utilization, scalability, uniqueness

### 2.1 Existing solutions (verify current details before quoting them in the pitch)
| Category | Examples | What they do well | What is missing vs our problem |
|---|---|---|---|
| Commercial pooled rides | Uber/Lyft shared products, Via, Grab/Ola-style share | Real fleets, real-time matching | Closed. Fare discount logic is not published or game-theoretic. No transparency to riders or judges. |
| General solvers | Google OR-Tools, VROOM, jsprit, Timefold | Strong VRPTW | Solver only. No batching policy, no live dispatch UX, no fair fares. |
| Research algorithms | LOUD, KaRRi (KIT), insertion-based methods | Very fast, exact insertion | Papers/code. No dashboard, no pricing, needs CH infrastructure. |
| Simulators | NOMAD-RPS (NYU, non-commercial license — **do not copy code**) | Research simulation | Not an interactive product. License restricts reuse. |
| Cost-sharing theory | Shapley for ride sharing (e.g. Levinger et al., cited in your PDF) | Fairness proofs | Theory only; no working system tied to routing. |

**The gap we fill:** an *open, explainable, end-to-end* pipeline — **batch → multi-algorithm route → independent proof → Shapley fare** — that a judge can click through in 2 minutes.

### 2.2 Utilization (what we measure; all computed from the same scenario)
- Total vehicle km: pooled vs solo (no sharing).
- Average occupancy per moving km; empty (deadhead) km share.
- Served %, deferred %, rejected % (with reasons).
- Avg and max rider detour % (must be ≤ 15%), avg wait.
- Fare per rider: solo vs equal split vs Shapley.
- Optional CO₂ estimate = km saved × a **labelled assumption** emission factor. Show as "estimate".

### 2.3 Scalability (what we claim and how we back it)
| Concern | Design answer |
|---|---|
| Fleet size | Per-request candidate set = vehicles with a stop in nearby grid cells (LOUD-style buckets), not the whole fleet. |
| Solver blow-up | OR-Tools runs only on **small subproblems** (batch + ≤ 8 affected vehicles, ≤ 1.5 s time limit), warm-started from the fast solution. |
| Travel times | One matrix call per window, LRU cache, deterministic fallback. |
| City growth | Zone sharding: independent dispatcher per grid zone (story + benchmark, not built). |
| Evidence | `scripts/benchmark.py` runs 20/100/500 requests × 5/25/100 vehicles and the UI shows measured ms. **Only show numbers we measured.** |

### 2.4 Uniqueness (our edge vs the other 49 teams)
1. **Algorithm Arena** — run 5 strategies on one scenario, compare km, detour, served %, ms.
2. **Constraint proof badge** — every route re-checked by an independent validator; UI shows ✔ capacity / precedence / windows / detour ≤ 15%.
3. **Explainable decisions** — every accept / defer / reject has a reason code and a plain-English line.
4. **Fairness Audit** — Shapley vs equal split vs distance-proportional, with axiom checks live.
5. **Adaptive sliding window** — visible timeline; flushes early when a rider is about to expire.
6. **Deterministic replay** — seeded scenarios; the demo never depends on luck or the network.
7. **Local flavour** — Nashik scenario (CBS, Nashik Road, College Road, Gangapur Road, Satpur MIDC, Panchavati, Dwarka, Indira Nagar) + ₹ pricing.

---

## 3. Core definitions (everyone uses exactly these)
- Time unit: **seconds**. Distance: **meters**. Money: **₹**. Default rate: **₹12/km** (configurable).
- **Request:** `id, pickup, drop, request_time, seats (default 1), max_wait_s (default 480), detour_cap (default 0.15)`.
- **Direct time** `T_direct(i)` = shortest road time pickup→drop, unpooled.
- **Pickup window:** `[request_time, request_time + max_wait_s]`.
- **Ride-time cap (the 15% rule):** `drop_time(i) − pickup_time(i) ≤ (1 + detour_cap) × T_direct(i)`.
  Detour % = `(ride_time − T_direct) / T_direct × 100`. Wait time is reported separately.
- **Capacity:** onboard seats ≤ vehicle capacity at all times.
- **Precedence:** pickup before drop.
- **Commitment:** once accepted, a rider's constraints can never be violated by later re-optimization. A change is applied only if the validator passes on *all* riders of that vehicle.
- **Cost model:** route cost = `km × rate`. Deterministic. No surge, no ML.
- **Status lifecycle:** `PENDING → BATCHED → ASSIGNED → PICKED_UP → COMPLETED`, or `DEFERRED` (retry next window) → `REJECTED(reason)`.
- **Reason codes:** `NO_VEHICLE_NEARBY, CAPACITY_FULL, DETOUR_EXCEEDED, WINDOW_MISSED, WOULD_BREAK_COMMITMENT, SOLVER_TIMEOUT`.

---

## 4. Algorithm pipeline (the heart of the project)

```
requests ──► [4.1 Sliding-window batcher] ──► batch
                                   │
                    [4.2 Candidate filter (spatial buckets)]
                                   │
                    [4.3 Dispatch strategy (pluggable)]
                          C: LOUD-inspired best insertion
                          D: Batch matching (Hungarian on insertion costs)
                          E: OR-Tools VRPTW polish (warm-started)
                                   │
                    [4.4 Independent validator]  ← accept only if ✔
                                   │
                  accepted routes ──► [5 Shapley fares] ──► UI
                  failed/unfit   ──► DEFER or REJECT(reason)
```

### 4.1 Adaptive sliding-window batching (owner: Ketan)
- Window `W` (demo default **30 s sim-time**; realistic mode 120 s). Requests collect in the window.
- Flush the batch when **any** is true: (a) window timer expires; (b) batch size ≥ `N_max` (default 12); (c) **urgency flush** — some request's *latest safe dispatch time* (`pickup_deadline − best_case_ETA`) is within a margin.
- Why: bigger batch = better pooling; waiting = worse service. The urgency rule protects riders. The UI draws the window filling.
- Deferred requests re-enter the next window until their latest feasible time passes, then become `REJECTED`.

### 4.2 Candidate filtering — "local buckets" idea (owner: Spandan)
- Grid-index the **stops of all active routes** (cell ≈ 500 m).
- For a new pickup, collect vehicles that have a stop within the cell neighborhood reachable inside `max_wait_s`, plus idle vehicles within reach. Cap at K = 8 nearest.
- This is what keeps per-request work independent of fleet size.

### 4.3 Dispatch strategies (owner: Spandan) — all implement one interface
| Id | Name | Idea | Role |
|---|---|---|---|
| A | `solo` | One vehicle per rider, nearest idle | No-pooling baseline |
| B | `greedy_fcfs` | First-come, nearest feasible vehicle, append pickup+drop at end | Naive baseline |
| C | `loud_insertion` | For each request, try **all** (pickup pos, drop pos) insertions in candidate routes, O(1) feasibility via precomputed slack, take min added cost | Fast core |
| D | `batch_matching` | Build requests × vehicles matrix of best-insertion cost, solve with Hungarian (`scipy.optimize.linear_sum_assignment`), apply, repeat rounds | Batch-optimal assignment |
| E | `hybrid` (**default**) | D, then OR-Tools VRPTW pickup-delivery on affected vehicles, warm-started from D, time-limited. Keep the OR-Tools result only if validator ✔ **and** cost lower | Quality polish |

**Insertion feasibility (strategy C/D core).** For route stops `s0 (vehicle now), s1…sm`, precompute `arrival[k]`, `load[k]`, `slack[k]` = max delay stop k and everything after can absorb, and `ride_slack[k]` = min remaining ride-time slack among riders onboard across k. Inserting pickup after `i` and drop after `j ≥ i` adds delay `δ`. Feasible iff `δ ≤ slack[…]`, `load` stays ≤ capacity between i..j, the new rider's own ride-time ≤ cap, and `δ_between ≤ ride_slack`. Cost = added route time/distance. Always re-confirm with the independent validator before committing.

**OR-Tools model (strategy E).** Pickup-and-delivery with `RoutingModel`: transit callback = matrix seconds; `Time` dimension with pickup windows; `Capacity` dimension (demand +seats / −seats); for each rider `solver.Add(time[drop] − time[pickup] <= int(1.15 * T_direct))`, precedence constraint, `same_vehicle`. Disjunctions with high penalty so infeasible requests can be dropped (→ defer/reject) instead of failing the model. Search: `PATH_CHEAPEST_ARC` + `GUIDED_LOCAL_SEARCH`, `time_limit = 1.5 s`. Use `ReadAssignmentFromRoutes` to warm-start. Docs: https://developers.google.com/optimization/routing/pickup_delivery

### 4.4 Independent validator (owner: Ketan)
Pure function, **no import from optimizer code**. Input: route stops, requests, matrix. Checks: precedence, capacity at every stop, pickup windows, ride-time ≤ 1.15 × direct for **every** rider (including already onboard), no duplicate/missing stops. Output: `ValidationReport{ok, violations[], per_rider{detour_pct, wait_s}}`. If it says no, the plan is discarded. This is also the source of the UI proof badge.

### 4.5 Travel-time provider (owner: Spandan interface, Amod fallback)
- `MatrixProvider.table(points) -> {durations_s, distances_m}`.
- Primary: OSRM Table API (public demo server, cached to disk). Fallback: haversine × 1.35 circuity ÷ 25 km/h, deterministic. UI labels "Road data: OSRM / Offline model".
- **Pre-cache the whole demo scenario at hour 8.**

### 4.6 Algorithm Arena (owner: Spandan backend, Nakul UI)
`GET /api/arena/{scenario}` runs strategies A–E on the **same seeded scenario** and returns total km, avg/max detour, served %, avg occupancy, solve ms, fare total. UI shows a table + bar chart + "winner" per metric. This is the slide that proves the multi-algorithm approach.

---

## 5. Fair fare allocation (owner: Kaushik)

**Game:** players = riders sharing overlapping time in one vehicle (a *pool group*, ≤ 5; larger groups use sampling).
**Coalition value:** `v(S)` = minimum route cost (₹) to serve exactly the riders in S, over precedence-valid stop orderings (capacity respected), counted from the first pickup of S to the last drop of S. `v({i})` = rider i's solo trip cost. Deadhead to first pickup is a flat booking fee, not part of the game.
**Grand coalition:** `v(N)` = the cost actually executed for the group (so fares sum exactly to what the route cost).
**Shapley:** `φᵢ = Σ_{S⊆N∖{i}} |S|!(n−|S|−1)!/n! · [v(S∪{i}) − v(S)]` — each rider's average marginal route cost.
**Computation:** exact via bitmask DP for each subset (≤ 10 stops → fast). For n > 5: Monte-Carlo permutation sampling (2,000 permutations) with ± error shown.
**Baselines shown side by side:** solo fare, equal split, distance-proportional split, Shapley.
**Fairness Audit (live checks):**
- Efficiency: Σφᵢ = v(N) within ₹0.01.
- Symmetry: two identical riders get identical fares (test case).
- Null player: a rider adding zero marginal cost pays ≈ 0 extra.
- Individual rationality: φᵢ ≤ v({i}) — flag any rider who would pay more than riding alone.
- Caveat to say out loud: Shapley guarantees the axioms, not that every rider saves.

---

## 6. Data contract (frozen at hour 2 — Ketan owns `backend/app/models.py`)

```jsonc
// LatLon
{ "lat": 19.9975, "lon": 73.7898 }

// Request
{ "id": "R1", "pickup": LatLon, "drop": LatLon, "request_time": 120,
  "seats": 1, "max_wait_s": 480, "detour_cap": 0.15,
  "status": "ASSIGNED", "vehicle_id": "V2", "reason": null,
  "direct_time_s": 900, "direct_dist_m": 7200 }

// Vehicle
{ "id": "V1", "position": LatLon, "capacity": 4, "onboard": ["R1"],
  "route": RoutePlan | null }

// RoutePlan
{ "vehicle_id": "V1", "version": 7,
  "stops": [ { "seq": 0, "type": "PICKUP|DROP", "request_id": "R1", "point": LatLon,
               "eta_s": 180, "load_after": 1 } ],
  "total_dist_m": 15400, "total_time_s": 1800,
  "polyline": [[lat,lon], ...],
  "validation": { "ok": true, "violations": [], "per_rider": { "R1": { "detour_pct": 8.2, "wait_s": 90 } } } }

// DispatchResult
{ "strategy": "hybrid", "solve_ms": 412, "plans": [RoutePlan],
  "assigned": ["R1","R2"], "deferred": ["R5"], "rejected": [ { "id": "R6", "reason": "DETOUR_EXCEEDED", "explain": "Adding R6 would push R2 to 19% detour (cap 15%)." } ] }

// FareBreakdown
{ "group_id": "G1", "riders": ["R1","R2","R3"], "total_cost": 214.40,
  "solo": {"R1": 96.0}, "equal": {"R1": 71.47}, "proportional": {"R1": 80.1},
  "shapley": {"R1": 74.2}, "shapley_ci": null,
  "audit": { "efficiency": true, "symmetry": true, "null_player": true,
             "individual_rationality": { "ok": true, "violations": [] } } }

// Metrics
{ "pooled_km": 41.2, "solo_km": 63.8, "saved_pct": 35.4, "avg_occupancy": 2.1,
  "avg_detour_pct": 7.6, "max_detour_pct": 13.9, "served_pct": 83.3, "deadhead_pct": 18.0 }

// WindowState
{ "window_s": 30, "elapsed_s": 12, "pending": ["R4","R5"], "next_flush_reason": "TIMER|SIZE|URGENCY" }
```

### API (REST + 1 s polling; SSE is a stretch)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + road-data mode |
| POST | `/api/scenarios/{id}/load` | load seeded scenario, reset state |
| POST | `/api/sim/control` | `{action: start|pause|reset, speed: 1|10|60}` |
| POST | `/api/requests` | submit a new request (live demo button) |
| GET | `/api/state` | vehicles, requests, routes, window state, metrics |
| POST | `/api/dispatch/run` | `{strategy}` force-run a window now |
| GET | `/api/fares/{group_id}` | FareBreakdown |
| GET | `/api/arena/{scenario}` | run all strategies, return comparison |
| GET | `/api/diff/{request_id}` | before/after plan for the request that was just added |

---

## 7. Scope

**Must (hour 0–14):** map, vehicles, requests, sliding-window batcher, strategies A–E working, validator, Shapley + baselines, live "add request", before/after panel, rider mobile view, fixtures + fallback matrix.
**Should (14–18):** Algorithm Arena UI, Fairness Audit panel, reason-code explanations, animated vehicles, benchmark script, security checklist.
**Stretch (only if all gates green):** SSE live updates, CO₂ estimate, zone-sharding diagram, Monte-Carlo CI display, PWA install.
**Out:** payments, accounts, real GPS, ML demand prediction, contraction hierarchies, microservices, Redis.

---

## 8. UI spec (owner: Nakul) — dark, clean, "control-room" look
- **Dispatch dashboard (`/`)**: full-screen Leaflet map (dark tiles). Left: request queue + window timeline. Right: metrics cards, validator badge, fare panel. Bottom: Arena table (collapsible).
- **Rider view (`/rider`)**: mobile-first. Pick pickup/drop on map → "Request ride" → shows assigned vehicle, ETA, detour %, fare (Shapley vs equal split).
- **Required interactions:** Add-request button + click-to-place; Before/After toggle; speed 1×/10×/60×; strategy dropdown; Arena run button.
- **Animation level: light.** Framer Motion for panels/cards, CSS for pulses, marker interpolation for vehicles. No Three.js/GSAP.
- **Look:** Tailwind, one accent color, rounded cards, few icons, no AI-clichés (no purple gradients, no robot icons).

## 9. Tech stack (final)
Frontend: React + Vite + Tailwind + Leaflet + Framer Motion + Recharts.
Backend: Python 3.11, FastAPI, Pydantic v2, OR-Tools, NumPy, SciPy, SQLite (state snapshot), httpx (OSRM).
Tests: pytest + hypothesis (property tests for validator/Shapley). CI: GitHub Actions. No Docker required.

## 10. Folder structure (create this first)
```
poolIQ/                      (on Desktop)
 ├── frontend/
 │    ├── components/        (MapView, RequestQueue, WindowTimeline, FarePanel, ArenaTable, MetricsCards, ProofBadge)
 │    ├── pages/             (Dashboard, Rider)
 │    ├── utils/             (api client, formatters, geo helpers)
 │
 ├── animations/             (marker-interpolation, framer variants)
 │
 ├── backend/
 │    ├── app/               (main.py, api routes, models.py, security, persistence)      ← Ketan
 │    ├── engine/
 │    │    ├── batching/     (sliding_window.py)                                          ← Ketan
 │    │    ├── validator/    (validator.py)                                               ← Ketan
 │    │    ├── routing/      (matrix_provider.py, osrm.py, spatial_index.py)              ← Spandan
 │    │    ├── dispatch/     (solo, greedy, loud_insertion, batch_matching, hybrid)       ← Spandan
 │    │    ├── optimizer/    (ortools_vrptw.py)                                           ← Spandan
 │    │    ├── pricing/      (shapley.py, baselines.py, audit.py)                         ← Kaushik
 │    │    ├── metrics/      (metrics.py)                                                 ← Kaushik
 │    │    └── sim/          (clock.py, vehicle_motion.py, scenario_gen.py)               ← Amod
 │    ├── data/              (scenarios/, cache/)                                         ← Amod
 │    └── tests/                                                                          ← all, Amod owns CI
 │
 ├── scripts/                (benchmark.py, precache_matrix.py)                           ← Amod
 ├── public/
 │    └── assets/
 ├── docs/                   (00_MAIN_PRD.md, person PRDs, pitch, architecture.png)
 ├── progress.md
 └── activeContext.md
```
**progress.md** and **activeContext.md** are created by Antigravity (never hand-written): progress.md = Completed / In Progress / Pending / Next Steps (one heading per person). activeContext.md = current prompt, tech decisions, folder structure, features, future scope. Update progress.md after every step; update activeContext.md when a decision changes.

## 11. Demo script (2 minutes — Kaushik delivers, Nakul drives)
1. **0:00 Problem (15 s):** "Overlapping commutes, congestion, unfair splits." Show map with 5 requests, 3 vehicles, solo routes: total km.
2. **0:15 Batch (25 s):** Window timeline fills, flushes. Hybrid dispatch runs. Routes redraw, vehicles pool riders. Show saved km %, occupancy.
3. **0:40 Proof (20 s):** Click a route → ProofBadge: capacity ✔ precedence ✔ windows ✔ max detour 13.9% ≤ 15% ✔.
4. **1:00 Fair fare (25 s):** Equal split vs Shapley bars. "Rider 3 caused the longest detour so pays more; Rider 1 on the main corridor pays less." Audit ticks.
5. **1:25 Arena (15 s):** Table: solo vs greedy vs LOUD-inspired vs batch vs hybrid.
6. **1:40 Stress (20 s):** Add an impossible rider. Reason shown: "Would push R2 to 19% (cap 15%)". Existing riders untouched. Rider mobile view on phone.
**Fallback:** pre-recorded 90 s screen capture + screenshots (Amod).

## 12. Acceptance tests (must pass before freeze)
- [ ] Pickup precedes drop for every accepted rider.
- [ ] Capacity never exceeded.
- [ ] Every accepted rider ≤ 15% detour (validator, all strategies E, D, C).
- [ ] Pickup windows respected.
- [ ] Infeasible request → DEFERRED then REJECTED with reason; existing plans unchanged (version number of other routes does not change).
- [ ] Fare conservation: Σ shapley = group cost (±₹0.01).
- [ ] Symmetric toy game → equal fares. Null player → zero extra.
- [ ] Same seed → identical results (deterministic).
- [ ] Hybrid cost ≤ greedy cost on the demo scenario (or we show honestly when it is not).
- [ ] OSRM blocked → app still runs on fallback matrix, banner shows "Offline model".
- [ ] Fresh clone → `make setup && make run` works in under 5 minutes (Amod).
- [ ] Optimizer timeout (1.5 s) never freezes the API.

## 13. 24-hour timeline and gates
| Hours | Everyone | Gate |
|---|---|---|
| 0–2 | Repo, folders, models.py frozen, `/api/state` mock, fixtures | Everyone runs project; contract signed (Ketan, Amod, Nakul) |
| 2–6 | **Parallel:** Spandan matrix + insertion; Ketan API + validator; Kaushik Shapley on toy costs; Nakul map + mock data; Amod sim clock + scenario + CI | Each module passes its own tests alone |
| 6–10 | **Integration 1:** batcher → dispatch C → validator → API → UI | 5 requests produce routes + fares in browser |
| 10–14 | Strategies D+E, urgency flush, defer/reject reasons, live add-request | New request updates plan without breaking commitments |
| 14–18 | Arena, Fairness Audit, before/after diff, animation, benchmark, security pass | Judge understands value without reading code |
| 18–21 | **Feature freeze.** Edge cases, precache, bug bash, recorded fallback video | Demo repeatable 3× in a row |
| 21–24 | Deck, rehearsal ×3, README, final tag, submission | Clean clone runs; everyone can explain their part |

**Rules:** (1) Nothing merges to `main` without passing `pytest`. (2) Small PRs, branch per person: `feat/<name>-<topic>`. (3) Amod is merge-gatekeeper and tags `demo-stable` at hours 10, 14, 18, 21. (4) If a task is >2 h late, call it in chat, cut scope, don't stay silent.

## 14. Risks
| Risk | Response |
|---|---|
| OR-Tools model stuck | Ship C+D (hybrid falls back to D). Arena shows 4 strategies. |
| OSRM down | Fallback matrix + pre-cached matrix. |
| Shapley mismatches executed cost | `v(N)` = executed cost; show delta as a metric. |
| Frontend behind | Metric cards + static route lines first, animation last. |
| Integration chaos | Contract frozen at hour 2, mock endpoints, daily-style merges every 2 h. |
| Judge asks "is this real LOUD?" | Answer honestly: LOUD-inspired local-bucket insertion on a matrix; real LOUD uses bucket CH; here is why that is future work. |
| Overclaiming savings | Only measured numbers on the same seeded scenario. |

## 15. Judge Q&A cheat sheet
- *Why not just OR-Tools?* Solver alone can't do batching policy, commitments, or proofs; we use it as the polish stage and measure it against faster methods.
- *Is it optimal?* Insertion is exact per request, batch matching is optimal per round, VRPTW is NP-hard so hybrid is a high-quality heuristic, and we show measured gaps.
- *Why Shapley?* Unique allocation satisfying efficiency, symmetry, null-player, additivity; ties fare to marginal detour cost.
- *Does everyone save?* Not guaranteed; we audit individual rationality and flag it.
- *Scale?* Candidate filtering is fleet-independent per request; OR-Tools only on small subproblems; benchmark measured; zone sharding next.
- *Security?* Validation, rate limits, solver timeouts, no PII (Ketan's checklist).

## 16. References
- Buchhold, Sanders, Wagner — *Fast, Exact and Scalable Dynamic Ridesharing* (ALENEX 2021), arXiv:2011.02601
- KaRRi — *Fast Many-to-Many Routing for Ridesharing with Multiple Pickup and Dropoff Locations* (KIT)
- OR-Tools routing + pickup/delivery: https://developers.google.com/optimization/routing
- OSRM docs: https://project-osrm.org/docs/
- Leaflet: https://leafletjs.com/
- NOMAD-RPS (idea source only, non-commercial license): https://github.com/nyu-dss/nomad-rps
- Your uploaded PDF: *Algorithmic Transit Ride-Pooling: Optimization and Fair Cost Sharing*
