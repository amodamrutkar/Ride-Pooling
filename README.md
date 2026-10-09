# PoolIQ — Explainable Ride-Pooling Dispatch Engine

> Batch → Multi-Algorithm Route → Independent Proof → Shapley Fair Fare

[![CI](https://github.com/YOUR_ORG/poolIQ/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/poolIQ/actions/workflows/ci.yml)

---

## What is PoolIQ?

PoolIQ batches ride requests in a sliding window, routes them with a multi-algorithm VRPTW engine (LOUD-inspired insertion + batch matching + OR-Tools polish), proves every route with an independent validator, and splits the fare with Shapley values — showing all of it live on a map.

**Local flavour:** Demo scenario set in **Nashik** (CBS, Nashik Road, College Road, Gangapur Road, Panchavati, Dwarka, Indira Nagar, Satpur MIDC) with ₹ pricing.

<!-- TODO: Add screenshot here -->

---

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR_ORG/poolIQ.git
cd poolIQ

# Setup (Python venv + pip + Node deps)
make setup

# Run backend + frontend
make run

# Run tests
make test

# Run benchmark
make bench
```

**Requirements:** Python 3.11+, Node 20+, npm.

---

## Architecture

```
requests ──► Sliding-window batcher ──► batch
                                │
                  Candidate filter (spatial buckets)
                                │
                  Dispatch strategy (pluggable: A–E)
                     C: LOUD-inspired insertion
                     D: Batch matching (Hungarian)
                     E: OR-Tools VRPTW polish
                                │
                  Independent validator  ← accept only if ✔
                                │
              accepted routes ──► Shapley fares ──► UI
              failed/unfit   ──► DEFER or REJECT(reason)
```

### Dispatch Strategies

| Id | Name | Idea |
|---|---|---|
| A | `solo` | One vehicle per rider, nearest idle (baseline) |
| B | `greedy_fcfs` | First-come, nearest feasible, append |
| C | `loud_insertion` | Try all (pickup, drop) insertion positions, take min cost |
| D | `batch_matching` | Hungarian assignment on insertion cost matrix |
| E | `hybrid` (default) | D → OR-Tools VRPTW polish, keep if validator ✔ and cost lower |

---

## Folder Structure

```
poolIQ/
├── frontend/              # React + Vite + Tailwind + Leaflet
│   ├── components/        # MapView, RequestQueue, FarePanel, etc.
│   ├── pages/             # Dashboard, Rider
│   └── utils/             # API client, formatters, geo helpers
├── animations/            # Marker interpolation, Framer variants
├── backend/
│   ├── app/               # FastAPI main, routes, models, security
│   ├── engine/
│   │   ├── sim/           # SimClock, vehicle_motion, scenario_gen
│   │   ├── routing/       # MatrixProvider, OSRM, fallback, spatial
│   │   ├── dispatch/      # solo, greedy, loud_insertion, batch, hybrid
│   │   ├── optimizer/     # OR-Tools VRPTW wrapper
│   │   ├── validator/     # Independent route validator
│   │   ├── batching/      # Sliding-window batcher
│   │   ├── pricing/       # Shapley, baselines, fairness audit
│   │   └── metrics/       # KPIs computation
│   ├── data/              # scenarios/, cache/, hubs.json
│   └── tests/             # pytest suite
├── scripts/               # benchmark.py, precache_matrix.py
├── public/assets/         # Static assets
└── docs/                  # PRDs, architecture
```

---

## Key Features

- **Adaptive sliding-window batching** with urgency flush
- **5 pluggable dispatch strategies** with Algorithm Arena comparison
- **Independent validator** — proof badge for every route
- **Shapley fair fares** with Fairness Audit (efficiency, symmetry, null player, individual rationality)
- **Deterministic replay** — seeded scenarios, same seed = identical results
- **Fallback matrix** — works offline (haversine × 1.35 / 25 km/h)
- **Explainable decisions** — reason codes for every defer/reject

---

## Algorithms & References

- Buchhold, Sanders, Wagner — *Fast, Exact and Scalable Dynamic Ridesharing* (ALENEX 2021) — LOUD-inspired insertion
- KaRRi (KIT) — Multiple pickup/dropoff locations
- [Google OR-Tools Routing](https://developers.google.com/optimization/routing) — VRPTW solver
- [OSRM](https://project-osrm.org/) — Travel time matrix
- Shapley value — Game-theoretic fair cost allocation

---

## Limitations

- LOUD-**inspired**, not full LOUD (no contraction hierarchies)
- OR-Tools runs on small subproblems only (≤ 8 vehicles, 1.5 s time limit)
- CO₂ estimates are labelled assumptions, not measured
- No real GPS, payments, accounts, or ML demand prediction

---

## Team

| Member | Role |
|---|---|
| Nakul | Frontend (React, Leaflet, UI/UX) |
| Kaushik | Idea/Pitch + Shapley fairness math |
| Spandan | Optimizer core (dispatch strategies, OR-Tools, spatial) |
| Ketan | Platform (API, validator, batcher, security) |
| Amod | Repo, simulation, tests, CI |

---

## License

MIT
