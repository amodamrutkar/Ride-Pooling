"""
PoolIQ Shapley Engine — Exact & Monte-Carlo Fair Fare Allocation.

Computes game-theoretic Shapley value fare allocations for pooled ride groups.
Implements:
  - Bitmask DP for characteristic coalition value v(S) over precedence-valid stop orderings.
  - Exact Shapley formulation for n <= 5 riders.
  - Seeded Monte-Carlo permutation sampling with 95% CI for n > 5 riders.
  - Integration with baseline fare splits and fairness audit.
"""

from __future__ import annotations

import itertools
import math
import random
from typing import Callable, Optional

from backend.app.models import (
    FareBreakdown,
    LatLon,
    Request,
)
from backend.engine.pricing.audit import run_fairness_audit
from backend.engine.pricing.baselines import (
    distance_proportional_split,
    equal_split,
    solo_fares,
)


def _compute_v_subset_dp(
    subset_requests: list[Request],
    dist_fn: Callable[[LatLon, LatLon], float],
    rate_per_km: float,
    capacity: int = 4,
) -> float:
    """Compute v(S) using bitmask DP over stops.
    
    Returns minimum route cost (₹) to serve riders in S from the first pickup
    to the last drop, respecting pickup-before-drop precedence and vehicle capacity.
    """
    k = len(subset_requests)
    if k == 0:
        return 0.0

    if k == 1:
        req = subset_requests[0]
        dist_m = dist_fn(req.pickup, req.drop)
        return (dist_m / 1000.0) * rate_per_km

    # Build stops: 2k stops.
    # For rider i (0 <= i < k):
    # stop 2*i: Pickup
    # stop 2*i + 1: Drop
    stops: list[LatLon] = []
    demand: list[int] = []  # seats added at stop (+seats for pickup, -seats for drop)
    is_drop: list[bool] = []
    rider_of_stop: list[int] = []

    for idx, r in enumerate(subset_requests):
        seats = r.seats if r.seats > 0 else 1
        stops.append(r.pickup)
        demand.append(seats)
        is_drop.append(False)
        rider_of_stop.append(idx)

        stops.append(r.drop)
        demand.append(-seats)
        is_drop.append(True)
        rider_of_stop.append(idx)

    num_stops = 2 * k
    target_mask = (1 << num_stops) - 1

    # Precompute pairwise distances between all stops in subset
    dist_matrix = [[0.0] * num_stops for _ in range(num_stops)]
    for i in range(num_stops):
        for j in range(num_stops):
            if i != j:
                dist_matrix[i][j] = dist_fn(stops[i], stops[j])

    # dp[mask][last_stop] = min distance (meters)
    # Start: route starts at any pickup stop (cost counted from first pickup).
    dp: dict[tuple[int, int], float] = {}

    for i in range(num_stops):
        if not is_drop[i]:  # Must start at a pickup
            mask = 1 << i
            dp[(mask, i)] = 0.0

    # Iterate over mask sizes from 1 to num_stops - 1
    # Group states by popcount of mask for structured layer-by-layer DP
    masks_by_size: list[list[int]] = [[] for _ in range(num_stops + 1)]
    for m in range(1, 1 << num_stops):
        masks_by_size[m.bit_count()].append(m)

    for sz in range(1, num_stops):
        for mask in masks_by_size[sz]:
            # Calculate current vehicle load for this mask
            current_load = 0
            for s in range(num_stops):
                if mask & (1 << s):
                    current_load += demand[s]

            for last_stop in range(num_stops):
                state = (mask, last_stop)
                if state not in dp:
                    continue
                current_dist = dp[state]

                # Try all next unvisited stops
                for nxt in range(num_stops):
                    if mask & (1 << nxt):
                        continue

                    # Precedence check: if nxt is drop of rider r, pickup must be visited
                    r_idx = rider_of_stop[nxt]
                    pickup_stop = 2 * r_idx
                    if is_drop[nxt] and not (mask & (1 << pickup_stop)):
                        continue

                    # Capacity check: if nxt is pickup, adding its demand must not exceed capacity
                    if not is_drop[nxt]:
                        if current_load + demand[nxt] > capacity:
                            continue

                    nxt_mask = mask | (1 << nxt)
                    nxt_dist = current_dist + dist_matrix[last_stop][nxt]
                    nxt_state = (nxt_mask, nxt_nxt := nxt)

                    if nxt_state not in dp or nxt_dist < dp[nxt_state]:
                        dp[nxt_state] = nxt_dist

    # Find minimum distance where all stops are visited
    min_dist = float("inf")
    for last_stop in range(num_stops):
        final_state = (target_mask, last_stop)
        if final_state in dp and dp[final_state] < min_dist:
            min_dist = dp[final_state]

    if math.isinf(min_dist):
        # Fallback in case of capacity deadlock: sum of individual trips
        total_solo_dist = sum(dist_fn(r.pickup, r.drop) for r in subset_requests)
        return (total_solo_dist / 1000.0) * rate_per_km

    return (min_dist / 1000.0) * rate_per_km


def _solve_bruteforce_v(
    subset_requests: list[Request],
    dist_fn: Callable[[LatLon, LatLon], float],
    rate_per_km: float,
    capacity: int = 4,
) -> float:
    """Brute force all valid permutations of stops to find minimum route distance.
    
    Used for unit testing and verifying DP correctness.
    """
    k = len(subset_requests)
    if k == 0:
        return 0.0
    if k == 1:
        req = subset_requests[0]
        return (dist_fn(req.pickup, req.drop) / 1000.0) * rate_per_km

    num_stops = 2 * k
    stops: list[LatLon] = []
    demand: list[int] = []
    is_drop: list[bool] = []
    rider_of_stop: list[int] = []

    for idx, r in enumerate(subset_requests):
        seats = r.seats if r.seats > 0 else 1
        stops.append(r.pickup)
        demand.append(seats)
        is_drop.append(False)
        rider_of_stop.append(idx)

        stops.append(r.drop)
        demand.append(-seats)
        is_drop.append(True)
        rider_of_stop.append(idx)

    min_dist = float("inf")

    for perm in itertools.permutations(range(num_stops)):
        # First stop must be a pickup
        if is_drop[perm[0]]:
            continue

        valid = True
        visited = set()
        load = 0
        dist = 0.0

        for i, stop_idx in enumerate(perm):
            visited.add(stop_idx)
            # Check precedence
            if is_drop[stop_idx]:
                p_stop = 2 * rider_of_stop[stop_idx]
                if p_stop not in visited:
                    valid = False
                    break
            # Check capacity
            load += demand[stop_idx]
            if load > capacity or load < 0:
                valid = False
                break

            if i > 0:
                dist += dist_fn(stops[perm[i - 1]], stops[stop_idx])

        if valid and dist < min_dist:
            min_dist = dist

    return (min_dist / 1000.0) * rate_per_km


class CharacteristicFunction:
    """Memoized coalition value evaluator v(S)."""

    def __init__(
        self,
        requests: list[Request],
        dist_fn: Callable[[LatLon, LatLon], float],
        rate_per_km: float,
        executed_cost: Optional[float] = None,
        capacity: int = 4,
    ):
        self.requests = requests
        self.request_map = {r.id: r for r in requests}
        self.dist_fn = dist_fn
        self.rate_per_km = rate_per_km
        self.executed_cost = executed_cost
        self.capacity = capacity
        self.all_ids = frozenset(r.id for r in requests)
        self._memo: dict[frozenset[str], float] = {}

    def value(self, subset: frozenset[str]) -> float:
        """Returns v(S)."""
        if not subset:
            return 0.0

        # Grand coalition overrides to executed_cost if provided
        if subset == self.all_ids and self.executed_cost is not None and self.executed_cost > 0:
            return self.executed_cost

        if subset in self._memo:
            return self._memo[subset]

        sub_reqs = [self.request_map[rid] for rid in subset]
        val = _compute_v_subset_dp(
            sub_reqs,
            self.dist_fn,
            self.rate_per_km,
            self.capacity,
        )
        self._memo[subset] = val
        return val


def compute_exact_shapley(
    requests: list[Request],
    v: CharacteristicFunction,
) -> dict[str, float]:
    """Compute exact Shapley values for all riders in requests using classical formula."""
    riders = [r.id for r in requests]
    n = len(riders)
    if n == 0:
        return {}
    if n == 1:
        return {riders[0]: v.value(frozenset([riders[0]]))}

    shapley_fares: dict[str, float] = {rid: 0.0 for rid in riders}
    n_fact = math.factorial(n)

    for i_idx, i_rid in enumerate(riders):
        other_riders = [r for r in riders if r != i_rid]
        m = len(other_riders)

        # Enumerate all subsets of other_riders
        for k in range(m + 1):
            weight = (math.factorial(k) * math.factorial(n - k - 1)) / n_fact
            for subset_tuple in itertools.combinations(other_riders, k):
                s = frozenset(subset_tuple)
                s_with_i = s | {i_rid}
                marginal = v.value(s_with_i) - v.value(s)
                shapley_fares[i_rid] += weight * marginal

    return shapley_fares


def compute_monte_carlo_shapley(
    requests: list[Request],
    v: CharacteristicFunction,
    num_samples: int = 2000,
    seed: int = 42,
) -> tuple[dict[str, float], dict[str, list[float]]]:
    """Compute Monte-Carlo Shapley values with 95% confidence intervals.
    
    Returns (mean_fares, confidence_intervals) where confidence_intervals
    maps rider_id -> [ci_lower, ci_upper].
    """
    riders = [r.id for r in requests]
    n = len(riders)
    if n == 0:
        return {}, {}

    rng = random.Random(seed)
    # Store marginal contributions for each rider across permutations
    marginals: dict[str, list[float]] = {rid: [] for rid in riders}

    for _ in range(num_samples):
        perm = list(riders)
        rng.shuffle(perm)

        current_set = set()
        current_v = 0.0

        for rid in perm:
            next_set = frozenset(current_set | {rid})
            next_v = v.value(next_set)
            marginal = next_v - current_v
            marginals[rid].append(marginal)

            current_set.add(rid)
            current_v = next_v

    shapley_mean: dict[str, float] = {}
    shapley_ci: dict[str, list[float]] = {}

    z_95 = 1.96

    for rid in riders:
        vals = marginals[rid]
        mean = sum(vals) / len(vals)
        variance = sum((x - mean) ** 2 for x in vals) / (len(vals) - 1) if len(vals) > 1 else 0.0
        std_err = math.sqrt(variance / len(vals)) if len(vals) > 1 else 0.0

        shapley_mean[rid] = mean
        shapley_ci[rid] = [mean - z_95 * std_err, mean + z_95 * std_err]

    # Normalize Monte-Carlo mean so efficiency is exactly satisfied with executed cost
    v_n = v.value(frozenset(riders))
    raw_sum = sum(shapley_mean.values())
    if raw_sum > 0:
        factor = v_n / raw_sum
        for rid in riders:
            shapley_mean[rid] = round(shapley_mean[rid] * factor, 4)
            shapley_ci[rid] = [
                round(shapley_ci[rid][0] * factor, 4),
                round(shapley_ci[rid][1] * factor, 4),
            ]

    return shapley_mean, shapley_ci


def compute_fares(
    group_requests: list[Request],
    dist_fn: Callable[[LatLon, LatLon], float],
    executed_cost: float,
    rate_per_km: float = 12.0,
    booking_fee: float = 0.0,
    seed: int = 42,
    group_id: str = "G1",
    capacity: int = 4,
) -> FareBreakdown:
    """Main entry point for computing fair fares and baseline comparisons.
    
    Args:
        group_requests: List of riders sharing the pool.
        dist_fn: Function returning road distance in meters between two LatLon points.
        executed_cost: Total ₹ cost of the executed pooled route (v(N)).
        rate_per_km: Base ₹ cost per kilometer.
        booking_fee: Flat fee added to each rider's fare outside the game.
        seed: Random seed for Monte-Carlo sampling.
        group_id: Identifier for the pool group.
        capacity: Vehicle passenger capacity.
        
    Returns:
        FareBreakdown matching PRD §6 data contract.
    """
    riders = [r.id for r in group_requests]
    n = len(riders)

    if n == 0:
        return FareBreakdown(
            group_id=group_id,
            riders=[],
            total_cost=0.0,
        )

    # Solo fares for all riders
    solo = solo_fares(group_requests, dist_fn, rate_per_km, booking_fee)

    # Initialize characteristic function
    v = CharacteristicFunction(
        requests=group_requests,
        dist_fn=dist_fn,
        rate_per_km=rate_per_km,
        executed_cost=executed_cost,
        capacity=capacity,
    )

    effective_total = executed_cost if executed_cost > 0 else v.value(frozenset(riders))
    final_total_cost = effective_total + (n * booking_fee)

    # Compute Shapley
    shapley_ci: Optional[dict[str, list[float]]] = None
    if n <= 5:
        raw_shapley = compute_exact_shapley(group_requests, v)
        # Apply booking fee and round
        shapley = {rid: round(fare + booking_fee, 2) for rid, fare in raw_shapley.items()}
    else:
        raw_shapley, ci = compute_monte_carlo_shapley(
            group_requests, v, num_samples=2000, seed=seed
        )
        shapley = {rid: round(fare + booking_fee, 2) for rid, fare in raw_shapley.items()}
        shapley_ci = {
            rid: [round(c[0] + booking_fee, 2), round(c[1] + booking_fee, 2)]
            for rid, c in ci.items()
        }

    # Ensure exact rounding balance to final_total_cost
    fare_sum = sum(shapley.values())
    diff = round(final_total_cost - fare_sum, 2)
    if abs(diff) > 0 and riders:
        # Adjust the first rider by rounding discrepancy (cent level)
        shapley[riders[0]] = round(shapley[riders[0]] + diff, 2)

    # Compute baseline allocations
    equal = equal_split(effective_total, riders, booking_fee)
    proportional = distance_proportional_split(effective_total, solo, booking_fee)

    # Run Fairness Audit
    audit = run_fairness_audit(
        shapley_fares=shapley,
        solo_fares=solo,
        total_cost=final_total_cost,
        v_func=v.value,
        rider_ids=riders,
    )

    return FareBreakdown(
        group_id=group_id,
        riders=riders,
        total_cost=round(final_total_cost, 2),
        solo=solo,
        equal=equal,
        proportional=proportional,
        shapley=shapley,
        shapley_ci=shapley_ci,
        audit=audit,
    )
