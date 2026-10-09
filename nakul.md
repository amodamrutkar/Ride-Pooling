# nakul.md — Frontend Lead (Dashboard, Rider Mobile View, Visual Polish)
Read `00_MAIN_PRD.md` first. If this file conflicts with it, the main PRD wins.

## Mission
Make the algorithm *visible*. A judge must understand batching, pooling, proof, and fair fares **without reading code**. You own everything in the browser.

## You own
`frontend/`, `animations/`, `public/assets/`

## Depends on
- Ketan: `/api/state` + OpenAPI contract (hour 2). Until then use `frontend/utils/mock/state.json` (Amod creates fixtures).
- Spandan: route polylines + arena endpoint (hour 6+).
- Kaushik: FareBreakdown + metrics shapes (already in main PRD §6).

## Deliverables
| # | Deliverable | Done when |
|---|---|---|
| 1 | Vite + React + Tailwind app, routes `/` and `/rider` | Runs with mock JSON, no backend needed |
| 2 | `MapView` (Leaflet, dark tiles) | Vehicles, pickup/drop markers, route polylines colored per vehicle |
| 3 | `RequestQueue` + `WindowTimeline` | Shows pending requests and the batching window filling; flush reason (TIMER / SIZE / URGENCY) |
| 4 | `MetricsCards` | pooled km, solo km, saved %, occupancy, avg/max detour, served % |
| 5 | `ProofBadge` | Click a route → ✔ capacity ✔ precedence ✔ windows ✔ max detour X% ≤ 15% (from `validation`) |
| 6 | `FarePanel` | Bars: solo vs equal vs Shapley per rider + Fairness Audit ticks + IR warning |
| 7 | Add-request flow | Click map for pickup, click for drop, press "Request" → POST → plan updates |
| 8 | Before/After toggle | Uses `/api/diff/{id}`; old route dashed grey, new route solid |
| 9 | `ArenaTable` | Strategies A–E, metrics, "best" highlighted, run button |
| 10 | Rider mobile view `/rider` | Works at 390 px width: request → vehicle, ETA, detour %, fare |
| 11 | Rejection UI | Reason code + plain sentence toast, e.g. "Would push R2 to 19% (cap 15%)" |
| 12 | Vehicle animation | Marker moves along polyline; speed 1× / 10× / 60× |

## UI rules
- Dark, clean, control-room feel. One accent color. Rounded cards. Few icons.
- No purple gradients, no robot icons, no generic "AI" look.
- Light animation only: Framer Motion for panels and numbers, CSS pulses, marker interpolation. No Three.js, GSAP, or Vanta.
- Currency ₹. Distances in km. Times mm:ss.
- Always show a banner "Road data: OSRM / Offline model" from `/api/health`.
- Poll `/api/state` every 1000 ms. Pause polling when tab hidden.

## Hour plan
| Hours | Task |
|---|---|
| 0–2 | Scaffold, Tailwind, router, API client with `VITE_API_URL`, mock state loader |
| 2–6 | MapView with mock vehicles and static routes, MetricsCards, RequestQueue |
| 6–10 | Connect real `/api/state`; draw polylines; add-request flow; first full loop |
| 10–14 | WindowTimeline, ProofBadge, rejection toasts, Before/After |
| 14–18 | FarePanel + audit, ArenaTable, vehicle animation, Rider view polish |
| 18–21 | Bug bash, responsive checks, screenshots for deck, no new features |
| 21–24 | Rehearse driving the demo (you click, Kaushik talks) |

## Gates
- Hour 6: map shows mock data, nothing blank.
- Hour 10: submit a request in the browser → see new route + fare.
- Hour 18: demo script §11 runs with zero console errors.

## Edge cases to handle
Empty state (no vehicles), backend down (show last good state + "reconnecting"), long route lists, rejected request with no route, 60× speed jitter (throttle renders), tiles failing (fallback plain background).

## Fallbacks
- Map tiles slow → use cached screenshot background.
- Animation janky → remove it; static polylines are fine.
- Arena not ready → hardcode a screenshot table from `scripts/benchmark.py` output, labelled "measured offline".

## Antigravity prompt (paste as is)
```
Folder structure first. Create on Desktop: poolIQ/ with
 frontend/ (components/, pages/, utils/), animations/, backend/ (owned by others, do not touch),
 public/assets/, docs/, progress.md, activeContext.md.
If progress.md and activeContext.md exist, only add/update the "Nakul" section. If not, create them: 
progress.md = Completed / In Progress / Pending / Next Steps; activeContext.md = current prompt,
tech decisions, folder structure, features, future scope. Not empty, structured, resumable. 
Update progress.md after every step.

Goal: build the frontend of PoolIQ, a ride-pooling dispatch dashboard + mobile rider view.
Read docs/00_MAIN_PRD.md and docs/nakul.md fully before coding.

Tech: React + Vite + Tailwind + Leaflet + Framer Motion + Recharts. No backend code.
Start with mock JSON matching the contract in the main PRD §6, then switch to real /api/state polling (1s).

Build in order: scaffold + routes (/ and /rider) -> MapView (dark tiles, vehicles, markers, route polylines)
-> MetricsCards -> RequestQueue + WindowTimeline -> add-request flow (click map twice, POST /api/requests)
-> ProofBadge from route.validation -> FarePanel (solo vs equal vs Shapley bars + audit ticks)
-> Before/After using /api/diff -> ArenaTable -> vehicle movement animation -> Rider mobile page.

UI: modern, sleek, dark control-room look, one accent color, few icons, rounded cards,
mobile friendly and desktop compatible. Not AI-looking. Animation level: light.
Rejections show reason + plain sentence. Show "Road data: OSRM / Offline model" banner.
Keep it simple, no overengineering. After each step update progress.md.
```
