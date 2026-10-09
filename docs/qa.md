# PoolIQ — Comprehensive Judge Q&A Guide (15 Questions)

---

### Q1: Why not just use Google OR-Tools directly for the entire dispatch?
**Answer:**  
OR-Tools provides an excellent VRPTW solver, but an industrial dispatch system cannot be just a solver. A solver alone cannot handle:
1. **Dynamic batching policies:** It doesn't know when to flush a sliding window or trigger an urgency release.
2. **Commitment guarantees:** Monolithic solvers routinely re-shuffle existing passenger routes, which would violate passenger pickup or detour guarantees.
3. **Execution time bounds:** Global integer programs exhibit worst-case exponential scaling.
In PoolIQ, we use our fast LOUD-inspired heuristic and Hungarian matching to construct high-quality feasible assignments within milliseconds, and use OR-Tools only on small bounded subproblems ($K \le 8$ vehicles, $\le 1.5\text{ s}$ timeout) warm-started from the heuristic.

---

### Q2: Is your routing algorithm provably optimal?
**Answer:**  
Dynamic Dial-a-Ride with Time Windows (DARP-TW) is strongly NP-hard. We are transparent:
- Our intra-route insertion is **exact** for a single request into a candidate vehicle.
- Our batch matching is **globally optimal per batch round** using the Kuhn-Munkres (Hungarian) algorithm on insertion cost deltas.
- Our multi-vehicle VRPTW polish is a **high-quality heuristic** warm-started with local search.
In our Algorithm Arena, we measure and display the exact empirical gap between these methods on identical scenarios.

---

### Q3: Did you actually implement LOUD from the Buchhold et al. ALENEX 2021 paper?
**Answer:**  
No, and we are deliberate about our terminology: we built a **LOUD-inspired** dispatcher.  
The source paper (ALENEX 2021) relies on precomputed **Bucket Contraction Hierarchies (Bucket-CH)** on the road graph to answer many-to-many distance queries in microseconds.  
We adopted LOUD's core architectural ideas: spatial stop bucketing to decouple candidate evaluation from fleet size, exhaustive $(p, d)$ intra-route insertion checks, and $O(1)$ delay slack feasibility. However, we execute this over our OSRM/fallback travel-time matrix rather than precomputing contraction hierarchies in C++.

---

### Q4: Why use Shapley values for fare calculation instead of a simple distance split?
**Answer:**  
A distance-proportional or 50/50 split is mathematically naive in pooled transit:
- If Rider A stays on the direct arterial corridor and Rider B causes a 4 km detour into a suburb, a distance split forces Rider A to subsidize Rider B's detour.
- The Shapley value is the **unique** cost-sharing allocation that simultaneously satisfies four fundamental axioms:
  1. **Efficiency:** Total fares sum exactly to the executed group route cost.
  2. **Symmetry:** Two riders who contribute identical marginal detours pay identical fares.
  3. **Null Player:** A passenger whose ride is completely along the existing path without adding any detour pays only their marginal cost contribution.
  4. **Additivity:** Independent route costs aggregate linearly.
It directly ties every passenger's fare to their *marginal detour contribution*.

---

### Q5: Does Shapley value guarantee that every rider pays less than their solo fare?
**Answer:**  
No, and this is an important distinction in cooperative game theory. Shapley guarantees axiomatic fairness, not unconditional individual rationality across arbitrary non-convex cost functions.  
However, PoolIQ includes a live **Fairness Audit** that explicitly checks **Individual Rationality** ($\phi_i \le v(\{i\})$). If an IR violation occurs, our system flags it transparently. In practice, because pooling reduces total vehicle kilometers, almost all realistic configurations satisfy individual rationality.

---

### Q6: How does your bitmask DP compute coalition value $v(S)$?
**Answer:**  
For any subset of riders $S$, $v(S)$ represents the minimum cost to serve only the riders in $S$ from the first pickup to the last dropoff.  
With $|S| \le 5$, the group has at most 10 stops (pickups and drops). We model this as a constrained Hamiltonian path using bitmask dynamic programming over state $(mask, last\_stop)$:
- We enforce strict pickup-before-drop precedence.
- We enforce vehicle seat capacity at every intermediate transition.
The complexity is $O(n \cdot 4^n)$, which solves in under $0.5\text{ ms}$ in pure Python. For groups larger than 5, we fall back to seeded Monte-Carlo permutation sampling (2,000 permutations) with 95% confidence intervals.

---

### Q7: Why do you need an "Independent Validator" if the solver already has constraints?
**Answer:**  
*"Never trust the optimizer."*  
Heuristics, constraint-relaxation penalty functions, or bugged solver configurations can silently produce routes with invalid passenger sequences, capacity overflows, or detour violations.  
Our independent validator is a completely pure function with **zero imports** from the routing or dispatch modules. It takes the proposed route stops, requests, and distance matrix, and independently checks:
1. Pickup precedes dropoff for every passenger.
2. Capacity is respected at every stop.
3. Every passenger's ride time satisfies the $\le 15\%$ detour SLA cap.
4. Pickup time windows are strictly met.
If the validator fails, the proposed plan is discarded and the system defaults to the safe fallback.

---

### Q8: How does PoolIQ scale to a fleet of 10,000 vehicles?
**Answer:**  
PoolIQ uses three architectural layers to guarantee scalability:
1. **Spatial Candidate Bucketing:** Vehicles are indexed in spatial grid cells. Incoming requests only evaluate the $K \le 8$ nearest candidate vehicles, decoupling matching complexity from total fleet size $|V|$.
2. **Subproblem Localization:** OR-Tools is never invoked on the city-wide network; it only optimizes small localized clusters affected by the current batch.
3. **Zone Sharding:** In a metropolitan deployment, the city is partitioned into geographic dispatch zones with coordinated boundary handoff corridors.

---

### Q9: What happens if the external OSRM routing server goes down?
**Answer:**  
PoolIQ features an offline, zero-dependency **FallbackMatrixProvider**:
- It computes Haversine distances scaled by a calibrated urban circuity factor (1.35 for Indian urban road networks like Nashik) and an average speed of $25\text{ km/h}$.
- The system pre-caches the full matrix during initialization.
- If OSRM fails or times out, the backend automatically falls back to the deterministic model and displays an "Offline Road Model" badge in the UI.

---

### Q10: How does your sliding-window batching prevent excessive wait times?
**Answer:**  
We utilize an **adaptive sliding window** (default 30 seconds sim-time):
- Requests accumulate in the window to form efficient multi-passenger batches.
- The window flushes early if:
  1. The batch size reaches the upper limit ($N_{max} = 12$).
  2. An **urgency flush** is triggered: when any waiting rider's latest feasible dispatch time ($\text{pickup\_deadline} - \text{best\_case\_ETA}$) approaches a safety threshold.
- Deferred requests enter a rolling horizon and re-enter the next window up until their hard deadline.

---

### Q11: How do you handle impossible or infeasible ride requests?
**Answer:**  
Instead of crashing or breaking existing commitments, PoolIQ uses **defer-then-reject**:
- An infeasible request is deferred to subsequent sliding windows in case an opening appears.
- If it exceeds its latest feasible dispatch time, it is formally rejected with an explicit, human-readable reason code:
  - `NO_VEHICLE_NEARBY`
  - `CAPACITY_FULL`
  - `DETOUR_EXCEEDED`
  - `WINDOW_MISSED`
  - `WOULD_BREAK_COMMITMENT`
Existing passenger plans and route version numbers remain completely unchanged.

---

### Q12: How do you prevent solver re-optimization from worsening an onboard passenger's trip?
**Answer:**  
This is our **Commitment Invariant**:
- Once a rider is accepted, their assigned arrival window and maximum detour ($1.15 \times \text{direct}$) are permanently locked.
- Whenever a candidate insertion or OR-Tools polish step is evaluated, the new schedule is validated against *all* currently assigned and onboard passengers.
- If any existing passenger's promised SLA is breached, the new candidate is rejected (`WOULD_BREAK_COMMITMENT`).

---

### Q13: Are your savings numbers real, or synthetic estimates?
**Answer:**  
All reported metrics—vehicle kilometers saved, average occupancy, deadhead percentage, and detour percentages—are calculated **exclusively from the same seeded scenario execution**.  
We run the solo baseline and the pooled dispatch on the exact same requests and network conditions. We never compare across mismatched scenarios.

---

### Q14: How does PoolIQ protect rider privacy and security?
**Answer:**  
1. **Ephemeral Geographic Obfuscation:** The public API and rider-facing interface only receive route waypoints; personal home coordinates are not broadcast across the WebSocket/polling endpoints.
2. **Deterministic Sandboxing:** The solver and game-theoretic modules are pure functional algorithms with no filesystem or network execution privileges.
3. **DoS Resistance:** Input validation caps request batch sizes and enforces strict solver timeouts ($1.5\text{ s}$) to prevent resource exhaustion attacks.

---

### Q15: Why is Nashik used as the demo scenario?
**Answer:**  
Nashik provides a realistic, non-trivial urban topography:
- Clear arterial transit corridors (e.g., CBS, Nashik Road Railway Station, College Road, Gangapur Road, Panchavati, Dwarka, Indira Nagar, Satpur MIDC).
- Mix of high-density commercial hubs, industrial zones, and residential neighborhoods.
- Real road network circuity characteristics that test whether an algorithm can differentiate between corridor pooling and destructive cross-city detours.
- All fares are computed realistically in Indian Rupees (₹) with a ₹12/km base rate.
