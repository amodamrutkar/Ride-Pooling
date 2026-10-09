# PoolIQ — 2-Minute Demo Script
**Speaker:** Kaushik | **Driver:** Nakul | **Target Time:** 1:55 (leaves 5s buffer)

---

### Step 1: The Problem (0:00 – 0:15)
- **Spoken (Kaushik):**  
  > "Urban ride-pooling is broken in three ways: naive route matching causes massive rider detours, commercial dispatch algorithms operate as black boxes, and pooled fares are split arbitrarily without any mathematical fairness. On this screen, we have 5 commuters traveling across Nashik. In a solo world, they require separate vehicles driving 63.8 total kilometers."
- **Screen Action (Nakul):**  
  - Show initial dashboard view with 5 pending requests and 3 idle vehicles on the Leaflet dark map.
  - Hover over the pre-pooling metrics card showing the baseline solo footprint.

---

### Step 2: Adaptive Sliding-Window Batching & Dispatch (0:15 – 0:40)
- **Spoken (Kaushik):**  
  > "Instead of greedy first-come dispatch, PoolIQ collects requests into an adaptive 30-second sliding window. Watch the timeline fill. When urgent deadlines approach or the window expires, it flushes the batch into our hybrid engine: spatial candidate filtering, LOUD-inspired exact insertion, and warm-started OR-Tools polish."
- **Screen Action (Nakul):**  
  - Click **Start Simulation**.
  - Show window progress bar filling in the left panel. Window triggers flush.
  - Vehicle route polylines immediately animate on the map.
  - Highlight the metrics updating: **saved km: 35.4%**, **average occupancy: 2.1 riders**.

---

### Step 3: Independent Constraint Proof (0:40 – 1:00)
- **Spoken (Kaushik):**  
  > "Never trust the solver. Every single proposed route is verified by an independent hard-constraint validator completely isolated from the optimization logic. Look at Vehicle 2's route badge."
- **Screen Action (Nakul):**  
  - Click on Vehicle 2's route on the map to expand the **ProofBadge**.
  - Point to the live checkmarks:
    - ✔ Capacity: max 3/4 onboard
    - ✔ Precedence: pickups strictly before dropoffs
    - ✔ Pickup windows respected
    - ✔ Max detour: 11.2%, strictly under the 15% SLA cap

---

### Step 4: Provably Fair Shapley Fare Allocation (1:00 – 1:25)
- **Spoken (Kaushik):**  
  > "Now the million-dollar question: how do you split the bill? If you split equally, short-trip riders subsidize detours for others. PoolIQ computes exact cooperative game-theoretic Shapley values using bitmask DP. Rider 3 added the detour to Satpur MIDC, so they pay ₹88. Rider 1 stayed on the main corridor and pays only ₹52. Our live Fairness Audit proves efficiency, symmetry, and individual rationality."
- **Screen Action (Nakul):**  
  - Click the **Fairness Breakdown** card for Group G1.
  - Toggle between **Equal Split** vs **Shapley Values** bar charts.
  - Show the live **Fairness Audit** badges: Efficiency (₹214.40 = route cost ±₹0.00), Symmetry ✔, Null Player ✔.

---

### Step 5: Algorithm Arena (1:25 – 1:40)
- **Spoken (Kaushik):**  
  > "How do we know our algorithms actually work? Our Algorithm Arena benchmarks 5 distinct dispatch strategies on the exact same seeded scenario: Solo, Greedy FCFS, LOUD-inspired insertion, Hungarian batch matching, and Hybrid. Hybrid achieves the lowest total vehicle kilometers while keeping solve time under 500 milliseconds."
- **Screen Action (Nakul):**  
  - Open the bottom drawer to display the **Algorithm Arena** comparison table and performance graph.

---

### Step 6: Edge Case Stress & Rider View (1:40 – 1:55)
- **Spoken (Kaushik):**  
  > "Finally, what happens when an impossible request arrives? Watch Nakul add a rider whose dropoff would violate existing commitments. The engine rejects it with an explainable reason code: DETOUR_EXCEEDED. Existing riders are completely protected. Meanwhile, the mobile rider interface displays their guaranteed fare and live ETA."
- **Screen Action (Nakul):**  
  - Click **Add Request** in an outlier location.
  - Show instant explainable banner: `REJECTED: DETOUR_EXCEEDED — would push Rider 2 to 19.4% detour (cap 15%)`.
  - Switch tab to `/rider` on a mobile viewport showing the clean mobile booking interface.

---

### Wrap-Up (1:55 – 2:00)
- **Spoken (Kaushik):**  
  > "PoolIQ: Algorithmic ride-pooling that is verifiable, scalable, and provably fair."
