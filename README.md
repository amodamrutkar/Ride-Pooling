<div align="center">

# 🚗 PoolIQ

### The Integration Layer for Urban Ride Pooling

**One neutral engine. Any app. Every city.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-pool--iq--live.vercel.app-brightgreen?style=for-the-badge)](https://pool-iq-live.vercel.app/)
[![Tests](https://img.shields.io/badge/pytest-117%20passed-success?style=for-the-badge&logo=pytest)](https://github.com/amodamrutkar/Ride-Pooling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red?style=for-the-badge)](https://github.com/amodamrutkar/Ride-Pooling)

> *"Cabs keep running with one passenger. Every city has the same rush hour. PoolIQ turns shared routes into shared savings — for the rider's wallet, the operator's fuel bill, and the city's roads."*

</div>

---

##  The Problem

A few weeks ago, one of us was travelling through Pune, stuck in traffic. Inside buses and on two-wheelers, people were packed. But right beside them, cab after cab — four seats, one person, moving through the same jam.

**These trips aren't random.** Every city has its daily patterns — the same corridors, the same office hours, the same routes. Hundreds of people travel the same way at the same time, in hundreds of separate cars.

| Who pays the cost? | How? |
|---|---|
| 🧑 **Riders** | Pay a full solo fare for a trip someone else is already taking |
| 🚗 **Operators & Fleets** | Burn fuel on half-empty vehicles; lower revenue per km |
| 🏙️ **Cities & Governments** | Manage congestion that never had to exist; pay the emissions bill |

**Existing pooling apps don't fix this.** Each app runs its own closed system — it can only pool its own riders. Fare logic is a black box. The city has no visibility. And no one can prove the split was fair.

---

## 💡 Our Solution: PoolIQ

PoolIQ is **not another cab app.** It is the **integration layer underneath all of them.**

```
┌─────────────────────────────────────────────────────────────┐
│              Any Ride App / Fleet / City System             │
│         (Ola, Rapido, NMMT, Private Fleet, Live Pin)        │
└──────────────────────────┬──────────────────────────────────┘
                           │  One API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        PoolIQ Engine                        │
│  Batcher → Dispatcher (5 Strategies) → Zero-Trust Gate      │
│                → Shapley Fare Engine                        │
└──────────────────────────┬──────────────────────────────────┘
                           │  Best shared routes + fair fares
                           ▼
                     Riders · Operators · City Dashboard
```

Any ride app, fleet, or city system sends requests to PoolIQ through **one API** and gets back the best shared routes, with a provably fair fare for every passenger.

---

## 🏗️ How It Works (Full System Architecture)

### Step 1 — Sliding-Window Batcher

Requests don't get assigned one by one. They enter a **sliding window** that flushes on one of three conditions:

| Flush Trigger | Condition | Why |
|---|---|---|
| ⏱️ **Timer** | 30-second limit | Guaranteed max latency |
| 📦 **Batch Size** | 12 requests reached | Optimal batch economics |
| 🚨 **Urgency** | Rider near pickup deadline | No one gets left behind |

This gives us the benefit of batching without making anyone wait too long.

---

### Step 2 — Multi-Algorithm Dispatcher (5 Strategies)

Requests don't go to one algorithm. We run **five strategies** and pick the best:

| Strategy | Name | How It Works |
|---|---|---|
| A | **Solo** | Nearest idle vehicle per rider — the baseline |
| B | **Greedy FCFS** | First-come, nearest feasible vehicle, sequential append |
| C | **LOUD-Inspired Insertion** | Precomputes slack arrays; evaluates all (pickup, drop) insertion permutations with O(1) checks; picks the one with smallest marginal detour |
| D | **Batch Matching** | Builds a cost matrix of all request × vehicle insertion pairs; solves with `scipy` Hungarian algorithm (linear sum assignment) |
| E | **Hybrid** (default) | Runs D, then passes affected vehicles to **Google OR-Tools VRPTW** for a 1.5-second global optimization polish — warm-started from D's output |

> **Algorithm Arena:** All five strategies run side-by-side on the same seeded scenario. You can benchmark them live from the Settings panel.

---

### Step 3 — Zero-Trust Route Gate (The Key Differentiator)

**The optimizer proposes. The validator decides. Independently.**

Every candidate route — no matter which strategy produced it — must pass **5 invariant checks** before it's accepted:

```
✅  1. Vehicle capacity ≤ 4 seats
✅  2. Pickup always before drop (precedence)
✅  3. Pickup window SLA ≤ 480 seconds
✅  4. Detour per passenger ≤ 15% over direct route
✅  5. Physical / kinematic reachability (road network)
```

If a route **fails any check**, the request is **not forced in**. It either goes to the next batch window, or is rejected with a clear, machine-readable reason code (`DETOUR_EXCEEDED`, `WOULD_BREAK_COMMITMENT`, `NO_FEASIBLE_VEHICLE`).

> **Critical guarantee:** Existing riders are **never broken** to fit a new one in. Accepting a new rider that would push any current passenger's detour past 15% is a hard rejection.

---

### Step 4 — Shapley Fair Fare Engine

Once a route is approved, fares are split using **Shapley values from cooperative game theory.**

Each passenger pays according to the **extra distance they actually add** to the shared trip — not an arbitrary equal split:

- A rider on the main corridor → **pays less**
- A rider who causes a longer detour → **pays proportionally more**
- The total never exceeds what solo trips would cost

This is **provably fair** — it satisfies four mathematical fairness properties (efficiency, symmetry, null player, additivity) — and the breakdown is shown to every passenger.

---

## 🎬 Three Live Scenarios

```
┌─────────────────────────────────────────────────────────────┐
│  😊 HAPPY PATH                                              │
│  Rider A and Rider B overlap.                               │
│  → Window batches them                                      │
│  → Dispatcher puts B into A's vehicle                       │
│  → Validator approves (all 5 checks pass)                   │
│  → Both get a cheaper, fair fare                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🚫 REJECTION (SLA Protection)                              │
│  Rider C requests a ride.                                   │
│  → Accepting C would push Rider A's detour to 18%           │
│  → Validator rejects C                                      │
│  → A's SLA promise is protected ✓                           │
│  → C moves to the next window (or rejects if deadline past) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚡ URGENCY FLUSH                                           │
│  Rider D is 20 seconds from the pickup deadline.            │
│  → System doesn't wait for the 30-second timer              │
│  → Window flushes early                                     │
│  → D is dispatched immediately                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌟 Why PoolIQ Wins (USPs)

### 1. 🔗 Integration Layer, Not an App
We don't compete with Ola, Uber, or Rapido. We make them better. Apps keep their customers and their fleets. PoolIQ is the neutral engine underneath — one API call away. **Riders from different platforms can share the same cab** because we sit below all of them.

### 2. 🧠 Multi-Algorithm Dispatch with Real Benchmarking
Five strategies run side-by-side in the Algorithm Arena. The hybrid strategy uses **Google OR-Tools** — the same solver used by Google Maps, Google Fleet Routing, and supply chain systems at scale. Results are deterministic, reproducible, and benchmarked with real numbers.

### 3. 🛡️ Zero-Trust Route Gate
The optimizer and the validator are **architecturally separated**. The optimizer can never bypass the validator. This is a formal correctness guarantee on every live route — not just a hope. No other pooling system ships this.

### 4. ⏱️ Adaptive Sliding Window
Three flush conditions (timer, size, urgency) mean we batch intelligently without making any rider wait past their deadline. The 30-second window captures demand peaks; the urgency flush protects edge-case riders.

### 5. 🔍 Explainable Re-Pooling Diffs
When a new rider joins a vehicle mid-trip, every affected stop is labeled: **UNCHANGED**, **ADDED**, or **REORDERED**. Passengers can see exactly what changed and why — with a detour impact number per person. Transparency, not a black box.

### 6. ⚖️ Provably Fair Shapley Fares
Shapley values aren't just "fancy math." They come with mathematical proofs. Each passenger's fare is tied to their marginal contribution to the shared trip — with a live audit showing the fairness properties. You can explain the fare to a judge, a regulator, or a suspicious passenger.

### 7. 🗺️ Real Roads, Real City
Turn-by-turn routing via OSRM on Nashik's actual road network. Routes follow real streets, curves, and bridges. The spatial index buckets candidates by 500m grid cells for O(1) candidate filtering regardless of fleet size.

---

## 👥 Who Benefits

<table>
<tr>
<td width="33%">

### 🧑 Riders
- Lower fare, fair split
- Join a vehicle already heading your way
- Detour capped at **15%**, shown before you accept
- Clear rejection reason if pooling isn't possible

</td>
<td width="33%">

### 🚗 Ride Apps & Fleets
- Higher **seat utilisation**
- Fewer empty kilometres
- Lower fuel cost per passenger
- Pooling capability without building their own engine
- Plug into PoolIQ via one API

</td>
<td width="33%">

### 🏙️ Cities & Governments
- Fewer vehicles for the same passengers
- Less traffic, less congestion to manage
- Lower emissions and fuel use
- Corridor-level demand analytics for policy planning
- Anonymised — no personal data

</td>
</tr>
</table>

---

## 💼 Business Model

PoolIQ is **B2B**. We don't touch consumer pricing — we power the engine for those who do.

### Revenue Streams

| Stream | Who Pays | Model |
|---|---|---|
| 💳 **Per-Trip Fee** | Ride apps & fleets | Fee per pooled trip, or % of measured fuel savings |
| 🏛️ **City Dashboard Licence** | Municipal bodies, transport authorities | Annual SaaS licence for corridor analytics + policy simulator |
| 📊 **Demand Insights** | Urban planners, fleet operators | Anonymised corridor demand heatmaps, peak-time analytics |

### The Data Flywheel (Our Compounding Advantage)

Every pooled trip generates structured data: **corridor demand patterns, route efficiency profiles, driver behaviour, time-of-day demand curves.** This data:

- Improves our routing and demand prediction over time
- Becomes a high-value analytics product for cities and fleet operators
- Is anonymised at ingestion — no personal identifiers stored in demo

### Go-To-Market

```
Nashik corridor pilot  →  One local fleet or aggregator
→  City transport authority  →  Other Tier-2 cities
→  Enterprise API for national fleet operators
```

**Why Nashik first:** We know the corridors. The MH-09, MH-15, and MH-03 routes are already modelled. A single corridor pilot proves the savings with real numbers before any scale.

---

## 🔬 Technical Stack

### Backend (Python 3.11)
| Component | Technology |
|---|---|
| API Server | FastAPI + Uvicorn |
| Routing | OSRM (Turn-by-turn, real roads) + disk-cached matrix |
| Spatial Index | 500m grid bucket index (O(1) candidate lookup) |
| Optimization | Google OR-Tools CP-SAT / VRP (VRPTW, pickup-delivery) |
| Batch Matching | `scipy.optimize.linear_sum_assignment` (Hungarian) |
| Fare Engine | Shapley value calculation (cooperative game theory) |
| Validation | Independent Zero-Trust Route Gate (5 invariant checks) |
| Tests | `pytest` — 117 tests, property tests with fixed seeds |

### Frontend (React + Vite)
| Component | Technology |
|---|---|
| UI Framework | React 18 + Vite |
| Map | Leaflet + ESRI Dark Gray Canvas (no API key required) |
| Styling | Tailwind CSS v4 (custom dark design system) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## 🚀 Quick Start

### Option 1: One Command
```bash
make run
# Starts backend (port 8000) + frontend (port 5173)
```

### Option 2: Separate Terminals

**Terminal 1 — Backend:**
```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/api/health`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install && npm run dev
# Open: http://localhost:5173
```

### Run Tests
```bash
.venv/bin/pytest backend/tests/ -v
# 117 tests — all passing
```

---

## 🧭 What's Built vs What's Next

### ✅ Built & Shipped
- Sliding-window batcher (timer + size + urgency flush)
- 5 dispatch strategies (Solo → Hybrid + OR-Tools)
- Zero-Trust Route Gate (5-invariant independent validator)
- Shapley value fare engine
- OSRM real-road routing with disk cache
- 500m spatial index for O(1) candidate filtering
- Algorithm Arena (benchmark all 5 strategies side-by-side)
- Route Diff View (UNCHANGED / ADDED / REORDERED per stop)
- Live Fleet Telemetry dashboard
- Corridor Network map (MH-09, MH-15, MH-03)
- 117 unit + property tests (deterministic, seeded)
- Deployed: Vercel + Render

### 🔜 Roadmap
- Real ride app API adapters (Ola, Rapido webhooks)
- White-label rider SDK (embed PoolIQ in any app)
- City policy simulator and congestion dashboard
- Contraction hierarchies + zone sharding for metro-scale fleet
- Real demand data pipeline

---

## 🙋 Honest Caveats

We believe in transparency — especially at a hackathon:

- Fleet vehicles and passengers in the demo are **simulated**; the algorithms, constraints, and validations are real
- The ₹ Lakhs figures on the Efficiency Hub are **simulated projections**, not measured revenue
- Our insertion algorithm is **"LOUD-inspired"** — not the original LOUD, which uses contraction hierarchies (we mention this as future work)
- Shapley values guarantee fairness **properties** — not that every rider saves vs solo in every scenario
- Verify current regulation on shared rides for cab aggregators before quoting it

---

## 👨‍💻 Team

| Member | Role |
|---|---|
| **Nakul** | Frontend Architecture — React, Leaflet, Dynamic Control Room, UI/UX |
| **Kaushik** | Concept, Pricing Models & Shapley Value Fairness Math |
| **Spandan** | Optimizer Engine — Dispatch Strategies, Google OR-Tools, Spatial Index |
| **Ketan** | Platform & Verification — FastAPI, Independent Route Validator, Batcher |
| **Amod** | Simulation Engine, Deterministic Replay, CI/CD Pipeline |

---

## 📄 License

MIT — open source, open data, open city.

---

<div align="center">

**🌆 Every city has the same rush hour.**
**PoolIQ turns shared routes into shared savings.**

[🌐 Live Demo](https://pool-iq-live.vercel.app/) · [💻 Code](https://github.com/amodamrutkar/Ride-Pooling) · [📖 API Docs](https://pool-iq-live.vercel.app/docs)

</div>
