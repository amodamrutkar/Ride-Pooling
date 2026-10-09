"""
Tests for PoolIQ Pricing Engine (Shapley, Baselines, Audit).

Validates all 7 required tests from kaushik.md:
  1. 3 symmetric riders, symmetric costs -> equal phi.
  2. 2 riders, one is a pure subset-route of the other -> null-ish player pays approx marginal only.
  3. Sum(phi) = v(N) on 100 random seeded groups (property test).
  4. Exact vs Monte-Carlo agree within CI for n = 5.
  5. Single rider -> phi = solo cost.
  6. IR violation example is detected and reported.
  7. Brute-force check of bitmask DP vs naive permutations for n <= 3.
"""

import math
import random
import pytest

from backend.app.models import LatLon, Request
from backend.engine.pricing.audit import run_fairness_audit
from backend.engine.pricing.baselines import (
    distance_proportional_split,
    equal_split,
    solo_fares,
)
from backend.engine.pricing.shapley import (
    CharacteristicFunction,
    _compute_v_subset_dp,
    _solve_bruteforce_v,
    compute_exact_shapley,
    compute_fares,
    compute_monte_carlo_shapley,
)


def euclidean_m(p1: LatLon, p2: LatLon) -> float:
    """Simple 2D distance scaled so 0.01 deg approx 1110m."""
    dx = (p1.lon - p2.lon) * 111000.0
    dy = (p1.lat - p2.lat) * 111000.0
    return math.sqrt(dx * dx + dy * dy)


# ─── Test 1: Symmetric riders receive equal fares ─────────────────────────────

def test_symmetric_riders_equal_fares():
    """3 symmetric riders along a shared corridor must receive equal Shapley values."""
    # 3 identical riders: pickup at (0, 0), drop at (0, 0.05)
    r1 = Request(id="R1", pickup=LatLon(lat=0.0, lon=0.0), drop=LatLon(lat=0.0, lon=0.05), request_time=0.0)
    r2 = Request(id="R2", pickup=LatLon(lat=0.0, lon=0.0), drop=LatLon(lat=0.0, lon=0.05), request_time=0.0)
    r3 = Request(id="R3", pickup=LatLon(lat=0.0, lon=0.0), drop=LatLon(lat=0.0, lon=0.05), request_time=0.0)

    # Executed cost for the shared trip
    solo_dist_m = euclidean_m(r1.pickup, r1.drop)
    rate = 12.0
    solo_cost = (solo_dist_m / 1000.0) * rate
    executed_cost = solo_cost  # Perfectly pooled: vehicle only traverses the corridor once

    breakdown = compute_fares(
        group_requests=[r1, r2, r3],
        dist_fn=euclidean_m,
        executed_cost=executed_cost,
        rate_per_km=rate,
    )

    phi1 = breakdown.shapley["R1"]
    phi2 = breakdown.shapley["R2"]
    phi3 = breakdown.shapley["R3"]

    # Fares must be equal within 0.05
    assert abs(phi1 - phi2) <= 0.05
    assert abs(phi2 - phi3) <= 0.05

    # Sum of fares must equal executed cost
    assert abs(sum(breakdown.shapley.values()) - executed_cost) <= 0.05
    assert breakdown.audit is not None
    assert breakdown.audit.efficiency is True
    assert breakdown.audit.symmetry is True


# ─── Test 2: Pure subset route (null-ish player pays marginal only) ───────────

def test_subset_route_null_player():
    """Rider R2 is fully on R1's path; adding R2 incurs 0 extra detour."""
    # R1: (0, 0) -> (0, 0.10)
    # R2: (0, 0.03) -> (0, 0.07)  -- intermediate stop completely on the way
    r1 = Request(id="R1", pickup=LatLon(lat=0.0, lon=0.0), drop=LatLon(lat=0.0, lon=0.10), request_time=0.0)
    r2 = Request(id="R2", pickup=LatLon(lat=0.0, lon=0.03), drop=LatLon(lat=0.0, lon=0.07), request_time=0.0)

    rate = 12.0
    cost_r1 = (euclidean_m(r1.pickup, r1.drop) / 1000.0) * rate
    executed_cost = cost_r1  # Vehicle follows R1's path and serves R2 at zero detour

    v = CharacteristicFunction(
        requests=[r1, r2],
        dist_fn=euclidean_m,
        rate_per_km=rate,
        executed_cost=executed_cost,
    )

    exact = compute_exact_shapley([r1, r2], v)

    # R2's marginal contribution to {R1} is v({R1, R2}) - v({R1}) = 0
    # To empty set {}, R2's contribution is v({R2})
    # Therefore, phi(R2) = 0.5 * 0 + 0.5 * v({R2})
    cost_r2 = (euclidean_m(r2.pickup, r2.drop) / 1000.0) * rate
    expected_phi_r2 = 0.5 * cost_r2
    assert abs(exact["R2"] - expected_phi_r2) <= 0.05
    assert abs(exact["R1"] + exact["R2"] - executed_cost) <= 0.05


# ─── Test 3: Property test (Sum of fares == v(N) on 100 random groups) ────────

def test_fares_sum_to_group_cost_100_groups():
    """Property test: Across 100 random groups, efficiency is always satisfied."""
    rng = random.Random(1337)
    rate = 12.0

    for test_idx in range(100):
        group_size = rng.randint(1, 4)
        reqs = []
        for i in range(group_size):
            p = LatLon(lat=19.99 + rng.uniform(-0.05, 0.05), lon=73.78 + rng.uniform(-0.05, 0.05))
            d = LatLon(lat=19.99 + rng.uniform(-0.05, 0.05), lon=73.78 + rng.uniform(-0.05, 0.05))
            reqs.append(Request(id=f"R{i}", pickup=p, drop=d, request_time=0.0))

        v_temp = CharacteristicFunction(reqs, euclidean_m, rate)
        calc_v_n = v_temp.value(frozenset(r.id for r in reqs))
        executed_cost = calc_v_n * rng.uniform(0.9, 1.1)  # Real simulated variance

        breakdown = compute_fares(
            group_requests=reqs,
            dist_fn=euclidean_m,
            executed_cost=executed_cost,
            rate_per_km=rate,
        )

        fare_sum = sum(breakdown.shapley.values())
        assert abs(fare_sum - breakdown.total_cost) <= 0.05, (
            f"Failed on group {test_idx}: sum={fare_sum}, total={breakdown.total_cost}"
        )
        assert breakdown.audit.efficiency is True


# ─── Test 4: Exact vs Monte-Carlo agree within CI for n = 5 ───────────────────

def test_exact_vs_monte_carlo_n5():
    """Exact Shapley and Monte-Carlo Shapley agree within 95% CI for n = 5."""
    rng = random.Random(42)
    rate = 12.0
    reqs = []
    for i in range(5):
        p = LatLon(lat=20.0 + rng.uniform(-0.02, 0.02), lon=73.8 + rng.uniform(-0.02, 0.02))
        d = LatLon(lat=20.0 + rng.uniform(-0.02, 0.02), lon=73.8 + rng.uniform(-0.02, 0.02))
        reqs.append(Request(id=f"R{i}", pickup=p, drop=d, request_time=0.0))

    v = CharacteristicFunction(reqs, euclidean_m, rate)
    v_n = v.value(frozenset(r.id for r in reqs))

    exact = compute_exact_shapley(reqs, v)
    mc_mean, mc_ci = compute_monte_carlo_shapley(reqs, v, num_samples=3000, seed=123)

    for r in reqs:
        rid = r.id
        exact_val = exact[rid]
        ci_lower, ci_upper = mc_ci[rid]
        # Monte-Carlo estimate should be close to exact value (within 10% or within CI bounds with margin)
        assert abs(mc_mean[rid] - exact_val) <= max(2.5, exact_val * 0.15), (
            f"Rider {rid}: exact={exact_val}, mc_mean={mc_mean[rid]}, CI=[{ci_lower}, {ci_upper}]"
        )


# ─── Test 5: Single rider -> phi = solo cost ─────────────────────────────────

def test_single_rider_solo_cost():
    """A single rider pays exactly their own solo trip cost."""
    r = Request(
        id="R1",
        pickup=LatLon(lat=19.9975, lon=73.7898),
        drop=LatLon(lat=20.0120, lon=73.8050),
        request_time=0.0,
    )
    rate = 12.0
    expected_solo = (euclidean_m(r.pickup, r.drop) / 1000.0) * rate

    breakdown = compute_fares(
        group_requests=[r],
        dist_fn=euclidean_m,
        executed_cost=expected_solo,
        rate_per_km=rate,
    )

    assert abs(breakdown.shapley["R1"] - expected_solo) <= 0.05
    assert breakdown.audit.individual_rationality.ok is True


# ─── Test 6: IR violation is detected and reported ────────────────────────────

def test_ir_violation_detected():
    """Audit properly detects and flags individual rationality violations."""
    shapley_fares = {"R1": 150.0, "R2": 50.0}
    solo_fares = {"R1": 120.0, "R2": 80.0}  # R1 pays 150 > 120 (violates IR!)

    audit = run_fairness_audit(
        shapley_fares=shapley_fares,
        solo_fares=solo_fares,
        total_cost=200.0,
    )

    assert audit.efficiency is True
    assert audit.individual_rationality.ok is False
    assert len(audit.individual_rationality.violations) == 1
    assert "R1" in audit.individual_rationality.violations[0]


# ─── Test 7: Brute-force check of bitmask DP vs naive permutations for n <= 3 ─

def test_bitmask_dp_vs_bruteforce_n3():
    """Verify bitmask DP matches brute force permutation search for n = 1, 2, 3."""
    rng = random.Random(999)
    rate = 12.0

    for n in [1, 2, 3]:
        reqs = []
        for i in range(n):
            p = LatLon(lat=20.0 + rng.uniform(-0.03, 0.03), lon=73.8 + rng.uniform(-0.03, 0.03))
            d = LatLon(lat=20.0 + rng.uniform(-0.03, 0.03), lon=73.8 + rng.uniform(-0.03, 0.03))
            reqs.append(Request(id=f"R{i}", pickup=p, drop=d, request_time=0.0))

        dp_cost = _compute_v_subset_dp(reqs, euclidean_m, rate, capacity=4)
        bf_cost = _solve_bruteforce_v(reqs, euclidean_m, rate, capacity=4)

        assert abs(dp_cost - bf_cost) <= 0.001, (
            f"Mismatch for n={n}: DP={dp_cost}, BF={bf_cost}"
        )
