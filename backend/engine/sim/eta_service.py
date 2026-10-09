"""
Traffic-Aware ETA & Driver Lateness Service — PoolIQ

Tracks and computes independent ETAs:
1. Driver-to-pickup ETA
2. Expected passenger pickup timestamp
3. Passenger direct-trip ETA
4. Expected destination arrival timestamp
5. Predicted arrival time & delay compared to initial committed ETA
6. Driver lateness states (ON_TIME, ARRIVING_EARLY, SLIGHT_DELAY, SIGNIFICANT_DELAY, DEADLINE_AT_RISK, DEADLINE_MISSED)

Rule: A 50% delay is an operational alert threshold, NOT an accusation of fraud.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.app.models import (
    EtaDetails,
    LatenessStatus,
    Request,
    RoutePlan,
    StopType,
    TrafficMode,
    Vehicle,
)
from backend.engine.routing.matrix_provider import MatrixProvider


class EtaService:
    """Computes, monitors, and separates ETAs for vehicles and active riders."""

    def __init__(self) -> None:
        # request_id -> initial_destination_eta_s
        self._initial_drop_etas: dict[str, float] = {}
        # request_id -> previous_destination_eta_s
        self._previous_drop_etas: dict[str, float] = {}
        # request_id -> EtaDetails
        self._eta_cache: dict[str, EtaDetails] = {}

    def reset(self) -> None:
        self._initial_drop_etas.clear()
        self._previous_drop_etas.clear()
        self._eta_cache.clear()

    def record_initial_commitment(self, request_id: str, committed_drop_eta_s: float) -> None:
        """Lock in initial promised destination ETA when request is first assigned."""
        if request_id not in self._initial_drop_etas:
            self._initial_drop_etas[request_id] = committed_drop_eta_s
            self._previous_drop_etas[request_id] = committed_drop_eta_s

    def compute_request_eta(
        self,
        request: Request,
        assigned_vehicle: Optional[Vehicle],
        matrix: MatrixProvider,
        now_s: float,
        traffic_mode: TrafficMode = TrafficMode.NORMAL,
        traffic_source: str = "Cached Road Data",
    ) -> EtaDetails:
        """Compute the complete separated ETA profile for a rider."""
        req_id = request.id

        # 1. Direct trip ETA
        direct_time_s = request.direct_time_s
        if direct_time_s is None or direct_time_s <= 0:
            direct_time_s, _ = matrix.pair(request.pickup, request.drop)
            request.direct_time_s = direct_time_s

        if not assigned_vehicle or not assigned_vehicle.route:
            # Unassigned: driver ETA is unavailable, pickup time is pending
            return EtaDetails(
                request_id=req_id,
                vehicle_id=None,
                driver_to_pickup_eta_s=0.0,
                passenger_pickup_time_s=round(now_s + request.max_wait_s, 1),
                passenger_direct_eta_s=round(direct_time_s, 1),
                expected_destination_eta_s=round(now_s + request.max_wait_s + direct_time_s, 1),
                current_predicted_arrival_s=round(now_s + request.max_wait_s + direct_time_s, 1),
                delay_vs_previous_s=0.0,
                delay_vs_initial_s=0.0,
                delay_pct=0.0,
                lateness_status=LatenessStatus.ETA_UNAVAILABLE,
                traffic_mode=traffic_mode,
                traffic_source=traffic_source,
            )

        # Vehicle is assigned: find stops for this rider
        route: RoutePlan = assigned_vehicle.route
        pickup_stop = next((s for s in route.stops if s.request_id == req_id and s.type == StopType.PICKUP), None)
        drop_stop = next((s for s in route.stops if s.request_id == req_id and s.type == StopType.DROP), None)

        is_onboard = req_id in assigned_vehicle.onboard

        if is_onboard:
            # Already picked up
            driver_to_pickup_s = 0.0
            pickup_arrival_time = now_s
        elif pickup_stop:
            driver_to_pickup_s = max(0.0, pickup_stop.eta_s - now_s)
            pickup_arrival_time = pickup_stop.eta_s
        else:
            driver_to_pickup_s, _ = matrix.pair(assigned_vehicle.position, request.pickup)
            pickup_arrival_time = now_s + driver_to_pickup_s

        # Predicted destination arrival
        if drop_stop:
            predicted_arrival_time = drop_stop.eta_s
        else:
            predicted_arrival_time = pickup_arrival_time + direct_time_s

        # Record or compare with initial committed arrival
        if req_id not in self._initial_drop_etas:
            self._initial_drop_etas[req_id] = predicted_arrival_time
            self._previous_drop_etas[req_id] = predicted_arrival_time

        initial_drop_time = self._initial_drop_etas[req_id]
        prev_drop_time = self._previous_drop_etas.get(req_id, initial_drop_time)

        diff_vs_initial = predicted_arrival_time - initial_drop_time
        delay_vs_initial = max(0.0, diff_vs_initial)
        delay_vs_prev = predicted_arrival_time - prev_drop_time
        self._previous_drop_etas[req_id] = predicted_arrival_time

        # Calculate delay percentage against initial promised trip duration or baseline
        initial_duration = max(10.0, initial_drop_time - request.request_time)
        baseline_s = min(initial_duration, max(10.0, direct_time_s))
        delay_pct = round((delay_vs_initial / baseline_s) * 100.0, 1)

        # Classify lateness status
        pickup_deadline = request.request_time + request.max_wait_s

        if pickup_arrival_time > pickup_deadline + 1.0:
            lateness = LatenessStatus.DEADLINE_MISSED
        elif pickup_arrival_time > pickup_deadline - 45.0:
            lateness = LatenessStatus.DEADLINE_AT_RISK
        elif diff_vs_initial <= -30.0:
            lateness = LatenessStatus.ARRIVING_EARLY
        elif delay_pct >= 50.0 or delay_vs_initial >= 180.0:
            # 50% or large delay: operational warning, NEVER fraud
            lateness = LatenessStatus.SIGNIFICANT_DELAY
        elif delay_vs_initial >= 60.0 or delay_pct >= 20.0:
            lateness = LatenessStatus.SLIGHT_DELAY
        else:
            lateness = LatenessStatus.ON_TIME

        details = EtaDetails(
            request_id=req_id,
            vehicle_id=assigned_vehicle.id,
            driver_to_pickup_eta_s=round(driver_to_pickup_s, 1),
            passenger_pickup_time_s=round(pickup_arrival_time, 1),
            passenger_direct_eta_s=round(direct_time_s, 1),
            expected_destination_eta_s=round(predicted_arrival_time, 1),
            current_predicted_arrival_s=round(predicted_arrival_time, 1),
            delay_vs_previous_s=round(delay_vs_prev, 1),
            delay_vs_initial_s=round(delay_vs_initial, 1),
            delay_pct=delay_pct,
            lateness_status=lateness,
            traffic_mode=traffic_mode,
            traffic_source=traffic_source,
        )

        self._eta_cache[req_id] = details
        return details

    def get_cached_eta(self, request_id: str) -> Optional[EtaDetails]:
        return self._eta_cache.get(request_id)
