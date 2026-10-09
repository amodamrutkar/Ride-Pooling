"""
PoolIQ Baselines — Standard Non-Game-Theoretic Fare Splits.

Provides comparative allocations to benchmark against Shapley values:
  - Solo trip cost (unpooled direct travel)
  - Equal split (v(N) / n)
  - Distance-proportional split (v(N) * solo_i / sum(solo))
"""

from __future__ import annotations

from typing import Callable

from backend.app.models import LatLon, Request


def solo_fares(
    requests: list[Request],
    dist_fn: Callable[[LatLon, LatLon], float],
    rate_per_km: float = 12.0,
    booking_fee: float = 0.0,
) -> dict[str, float]:
    """Calculate the solo (unpooled) cost for each individual rider."""
    fares: dict[str, float] = {}
    for r in requests:
        dist_m = dist_fn(r.pickup, r.drop)
        cost = (dist_m / 1000.0) * rate_per_km + booking_fee
        fares[r.id] = round(cost, 2)
    return fares


def equal_split(
    total_cost: float,
    rider_ids: list[str],
    booking_fee: float = 0.0,
) -> dict[str, float]:
    """Split the total group route cost equally among all riders."""
    n = len(rider_ids)
    if n == 0:
        return {}

    per_rider = total_cost / n
    split = {rid: round(per_rider + booking_fee, 2) for rid in rider_ids}

    # Balance rounding discrepancy to ensure exact sum
    target_sum = round(total_cost + n * booking_fee, 2)
    diff = round(target_sum - sum(split.values()), 2)
    if abs(diff) > 0:
        split[rider_ids[0]] = round(split[rider_ids[0]] + diff, 2)

    return split


def distance_proportional_split(
    total_cost: float,
    solo_costs: dict[str, float],
    booking_fee: float = 0.0,
) -> dict[str, float]:
    """Split the total route cost proportionally to riders' solo trip costs."""
    riders = list(solo_costs.keys())
    n = len(riders)
    if n == 0:
        return {}

    # Strip booking fee from solo base if present
    base_solo = {rid: max(0.0, solo_costs[rid] - booking_fee) for rid in riders}
    sum_solo = sum(base_solo.values())

    if sum_solo == 0.0:
        return equal_split(total_cost, riders, booking_fee)

    split = {
        rid: round((base_solo[rid] / sum_solo) * total_cost + booking_fee, 2)
        for rid in riders
    }

    # Balance rounding discrepancy
    target_sum = round(total_cost + n * booking_fee, 2)
    diff = round(target_sum - sum(split.values()), 2)
    if abs(diff) > 0:
        split[riders[0]] = round(split[riders[0]] + diff, 2)

    return split
