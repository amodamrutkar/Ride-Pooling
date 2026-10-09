# PoolIQ — Project Progress

## Amod (Simulation, Routing & Engine Tooling)

### Completed
- [x] Initialized complete project folder structure according to PRD & AMoD specifications:
  - `frontend/` (`components/`, `pages/`, `utils/mock/state.json`)
  - `animations/`
  - `backend/` (`app/`, `engine/{sim,routing,dispatch,optimizer,validator,batching,pricing,metrics}`, `data/{scenarios,cache}`, `tests/`)
  - `scripts/` (`benchmark.py`, `generate_stress.py`, `precache_matrix.py`)
  - `public/assets/`
  - `docs/` (`00_MAIN_PRD.md`, `amod.md`)
- [x] Development tooling:
  - `.gitignore` (Python, Node/Vite, cache, logs, virtual environments)
  - `Makefile` (`setup`, `run`, `test`, `bench`, `lint`, `clean`)
  - GitHub Actions CI (`.github/workflows/ci.yml`) with Python 3.11 test matrix & frontend build stub
  - Project `README.md` with system overview, architecture, quickstart, team assignments
  - `backend/requirements.txt` with FastAPI, Uvicorn, Pydantic v2, Shapely, PyYAML, Pytest, Requests
- [x] Core Simulation Engine (`backend/engine/sim/`):
  - `SimulationClock`: Discrete event/tick clock supporting 1s / 5s / dynamic step intervals, pause/resume, and speed multiplier (1x-10x)
  - `VehicleMotionModel`: Haversine-based constant-speed interpolation (25 km/h) with ETA calculations and waypoint progression
  - `ScenarioGenerator`: Seeded deterministic scenario generation with realistic Nashik hubs and request distributions
- [x] Matrix & Routing Provider (`backend/engine/routing/`):
  - `MatrixProvider` interface (`get_matrix`, `get_eta`)
  - `FallbackMatrixProvider`: Deterministic Haversine distance with Nashik urban circuity factor (1.35) and 25 km/h urban speed
- [x] Test Suite (`backend/tests/`):
  - `test_clock.py`: Validates tick progression, speed multiplier, pause/resume
  - `test_vehicle_motion.py`: Validates movement interpolation, ETA calculations, waypoint arrival
  - `test_fallback_provider.py`: Validates triangular inequality, symmetry, coordinate handling
  - `test_scenario_gen.py`: Validates seed repeatability, hub adherence, pickup-dropoff windows
- [x] Pre-configured Scenarios (`backend/data/scenarios/`):
  - `demo_5r_3v.json`: 5 requests, 3 vehicles (PRD demo flow)
  - `edge_capacity.json`: Capacity stress scenario (PRD §11)
  - `edge_onboard_commitment.json`: Onboard commitment constraint test (PRD §11)
  - `edge_tight_window.json`: Window violation rejection test (PRD §11)
  - `stress_25r_100v.json`: Stress test scenario (seed 42)
  - `stress_500r_100v.json`: High load stress scenario (seed 42)
- [x] Scripts (`scripts/`):
  - `benchmark.py`: Benchmarking scenario generation & fallback matrix performance
  - `generate_stress.py`: Generating deterministic stress scenarios
  - `precache_matrix.py`: OSRM matrix pre-caching with fallback support
- [x] Mock Data for Frontend:
  - `frontend/utils/mock/state.json`: Realistic live simulation state matching PRD §6 API contracts for frontend dev

### Completed Integrations
- [x] **Route Validator & Hard Constraints** (`backend/engine/validator/`): Pluggable `validate_route_plan` protocol with zero-dependency constraint evaluation.
- [x] **Multi-Strategy Dispatchers** (`backend/engine/dispatch/`): Wire-up of Strategies A-E (Solo, Greedy FCFS, Loud Insertion, Batch Matching, Hybrid) inside `World._execute_dispatch_pipeline` and live `/api/arena/{scenario_id}`.
- [x] **Fair Pricing Engine** (`backend/engine/pricing/`): Connected exact bitmask DP and Monte-Carlo Shapley cost allocator with fairness axioms in `World._update_fares()`.
- [x] **Operational Metrics Engine** (`backend/engine/metrics/`): Integrated aggregate KPIs in `World._recompute_metrics()`.
- [x] **Vehicle Kinematics & Stop Events** (`backend/engine/sim/vehicle_motion.py`): Integrated into `World.tick()`.
- [x] **Full Test Suite & E2E Verification**: 98/98 tests passing with zero failures.

### Pending
- [ ] Integration of Frontend React UI & MapLibre Dashboard (`frontend/` - Nakul).

## Spandan (Optimization Core Lead)

### Completed
- [x] `OsrmProvider` (`backend/engine/routing/osrm.py`): OSRM Table API client with local JSON disk cache and automatic fallback to `FallbackMatrixProvider`.
- [x] `SpatialIndex` (`backend/engine/routing/spatial_index.py`): Grid-based (~500m cell) spatial index for candidate vehicle filtering (`candidates(pickup, k=8)`).
- [x] `Dispatcher` protocol & `DispatchCtx` (`backend/engine/dispatch/__init__.py`): Interface freeze and context injection container. Supports injected `validator` callable.
- [x] Strategy A `solo` (`backend/engine/dispatch/solo.py`): Nearest idle vehicle per rider (no-pooling baseline).
- [x] Strategy B `greedy_fcfs` (`backend/engine/dispatch/greedy_fcfs.py`): Nearest feasible vehicle append at route end.
- [x] Strategy C `loud_insertion` (`backend/engine/dispatch/loud_insertion.py`): LOUD-inspired exact best insertion over candidate vehicles with O(1) slack array lookups.
- [x] Strategy D `batch_matching` (`backend/engine/dispatch/batch_matching.py`): Hungarian algorithm (`scipy.optimize.linear_sum_assignment`) over insertion cost matrix.
- [x] Strategy E `hybrid` (`backend/engine/dispatch/hybrid.py`): Strategy D + OR-Tools VRPTW polish stage (`backend/engine/optimizer/ortools_vrptw.py`).
- [x] Arena Benchmark Runner (`scripts/run_arena.py`): Runs strategies A–E on seeded scenarios and outputs solve time, served %, total km, and rejections.
- [x] Test Suite (`backend/tests/`):
  - `test_spatial_index.py`: Grid cell indexing and candidate filtering.
  - `test_osrm.py`: Disk cache hit/miss and offline fallback handling.
  - `test_dispatch.py`: Full strategy test suite (A–E), determinism checks, rejection reason codes, and validator integration stub.

### Integration Note for Ketan
- A lightweight `stub_validator` is currently used in `backend/tests/test_dispatch.py` to test dispatch logic independently.
- When Ketan's validator module (`backend/engine/validator/validator.py`) is complete, pass `validate_route_plan` into `DispatchCtx.validator`. Strategy modules consume `ctx.validator` as a callable protocol and do NOT require code changes.

### Next Steps
1. Teammates clone repository and install dependencies (`make setup`).
2. Run baseline unit tests (`make test`).
3. Plug in respective submodules into the established contracts.

## Ketan (Backend Platform, Batcher, Validator & Security Lead)

### Completed
- [x] **Data Contracts & Models (`backend/app/models.py`)**:
  - Validated Pydantic v2 data models per PRD §6.
  - Exported OpenAPI specification to `docs/openapi.json`.
- [x] **Independent Route Validator (`backend/engine/validator/validator.py`)**:
  - Pure function with zero dependencies on optimizer or dispatcher.
  - Enforces precedence, cumulative capacity, pickup time windows, the 15% detour cap, and travel feasibility.
  - Computes per-rider detour % and wait seconds for UI proof badge.
  - Complete test suite (`backend/tests/test_validator.py`, 9 tests passing).
- [x] **Sliding-Window Batcher (`backend/engine/batching/sliding_window.py`)**:
  - Dynamic request batching over sliding window (default 30s).
  - Multi-trigger flush policies: `TIMER`, `SIZE` (N_max=12), and `URGENCY` (pickup deadline proximity).
  - Defer-then-reject rolling horizon logic with `WINDOW_MISSED` reason codes.
  - Unit test suite (`backend/tests/test_batcher.py`, 5 tests passing).
- [x] **World Orchestrator (`backend/app/world.py`)**:
  - Simulation loop coordination: batching → dispatch → independent validator → plan commit → fare calculation → metrics update.
  - Route version tracking; guarantees existing vehicle route plans remain untouched if a candidate dispatch plan fails validation.
  - Before/after route plan diff capture for `GET /api/diff/{request_id}`.
  - High-performance cached state snapshot for `<20ms` latency on `GET /api/state`.
- [x] **FastAPI Platform Routes (`backend/app/routes.py`, `backend/app/main.py`)**:
  - Implemented all PRD §6 endpoints: `/api/health`, `/api/scenarios/{id}/load`, `/api/sim/control`, `/api/requests`, `/api/state`, `/api/dispatch/run`, `/api/fares/{group_id}`, `/api/diff/{request_id}`, `/api/arena/{scenario}`.
  - CORS allowlist for Vite/React frontend.
  - Global sanitized exception handling preventing internal stack trace leaks.
- [x] **SQLite State Snapshotting (`backend/app/persistence.py`)**:
  - Automatic snapshot storage on every window flush and control operation.
- [x] **Security Hardening & Documentation (`backend/app/security.py`, `docs/security.md`)**:
  - Nashik geographical bounding box enforcement [19.8-20.2 lat, 73.6-74.0 lon].
  - Rate limiting on request submissions.
  - Bearer token authentication on administrative routes (`/scenarios/*/load`, `/sim/control`).
  - Defense-in-depth HTTP security headers middleware.
  - One-page threat model and security architecture checklist in `docs/security.md`.
- [x] **Integration & API Test Suite (`backend/tests/test_api_and_world.py`)**:
  - 8 tests passing verifying all endpoints, auth protection, rate limiting, and diff tracking.

### Completed Integrations
- [x] Paired with Spandan's multi-algorithm dispatcher: Strategies A-E integrated into `World._execute_dispatch_pipeline` and `/api/arena/{scenario_id}`.
- [x] Connected Kaushik's Shapley cost allocator (`backend/engine/pricing/shapley.py`) into `World._update_fares()`.
- [x] Connected Kaushik's aggregate metrics engine (`backend/engine/metrics/metrics.py`) into `World._recompute_metrics()`.
- [x] Connected Amod's vehicle kinematics (`backend/engine/sim/vehicle_motion.py`) into `World.tick()`.
- [x] **Full-Stack Frontend Integration (Nakul & Team)**:
  - Pulled and integrated Nakul's React + Vite + Leaflet frontend into the live environment.
  - Aligned data contracts for `POST /api/requests`, `GET /api/diff/{id}`, and `GET /api/arena/{scenario_id}`.
  - Connected live polling to `/api/state` (<20ms snapshot) and `/api/health`.
  - Authenticated simulation speed/pause controls seamlessly with admin bearer token.
  - Verified live in browser:
    - Control room dashboard (`/`) with dark Leaflet map, live vehicles (V1, V2, V3), metrics cards, sliding window panel, request queue, constraint proof badges, and Shapley fare breakdowns.
    - Algorithm Arena comparing all 5 dispatch strategies on identical Nashik traffic.
    - Rider mobile interface (`/rider`) with Nashik corridor booking, location selection, and instant fair fare discounts.

### Next Steps
1. Rehearse driving the demo presentation using `demo_5r_3v.json` according to PRD §11.
2. Final review for hackathon submission.
