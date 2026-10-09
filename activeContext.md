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
- **Batching & Rebalancing (Amod):** Request batching window (30s) and idle vehicle repositioning toward high-demand hubs.
- **Dispatch & Optimizer (Parth):** Insertion heuristics, ALNS/OR-Tools formulation for min cost & delay.
- **Hard Constraint Validator (Amod / Parth):** Capacity limits, max detour (1.4x direct), time window compliance, onboard sequence guarantees.
- **Dynamic Pricing (Parth):** Base fare + distance + surge factor based on demand/supply ratio.
- **Live Metrics (Amod):** Pooling efficiency, detour ratio, SLA compliance, vehicle utilization.
- **React Frontend (Nakul):** Leaflet dark tile map, vehicle markers, rider route polylines, operator control panel.

---

## Nakul (Frontend Lead — Dashboard, Rider Mobile View, Visual Polish)

### Current Prompt / Objective
Build the explainable frontend for PoolIQ: a dark control-room operator dashboard (`/`) and a mobile-first rider interface (`/rider`) adhering strictly to the Stitch UI design specifications and PRD contracts. Make dynamic batching, mathematical proof badges, and Shapley cost allocations clear without requiring judges to inspect code.

### Tech Decisions & Architecture
- **Framework & Tooling:** React 19 + Vite 8 + Tailwind CSS v4 + React Router v7.
- **Mapping & Geospatial:** Leaflet 1.9 + React-Leaflet 5 with CartoDB dark tile layer (`dark_all`). Custom DOM `L.divIcon` markers for vehicles (showing ID + occupancy load) and pickup/drop stops.
- **Design System:** Aligned with Stitch `DESIGN.md` tokens: Obsidian surface (`#0A0A0F`, `#131318`), Telemetry accent (`#0ED4A8`), Inter & JetBrains Mono typography, 4px/8px grid system. No AI clichés or purple gradients.
- **State Management & Polling:** Polling `/api/state` every 1000ms with automatic pause on document tab hidden (`document.visibilityState`). Graceful fallback to `mockState` when offline.
- **Interactive Capabilities:**
  - **Click-to-Add Request:** Click 1 for pickup, Click 2 for destination &rarr; POST to `/api/requests`.
  - **Before / After Diff Toggle:** Displays old pre-insertion route as dashed grey (`#6B6B76`) and newly optimized pooled route as solid teal (`#0ED4A8`).
  - **Algorithm Arena:** Interactive benchmark across Strategies A–E with metric winner highlights.
  - **Explainable Rejection UI:** Reason code toast (`DETOUR_EXCEEDED`) preserving existing rider commitments.
- **Mobile Rider Flow (`/rider`):** 390px mobile-first responsive layout traversing Request &rarr; Sliding Window Matching &rarr; Active Ride with multi-stop itinerary and Shapley fair fare savings.
