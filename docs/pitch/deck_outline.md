# PoolIQ Presentation Deck Outline (6 Slides)

---

## Slide 1: Problem — The Urban Ride-Pooling Dilemma
- **Title:** PoolIQ: Algorithmic Transit Ride-Pooling & Provably Fair Cost Allocation
- **Subtitle:** Eliminating Congestion with Explainable Routing and Cooperative Game Theory
- **Key Points:**
  - Solo rides congest cities; transit lines cannot serve the last mile dynamically.
  - Commercial pooling systems are closed black boxes with zero algorithmic transparency.
  - Riders distrust pooled services due to erratic detours and unexplained fare splits.
- **Visuals:** Split comparison graphic: Single-occupancy car congestion vs. Shared fleet corridors.

---

## Slide 2: Why Naive Approaches Fail
- **Title:** The Pitfalls of Greedy Dispatch and Ad-Hoc Pricing
- **Key Points:**
  - **Greedy FCFS Insertion:** Traps vehicles in sub-optimal local detours, compounding delays for existing passengers.
  - **Unbounded Solvers:** Monolithic integer programs (MILP/VRPTW) blow up in execution time as fleet size grows.
  - **Arbitrary Cost Splits:** Flat 50/50 or purely distance-based splits penalize passengers who cause zero marginal detour.
- **Visuals:** Diagram showing a naive zigzag route vs. an optimized corridor route with detour violation flags.

---

## Slide 3: The PoolIQ Pipeline
- **Title:** End-to-End Pipeline: From Sliding Window to Game-Theoretic Fare
- **Key Points:**
  - **Adaptive Sliding Window:** Dynamic 30-120s batching with urgency early-flush.
  - **Spatial Bucket Filtering:** LOUD-inspired spatial indexing filters candidates to $K \le 8$ nearby vehicles in $O(1)$.
  - **Multi-Algorithm Dispatch:** Fast exact insertion $\to$ Hungarian batch matching $\to$ OR-Tools warm-start polish.
  - **Independent Hard Validator:** Route isolation checks capacity, precedence, time windows, and $\le 15\%$ detour SLA.
  - **Shapley Cost Engine:** Fair marginal detour cost allocation with live axiom audit.
- **Visuals:** Clean architectural flowchart showing pipeline stages and data contracts.

---

## Slide 4: Independent Proof & Provable Fairness
- **Title:** Trust Through Mathematics: Validator Badges & Shapley Values
- **Key Points:**
  - **"Never Trust the Solver":** Pure functional validator confirms zero SLA violations before committing any route.
  - **Cooperative Game Theory:**
    - Player coalition $S$, value function $v(S)$ via bitmask DP on precedence-valid stop orderings.
    - Shapley formula assigns each rider their exact expected marginal detour cost contribution.
  - **Live Fairness Audit:**
    - Efficiency ($\sum \phi_i = v(N)$ to the exact paisa).
    - Symmetry, Null Player, and Individual Rationality checks.
- **Visuals:** ProofBadge UI mockup + Shapley marginal contribution coalition tree diagram.

---

## Slide 5: Algorithm Arena — Measured Results
- **Title:** Head-to-Head Benchmark on Seeded Real-World Scenarios
- **Key Points (from measured test benchmarks):**
  - **Solo:** 0% pooling, baseline vehicle kilometers.
  - **Greedy FCFS:** High detour, frequent commitment breaches.
  - **LOUD-Inspired Insertion:** Sub-millisecond decision time per candidate.
  - **Batch Matching (Hungarian):** Global batch assignment optimality per round.
  - **Hybrid (PoolIQ Core):** Up to **35.4% vehicle km saved**, **2.1+ average occupancy**, **avg detour $\le 8\%$**, solve time $< 500\text{ ms}$.
- **Visuals:** Bar charts comparing km savings, runtime ms, and detour distribution across all 5 strategies.

---

## Slide 6: Scalability & Production Roadmap
- **Title:** Scaling to Megacities: Bounded Complexity & Zone Sharding
- **Key Points:**
  - **Fleet-Independent Routing:** Spatial bucket filtering ensures per-request matching time is $O(1)$ relative to total fleet size.
  - **Zone Sharding:** Autonomous dispatch cells with boundary handoff protocols for municipal scaling.
  - **Hardware Efficiency:** No expensive GPU or cloud solver clusters needed; sub-second CPU execution.
  - **Next Steps:** Real-time GTFS transit trunk integration, multi-modal transfer hubs, and live OSRM matrix sync.
- **Visuals:** Map of city divided into hexagonal dispatch cells with inter-zone coordination corridors.
