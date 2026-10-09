"""
Strategy A: solo — One vehicle per rider (no pooling baseline).

Assigns nearest available idle vehicle per request.
No ride sharing allowed.
"""

from __future__ import annotations

import time
from backend.app.models import (
    DispatchResult,
    LatLon,
    RejectReason,
    RejectedRequest,
    Request,
    RequestStatus,
    RoutePlan,
    Stop,
    StopType,
    Vehicle,
)
from backend.engine.dispatch import DispatchCtx, Dispatcher


class SoloDispatcher(Dispatcher):
    """Strategy A: Nearest idle vehicle per rider (no pooling baseline)."""

    name: str = "solo"

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
        new_plans: list[RoutePlan] = []

        # Keep track of vehicles assigned in this dispatch round
        available_vehicles = {v.id: v for v in fleet if not v.route or not v.route.stops}

        for req in sorted(batch, key=lambda r: r.request_time):
            # Compute direct time & distance if missing
            if req.direct_time_s is None or req.direct_dist_m is None:
                dur, dist = ctx.matrix.pair(req.pickup, req.drop)
                req.direct_time_s = dur
                req.direct_dist_m = dist

            best_vehicle_id: str | None = None
            best_eta: float = float("inf")
            best_dist: float = float("inf")

            # Find nearest idle vehicle
            for v_id, v in available_vehicles.items():
                dur_to_pickup, dist_to_pickup = ctx.matrix.pair(v.position, req.pickup)
                if dur_to_pickup <= ctx.max_wait_s and dur_to_pickup < best_eta:
                    best_eta = dur_to_pickup
                    best_dist = dist_to_pickup
                    best_vehicle_id = v_id

            if best_vehicle_id is None:
                # No idle vehicle nearby
                rejected.append(
                    RejectedRequest(
                        id=req.id,
                        reason=RejectReason.NO_VEHICLE_NEARBY,
                        explain=f"No idle vehicle within {ctx.max_wait_s}s reach of pickup.",
                    )
                )
                continue

            vehicle = available_vehicles[best_vehicle_id]
            pickup_eta = ctx.now_s + best_eta
            dur_trip, dist_trip = ctx.matrix.pair(req.pickup, req.drop)
            drop_eta = pickup_eta + dur_trip

            stops = [
                Stop(
                    seq=0,
                    type=StopType.PICKUP,
                    request_id=req.id,
                    point=req.pickup,
                    eta_s=pickup_eta,
                    load_after=req.seats,
                ),
                Stop(
                    seq=1,
                    type=StopType.DROP,
                    request_id=req.id,
                    point=req.drop,
                    eta_s=drop_eta,
                    load_after=0,
                ),
            ]

            total_dist = best_dist + dist_trip
            total_time = best_eta + dur_trip
            version = (vehicle.route.version + 1) if vehicle.route else 1

            plan = RoutePlan(
                vehicle_id=vehicle.id,
                version=version,
                stops=stops,
                total_dist_m=total_dist,
                total_time_s=total_time,
                polyline=[[req.pickup.lat, req.pickup.lon], [req.drop.lat, req.drop.lon]],
            )

            # Optional validator check
            if ctx.validator is not None:
                report = ctx.validator(plan, [req], ctx.matrix)
                plan.validation = report
                if not report.ok:
                    rejected.append(
                        RejectedRequest(
                            id=req.id,
                            reason=RejectReason.DETOUR_EXCEEDED,
                            explain=f"Validator check failed: {', '.join(report.violations)}",
                        )
                    )
                    continue

            # Successfully assigned
            assigned_ids.append(req.id)
            new_plans.append(plan)
            # Remove vehicle from available idle pool
            del available_vehicles[best_vehicle_id]

        solve_ms = (time.perf_counter() - start_time) * 1000.0

        return DispatchResult(
            strategy=self.name,
            solve_ms=round(solve_ms, 2),
            plans=new_plans,
            assigned=assigned_ids,
            deferred=deferred_ids,
            rejected=rejected,
        )
