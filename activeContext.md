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

