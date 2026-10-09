"""
Strategy B: greedy_fcfs — First-come first-served nearest feasible vehicle append.

For each request:
- Finds nearest feasible vehicle (including busy vehicles).
- Appends pickup + drop at the end of the vehicle's current route.
- Checks capacity and 15% ride-time cap constraints.
"""

from __future__ import annotations

import copy
import time
from backend.app.models import (
    DispatchResult,
    LatLon,
    RejectReason,
    RejectedRequest,
    Request,
    RoutePlan,
    Stop,
    StopType,
    Vehicle,
)
from backend.engine.dispatch import DispatchCtx, Dispatcher


class GreedyFcfsDispatcher(Dispatcher):
    """Strategy B: First-come first-served greedy append at end of route."""

    name: str = "greedy_fcfs"

    def dispatch(
        self,
        batch: list[Request],
        fleet: list[Vehicle],
        ctx: DispatchCtx,
    ) -> DispatchResult:
        start_time = time.perf_counter()

        assigned_ids: list[str] = []
        deferred_ids: list[str] = []
        rejected: list[RejectedRequest] = []

        # Create mutable working copies of fleet vehicle routes
        working_routes: dict[str, RoutePlan] = {
            v.id: copy.deepcopy(v.route) if v.route else RoutePlan(vehicle_id=v.id)
            for v in fleet
        }
        fleet_by_id = {v.id: v for v in fleet}

        for req in sorted(batch, key=lambda r: r.request_time):
            # Compute direct duration & distance
            if req.direct_time_s is None or req.direct_dist_m is None:
                dur, dist = ctx.matrix.pair(req.pickup, req.drop)
                req.direct_time_s = dur
                req.direct_dist_m = dist

            best_v_id: str | None = None
            best_added_time: float = float("inf")
            best_new_plan: RoutePlan | None = None

            for v in fleet:
                route = working_routes[v.id]
                existing_stops = route.stops

                # Determine starting position and ETA for pickup calculation
                if not existing_stops:
                    start_pt = v.position
                    start_eta = ctx.now_s
                    current_load = len(v.onboard)
                else:
                    start_pt = existing_stops[-1].point
                    start_eta = existing_stops[-1].eta_s
                    current_load = existing_stops[-1].load_after

                # Capacity check
                if current_load + req.seats > v.capacity:
                    continue

                # ETA to new pickup
                dur_to_pickup, dist_to_pickup = ctx.matrix.pair(start_pt, req.pickup)
                pickup_eta = start_eta + dur_to_pickup

                # Pickup window constraint check
                if pickup_eta - req.request_time > ctx.max_wait_s:
                    continue

                # ETA from pickup to drop
                dur_trip, dist_trip = ctx.matrix.pair(req.pickup, req.drop)
                drop_eta = pickup_eta + dur_trip

                # Ride-time cap constraint check (1.15 x direct_time)
                max_allowed_ride = (1.0 + req.detour_cap) * req.direct_time_s
                ride_time = drop_eta - pickup_eta
                if ride_time > max_allowed_ride + 1e-3:
                    continue

                added_time = dur_to_pickup + dur_trip

                if added_time < best_added_time:
                    # Construct candidate stops
                    new_seq = len(existing_stops)
                    pickup_stop = Stop(
                        seq=new_seq,
                        type=StopType.PICKUP,
                        request_id=req.id,
                        point=req.pickup,
                        eta_s=pickup_eta,
                        load_after=current_load + req.seats,
                    )
                    drop_stop = Stop(
                        seq=new_seq + 1,
                        type=StopType.DROP,
                        request_id=req.id,
                        point=req.drop,
                        eta_s=drop_eta,
                        load_after=current_load,
                    )

                    candidate_stops = list(existing_stops) + [pickup_stop, drop_stop]
                    candidate_dist = route.total_dist_m + dist_to_pickup + dist_trip
                    candidate_time = route.total_time_s + added_time

                    candidate_plan = RoutePlan(
                        vehicle_id=v.id,
                        version=route.version + 1 if route.stops else 1,
                        stops=candidate_stops,
                        total_dist_m=candidate_dist,
                        total_time_s=candidate_time,
                        polyline=[[s.point.lat, s.point.lon] for s in candidate_stops],
                    )

                    # Optional validator check
                    if ctx.validator is not None:
                        all_reqs = [req]  # validator will check all riders on vehicle
                        report = ctx.validator(candidate_plan, all_reqs, ctx.matrix)
                        candidate_plan.validation = report
                        if not report.ok:
                            continue

                    best_added_time = added_time
                    best_v_id = v.id
                    best_new_plan = candidate_plan

            if best_v_id is not None and best_new_plan is not None:
                working_routes[best_v_id] = best_new_plan
                assigned_ids.append(req.id)
            else:
                rejected.append(
                    RejectedRequest(
                        id=req.id,
                        reason=RejectReason.DETOUR_EXCEEDED,
                        explain=f"No feasible append placement for request {req.id} within detour/capacity limits.",
                    )
                )

        updated_plans = [plan for plan in working_routes.values() if plan.stops]
        solve_ms = (time.perf_counter() - start_time) * 1000.0

        return DispatchResult(
            strategy=self.name,
            solve_ms=round(solve_ms, 2),
            plans=updated_plans,
            assigned=assigned_ids,
            deferred=deferred_ids,
            rejected=rejected,
        )
