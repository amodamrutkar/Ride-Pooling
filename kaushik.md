# kaushik.md — Fair Pricing, Metrics, Research & Pitch Lead
Read `00_MAIN_PRD.md` first. If this file conflicts with it, the main PRD wins.

## Mission
You own the **story and the math that makes it believable**: Shapley fares, the Fairness Audit, the metrics, and the pitch. You are the brainstormer, but this time you also ship code — a small, pure-Python module that is easy to test alone. Your module is the part judges remember ("provably fair").

## You own
`backend/engine/pricing/` (`shapley.py`, `baselines.py`, `audit.py`), `backend/engine/metrics/metrics.py`, `docs/pitch/`, `docs/qa.md`, demo script, deck.

## Depends on
- Spandan: `RoutePlan` and `MatrixProvider` (to get stop-to-stop distances).
- Amod: toy fixtures and pytest setup.
- Nobody blocks you for the first 6 hours: start with hardcoded distance matrices.

## Deliverables
### A. Shapley engine (`pricing/shapley.py`)
Function: `compute_fares(group_requests, dist_fn, executed_cost, rate_per_km) -> FareBreakdown`.
- `v(S)` = minimum route cost to serve exactly riders in S: best precedence-valid ordering of S's pickups/drops (capacity respected), distance from first pickup to last drop × rate. Implement with **bitmask DP** over stops (≤ 10 stops for 5 riders), memoized per subset.
- `v({i})` = solo trip cost. `v(∅) = 0`. `v(N)` = **executed** group cost (so fares sum to what was actually charged).
- Exact Shapley: `φᵢ = Σ |S|!(n−|S|−1)!/n! · (v(S∪{i}) − v(S))`.
- n > 5: Monte-Carlo permutation sampling, 2,000 permutations, seeded, return mean + 95% CI.
- Add flat booking fee outside the game (config, default ₹0 in tests).

### B. Baselines (`pricing/baselines.py`)
`solo`, `equal_split` (v(N)/n), `distance_proportional` (v(N) × solo_i / Σ solo).

### C. Fairness Audit (`pricing/audit.py`)
Returns booleans + details for: **efficiency** (Σφ = v(N) ±0.01), **symmetry** (swap identical riders → same fare), **null player** (rider with zero marginal contribution adds ≈ 0), **individual rationality** (φᵢ ≤ v({i}); list violators). Never hide a violation — show it. Saying "Shapley is fair by the axioms, not necessarily cheaper for everyone" earns trust.

### D. Metrics (`metrics/metrics.py`)
`compute_metrics(plans, requests, solo_plans) -> Metrics`: pooled km, solo km, saved %, avg occupancy (distance-weighted), deadhead %, avg/max detour %, served/deferred/rejected %. **Only compute from the same scenario run.**

### E. Pitch assets
- 2-minute demo script (main PRD §11) with exact words per step.
- 6-slide deck: Problem → Why naive fails → Our pipeline (diagram) → Proof + Fairness → Arena results (measured) → Roadmap/scale. Use the PowerPoint skill/Claude to generate the .pptx from your outline.
- `docs/qa.md`: 15 judge questions + answers (start from main PRD §15). Include honest answers on LOUD-inspired vs LOUD.
- One-page research note: LOUD (Buchhold, Sanders, Wagner, ALENEX'21) and KaRRi in plain English; what we borrowed, what we skipped and why.

## Required tests (pytest, with Amod's setup)
1. 3 symmetric riders, symmetric costs → equal φ.
2. 2 riders, one is a pure subset-route of the other → null-ish player pays ≈ marginal only.
3. Σφ = v(N) on 100 random seeded groups (property test).
4. Exact vs Monte-Carlo agree within CI for n = 5.
5. Single rider → φ = solo cost.
6. IR violation example is detected and reported.
7. Brute-force check of bitmask DP vs naive permutations for n ≤ 3.

## Hour plan
| Hours | Task |
|---|---|
| 0–2 | Read PRD + LOUD abstract; agree FareBreakdown shape with Ketan; set up your branch |
| 2–6 | v(S) DP + exact Shapley on hardcoded 3-rider matrix; tests 1, 3, 5, 7 |
| 6–10 | Wire to real `RoutePlan`; baselines; audit; API payload ready for Ketan to expose |
| 10–14 | Monte-Carlo, metrics module, edge cases; start deck outline |
| 14–18 | Pull real arena numbers from Spandan/Amod's benchmark; finish deck + qa.md |
| 18–21 | Rehearse demo ×3 with Nakul driving; time it under 2:00 |
| 21–24 | Final deck export, speaker order, backup video check with Amod |

## Gates
- Hour 6: `pytest backend/tests/test_pricing.py` green on toy data.
- Hour 10: fares appear in the browser for the demo group.
- Hour 18: deck draft complete with *real measured* numbers.

## Fallbacks
- Real route not ready → compute `v(S)` from straight-line distance matrix; label it.
- DP slow → precompute `v(S)` per group once and cache by frozenset of rider ids.
- Deck time low → 4 slides: Problem, Pipeline, Proof+Fairness, Results.

## Pitch rules
Do not promise "always saves". Do not say "we implemented LOUD". Say "LOUD-inspired". Quote only numbers measured on the seeded demo scenario.

## Antigravity prompt (paste as is)
```
Folder structure first. Create on Desktop (or open existing): poolIQ/ with
 frontend/ (components/, pages/, utils/), animations/, backend/ (engine/pricing, engine/metrics, tests),
 public/assets/, docs/pitch/, progress.md, activeContext.md.
If progress.md and activeContext.md exist, only add/update the "Kaushik" section. If not, create them:
progress.md = Completed / In Progress / Pending / Next Steps; activeContext.md = current prompt, tech decisions,
folder structure, features, future scope. Structured, not empty, resumable. Update progress.md after each step.

Goal: implement the fair pricing and metrics modules of PoolIQ in pure Python 3.11.
Read docs/00_MAIN_PRD.md section 5 and docs/kaushik.md fully before coding.

Build in order: backend/engine/pricing/shapley.py (bitmask DP for v(S) over precedence-valid stop orderings,
exact Shapley for n<=5, seeded Monte-Carlo for n>5 with 95% CI), baselines.py (solo, equal, distance-proportional),
audit.py (efficiency, symmetry, null player, individual rationality), backend/engine/metrics/metrics.py.
Return Pydantic models matching FareBreakdown and Metrics in the main PRD section 6.
Write pytest tests including property tests (hypothesis) that fares sum to the group cost and that
DP matches brute force for n<=3. No web code, no database, keep it simple and fast.
After each step update progress.md.
```
