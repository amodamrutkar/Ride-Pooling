# amod.md — Repo, Simulation, Test Data & CI Lead
Read `00_MAIN_PRD.md` first. If this file conflicts with it, the main PRD wins.

## Mission
You keep the team moving and make the demo **repeatable**. You own GitHub, the simulation (fake clock, moving vehicles, seeded scenarios), the fallback road-time model, the test suite setup, and the benchmark script. Each task below is small, clearly specified, and testable on its own. Work in short steps, commit often, ask in chat when blocked for more than 20 minutes.

## You own
GitHub repo + CI, `backend/engine/sim/` (`clock.py`, `vehicle_motion.py`, `scenario_gen.py`), `backend/engine/routing/fallback_provider.py`, `backend/data/` (scenarios, cache), `scripts/` (`benchmark.py`, `precache_matrix.py`), `backend/tests/` setup, README, Makefile, screenshots and backup demo video.

## Depends on
- Ketan: `models.py` (hour 2) for the data shapes.
- Spandan: `MatrixProvider` interface (hour 2) so your fallback fits.

## Deliverables

### 1. Repo and workflow (hour 0–1) — do this first
- Create GitHub repo `poolIQ` (public or private as team decides), add all 5 members.
- Add the folder structure from main PRD §10 with `.gitkeep` files, plus `.gitignore` (python, node, `.env`, `__pycache__`, `backend/data/cache/*.json` big files), `LICENSE` (MIT), `README.md` skeleton.
- Branch rules: `main` protected (PR + passing checks). Branches `feat/<name>-<topic>`. Short PRs. You merge.
- `Makefile`: `make setup` (venv + pip install + npm install), `make run` (backend + frontend), `make test`, `make bench`.
- Put all 6 PRD files in `docs/`.

### 2. CI (hour 1–3)
GitHub Actions workflow: on PR run `pip install -r backend/requirements.txt`, `pytest`, and `npm run build` for frontend. Fail the check on errors. Enable Dependabot.

### 3. Fallback travel-time provider (hour 2–5)
`FallbackMatrixProvider.table(points)`: distance = haversine × 1.35; duration = distance ÷ 25 km/h (configurable). Deterministic, no network. Must implement Spandan's `MatrixProvider` interface. Test: symmetric, zero diagonal, triangle inequality roughly holds.

### 4. Scenario generator + fixtures (hour 2–6)
`scenario_gen.py`: `generate(seed, n_requests, n_vehicles, area="nashik") -> Scenario` as JSON.
- Nashik area: use a bounding box around the city center (approx 19.9975 N, 73.7898 E). Pick ~15 named hubs (CBS, Nashik Road, College Road, Gangapur Road, Panchavati, Dwarka, Indira Nagar, Satpur MIDC, etc.). Look up their coordinates once (OpenStreetMap/Nominatim or Google Maps), save in `backend/data/hubs.json`. Do not guess coordinates.
- Create these fixed files in `backend/data/scenarios/`:
  - `demo_5r_3v.json` — the demo: 5 requests, 3 vehicles, built so that pooling clearly helps and one 6th "bad" request breaks the 15% rule.
  - `edge_capacity.json`, `edge_tight_window.json`, `edge_onboard_commitment.json`
  - `stress_100r_25v.json`, `stress_500r_100v.json` (seeded, generated)
- Also create `frontend/utils/mock/state.json` matching main PRD §6 so Nakul can start now.

### 5. Simulation clock + vehicle motion (hour 4–9)
- `clock.py`: `SimClock(speed)`; `now()`, `advance(dt)`, `pause()`, `reset()`. Speeds 1×, 10×, 60×. Deterministic stepping option for tests.
- `vehicle_motion.py`: given a `RoutePlan.polyline` (or straight segments between stops) and elapsed seconds, return the vehicle position and which stop is reached. Update `onboard` when pickup/drop happens. Pure functions + tests.

### 6. Test suite foundation (hour 3 onward)
- `backend/tests/` with `conftest.py`: fixtures that load scenarios and the fallback provider.
- Write these tests yourself (you can use Antigravity): determinism of `generate(seed)`, fallback provider properties, vehicle motion reaches final stop, clock speed math.
- Then own `test_acceptance.py` that runs the checklist in main PRD §12 once everyone's modules exist (hour 10+).

### 7. Benchmark + precache scripts (hour 12–16)
- `scripts/precache_matrix.py`: calls OSRM Table API (with throttling) for all points of `demo_5r_3v` and saves to `backend/data/cache/`. Run it, commit the cache for the demo scenario only.
- `scripts/benchmark.py`: for sizes (20/5, 100/25, 500/100) run each strategy via Spandan's arena runner, print a table (strategy, ms, km, served %), save CSV. Never edit numbers by hand.

### 8. Demo safety net (hour 18–24)
- Tag `demo-stable` at hours 10, 14, 18, 21 after a clean run.
- Fresh-clone test on a **different laptop**: `make setup && make run` under 5 minutes.
- Record a 90-second screen capture of the demo script (main PRD §11) as backup; export 8–10 screenshots; copy architecture diagram into `docs/`.
- README: what it is, screenshot, how to run, architecture, algorithms, limitations, credits (cite LOUD, KaRRi, OR-Tools, OSRM, Leaflet; note NOMAD-RPS not used).

## Hour plan
| Hours | Task |
|---|---|
| 0–1 | Repo, folders, `.gitignore`, protect `main`, invite team |
| 1–3 | Makefile, CI, README skeleton, mock state JSON for Nakul |
| 3–6 | Fallback provider, `hubs.json`, `demo_5r_3v.json`, tests setup |
| 6–10 | Clock + vehicle motion, edge-case scenarios, first merge-gate `demo-stable` |
| 10–14 | Acceptance test file, stress scenarios, help Spandan/Ketan with integration bugs |
| 14–18 | Benchmark + precache scripts, support Nakul with fixtures and QA |
| 18–21 | Bug bash, clean-clone test, screenshots |
| 21–24 | Backup video, README final, submission checklist, final tag |

## Gates
- Hour 1: everyone can `git clone`, create a branch, open a PR.
- Hour 3: CI green on an empty test.
- Hour 6: demo scenario JSON + fallback provider merged.
- Hour 21: clean clone works on another machine.

## Working tips
- If a task is unclear, post a 2-line question in the team chat; don't stay stuck.
- Use Antigravity with the prompt below for each deliverable one at a time; read the output before committing.
- Never commit secrets or `.env`.
- If you finish early, ask Ketan or Nakul for the next ticket: extra edge-case tests, UI QA on mobile, or screenshots.

## Antigravity prompt (paste as is)
```

```
