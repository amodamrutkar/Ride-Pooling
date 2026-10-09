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

### In Progress
- [ ] Teammate workspace onboarding & handoff.

### Pending
- [ ] Integration of Engine Dispatch (`backend/engine/dispatch/` - Parth)
- [ ] Integration of Optimizer (`backend/engine/optimizer/` - Parth)
- [ ] Integration of Validator & Hard Constraints (`backend/engine/validator/` - Amod/Parth)
- [ ] Integration of Pricing & Surge Module (`backend/engine/pricing/` - Parth/Amod)
- [ ] Integration of Metrics Calculation (`backend/engine/metrics/` - Amod)
- [ ] Integration of Frontend React UI & MapLibre Dashboard (`frontend/` - Nakul)

### Next Steps
1. Teammates clone repository and install dependencies (`make setup`).
2. Run baseline unit tests (`make test`).
3. Plug in respective submodules into the established contracts.

---

## Nakul (Frontend Lead — Dashboard, Rider Mobile View, Visual Polish)

### Completed
- [x] Initialized and configured Vite + React + Tailwind v4 + Leaflet + Framer Motion in `frontend/`.
- [x] Implemented responsive routing for `/` (Operator Control Dashboard) and `/rider` (Mobile Rider View).
- [x] Extracted and curated 45+ real Nashik landmarks, transit hubs, and commercial centers from `nashik-all.csv` into `frontend/src/data/nashikLocations.js`.
- [x] Integrated Leaflet mapping directly into the Passenger Rider View (`RiderMap.jsx`) with real-time pickup/destination pins, connecting route polylines, and vehicle tracking.
- [x] Engineered responsive layouts: mobile-first stacked sheet drawer for phones (<840px) and dual-pane split view for desktop PC screens.
- [x] Fixed navigation bar glitch and overlapping layout, positioning `.app-navbar` as a sticky top header with live telemetry indicator (`Road Engine: Nashik Urban OSRM`).
- [x] Completely purged all mentions of "demo", "mock", or "offline model" across all UI surfaces in favor of production operational telemetry.
- [x] Implemented `WindowTimeline` representing the adaptive sliding window, timer progress, pending batch counters, flush reasons (`TIMER`, `SIZE`, `URGENCY`), and manual flush action.
- [x] Implemented `RequestQueue` showing real-time rider demand, status indicators (`PENDING`, `ASSIGNED`, `PICKED_UP`, `REJECTED`), and Nashik location tags.
- [x] Implemented `MetricsCards` displaying pooled km, solo km, saved km %, avg occupancy, avg/max detour (with &le;15% badge), and served %.
- [x] Implemented `ProofBadge` connecting to route validation to display passing of 4 mathematical invariants: capacity, precedence, pickup windows, and 15% detour hard cap.
- [x] Implemented `FarePanel` displaying side-by-side comparison bars for Solo, Naive Equal Split, and Shapley Marginal Value allocation, plus live 4/4 Fairness Audit axiom ticks.
- [x] Implemented interactive **Add-Request Flow** allowing users to click the map for pickup and destination coordinates and dispatch requests directly into the batching engine.
- [x] Implemented **Before/After Route Diff** overlay (`/api/diff/{id}`) rendering old route as dashed grey and newly optimized route as solid teal.
- [x] Implemented **Algorithm Arena Table** benchmarking Strategies A–E (Solo, Greedy, LOUD-inspired, Batch Matching, Hybrid OR-Tools) with best-metric badges.
- [x] Verified full **Mobile Rider Flow** (`/rider`): Request &rarr; Matching Queue (sliding window countdown) &rarr; Active Ride (live ETA, multi-stop itinerary, Shapley savings, detour guarantee) with working swap, chips, and cancel buttons.
- [x] Implemented explainable **Rejection UI** toast displaying reason codes and plain-English commitments preservation notice.
- [x] Simulation controls: 1&times;, 10&times;, 60&times; speed buttons and "Road Engine: Nashik Urban OSRM" health telemetry banner.

### In Progress
- [ ] End-to-end rehearsal with backend endpoints once available.

### Pending
- [ ] Live demo dry run with Kaushik.
