"""
PoolIQ Metrics Engine — Aggregate Operational and Service KPIs.

Computes metrics comparing pooled performance against unpooled (solo) baselines:
  - Total pooled km & solo km
  - Saved km percentage
  - Distance-weighted average passenger occupancy
  - Empty vehicle deadhead percentage
  - Average & maximum rider detour percentages
  - Request service rates (served / deferred / rejected)
"""

from __future__ import annotations

import math
from typing import Callable, Optional

from backend.app.models import (
    LatLon,
    Metrics,
    Request,
    RequestStatus,
    RoutePlan,
)


def _haversine_distance(p1: LatLon, p2: LatLon) -> float:
    """Straight-line haversine distance in meters between two coordinates."""
    r = 6371000.0  # Earth radius in meters
    lat1, lon1 = math.radians(p1.lat), math.radians(p1.lon)
    lat2, lon2 = math.radians(p2.lat), math.radians(p2.lon)

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def compute_metrics(
    plans: list[RoutePlan],
    requests: list[Request],
    solo_plans: Optional[list[RoutePlan]] = None,
    dist_fn: Optional[Callable[[LatLon, LatLon], float]] = None,
) -> Metrics:
    """Compute aggregate KPIs for a scenario execution.

    Args:
        plans: Executed pooled RoutePlans for the active fleet.
        requests: All ride requests in the scenario.
        solo_plans: Optional RoutePlans for unpooled (solo) execution baseline.
        dist_fn: Optional distance function (defaulting to haversine).

    Returns:
        Metrics model conforming to PRD §6 data contract.
    """
    geo_dist = dist_fn if dist_fn is not None else _haversine_distance

    # 1. Total Pooled km
    pooled_m = sum(p.total_dist_m for p in plans)
    pooled_km = pooled_m / 1000.0

    # 2. Total Solo km
    if solo_plans is not None and len(solo_plans) > 0:
        solo_m = sum(p.total_dist_m for p in solo_plans)
        solo_km = solo_m / 1000.0
    else:
        # Compute from requests' direct distances
        served_statuses = {
            RequestStatus.ASSIGNED,
            RequestStatus.PICKED_UP,
            RequestStatus.COMPLETED,
        }
        served_reqs = [r for r in requests if r.status in served_statuses]

        # If requests have direct_dist_m, sum that; else use geo_dist
        solo_m = 0.0
        for r in served_reqs:
            if r.direct_dist_m is not None and r.direct_dist_m > 0:
                solo_m += r.direct_dist_m
            else:
                solo_m += geo_dist(r.pickup, r.drop)
        solo_km = solo_m / 1000.0

    # 3. Saved km %
    if solo_km > 0.0:
        saved_pct = ((solo_km - pooled_km) / solo_km) * 100.0
    else:
        saved_pct = 0.0

    # 4. Occupancy & Deadhead
    total_segment_dist = 0.0
    total_passenger_dist = 0.0
    empty_dist = 0.0

    for plan in plans:
        stops = plan.stops
        if not stops:
            continue

        for i in range(len(stops) - 1):
            s1 = stops[i]
            s2 = stops[i + 1]
            seg_dist = geo_dist(s1.point, s2.point)
            load = s1.load_after

            total_segment_dist += seg_dist
            total_passenger_dist += seg_dist * load
            if load == 0:
                empty_dist += seg_dist

    if total_segment_dist > 0.0:
        avg_occupancy = total_passenger_dist / total_segment_dist
        deadhead_pct = (empty_dist / total_segment_dist) * 100.0
    else:
        # Fallback if no stops or single stop
        avg_occupancy = 1.0 if pooled_km > 0 else 0.0
        deadhead_pct = 0.0

    # 5. Detour % (from validation per_rider records)
    detour_values: list[float] = []
    for plan in plans:
        if plan.validation and plan.validation.per_rider:
            for r_val in plan.validation.per_rider.values():
                detour_values.append(r_val.detour_pct)

    if detour_values:
        avg_detour_pct = sum(detour_values) / len(detour_values)
        max_detour_pct = max(detour_values)
    else:
        avg_detour_pct = 0.0
        max_detour_pct = 0.0

    # 6. Service rates
    total_requests = len(requests)
    if total_requests > 0:
        served_statuses = {
            RequestStatus.ASSIGNED,
            RequestStatus.PICKED_UP,
            RequestStatus.COMPLETED,
        }
        num_served = sum(1 for r in requests if r.status in served_statuses)
        served_pct = (num_served / total_requests) * 100.0
    else:
        served_pct = 0.0

    return Metrics(
        pooled_km=round(pooled_km, 2),
        solo_km=round(solo_km, 2),
        saved_pct=round(saved_pct, 2),
        avg_occupancy=round(avg_occupancy, 2),
        avg_detour_pct=round(avg_detour_pct, 2),
        max_detour_pct=round(max_detour_pct, 2),
        served_pct=round(served_pct, 2),
        deadhead_pct=round(deadhead_pct, 2),
    )
