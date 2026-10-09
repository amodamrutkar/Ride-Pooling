"""
World Orchestrator — PoolIQ

Central coordinator maintaining fleet state, simulation clock, request queues,
dispatch orchestration, validator enforcement, metrics computation, and caching.
Owner: Ketan
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, Optional

from backend.app.models import (
    DispatchResult,
    DistanceConfig,
    EtaDetails,
    FareBreakdown,
    FairnessAudit,
    FlushReason,
    GpsAlertSummary,
    GpsIntegrityResult,
    GpsObservationStatus,
    GpsReasonCode,
    GpsRiskLevel,
    IndividualRationalityAudit,
    LatLon,
    LocationUpdate,
    Metrics,
    RejectReason,
    Request,
    RequestStatus,
    RiderValidation,
    RoutePlan,
    Scenario,
    Stop,
    StopType,
    TrafficMode,
    TrafficScenarioConfig,
    Vehicle,
    WindowState,
)
from backend.app.persistence import PersistenceManager
from backend.engine.batching.sliding_window import BatchDecision, WindowBatcher
from backend.engine.dispatch import DispatchCtx
from backend.engine.dispatch.batch_matching import BatchMatchingDispatcher
from backend.engine.dispatch.greedy_fcfs import GreedyFcfsDispatcher
from backend.engine.dispatch.hybrid import HybridDispatcher
from backend.engine.dispatch.loud_insertion import LoudInsertionDispatcher
from backend.engine.dispatch.solo import SoloDispatcher
from backend.engine.integrity.gps_verifier import GpsIntegrityVerifier
from backend.engine.metrics.metrics import compute_metrics
from backend.engine.pricing.shapley import compute_fares
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.routing.matrix_provider import MatrixProvider
from backend.engine.routing.traffic_provider import TrafficMatrixProvider
from backend.engine.sim.clock import SimClock
from backend.engine.sim.eta_service import EtaService
from backend.engine.sim.vehicle_motion import EventType, check_stop_events, interpolate_position
from backend.engine.validator.validator import validate, validate_route_plan


class World:
    """Singleton-style or orchestrator object managing live simulation state."""

    def __init__(
        self,
        matrix_provider: Optional[MatrixProvider] = None,
        db_path: str = "backend/data/pooliq.db",
    ) -> None:
        self.base_matrix = matrix_provider or FallbackMatrixProvider()
        self.traffic_provider = TrafficMatrixProvider(self.base_matrix)
        self.matrix = self.traffic_provider
        self.clock = SimClock(speed=1)
        self.batcher = WindowBatcher(window_s=30.0, n_max=12, urgency_margin_s=20.0)
        self.persistence = PersistenceManager(db_path=db_path)

        self.distance_config = DistanceConfig()
        self.gps_verifier = GpsIntegrityVerifier()
        self.eta_service = EtaService()

        self.vehicles: dict[str, Vehicle] = {}
        self.requests: dict[str, Request] = {}
        self.pending_scenario_requests: list[Request] = []
        self.metrics = Metrics()
        self.fare_groups: dict[str, FareBreakdown] = {}
        self.last_dispatch_result: Optional[DispatchResult] = None

        # Plan history: request_id -> {"before": RoutePlan, "after": RoutePlan}
        self.diff_history: dict[str, dict[str, Any]] = {}

        # Cached state dict for <20ms GET /api/state
        self._cached_state: dict[str, Any] = {}
        self._custom_dispatcher: Optional[Callable[..., DispatchResult]] = None
        self._vehicle_last_stop_seq: dict[str, int] = {}

        # Pre-instantiated dispatchers (Strategies A-E)
        self._dispatchers = {
            "solo": SoloDispatcher(),
            "greedy_fcfs": GreedyFcfsDispatcher(),
            "greedy": GreedyFcfsDispatcher(),
            "loud_insertion": LoudInsertionDispatcher(),
            "loud": LoudInsertionDispatcher(),
            "batch_matching": BatchMatchingDispatcher(),
            "batch": BatchMatchingDispatcher(),
            "hybrid": HybridDispatcher(),
        }

        self._update_cache()

    def set_dispatcher(self, dispatcher_fn: Callable[..., DispatchResult]) -> None:
        """Inject Spandan's dispatch engine when available."""
        self._custom_dispatcher = dispatcher_fn

    def load_scenario(self, scenario_path_or_id: str) -> None:
        """Load scenario from JSON file or ID."""
        file_path = Path(scenario_path_or_id)
        if not file_path.exists():
            file_path = Path("backend/data/scenarios") / f"{scenario_path_or_id}.json"
        if not file_path.exists():
            file_path = Path("backend/data/scenarios/demo_5r_3v.json")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        scenario = Scenario.model_validate(data)

        # Reset state
        self.clock.reset()
        self.vehicles.clear()
        self.requests.clear()
        self.pending_scenario_requests.clear()
        self.fare_groups.clear()
        self.diff_history.clear()
        self._vehicle_last_stop_seq.clear()
        self.batcher = WindowBatcher(window_s=30.0, n_max=12, urgency_margin_s=20.0)
        self.persistence.clear()
        self.eta_service.reset()

        # Load vehicles and seed trusted GPS positions
        for v in scenario.vehicles:
            self.vehicles[v.id] = v
            self.gps_verifier.set_trusted_initial_position(
                entity_id=v.id,
                position=v.position,
                server_time=self.clock.now(),
                route=v.route,
            )

        # Populate direct distances and times
        for req in scenario.requests:
            if req.direct_time_s is None or req.direct_dist_m is None:
                dur, dist = self.matrix.pair(req.pickup, req.drop)
                req.direct_time_s = round(dur, 1)
                req.direct_dist_m = round(dist, 1)

            self.requests[req.id] = req
            self.pending_scenario_requests.append(req)

        # Pre-seed demo diff for R2 so Before/After toggle works immediately on boot
        self.diff_history["R2"] = {
            "request_id": "R2",
            "vehicle_id": "V1",
            "before": {
                "polyline": [
                    [19.9977, 73.7803],
                    [20.0020, 73.7870],
                    [20.0069, 73.7930],
                ],
                "total_dist_m": 4800,
                "total_time_s": 240,
            },
            "after": {
                "polyline": [
                    [19.9977, 73.7803],
                    [19.9900, 73.7810],
                    [19.9878, 73.7825],
                    [19.9920, 73.7860],
                    [19.9980, 73.7890],
                    [20.0069, 73.7930],
                    [20.0060, 73.7850],
                    [20.0050, 73.7750],
                    [20.0046, 73.7628],
                ],
                "total_dist_m": 7200,
                "total_time_s": 420,
            },
            "old_route": {
                "polyline": [
                    [19.9977, 73.7803],
                    [20.0020, 73.7870],
                    [20.0069, 73.7930],
                ],
                "total_dist_m": 4800,
                "total_time_s": 240,
            },
            "new_route": {
                "polyline": [
                    [19.9977, 73.7803],
                    [19.9900, 73.7810],
                    [19.9878, 73.7825],
                    [19.9920, 73.7860],
                    [19.9980, 73.7890],
                    [20.0069, 73.7930],
                    [20.0060, 73.7850],
                    [20.0050, 73.7750],
                    [20.0046, 73.7628],
                ],
                "total_dist_m": 7200,
                "total_time_s": 420,
            },
            "detour_pct": 5.1,
            "cost_delta": 28.8,
        }

        self._check_scenario_requests_injection(now_s=0.0)
        self._recompute_metrics()
        self._update_cache()

    def submit_request(self, req: Request) -> Request:
        """Add a dynamic user request directly into the live engine."""
        now_s = self.clock.now()
        req.request_time = now_s

        if req.direct_time_s is None or req.direct_dist_m is None:
            dur, dist = self.matrix.pair(req.pickup, req.drop)
            req.direct_time_s = round(dur, 1)
            req.direct_dist_m = round(dist, 1)

        self.requests[req.id] = req
        self.batcher.add(req, now_s=now_s)
        self._update_cache()
        return req

    def tick(self, now_s: Optional[float] = None) -> None:
        """Advance time step and process simulation triggers."""
        curr_time = self.clock.now() if now_s is None else now_s

        # Update vehicle motion & process reached stops
        self._update_vehicle_motion(curr_time)

        # Feed scenario requests arriving by current time
        self._check_scenario_requests_injection(curr_time)

        # Batcher tick
        batch_decision = self.batcher.tick(curr_time)
        if batch_decision:
            self._execute_dispatch_pipeline(batch_decision, strategy="hybrid")

        self._recompute_metrics()
        self._update_cache()

    def _update_vehicle_motion(self, curr_time: float) -> None:
        """Update vehicle positions and process reached stops."""
        for veh in self.vehicles.values():
            if not veh.route or not veh.route.stops:
                continue

            last_seq = self._vehicle_last_stop_seq.get(veh.id, -1)
            events = check_stop_events(veh.route, curr_time, last_checked_seq=last_seq)
            for event in events:
                self._vehicle_last_stop_seq[veh.id] = max(
                    self._vehicle_last_stop_seq.get(veh.id, -1), event.stop_seq
                )
                req = self.requests.get(event.request_id)
                if event.event_type == EventType.PICKUP:
                    if req and req.status == RequestStatus.ASSIGNED:
                        req.status = RequestStatus.PICKED_UP
                    if event.request_id not in veh.onboard:
                        veh.onboard.append(event.request_id)
                elif event.event_type == EventType.DROP:
                    if req and req.status == RequestStatus.PICKED_UP:
                        req.status = RequestStatus.COMPLETED
                    if event.request_id in veh.onboard:
                        veh.onboard.remove(event.request_id)

            if veh.route.polyline and len(veh.route.polyline) >= 2:
                veh.position = interpolate_position(
                    veh.route.polyline,
                    elapsed_s=max(0.0, curr_time),
                    speed_mps=25000.0 / 3600.0,
                )

    def step(self, sim_seconds: float) -> None:
        """Step simulation clock by specified duration."""
        self.clock.step(sim_seconds)
        self.tick()

    def force_dispatch(self, strategy: str = "hybrid") -> Optional[DispatchResult]:
        """Force flush the current window and run dispatch immediately."""
        now_s = self.clock.now()
        self._check_scenario_requests_injection(now_s)
        decision = self.batcher.force_flush(now_s)
        if decision:
            return self._execute_dispatch_pipeline(decision, strategy=strategy)
        return None

    def get_diff(self, request_id: str) -> Optional[dict[str, Any]]:
        """Return before and after plans for the vehicle handling request_id."""
        return self.diff_history.get(request_id)

    def get_state(self) -> dict[str, Any]:
        """Return cached serialized state (<20ms)."""
        return self._cached_state

    # ─── Internal Dispatch Pipeline ──────────────────────────────────────────

    def _execute_dispatch_pipeline(
        self, decision: BatchDecision, strategy: str = "hybrid"
    ) -> DispatchResult:
        start_ms = time.perf_counter() * 1000.0

        if self._custom_dispatcher is not None:
            # Use registered external dispatcher
            result = self._custom_dispatcher(
                batch=decision.requests,
                vehicles=list(self.vehicles.values()),
                matrix=self.matrix,
                strategy=strategy,
            )
        elif strategy.lower() in self._dispatchers:
            # Use integrated dispatch strategy (Strategies A-E)
            disp = self._dispatchers[strategy.lower()]
            ctx = DispatchCtx(
                matrix=self.matrix,
                now_s=self.clock.now(),
                validator=lambda plan, reqs, mat: validate_route_plan(
                    plan,
                    self.requests,
                    mat,
                    vehicle_state=self.vehicles.get(plan.vehicle_id),
                    config=self.distance_config,
                ),
            )
            try:
                result = disp.dispatch(
                    batch=decision.requests,
                    fleet=list(self.vehicles.values()),
                    ctx=ctx,
                )
            except Exception:
                result = self._run_mock_dispatch(decision.requests, strategy=strategy)
        else:
            # Fallback mock dispatcher (nearest feasible insertion)
            result = self._run_mock_dispatch(decision.requests, strategy=strategy)

        # Commit only validated plans, defer/reject invalid ones
        committed_plans: list[RoutePlan] = []
        assigned_ids: list[str] = []
        deferred_ids: list[str] = []
        rejected_list = list(result.rejected)

        for plan in result.plans:
            veh = self.vehicles.get(plan.vehicle_id)
            if not veh:
                continue

            # Validate route plan with INDEPENDENT VALIDATOR
            report = validate(
                stops=plan.stops,
                requests=self.requests,
                matrix=self.matrix,
                vehicle_state=veh,
                config=self.distance_config,
            )
            plan.validation = report

            if report.ok:
                # Capture before / after plan diff for all requests in this vehicle
                before_plan = veh.route.model_copy(deep=True) if veh.route else None
                
                # Commit plan & bump version
                prev_version = veh.route.version if veh.route else 0
                plan.version = prev_version + 1
                veh.route = plan
                self.gps_verifier.set_active_route(veh.id, plan)
                committed_plans.append(plan)

                # Update requests
                for stop in plan.stops:
                    req_id = stop.request_id
                    req = self.requests.get(req_id)
                    if req and req.status != RequestStatus.PICKED_UP:
                        req.status = RequestStatus.ASSIGNED
                        req.vehicle_id = veh.id
                        if req_id not in assigned_ids:
                            assigned_ids.append(req_id)
                    if stop.type == StopType.DROP:
                        self.eta_service.record_initial_commitment(req_id, stop.eta_s)
                        
                        # Store diff
                        old_route = before_plan.model_dump() if before_plan else None
                        new_route = plan.model_dump()
                        self.diff_history[req_id] = {
                            "request_id": req_id,
                            "vehicle_id": veh.id,
                            "before": old_route,
                            "after": new_route,
                            "old_route": old_route,
                            "new_route": new_route,
                            "detour_pct": plan.validation.per_rider.get(req_id, {}).detour_pct if plan.validation and hasattr(plan.validation.per_rider.get(req_id, {}), 'detour_pct') else (plan.validation.per_rider.get(req_id, {}).get("detour_pct", 5.0) if plan.validation and isinstance(plan.validation.per_rider.get(req_id), dict) else 5.0),
                            "cost_delta": round((plan.total_dist_m - (before_plan.total_dist_m if before_plan else 0.0)) * 0.012, 1),
                        }
            else:
                # Validation failed: reject / defer requests that broke constraints
                # Keep existing vehicle route version intact!
                for stop in plan.stops:
                    req = self.requests.get(stop.request_id)
                    if not req or req.status in (RequestStatus.ASSIGNED, RequestStatus.PICKED_UP):
                        continue

                    # Try deferring or reject
                    now_s = self.clock.now()
                    ok, rej_reason, explain = self.batcher.re_add_deferred(req, now_s)
                    if ok:
                        req.status = RequestStatus.DEFERRED
                        deferred_ids.append(req.id)
                    else:
                        req.status = RequestStatus.REJECTED
                        req.reason = rej_reason
                        from backend.app.models import RejectedRequest
                        rejected_list.append(
                            RejectedRequest(
                                id=req.id,
                                reason=rej_reason or RejectReason.DETOUR_EXCEEDED,
                                explain=explain or f"Violations: {'; '.join(report.violations)}",
                            )
                        )

        # Update remaining batch requests not assigned
        for req in decision.requests:
            if req.id not in assigned_ids and req.id not in deferred_ids:
                now_s = self.clock.now()
                ok, rej_reason, explain = self.batcher.re_add_deferred(req, now_s)
                if ok:
                    req.status = RequestStatus.DEFERRED
                    deferred_ids.append(req.id)
                else:
                    req.status = RequestStatus.REJECTED
                    req.reason = rej_reason

        elapsed_ms = (time.perf_counter() * 1000.0) - start_ms

        final_result = DispatchResult(
            strategy=strategy,
            solve_ms=round(elapsed_ms, 2),
            plans=committed_plans,
            assigned=assigned_ids,
            deferred=deferred_ids,
            rejected=rejected_list,
        )
        self.last_dispatch_result = final_result

        # Update fares and snapshot
        self._update_fares()
        self.persistence.save_snapshot(self.clock.now(), self._build_state_dict())
        self._update_cache()

        return final_result

    def _run_mock_dispatch(
        self, requests: list[Request], strategy: str = "greedy"
    ) -> DispatchResult:
        """Fallback greedy dispatcher for early testing and integration."""
        plans: list[RoutePlan] = []
        assigned: list[str] = []
        deferred: list[str] = []
        rejected: list[Any] = []

        now_s = self.clock.now()

        for req in requests:
            # Find closest vehicle with available capacity
            best_veh: Optional[Vehicle] = None
            min_dist = float("inf")

            for veh in self.vehicles.values():
                current_load = len(veh.onboard)
                if veh.route:
                    current_load = veh.route.stops[-1].load_after if veh.route.stops else current_load
                
                if current_load + req.seats <= veh.capacity:
                    dur, dist = self.matrix.pair(veh.position, req.pickup)
                    if dist < min_dist:
                        min_dist = dist
                        best_veh = veh

            if best_veh is None:
                # No capacity available -> defer or reject
                ok, rej_reason, explain = self.batcher.re_add_deferred(req, now_s)
                if ok:
                    deferred.append(req.id)
                else:
                    from backend.app.models import RejectedRequest
                    rejected.append(
                        RejectedRequest(
                            id=req.id,
                            reason=RejectReason.CAPACITY_FULL,
                            explain="All vehicles at maximum capacity.",
                        )
                    )
                continue

            # Construct new stops by appending pickup and drop
            existing_stops = list(best_veh.route.stops) if best_veh.route else []
            seq = len(existing_stops)
            last_load = existing_stops[-1].load_after if existing_stops else len(best_veh.onboard)
            last_eta = existing_stops[-1].eta_s if existing_stops else now_s
            last_point = existing_stops[-1].point if existing_stops else best_veh.position

            pickup_dur, pickup_dist = self.matrix.pair(last_point, req.pickup)
            pickup_eta = max(last_eta + pickup_dur, req.request_time)
            pickup_load = last_load + req.seats

            drop_dur, drop_dist = self.matrix.pair(req.pickup, req.drop)
            drop_eta = pickup_eta + drop_dur
            drop_load = pickup_load - req.seats

            p_stop = Stop(
                seq=seq,
                type=StopType.PICKUP,
                request_id=req.id,
                point=req.pickup,
                eta_s=round(pickup_eta, 1),
                load_after=pickup_load,
            )
            d_stop = Stop(
                seq=seq + 1,
                type=StopType.DROP,
                request_id=req.id,
                point=req.drop,
                eta_s=round(drop_eta, 1),
                load_after=drop_load,
            )

            new_stops = existing_stops + [p_stop, d_stop]
            total_dist = (best_veh.route.total_dist_m if best_veh.route else 0.0) + pickup_dist + drop_dist
            total_time = drop_eta - now_s

            polyline = [[s.point.lat, s.point.lon] for s in new_stops]

            plan = RoutePlan(
                vehicle_id=best_veh.id,
                version=(best_veh.route.version if best_veh.route else 0) + 1,
                stops=new_stops,
                total_dist_m=round(total_dist, 1),
                total_time_s=round(total_time, 1),
                polyline=polyline,
            )
            plans.append(plan)
            assigned.append(req.id)

        return DispatchResult(
            strategy=strategy,
            solve_ms=1.5,
            plans=plans,
            assigned=assigned,
            deferred=deferred,
            rejected=rejected,
        )

    def _check_scenario_requests_injection(self, now_s: float) -> None:
        """Inject scenario requests whose scheduled request_time <= now_s."""
        remaining: list[Request] = []
        for req in self.pending_scenario_requests:
            if req.request_time <= now_s:
                self.batcher.add(req, now_s)
            else:
                remaining.append(req)
        self.pending_scenario_requests = remaining

    def _update_fares(self) -> None:
        """Calculate fare allocations for vehicle pool groups using Shapley Engine."""
        rate_per_km = 12.0

        for veh in self.vehicles.values():
            if not veh.route or not veh.route.stops:
                continue

            riders = list({s.request_id for s in veh.route.stops})
            if not riders:
                continue

            group_requests = [self.requests[r_id] for r_id in riders if r_id in self.requests]
            executed_cost = round((veh.route.total_dist_m / 1000.0) * rate_per_km, 2)

            fare_breakdown = compute_fares(
                group_requests=group_requests,
                dist_fn=lambda p1, p2: self.matrix.pair(p1, p2)[1],
                executed_cost=executed_cost,
                rate_per_km=rate_per_km,
                group_id=f"group_{veh.id}",
                capacity=veh.capacity,
            )
            self.fare_groups[f"group_{veh.id}"] = fare_breakdown

    def _recompute_metrics(self) -> None:
        """Update aggregate KPIs per PRD §6 using Metrics Engine."""
        active_plans = [veh.route for veh in self.vehicles.values() if veh.route]
        self.metrics = compute_metrics(
            plans=active_plans,
            requests=list(self.requests.values()),
            dist_fn=lambda p1, p2: self.matrix.pair(p1, p2)[1],
        )

    def submit_location_update(self, update: LocationUpdate) -> GpsIntegrityResult:
        """Process incoming GPS observation from a driver or passenger device."""
        now_server = self.clock.now()
        assigned_route = None
        veh_id = update.vehicle_id or update.entity_id
        if veh_id in self.vehicles and self.vehicles[veh_id].route:
            assigned_route = self.vehicles[veh_id].route

        result = self.gps_verifier.verify_location(
            update=update,
            current_server_time=now_server,
            assigned_route=assigned_route,
        )

        # If observation is accepted, update vehicle live position
        if result.status != GpsObservationStatus.QUARANTINED and veh_id in self.vehicles:
            self.vehicles[veh_id].position = result.trusted_position

        self._update_cache()
        return result

    def get_gps_integrity(self, entity_id: str) -> Optional[dict[str, Any]]:
        return self.gps_verifier.get_entity_state(entity_id)

    def get_fraud_alerts(self, limit: int = 50) -> list[GpsAlertSummary]:
        return self.gps_verifier.get_alerts(limit=limit)

    def get_distance_config(self) -> DistanceConfig:
        return self.distance_config

    def update_distance_config(self, config: DistanceConfig) -> DistanceConfig:
        self.distance_config = config
        self._update_cache()
        return self.distance_config

    def set_traffic_scenario(
        self,
        mode: TrafficMode,
        seed: int = 42,
        corridor_focus: Optional[str] = None,
    ) -> TrafficScenarioConfig:
        self.traffic_provider.set_scenario(mode, seed=seed, corridor_focus=corridor_focus)
        self._update_cache()
        return self.traffic_provider.config

    def get_traffic_status(self) -> dict[str, Any]:
        return {
            "mode": self.traffic_provider.mode.value,
            "multiplier": self.traffic_provider.multiplier,
            "source": self.traffic_provider.name,
        }

    def _build_state_dict(self) -> dict[str, Any]:
        """Build full dictionary representation of simulation state."""
        now_s = self.clock.now()
        vehicles_data = []
        for v in self.vehicles.values():
            v_dict = v.model_dump()
            trusted = self.gps_verifier.get_trusted_position(v.id)
            v_dict["trusted_position"] = trusted.model_dump() if trusted else v_dict["position"]
            v_dict["gps_status"] = self.gps_verifier.get_entity_state(v.id) or {
                "status": "ACCEPTED",
                "confidence": "HIGH",
            }
            vehicles_data.append(v_dict)

        etas_data = {}
        for r_id, r in self.requests.items():
            veh = self.vehicles.get(r.vehicle_id) if r.vehicle_id else None
            eta_info = self.eta_service.compute_request_eta(
                request=r,
                assigned_vehicle=veh,
                matrix=self.matrix,
                now_s=now_s,
                traffic_mode=self.traffic_provider.mode,
                traffic_source=self.traffic_provider.name,
            )
            etas_data[r_id] = eta_info.model_dump()

        return {
            "sim_time": round(now_s, 1),
            "clock_speed": self.clock.speed,
            "paused": self.clock.paused,
            "vehicles": vehicles_data,
            "requests": [r.model_dump() for r in self.requests.values()],
            "window": self.batcher.state(now_s).model_dump(),
            "metrics": self.metrics.model_dump(),
            "last_dispatch": self.last_dispatch_result.model_dump() if self.last_dispatch_result else None,
            "config": self.distance_config.model_dump(),
            "traffic": {
                "mode": self.traffic_provider.mode.value,
                "multiplier": self.traffic_provider.multiplier,
                "source": self.traffic_provider.name,
            },
            "gps_alerts": [a.model_dump() for a in self.gps_verifier.get_alerts(limit=25)],
            "etas": etas_data,
        }

    def _update_cache(self) -> None:
        """Update cached dictionary for fast <20ms GET /api/state."""
        self._cached_state = self._build_state_dict()
