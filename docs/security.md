# PoolIQ Security Architecture & Threat Model

**Author:** Ketan (Platform, Validator & Security Lead)  
**Version:** 1.0 — 24-Hour Hackathon Delivery

---

## 1. Security Overview

PoolIQ operates as an explainable, algorithmic transit and fare dispatch platform. Given that ride-pooling infrastructure coordinates physical vehicle movement and financial fare allocation, security controls are built into every layer: network transport, API admission, solver execution, and routing validation.

---

## 2. Threat Model Matrix

| Threat | Impact | Attack Vector | Mitigation in PoolIQ |
|---|---|---|---|
| **Abusive Request Flooding** | Denial of Service, resource exhaustion | Automated spamming of `POST /api/requests` | In-memory IP rate limiter (60-120 req/min) returning HTTP 429; input payload size restrictions. |
| **Malformed / Out-of-Bounds Coordinates** | Solver instability, erroneous circuity, routing crashes | Crafting coordinates outside the target city (e.g., Delhi, ocean coordinates) | Pydantic geo-fence bounds: Nashik lat ∈ [19.80, 20.20], lon ∈ [73.60, 74.00]. Rejects with HTTP 422. |
| **Solver DoS (Algorithmic Complexity Attack)** | Infinite loop, thread pool exhaustion, API freeze | Crafting pathologically entangled time windows and high-degree detour requests | Asynchronous timeout wrapper (`run_with_timeout`, 1.5s max solver wall-clock); disjunction penalties allowing requests to be dropped/deferred. |
| **Tampered / Infeasible Route Injection** | Passenger safety compromise, capacity violation | Malicious or buggy optimizer output violating physical road constraints | **Independent Route Validator**: Zero-trust pure function re-checking capacity, precedence, time windows, and the 15% detour cap before any plan is committed. |
| **Unauthorized Simulation Hijacking** | Presentation demo disruption, state corruption | Unauthorized tampering with `/api/scenarios/*/load` or `/api/sim/control` | Bearer token authentication required for all administrative and clock control routes (`POOLIQ_ADMIN_TOKEN`). |
| **Information Leakage** | Profiling, fingerprinting, vulnerability exploitation | Server crashes returning full Python stack traces and environment internals | Global FastAPI exception handler masking internal errors and returning sanitized JSON envelopes. |

---

## 3. Defense-in-Depth Implementation Checklist

- [x] **Geographic Bounding Box:** Latitudes and longitudes strictly restricted to the Nashik urban boundary.
- [x] **Field Boundaries:** Request seats bounded strictly to `1–4`; request IDs sanitized and length-capped at 32 characters; max 500 requests per scenario batch.
- [x] **Rate Limiting:** IP-level sliding window rate limiter deployed on write routes.
- [x] **Solver Timeout Guard:** Solver routines are isolated with timeout enforcement to prevent thread pool starvation.
- [x] **Administrative Authorization:** Control endpoints protected by HTTP Bearer authentication token.
- [x] **Zero-Trust Independent Validation:** Every solver-generated route plan must pass independent mathematical checks (precedence, cumulative capacity, time windows, 15% detour ceiling) before entering live fleet state.
- [x] **Security Headers Middleware:** Responses injected with `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: no-referrer`.
- [x] **Privacy by Design:** Zero PII (Personally Identifiable Information) collection; synthetic riders with pseudonymous IDs only (`R1`, `R2`, ...); no live GPS trackers or third-party behavioral analytics.
- [x] **Clean Dependency Footprint:** No secrets or credentials committed to source control; `.env` listed in `.gitignore`.

---

## 4. Operational Best Practices for Judges & Evaluators

1. **Local Evaluation:** Run with default configuration. To test with auth enabled, provide `Authorization: Bearer pooliq-admin-secret-key` (or set `POOLIQ_ADMIN_TOKEN` in `.env`).
2. **Demo Mode:** Set `DISABLE_AUTH=true` in environment if testing UI without auth header configuration.
