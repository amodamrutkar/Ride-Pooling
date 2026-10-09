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
- **React Frontend (Nakul):** MapLibre GL map, vehicle markers, rider route polylines, operator control panel.

---

## Kaushik (Fair Pricing, Metrics, Research & Pitch Lead)

### Current Prompt / Objective
Implement the cooperative game-theoretic Shapley pricing engine, baseline splits, live fairness audit, KPI metrics engine, and pitch/research assets for PoolIQ in pure Python 3.11+.

### Tech Decisions & Architecture
- **Shapley Characteristic Coalition Function $v(S)$:**
  - Bitmask DP formulation over precedence-valid stop orderings (capacity respected, start at first pickup, end at last drop).
  - Precedence constraint: drop stop for rider $j$ only visited if pickup stop $j$ was already visited.
  - Capacity constraint: onboard passenger count $\le$ vehicle capacity (default 4) at every visited stop.
- **Exact & Sampled Computation:**
  - $n \le 5$: Classical exact permutation Shapley formula ($O(n \cdot 2^{n-1})$).
  - $n > 5$: Seeded Monte-Carlo permutation sampling (2,000 permutations) computing marginal contributions with empirical variance and 95% confidence intervals.
  - Exact reconciliation: Total fares calibrated to executed group route cost $v(N)$ to satisfy the efficiency axiom to the exact paisa.
- **Baseline Allocations:** Solo unpooled trip costs, equal split ($v(N)/n$), distance-proportional split.
- **Fairness Audit:** Pure functional validator auditing efficiency, symmetry, null player, and individual rationality ($\phi_i \le v(\{i\})$).
- **KPI Metrics:** Distance-weighted average passenger occupancy, total pooled km vs solo km, saved %, empty vehicle deadhead %, average & maximum detour %, and request service rates.
- **Pitch Materials:** Complete 2-minute demo script, 6-slide deck outline, 15 judge Q&A guide, and a research note on LOUD & KaRRi.

### Features Implemented
1. `backend/engine/pricing/shapley.py`: Bitmask DP, exact Shapley, Monte-Carlo Shapley, and `compute_fares`.
2. `backend/engine/pricing/baselines.py`: `solo_fares`, `equal_split`, `distance_proportional_split`.
3. `backend/engine/pricing/audit.py`: `run_fairness_audit` with `FairnessAudit` Pydantic model.
4. `backend/engine/metrics/metrics.py`: `compute_metrics` with `Metrics` Pydantic model.
5. `backend/tests/test_pricing.py`: 7 required unit and property tests.
6. `backend/tests/test_metrics.py`: Operational KPI unit tests.
7. `docs/pitch/demo_script.md`: 2-minute pitch script.
8. `docs/pitch/deck_outline.md`: 6-slide deck outline.
9. `docs/pitch/loud_research_note.md`: Research note on LOUD vs LOUD-inspired.
10. `docs/qa.md`: 15 comprehensive judge questions & answers.

### Future Scope
- Integration with live OSRM matrix in `/api/fares/{group_id}` endpoint.
- Interactive visualization of the Shapley coalition tree in the React frontend.

