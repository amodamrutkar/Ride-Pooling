# Research Note: LOUD, KaRRi, and PoolIQ's Algorithmic Design

**Author:** Kaushik (Fair Pricing & Algorithmic Lead)  
**References:**
- Buchhold, Sanders, Wagner — *Fast, Exact and Scalable Dynamic Ridesharing* (ALENEX 2021), arXiv:2011.02601
- KaRRi — *Fast Many-to-Many Routing for Ridesharing with Multiple Pickup and Dropoff Locations* (Karlsruhe Institute of Technology)

---

## 1. What is LOUD?
**LOUD** stands for **L**ocal b**U**ckets **D**ispatching. In the ALENEX 2021 paper, Buchhold et al. tackled the problem of inserting a new ride request (pickup + dropoff) into a fleet of tens of thousands of active vehicles (tested on a 10,000-vehicle Berlin scenario) with provably minimum insertion cost in under **1 millisecond**.

Traditional dispatch algorithms either evaluate all vehicles linearly ($O(|V|)$) or rely on heuristic local searches that may miss the globally optimal insertion position along a route.

LOUD achieves exactness and extreme speed by coupling two techniques:
1. **Bucket Contraction Hierarchies (Bucket-CH):** A preprocessed hierarchical road graph index that enables many-to-many shortest path queries in microseconds.
2. **Local Bucket Indexing:** Associating each route stop and idle vehicle with spatial buckets in the graph hierarchy. Queries inspect only the local buckets relevant to the request's origin and destination.

**KaRRi** extends LOUD to evaluate multiple alternative pickup and dropoff locations (such as virtual walking stops or transit hubs) simultaneously.

---

## 2. What PoolIQ Borrowed (The "LOUD-Inspired" Dispatcher)
In our 24-hour build, we adopted the core conceptual insight of LOUD:
- **Spatial Stop Bucketing:** Instead of evaluating the entire fleet $V$, we maintain a spatial grid index over the active stops and locations of vehicles. For each incoming request, candidate vehicles are filtered to a local neighborhood ($K \le 8$ nearest candidates) in $O(1)$ time relative to fleet size.
- **Exhaustive Intra-Route Position Search:** For every candidate vehicle, we test **all** valid insertion pairs $(p, d)$ where pickup position $p \le d$. 
- **Precomputed Slack Arrays:** We precalculate cumulative delay absorption slack and onboard passenger ride-time slack along existing route waypoints. This allows evaluating the feasibility of inserting a new request in $O(1)$ without re-simulating the entire route from scratch.

---

## 3. What We Skipped and Why
1. **Contraction Hierarchies (CH) Preprocessing:**  
   Building a full Contraction Hierarchy or Customizable Contraction Hierarchy (CCH) for a road network requires hours of graph preprocessing and specialized C++ graph libraries. In a 24-hour Python/FastAPI environment, implementing custom CH data structures is prohibitive and error-prone.
2. **Sub-Millisecond Micro-Queries on Custom C++ Graph Kernels:**  
   Instead of custom C++ Bucket-CH, we utilize an OSRM table engine combined with our deterministic fallback circuity matrix.
3. **Multi-Stop Walking Discretization (KaRRi):**  
   We fix pickup and dropoff coordinates to exact door-to-door locations rather than searching walking stop candidate meshes.

---

## 4. How to Explain This Honestly to Hackathon Judges
> **Our Pitch Phrasing:**  
> *"We implement a **LOUD-inspired** dispatch engine. We borrow the spatial bucket candidate filtering, exhaustive intra-route $(p, d)$ evaluation, and $O(1)$ slack verification from Buchhold et al. However, we do not implement custom Contraction Hierarchies in our Python stack; we evaluate candidate insertions over our matrix engine and warm-start our OR-Tools polish stage."*

Transparency builds credibility. Technical judges who know the ALENEX paper will immediately recognize and respect this distinction.
