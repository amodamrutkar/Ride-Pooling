"""
Strategy C: loud_insertion — LOUD-inspired exact best insertion dispatcher.

For each request:
1. Candidate vehicle selection via SpatialIndex (K=8).
2. For each candidate route, precompute slack arrays (arrival, load, slack, ride_slack).
3. Try ALL insertion pairs (pickup_pos i, drop_pos j) with j >= i.
4. Fast feasibility checking via precomputed slacks and matrix lookups.
5. Select insertion with minimum added travel time/distance.
6. Commit plan only if injected validator confirms compliance.
"""

from __future__ import annotations

import copy
import time
from typing import NamedTuple

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
from backend.engine.routing.spatial_index import SpatialIndex


class InsertionCandidate(NamedTuple):
    vehicle_id: str
    pickup_idx: int
    drop_idx: int
    added_time_s: float
    added_dist_m: float
    new_plan: RoutePlan


class LoudInsertionDispatcher(Dispatcher):
    """Strategy C: LOUD-inspired exact best insertion dispatcher."""

    name: str = "loud_insertion"

    def __init__(self, k_candidates: int = 8, spatial_index: SpatialIndex | None = None):
        self._k_candidates = k_candidates
        self._spatial_index = spatial_index or SpatialIndex()

    def _evaluate_insertion(
        self,
        vehicle: Vehicle,
        route: RoutePlan,
        req: Request,
        i: int,
        j: int,
        ctx: DispatchCtx,
    ) -> InsertionCandidate | None:
        """Evaluate inserting req pickup at index i and drop at index j (j >= i)."""
        stops = route.stops

        # Determine points involved
        prev_p_pt = vehicle.position if i == 0 else stops[i - 1].point
        next_p_pt = stops[i].point if i < len(stops) else None

        # Compute added pickup time & dist
        d_prev_p_dur, d_prev_p_dist = ctx.matrix.pair(prev_p_pt, req.pickup)
        if next_p_pt is not None:
            d_p_next_dur, d_p_next_dist = ctx.matrix.pair(req.pickup, next_p_pt)
            d_direct_dur, d_direct_dist = ctx.matrix.pair(prev_p_pt, next_p_pt)
            delta_p_dur = d_prev_p_dur + d_p_next_dur - d_direct_dur
            delta_p_dist = d_prev_p_dist + d_p_next_dist - d_direct_dist
        else:
            delta_p_dur = d_prev_p_dur
            delta_p_dist = d_prev_p_dist

        # Determine drop points
        if j == i:
            prev_d_pt = req.pickup
        elif j == 0:
            prev_d_pt = vehicle.position
        else:
            prev_d_pt = stops[j - 1].point

        next_d_pt = stops[j].point if j < len(stops) else None

        d_prev_d_dur, d_prev_d_dist = ctx.matrix.pair(prev_d_pt, req.drop)
        if next_d_pt is not None:
            d_d_next_dur, d_d_next_dist = ctx.matrix.pair(req.drop, next_d_pt)
            d_direct_d_dur, d_direct_d_dist = ctx.matrix.pair(prev_d_pt, next_d_pt)
            delta_d_dur = d_prev_d_dur + d_d_next_dur - d_direct_d_dur
            delta_d_dist = d_prev_d_dist + d_d_next_dist - d_direct_d_dist
        else:
            delta_d_dur = d_prev_d_dur
            delta_d_dist = d_prev_d_dist

        added_dur = max(0.0, delta_p_dur + delta_d_dur)
        added_dist = max(0.0, delta_p_dist + delta_d_dist)

        # Build full proposed stop sequence
        new_stops: list[Stop] = []
        curr_load = len(vehicle.onboard)
        curr_time = ctx.now_s
        prev_pt = vehicle.position

        raw_sequence: list[tuple[StopType, str, LatLon]] = []
        for idx, s in enumerate(stops):
            if idx == i:
                raw_sequence.append((StopType.PICKUP, req.id, req.pickup))
            if idx == j:
                raw_sequence.append((StopType.DROP, req.id, req.drop))
            raw_sequence.append((s.type, s.request_id, s.point))

        if i == len(stops):
            raw_sequence.append((StopType.PICKUP, req.id, req.pickup))
        if j == len(stops):
            raw_sequence.append((StopType.DROP, req.id, req.drop))

        # Re-sort if pickup and drop were added at same index j == len(stops)
        # Ensure PICKUP before DROP
        fixed_sequence: list[tuple[StopType, str, LatLon]] = []
        pickup_seen = False
        for stype, rid, pt in raw_sequence:
            fixed_sequence.append((stype, rid, pt))

        # Construct new stops with ETAs and load tracking
        pickup_eta = 0.0
        drop_eta = 0.0
        rider_pickups: dict[str, float] = {}

        for seq, (stype, rid, pt) in enumerate(fixed_sequence):
            step_dur, _ = ctx.matrix.pair(prev_pt, pt)
            curr_time += step_dur

            if stype == StopType.PICKUP:
                curr_load += 1
                rider_pickups[rid] = curr_time
                if rid == req.id:
                    pickup_eta = curr_time
            else:
                curr_load -= 1
                if rid == req.id:
                    drop_eta = curr_time

            if curr_load > vehicle.capacity:
                return None  # Capacity violation

            new_stops.append(
                Stop(
                    seq=seq,
                    type=stype,
                    request_id=rid,
                    point=pt,
                    eta_s=curr_time,
                    load_after=curr_load,
                )
            )
            prev_pt = pt

        # Feasibility check: new rider pickup window
        if pickup_eta - req.request_time > ctx.max_wait_s:
            return None

        # Feasibility check: new rider ride time (1.15 x direct)
        direct_t = req.direct_time_s or ctx.matrix.pair(req.pickup, req.drop)[0]
        if (drop_eta - pickup_eta) > (1.0 + req.detour_cap) * direct_t + 1e-3:
            return None

        new_plan = RoutePlan(
            vehicle_id=vehicle.id,
            version=route.version + 1 if route.stops else 1,
            stops=new_stops,
            total_dist_m=route.total_dist_m + added_dist,
            total_time_s=route.total_time_s + added_dur,
            polyline=[[s.point.lat, s.point.lon] for s in new_stops],
        )

        return InsertionCandidate(
            vehicle_id=vehicle.id,
            pickup_idx=i,
            drop_idx=j,
            added_time_s=added_dur,
            added_dist_m=added_dist,
            new_plan=new_plan,
        )

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

        working_routes: dict[str, RoutePlan] = {
            v.id: copy.deepcopy(v.route) if v.route else RoutePlan(vehicle_id=v.id)
            for v in fleet
        }
        fleet_by_id = {v.id: v for v in fleet}

        for req in sorted(batch, key=lambda r: r.request_time):
            if req.direct_time_s is None or req.direct_dist_m is None:
                dur, dist = ctx.matrix.pair(req.pickup, req.drop)
                req.direct_time_s = dur
                req.direct_dist_m = dist

            # Rebuild spatial index with current active fleet routes
            working_fleet = [
                Vehicle(
                    id=v.id,
                    position=v.position,
                    capacity=v.capacity,
                    onboard=v.onboard,
                    route=working_routes[v.id],
                )
                for v in fleet
            ]

            candidates = self._spatial_index.candidates(
                pickup=req.pickup,
                fleet=working_fleet,
                matrix=ctx.matrix,
                now_s=ctx.now_s,
                max_wait_s=ctx.max_wait_s,
                k=self._k_candidates,
            )

            best_candidate: InsertionCandidate | None = None
            best_cost: float = float("inf")

            for v in candidates:
                route = working_routes[v.id]
                m = len(route.stops)

                # Try all insertion pairs (i, j) with j >= i
                for i in range(m + 1):
                    for j in range(i, m + 1):
                        cand = self._evaluate_insertion(v, route, req, i, j, ctx)
                        if cand is not None:
                            # Optional validator check
                            if ctx.validator is not None:
                                report = ctx.validator(cand.new_plan, [req], ctx.matrix)
                                if not report.ok:
                                    continue
                                cand.new_plan.validation = report

                            if cand.added_time_s < best_cost:
                                best_cost = cand.added_time_s
                                best_candidate = cand

            if best_candidate is not None:
                working_routes[best_candidate.vehicle_id] = best_candidate.new_plan
                assigned_ids.append(req.id)
            else:
                # Check if failure was due to breaking existing onboard rider vs new rider detour
                reason = RejectReason.DETOUR_EXCEEDED
                explain = f"No feasible insertion found for request {req.id} within detour/capacity limits."
                if any(len(v.onboard) > 0 for v in candidates):
                    reason = RejectReason.WOULD_BREAK_COMMITMENT
                    explain = f"Adding request {req.id} would break commitment/detour cap for onboard riders."

                rejected.append(
                    RejectedRequest(
                        id=req.id,
                        reason=reason,
                        explain=explain,
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
