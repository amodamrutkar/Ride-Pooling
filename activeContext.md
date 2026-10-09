# PoolIQ — Active Context

## Amod (Simulation, Routing & Repository Baseline)

### Current Prompt / Objective
Set up the complete repository structure, tooling, simulation layer, scenario generator, routing fallbacks, mock data, and test suite for the PoolIQ Autonomous Mobility on Demand (AMoD) dynamic ride-pooling system. Enable teammates (Parth, Nakul, Amod) to immediately begin parallel feature development upon cloning.

### Tech Decisions & Architecture
- **Language & Runtime:** Python 3.11+
- **Type Safety & Data Models:** Pydantic v2 (models in `backend/app/models.py`)
- **Simulation Clock:** Discrete event tick clock with speed multipliers (1x–10x), tick step configurable (1s / 5s), state-safe pause/resume.
- **Routing & Distance:**
  - Pluggable `MatrixProvider` interface (`get_matrix`, `get_eta`)
  - `FallbackMatrixProvider`: Deterministic Haversine distance with Nashik urban circuity factor (1.35) and 25 km/h urban speed. Zero external dependencies required during local dev or CI.
  - OSRM client support with pre-caching mechanism (`scripts/precache_matrix.py`).
- **Vehicle Kinematics:** Linear coordinate interpolation along assigned waypoints with speed constant at 25 km/h.
- **Frontend Contract:** Pre-generated `mock/state.json` matching PRD §6 `/state` schema so frontend dashboard work is completely unblocked.
- **Build & CI System:** Standard `Makefile` covering setup, test, bench, and clean, backed by GitHub Actions CI workflow.

### Folder Structure
```
poolIQ/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── LICENSE
├── Makefile
├── README.md
├── activeContext.md
├── progress.md
├── animations/
│   └── .gitkeep
├── docs/
│   ├── 00_MAIN_PRD.md
│   └── amod.md
├── frontend/
│   ├── components/
│   │   └── .gitkeep
│   ├── pages/
│   │   └── .gitkeep
│   └── utils/
│       └── mock/
│           └── state.json
├── public/
│   └── assets/
│       └── .gitkeep
├── scripts/
│   ├── benchmark.py
│   ├── generate_stress.py
│   └── precache_matrix.py
└── backend/
    ├── requirements.txt
    ├── app/
    │   ├── __init__.py
    │   ├── main.py
    │   └── models.py
    ├── data/
    │   ├── cache/
    │   │   └── .gitkeep
    │   ├── hubs.json
    │   └── scenarios/
    │       ├── demo_5r_3v.json
    │       ├── edge_capacity.json
    │       ├── edge_onboard_commitment.json
    │       ├── edge_tight_window.json
    │       ├── stress_25r_100v.json
    │       └── stress_500r_100v.json
    ├── engine/
    │   ├── __init__.py
    │   ├── batching/
    │   │   └── __init__.py
    │   ├── dispatch/
    │   │   └── __init__.py
    │   ├── metrics/
    │   │   └── __init__.py
    │   ├── optimizer/
    │   │   └── __init__.py
    │   ├── pricing/
    │   │   └── __init__.py
    │   ├── routing/
    │   │   ├── __init__.py
    │   │   ├── fallback_provider.py
    │   │   └── matrix_provider.py
    │   ├── sim/
    │   │   ├── __init__.py
    │   │   ├── clock.py
    │   │   ├── motion.py
    │   │   └── scenario_generator.py
    │   └── validator/
    │       └── __init__.py
    └── tests/
        ├── __init__.py
        ├── conftest.py
        ├── test_clock.py
        ├── test_fallback_provider.py
        ├── test_scenario_gen.py
        └── test_vehicle_motion.py
```

### Features Implemented
1. **Simulation Core:**
   - Deterministic event loop & clock (`SimulationClock`)
   - Vehicle position & motion tracking (`VehicleMotionModel`)
   - Configurable scenario generator (`ScenarioGenerator`) with Nashik hub coordinates (`backend/data/hubs.json`)
2. **Matrix Engine:**
   - Fallback Haversine matrix provider with Nashik road circuity calibration
   - Matrix caching and OSRM table pre-caching utility
3. **Data Scenarios:**
   - Demo scenario (5 requests, 3 vehicles)
   - PRD edge cases: capacity constraint, onboard commitment violation, tight time-window expiration
   - Stress benchmark scenarios (25r/100v and 500r/100v)
4. **Mock State:**
   - Complete `/state` JSON mock payload for frontend development
5. **Quality Assurance:**
   - Comprehensive pytest suite covering simulation clock, vehicle kinematics, fallback matrix calculations, and scenario generation

### Future Scope (Next Phases)
- **Batching & Rebalancing (Ketan):** Request batching window (30s) and adaptive flush policy.
- **Hard Constraint Validator (Ketan):** Capacity limits, max detour (1.15x direct), time window compliance, onboard sequence guarantees.
- **Dynamic Pricing & Shapley (Kaushik):** Shapley cost allocation, baselines, and live fairness audit.
- **Live Metrics (Kaushik):** Pooling efficiency, detour ratio, SLA compliance, vehicle utilization.
- **React Frontend (Nakul):** MapLibre GL map, vehicle markers, rider route polylines, operator control panel.

---

## Spandan (Optimization Core Lead)

### Current Prompt / Objective
Build the multi-algorithm optimization engine core for PoolIQ: OSRM matrix provider with local JSON disk cache and automatic offline fallback, grid-based spatial index for candidate vehicle filtering, 5 pluggable dispatch strategies (`solo`, `greedy_fcfs`, `loud_insertion`, `batch_matching`, `hybrid`), OR-Tools VRPTW solver polish stage, and the Algorithm Arena runner.

### Tech Decisions & Architecture
- **Dispatch Protocol & Context (`backend/engine/dispatch/__init__.py`):**
  - `Dispatcher` protocol defining standard `dispatch(batch, fleet, ctx) -> DispatchResult`.
  - `DispatchCtx` container injecting `matrix`, `now_s`, parameters (`detour_cap=0.15`, `max_wait_s=480s`), and optional `validator` callable.
- **Routing & Matrix Cache (`backend/engine/routing/osrm.py`):**
  - `OsrmProvider` querying OSRM Table API, caching queries on disk as JSON (`backend/data/cache/`), with 2s timeout and automatic fallback to `FallbackMatrixProvider`.
- **Spatial Index (`backend/engine/routing/spatial_index.py`):**
  - Grid cell size `0.0045°` (~500m). Indexes stops of active vehicle routes. `candidates(pickup, k=8)` returns top K vehicles with nearby stops or idle status.
- **5 Dispatch Strategies (`backend/engine/dispatch/`):**
  1. `solo.py`: 1 vehicle per rider (no pooling baseline).
  2. `greedy_fcfs.py`: Nearest feasible vehicle append at route end.
  3. `loud_insertion.py`: LOUD-inspired exact best insertion evaluating all (i, j) stop pairs with O(1) slack array lookups.
  4. `batch_matching.py`: Matrix of request x vehicle insertion costs solved via `scipy.optimize.linear_sum_assignment` (Hungarian algorithm).
  5. `hybrid.py`: Strategy D + OR-Tools VRPTW solver polish stage (`backend/engine/optimizer/ortools_vrptw.py`) with 1.5s time limit and warm-starting.
- **Algorithm Arena (`scripts/run_arena.py`):**
  - Benchmarks strategies A–E on identical seeded scenarios.
- **Integration Harness & Test Suite (`backend/tests/test_dispatch.py`):**
  - Uses `stub_validator` for testing in isolation until Ketan's validator (`backend/engine/validator/validator.py`) is complete.
  - When ready, Ketan's `validate_route_plan` is passed into `DispatchCtx.validator` without modifying dispatch code.

## Ketan (Backend Platform, Batcher, Validator & Security Lead)

### Current Objective
Deliver the platform spine of PoolIQ: independent zero-trust constraint validator, adaptive sliding-window batcher, FastAPI endpoints per PRD §6, World state orchestrator with before/after route diffs, SQLite snapshots, and defense-in-depth security hardening.

### Tech Decisions & Architecture
- **Independent Validator (`backend/engine/validator/validator.py`):** Pure functional validator completely decoupled from routing/dispatch/optimization libraries. Enforces precedence, vehicle capacity at every stop, pickup arrival windows, and the strict 15% maximum detour rule. Computes per-rider detour % and wait times.
- **Sliding-Window Batcher (`backend/engine/batching/sliding_window.py`):** Injected-clock state machine supporting TIMER (30s), SIZE (12 requests), and URGENCY flushes (pickup deadline proximity). Includes defer-then-reject rolling horizon logic.
- **World Orchestrator (`backend/app/world.py`):** Single point of state coordination. Routes are only committed to vehicles if the independent validator passes; if invalid, route versions stay frozen and violating requests are deferred or rejected with clear reason codes.
- **FastAPI REST Spine (`backend/app/routes.py`, `backend/app/main.py`):**
  - High speed `/api/state` endpoint (<20ms response time via in-memory pre-serialized state cache).
  - Admin endpoints (`/api/scenarios/*/load`, `/api/sim/control`) protected via Bearer token.
  - Geo-fenced input schema bounded to Nashik coordinates [19.8-20.2 lat, 73.6-74.0 lon].
  - Security headers middleware and rate limiting.
  - Diff tracking via `/api/diff/{request_id}`.
- **OpenAPI Documentation:** Auto-exported to `docs/openapi.json`.
- **Security Documentation:** `docs/security.md` containing threat model matrix and operational guidance.

## System Integration (Full Stack Backend)

### Integrated Architecture
- **World Orchestrator Pipeline (`backend/app/world.py`):**
  - **Multi-strategy Dispatch:** Injects `DispatchCtx` with real `validate_route_plan` and invokes Strategies A–E (Solo, Greedy FCFS, Loud Insertion, Batch Matching, Hybrid).
  - **Dynamic Kinematics:** Simulation ticks advance vehicle motion along polylines using Haversine interpolation at 25 km/h and fire pickup/drop stop events.
  - **Fair Shapley Allocations:** Computes exact bitmask DP and Monte-Carlo Shapley allocations with 4 fairness axioms in `World._update_fares()`.
  - **KPI Metrics Engine:** Computes pooled vs solo km, saved km %, average occupancy, and detour % in `World._recompute_metrics()`.
  - **Algorithm Arena (`/api/arena/{scenario_id}`):** Live benchmark runner executing all 5 dispatch strategies side-by-side.
- **Verification:** 98/98 tests passing across unit, property, and end-to-end integration test suites.

## Nakul (Frontend & Visual Experience) & Full-Stack Integration

### Integrated Components & Architecture
- **Tech Stack:** React 19 + Vite 8 + TailwindCSS + Leaflet / React-Leaflet + Framer Motion + Recharts.
- **Routes & Views:**
  - `/`: Mission Control Room Dashboard (dark map, live vehicle markers, sliding-window batcher timeline, KPI cards, constraint proof badge, game-theoretic fair fare allocation panel, Algorithm Arena).
  - `/rider`: Rider Mobile Interface (Nashik Urban Corridor transit booking, live origin/destination selector, interactive pickup/drop map pins, dynamic Shapley fare discount estimation).
- **Backend Communication:**
  - Live polling `/api/state` every 1000ms with visibility change pause/resume.
  - Interactive ride submission via `POST /api/requests` with immediate coordinate mapping.
  - Dynamic route diff visualization via `/api/diff/{id}` showing dashed grey baseline vs solid teal pooled route.
  - Multi-strategy benchmark comparison via `/api/arena/{scenario}`.
  - Authenticated simulation speed & clock controls via `/api/sim/control`.
- **Status:** Fully integrated and verified live with FastAPI backend and Vite frontend running concurrently.

