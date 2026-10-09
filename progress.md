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
