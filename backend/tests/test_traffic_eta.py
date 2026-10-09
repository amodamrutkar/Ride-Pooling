"""
Tests for Traffic-Aware ETA & Driver Lateness Service — PoolIQ
"""

import pytest

from backend.app.models import (
    LatLon,
    LatenessStatus,
    Request,
    RoutePlan,
    Stop,
    StopType,
    TrafficMode,
    Vehicle,
)
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.routing.traffic_provider import TrafficMatrixProvider
from backend.engine.sim.eta_service import EtaService


@pytest.fixture
def base_matrix():
    return FallbackMatrixProvider()


def test_separated_etas_are_distinct(base_matrix):
    eta_service = EtaService()
    pickup = LatLon(lat=19.9975, lon=73.7898)   # CBS Chowk
    drop = LatLon(lat=20.0069, lon=73.7628)     # College Road
    veh_pos = LatLon(lat=19.9850, lon=73.7898)  # Vehicle approaching from south

    req = Request(id="R1", pickup=pickup, drop=drop, request_time=0.0, max_wait_s=480.0)

    # Route: vehicle drives to pickup (eta=120s), then to drop (eta=450s)
    route = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=120.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=450.0, load_after=0),
        ],
    )
    veh = Vehicle(id="V1", position=veh_pos, capacity=4, onboard=[], route=route)

    etas = eta_service.compute_request_eta(
        request=req,
        assigned_vehicle=veh,
        matrix=base_matrix,
        now_s=0.0,
    )

    # CRITICAL: Driver-to-pickup ETA and passenger destination arrival MUST NEVER be confused!
    assert etas.driver_to_pickup_eta_s == 120.0
    assert etas.passenger_pickup_time_s == 120.0
    assert etas.expected_destination_eta_s == 450.0
    assert etas.driver_to_pickup_eta_s != etas.expected_destination_eta_s


def test_traffic_multiplier_adjusts_matrix_times(base_matrix):
    traffic_provider = TrafficMatrixProvider(base_matrix)
    p1 = LatLon(lat=19.9975, lon=73.7898)
    p2 = LatLon(lat=20.0069, lon=73.7628)

    base_dur, dist = base_matrix.pair(p1, p2)

    # Severe congestion (+50%)
    traffic_provider.set_scenario(TrafficMode.SEVERE_CONGESTION)
    severe_dur, _ = traffic_provider.pair(p1, p2)

    assert round(severe_dur, 0) == round(base_dur * 1.5, 0)

    # Fast flow (0.8x)
    traffic_provider.set_scenario(TrafficMode.FAST)
    fast_dur, _ = traffic_provider.pair(p1, p2)
    assert round(fast_dur, 0) == round(base_dur * 0.8, 0)


def test_fifty_percent_delay_triggers_warning_without_fraud(base_matrix):
    eta_service = EtaService()
    pickup = LatLon(lat=19.9975, lon=73.7898)
    drop = LatLon(lat=20.0069, lon=73.7628)

    req = Request(id="R1", pickup=pickup, drop=drop, request_time=0.0, max_wait_s=600.0)

    # Step 1: Initial promised arrival at 300s
    route_init = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=60.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=300.0, load_after=0),
        ],
    )
    veh = Vehicle(id="V1", position=pickup, capacity=4, onboard=[], route=route_init)

    eta_init = eta_service.compute_request_eta(req, veh, base_matrix, now_s=0.0)
    assert eta_init.lateness_status == LatenessStatus.ON_TIME

    # Step 2: Severe traffic slows vehicle down by +50% (delay to 460s)
    route_delayed = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=120.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=465.0, load_after=0),
        ],
    )
    veh.route = route_delayed
    eta_delayed = eta_service.compute_request_eta(
        req, veh, base_matrix, now_s=30.0, traffic_mode=TrafficMode.SEVERE_CONGESTION
    )

    # Operational warning MUST be raised
    assert eta_delayed.lateness_status == LatenessStatus.SIGNIFICANT_DELAY
    assert eta_delayed.delay_pct >= 50.0
    assert eta_delayed.delay_vs_initial_s >= 165.0


def test_missed_pickup_deadline_triggers_lateness_alert(base_matrix):
    eta_service = EtaService()
    pickup = LatLon(lat=19.9975, lon=73.7898)
    drop = LatLon(lat=20.0069, lon=73.7628)

    # Max wait is 200s (deadline = 200s)
    req = Request(id="R1", pickup=pickup, drop=drop, request_time=0.0, max_wait_s=200.0)

    # Vehicle ETA to pickup slips to 240s (> 200s deadline)
    route = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=240.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=550.0, load_after=0),
        ],
    )
    veh = Vehicle(id="V1", position=pickup, capacity=4, onboard=[], route=route)

    etas = eta_service.compute_request_eta(req, veh, base_matrix, now_s=50.0)
    assert etas.lateness_status == LatenessStatus.DEADLINE_MISSED


def test_early_arrival_updates_eta(base_matrix):
    eta_service = EtaService()
    pickup = LatLon(lat=19.9975, lon=73.7898)
    drop = LatLon(lat=20.0069, lon=73.7628)

    req = Request(id="R1", pickup=pickup, drop=drop, request_time=0.0, max_wait_s=480.0)

    # Initial plan
    route_init = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=100.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=400.0, load_after=0),
        ],
    )
    veh = Vehicle(id="V1", position=pickup, capacity=4, onboard=[], route=route_init)
    eta_service.compute_request_eta(req, veh, base_matrix, now_s=0.0)

    # Vehicle arrives 40 seconds earlier than expected
    route_early = RoutePlan(
        vehicle_id="V1",
        stops=[
            Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=pickup, eta_s=70.0, load_after=1),
            Stop(seq=1, type=StopType.DROP, request_id="R1", point=drop, eta_s=355.0, load_after=0),
        ],
    )
    veh.route = route_early
    etas_early = eta_service.compute_request_eta(req, veh, base_matrix, now_s=10.0)

    assert etas_early.lateness_status == LatenessStatus.ARRIVING_EARLY
    assert etas_early.expected_destination_eta_s == 355.0
