"""
Independent Route Validator — PoolIQ

Pure function route validator with ZERO dependencies on dispatchers or optimizers.
Enforces all operational and fairness constraints:
1. Precedence: Pickups precede drops (or passenger is already onboard).
2. Capacity: Onboard seats <= vehicle capacity at vehicle start and after every stop.
3. Pickup Window: Pickup arrival time within [request_time, request_time + max_wait_s].
4. Ride-time Cap (15% Rule): Ride time <= (1 + detour_cap) * T_direct.
5. Completeness & Sanity: No unknown request IDs, no negative times, no duplicate stops,
   and travel times between stops are physically feasible.

Owner: Ketan
"""

from __future__ import annotations

from typing import Any, Optional, Sequence, Union

from backend.app.models import (
    LatLon,
    Request,
    RiderValidation,
    RoutePlan,
    Stop,
    StopType,
    ValidationReport,
    Vehicle,
)
from backend.engine.routing.matrix_provider import MatrixProvider


def validate(
    stops: Sequence[Stop],
    requests: dict[str, Request],
    matrix: Optional[MatrixProvider] = None,
    vehicle_state: Optional[Union[Vehicle, dict[str, Any]]] = None,
    config: Optional[dict[str, Any]] = None,
    allow_partial_requests: bool = False,
) -> ValidationReport:
    """Validate a planned route against all business, safety, and operational constraints.

    Args:
        stops: Sequence of route stops to evaluate.
        requests: Map of request_id -> Request.
        matrix: Optional MatrixProvider to verify or calculate transit times and direct times.
        vehicle_state: Optional Vehicle model or dict with vehicle attributes (capacity, onboard, position, etc.).
        config: Optional configuration overrides (e.g., tolerance seconds).

    Returns:
        ValidationReport containing ok (bool), violations (list[str]), and per_rider stats.
    """
    violations: list[str] = []
    per_rider: dict[str, RiderValidation] = {}

    # Extract vehicle parameters
    if isinstance(vehicle_state, Vehicle):
        capacity = vehicle_state.capacity
        onboard = list(vehicle_state.onboard)
        vehicle_pos = vehicle_state.position
    elif isinstance(vehicle_state, dict):
        capacity = vehicle_state.get("capacity", 4)
        onboard = list(vehicle_state.get("onboard", []))
        vehicle_pos = vehicle_state.get("position", None)
        if isinstance(vehicle_pos, dict):
            vehicle_pos = LatLon(lat=vehicle_pos["lat"], lon=vehicle_pos["lon"])
    else:
        capacity = 4
        onboard = []
        vehicle_pos = None

    # Track onboard pickup times if passed via config or vehicle_state
    onboard_pickup_times: dict[str, float] = {}
    if isinstance(vehicle_state, dict):
        onboard_pickup_times = vehicle_state.get("onboard_pickup_times", {})
    elif config and "onboard_pickup_times" in config:
        onboard_pickup_times = config["onboard_pickup_times"]

    # 1. Sanity check: Negative times or invalid sequences
    prev_eta = -1.0
    seen_stops_by_type: dict[tuple[str, StopType], int] = {}
    
    for idx, stop in enumerate(stops):
        if stop.eta_s < 0:
            violations.append(f"NEGATIVE_TIME: Stop {idx} ({stop.request_id}) has negative ETA {stop.eta_s}s")
        if stop.load_after < 0:
            violations.append(f"NEGATIVE_LOAD: Stop {idx} ({stop.request_id}) has negative load {stop.load_after}")
        if idx > 0 and stop.eta_s < prev_eta - 1e-3:
            violations.append(
                f"CHRONOLOGY_VIOLATION: Stop {idx} ETA ({stop.eta_s}s) is earlier than stop {idx-1} ETA ({prev_eta}s)"
            )
        prev_eta = stop.eta_s

        key = (stop.request_id, stop.type)
        seen_stops_by_type[key] = seen_stops_by_type.get(key, 0) + 1

    # Check for duplicate stops for same request & type
    for (req_id, st_type), count in seen_stops_by_type.items():
        if count > 1:
            violations.append(f"DUPLICATE_STOP: Request {req_id} has {count} {st_type.value} stops")

    # 2. Unknown request IDs
    if not allow_partial_requests:
        for stop in stops:
            if stop.request_id not in requests:
                violations.append(f"UNKNOWN_REQUEST: Stop references unknown request_id '{stop.request_id}'")

        for rider_id in onboard:
            if rider_id not in requests:
                violations.append(f"UNKNOWN_ONBOARD_REQUEST: Onboard list contains unknown request_id '{rider_id}'")

    # Calculate initial load from onboard riders
    current_load = 0
    for rider_id in onboard:
        if rider_id in requests:
            current_load += requests[rider_id].seats
        else:
            current_load += 1

    if current_load > capacity:
        violations.append(f"CAPACITY_EXCEEDED: Initial onboard load ({current_load}) exceeds vehicle capacity ({capacity})")

    # 3. Capacity and Load Consistency Check
    tracked_load = current_load
    for idx, stop in enumerate(stops):
        req = requests.get(stop.request_id)
        seats = req.seats if req else 1

        if stop.type == StopType.PICKUP:
            tracked_load += seats
        elif stop.type == StopType.DROP:
            tracked_load -= seats

        if tracked_load < 0:
            violations.append(f"NEGATIVE_LOAD: Load dropped below 0 at stop {idx} ({stop.request_id})")

        if tracked_load > capacity:
            violations.append(
                f"CAPACITY_EXCEEDED: Stop {idx} ({stop.request_id} {stop.type.value}) puts load at {tracked_load} > capacity {capacity}"
            )

        if stop.load_after != tracked_load:
            violations.append(
                f"LOAD_MISMATCH: Stop {idx} declared load_after={stop.load_after} does not match computed load={tracked_load}"
            )

    # 4. Precedence, Pickup Windows, and Ride-Time Detour Checks
    pickups: dict[str, Stop] = {}
    drops: dict[str, Stop] = {}

    for stop in stops:
        if stop.type == StopType.PICKUP:
            pickups[stop.request_id] = stop
        elif stop.type == StopType.DROP:
            drops[stop.request_id] = stop

    # Riders served on this route: onboard riders + new pickups
    active_riders = set(onboard) | set(pickups.keys()) | set(drops.keys())

    for rider_id in active_riders:
        req = requests.get(rider_id)
        if not req:
            continue

        is_onboard = rider_id in onboard

        # Check pickup exists or already onboard
        if not is_onboard and rider_id not in pickups:
            violations.append(f"MISSING_PICKUP: Request {rider_id} has drop stop but no pickup stop")
            continue

        if is_onboard and rider_id in pickups:
            violations.append(f"INVALID_PICKUP: Request {rider_id} is already onboard but has a pickup stop")

        if rider_id not in drops:
            violations.append(f"MISSING_DROP: Request {rider_id} has no drop stop")
            continue

        pickup_stop = pickups.get(rider_id)
        drop_stop = drops[rider_id]

        if not is_onboard and pickup_stop:
            # Check pickup precedes drop in sequence
            if pickup_stop.seq >= drop_stop.seq:
                violations.append(
                    f"PRECEDENCE_VIOLATION: Request {rider_id} pickup (seq={pickup_stop.seq}) must precede drop (seq={drop_stop.seq})"
                )

            # Pickup Window check: [request_time, request_time + max_wait_s]
            pickup_arrival = pickup_stop.eta_s
            window_start = req.request_time
            window_end = req.request_time + req.max_wait_s

            if pickup_arrival < window_start - 1e-2:
                violations.append(
                    f"WINDOW_TOO_EARLY: Request {rider_id} pickup arrival {pickup_arrival:.1f}s is before request_time {window_start:.1f}s"
                )
            if pickup_arrival > window_end + 1e-2:
                violations.append(
                    f"WINDOW_MISSED: Request {rider_id} pickup arrival {pickup_arrival:.1f}s exceeds deadline {window_end:.1f}s"
                )

            wait_s = max(0.0, pickup_arrival - req.request_time)
            pickup_time = pickup_arrival
        else:
            # Rider already onboard
            pickup_time = onboard_pickup_times.get(rider_id, req.request_time)
            wait_s = 0.0

        drop_arrival = drop_stop.eta_s
        ride_time = max(0.0, drop_arrival - pickup_time)

        # Direct time
        direct_time_s = req.direct_time_s
        if (direct_time_s is None or direct_time_s <= 0) and matrix:
            direct_time_s, _ = matrix.pair(req.pickup, req.drop)

        if direct_time_s is None or direct_time_s <= 0:
            direct_time_s = max(1.0, ride_time)

        # Direct distance and trip distance boundaries
        if config:
            enforce_min = getattr(config, "enforce_min_trip_distance", False) if hasattr(config, "enforce_min_trip_distance") else config.get("enforce_min_trip_distance", False)
            min_dist = getattr(config, "min_trip_distance_m", 500.0) if hasattr(config, "min_trip_distance_m") else config.get("min_trip_distance_m", 500.0)
            max_dist = getattr(config, "max_trip_distance_m", 35000.0) if hasattr(config, "max_trip_distance_m") else config.get("max_trip_distance_m", 35000.0)
            trip_dist = req.direct_dist_m
            if trip_dist is None and matrix:
                _, trip_dist = matrix.pair(req.pickup, req.drop)
            if trip_dist is not None:
                if enforce_min and trip_dist < min_dist:
                    violations.append(f"TRIP_DISTANCE_TOO_SHORT: Request {rider_id} distance {trip_dist:.0f}m is below min {min_dist:.0f}m")
                if trip_dist > max_dist:
                    violations.append(f"TRIP_DISTANCE_TOO_LONG: Request {rider_id} distance {trip_dist:.0f}m exceeds max {max_dist:.0f}m")

        # Ride-time cap with safe short-trip slack
        # Prevents division-by-zero or exaggerated detour penalties on small direct times
        safe_direct_time_s = max(1.0, direct_time_s)
        short_slack = 0.0
        if config and isinstance(config, dict):
            short_slack = config.get("short_trip_absolute_slack_s", 0.0)
        elif config and hasattr(config, "short_trip_absolute_slack_s"):
            short_slack = getattr(config, "short_trip_absolute_slack_s", 0.0)

        allowed_detour_s = max(req.detour_cap * safe_direct_time_s, short_slack)
        max_allowed_ride_time = safe_direct_time_s + allowed_detour_s
        detour_pct = max(0.0, (ride_time - safe_direct_time_s) / safe_direct_time_s * 100.0)

        # Tolerance of 0.1s to avoid float precision false positives
        if ride_time > max_allowed_ride_time + 0.1:
            allowed_pct = (allowed_detour_s / safe_direct_time_s) * 100.0
            violations.append(
                f"DETOUR_EXCEEDED: Request {rider_id} detour {detour_pct:.1f}% > cap {allowed_pct:.1f}% "
                f"(ride_time={ride_time:.1f}s, max_allowed={max_allowed_ride_time:.1f}s, direct={safe_direct_time_s:.1f}s)"
            )

        per_rider[rider_id] = RiderValidation(
            detour_pct=round(detour_pct, 2),
            wait_s=round(wait_s, 2),
        )

    # 5. Travel-time feasibility with matrix if matrix is provided
    if matrix and len(stops) > 0:
        prev_point = vehicle_pos if vehicle_pos else stops[0].point
        prev_time = 0.0 if not vehicle_pos else stops[0].eta_s - matrix.pair(prev_point, stops[0].point)[0]
        if prev_time < 0:
            prev_time = 0.0

        for idx, stop in enumerate(stops):
            curr_point = stop.point
            min_transit_s, _ = matrix.pair(prev_point, curr_point)
            
            # Check physical feasibility between consecutive stops
            if idx > 0:
                elapsed_s = stop.eta_s - stops[idx - 1].eta_s
                if elapsed_s < min_transit_s - 1.0:  # 1s buffer for floating precision
                    violations.append(
                        f"PHYSICAL_INCONSISTENCY: Stop {idx-1} to {idx} elapsed time {elapsed_s:.1f}s is less than matrix road transit {min_transit_s:.1f}s"
                    )
            prev_point = curr_point

    is_ok = len(violations) == 0
    return ValidationReport(
        ok=is_ok,
        violations=violations,
        per_rider=per_rider,
    )


def validate_route_plan(
    plan: RoutePlan,
    requests: Sequence[Request] | dict[str, Request],
    matrix: Optional[MatrixProvider] = None,
    vehicle_state: Optional[Union[Vehicle, dict[str, Any]]] = None,
    config: Optional[dict[str, Any]] = None,
    allow_partial_requests: bool = True,
) -> ValidationReport:
    """Validate a planned route against all business, safety, and operational constraints.

    Adapts RoutePlan and request collections into the core validate() engine.
    """
    req_dict: dict[str, Request] = (
        requests if isinstance(requests, dict) else {r.id: r for r in requests}
    )
    return validate(
        stops=plan.stops,
        requests=req_dict,
        matrix=matrix,
        vehicle_state=vehicle_state,
        config=config,
        allow_partial_requests=allow_partial_requests,
    )

