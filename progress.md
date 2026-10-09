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

## Kaushik (Fair Pricing, Metrics, Research & Pitch Lead)

### Completed
- [x] **Shapley Value Pricing Engine** (`backend/engine/pricing/shapley.py`):
  - Bitmask DP over precedence-valid stop orderings (capacity respected) to compute characteristic coalition function $v(S)$ from first pickup to last drop.
  - Classical exact Shapley computation for $n \le 5$ riders.
  - Seeded Monte-Carlo permutation sampling (2,000 samples) with 95% confidence intervals for $n > 5$ riders.
  - Flat booking fee integration and exact efficiency reconciliation to executed cost $v(N)$.
  - Brute-force verification function `_solve_bruteforce_v` for validating DP correctness.
- [x] **Pricing Baselines** (`backend/engine/pricing/baselines.py`):
  - `solo_fares`: Unpooled direct cost per rider.
  - `equal_split`: Total route cost divided equally ($v(N) / n$).
  - `distance_proportional_split`: Proportional split based on solo route distance.
- [x] **Fairness Audit** (`backend/engine/pricing/audit.py`):
  - Verification of core cooperative game axioms:
    - **Efficiency**: $\sum \phi_i = v(N) \pm ₹0.05$.
    - **Symmetry**: Symmetric passengers receive identical fares.
    - **Null Player**: Zero-detour marginal passengers pay $\approx 0$.
    - **Individual Rationality**: $\phi_i \le v(\{i\})$ with explicit violation flagging and loss reporting.
- [x] **Metrics Engine** (`backend/engine/metrics/metrics.py`):
  - Computation of pooled km, solo km, saved km %, distance-weighted average occupancy, empty vehicle deadhead %, average/max detour %, and service rates.
- [x] **Comprehensive Pytest Suites** (`backend/tests/`):
  - `test_pricing.py`: Passed all 7 required tests (symmetric riders, subset route null player, 100-group efficiency property test, exact vs Monte-Carlo $n=5$, single rider solo cost, IR violation detection, and DP vs brute-force for $n \le 3$).
  - `test_metrics.py`: Validated pooled vs solo distance, saved %, occupancy weighting, and detour aggregations.
- [x] **Pitch & Research Assets** (`docs/pitch/`, `docs/qa.md`):
  - `docs/pitch/demo_script.md`: 2-minute word-for-word demo script with driver screen cues.
  - `docs/pitch/deck_outline.md`: 6-slide presentation deck outline.
  - `docs/pitch/loud_research_note.md`: Research note clarifying LOUD & KaRRi vs our LOUD-inspired implementation.
  - `docs/qa.md`: 15 rigorous judge Q&A entries.

### In Progress
- [ ] Integration support for Ketan (FastAPI routes) and Nakul (React UI).

### Pending
- [ ] Live demo rehearsal with Nakul driving and Kaushik speaking.

### Next Steps
1. Support Ketan when exposing `/api/fares/{group_id}` endpoint.
2. Provide Nakul with sample fare and metric JSON payloads for UI rendering.

