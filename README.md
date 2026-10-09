# PoolIQ — Explainable Ride-Pooling Dispatch Engine

> Batch → Multi-Algorithm Route → Zero-Trust Route Gate → Shapley Fair Fare

[![Tests](https://img.shields.io/badge/pytest-117%20passed-brightgreen.svg)](#running-tests)
[![Build](https://img.shields.io/badge/vite-build%20passing-blue.svg)](#option-2-run-backend-and-frontend-in-separate-terminals)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is PoolIQ?

PoolIQ is an algorithmic ride-pooling control room and transit engine that batches incoming passenger requests into sliding time windows, constructs optimal shared itineraries using **Google OR-Tools** and **LOUD-inspired heuristic insertion**, enforces an independent **Zero-Trust Route Gate** where every candidate route must strictly satisfy 5 invariant constraints, and calculates game-theoretically fair fares using **Shapley values**.

### Core USPs
1. **USP 1 — Zero-Trust Route Gate:**
   > *"The optimizer proposes. An independent validator decides."*
   Candidate routes from dispatch heuristics are quarantined until proven against 5 invariant checks: **Capacity (≤ 4)**, **Precedence (Pickup before drop)**, **Pickup Window (≤ 480s SLA)**, **Detour Cap (≤ 15%)**, and **Physical Kinematic Feasibility**.
2. **USP 2 — Explainable Dynamic Re-Pooling (`/api/diff/{request_id}`):**
   Demonstrates how new requests dynamically re-optimize active vehicle itineraries with real-time visual stop diffs (**UNCHANGED**, **ADDED**, **REORDERED**) and passenger-level detour impact audits (+X percentage points within SLA).
3. **Turn-by-Turn Road Routing:**
   Map polylines follow actual streets, curves, and bridges just like Google Maps (powered by OSRM turn-by-turn geometry across Nashik's urban network).
4. **Interactive Multi-Screen Dynamic Telemetry:**
   - **Live Pool:** Street road rendering, dynamic solo vs pooled fares, and one-click Zero-Trust Gate verification.
   - **Optimized Corridors:** Click any corridor (MH-09 Tech Mid-Town, MH-15 Central, MH-03 Link) to focus and fly the map to its exact road path, with one-click "Book Pool on this Corridor".
   - **Fleet Telemetry:** Click any vehicle in the roster to fly to its position, track its live speed, battery SOC, and active route vector.
   - **Efficiency Hub:** Real-time metropolitan network savings scaled in **Lakhs (₹)** (e.g. ₹3.84 Lakhs / ₹28.65 Lakhs), live ticking counters, and interactive 7-day velocity cadence.

---

## Quick Start & Running on Localhost

### Option 1: One Command (Makefile)
```bash
# Starts both backend (port 8000) and frontend (port 5173):
make run
```

### Option 2: Run in Separate Terminals

#### Terminal 1 — Backend (FastAPI on Port 8000):
```bash
# From project root:
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`
- Interactive API Docs: `http://localhost:8000/docs`

#### Terminal 2 — Frontend (Vite React on Port 5173):
```bash
# From frontend directory:
cd frontend
npm install
npm run dev
```
- Open in your browser: **`http://localhost:5173`**
- In local development, Vite automatically reverse-proxies `/api` requests to `http://localhost:8000`.

### Running Tests
```bash
# Run complete test suite (117 passing tests):
.venv/bin/pytest backend/tests/ -v

# Run production frontend build check:
cd frontend && npm run build
```

---

## Deployment Guide: Render (Backend) & Vercel (Frontend)

PoolIQ is designed for seamless zero-downtime deployment with Render hosting the Python FastAPI engine and Vercel hosting the React/Vite UI.

### Step 1: Deploy Backend on Render

1. Log in to [Render](https://render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`poolIQ`).
3. Set the following settings:
   - **Name:** `pooliq-backend`
   - **Runtime:** `Python 3`
   - **Region:** `Oregon (US West)` (or closest to you)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank / repository root)*
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.9`
5. Click **Create Web Service**.
6. Once deployed, copy your Render backend URL (e.g., `https://pooliq-backend.onrender.com`).

*(Note: `render.yaml` is also included in the repository root for one-click Infrastructure-as-Code deployment via Render Blueprints).*

---

### Step 2: Deploy Frontend on Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository (`poolIQ`).
3. In the project configuration:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select **`frontend`**.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://pooliq-backend.onrender.com` *(your Render service URL from Step 1)*
5. Click **Deploy**.
6. Vercel will build and deploy your app in <30 seconds!

*(Note: `frontend/vercel.json` is pre-configured with SPA routing and CORS rewrites, ensuring all deep links and API requests work automatically).*

---

## Architecture & Algorithms

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
                  Zero-Trust Route Gate  ← accept only if 5/5 ✔
                     1. Capacity ≤ 4
                     2. Precedence (Pickup before drop)
                     3. Pickup window SLA ≤ 480s
                     4. Detour cap ≤ 15%
                     5. Physical kinematic feasibility
                                │
              accepted routes ──► Shapley fares ──► Live UI
              failed/unfit   ──► DEFER or REJECT(reason)
```

### Dispatch Strategies
| Id | Name | Description |
|---|---|---|
| A | `solo` | One vehicle per rider, nearest idle (baseline) |
| B | `greedy_fcfs` | First-come, nearest feasible, sequential append |
| C | `loud_insertion` | Evaluates all (pickup, drop) insertion permutations, minimizing marginal cost |
| D | `batch_matching` | Bipartite matching on insertion cost matrix |
| E | `hybrid` (default) | LOUD insertion + Google OR-Tools VRPTW solver with independent validation gate |

---

## Team & Roles

| Member | Role |
|---|---|
| Nakul | Frontend Architecture (React, Leaflet, Dynamic Control Room, UI/UX) |
| Kaushik | Concept, Pricing Models & Shapley Value Fairness Math |
| Spandan | Optimizer Engine (Dispatch Strategies, Google OR-Tools, Spatial Buckets) |
| Ketan | Platform & Verification (FastAPI, Independent Route Validator, Batcher) |
| Amod | Simulation Engine, Deterministic Replay, CI/CD Pipeline |

---

## License
MIT
