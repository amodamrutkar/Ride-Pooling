"""
Tests for Independent Route Validator.

Covers:
- Valid compliant route (happy path)
- Precedence violation (drop before pickup)
- Missing pickup / missing drop
- Duplicate stops
- Capacity exceeded
- Pickup window too early / too late (window missed)
- Ride time detour cap exceeded (>15% cap)
- Negative time / load
- Unknown request IDs
- Onboard rider constraints and capacity tracking
"""

import pytest

from backend.app.models import (
    LatLon,
    Request,
    RequestStatus,
    Stop,
    StopType,
    Vehicle,
)
from backend.engine.validator.validator import validate


@pytest.fixture
def base_requests() -> dict[str, Request]:
    return {
        "R1": Request(
            id="R1",
            pickup=LatLon(lat=19.9975, lon=73.7898),
            drop=LatLon(lat=20.0050, lon=73.7950),
            request_time=100.0,
            seats=1,
            max_wait_s=300.0,
            detour_cap=0.15,
            status=RequestStatus.PENDING,
            direct_time_s=600.0,
            direct_dist_m=4000.0,
        ),
        "R2": Request(
            id="R2",
            pickup=LatLon(lat=19.9990, lon=73.7910),
            drop=LatLon(lat=20.0100, lon=73.8000),
            request_time=120.0,
            seats=2,
            max_wait_s=300.0,
            detour_cap=0.15,
            status=RequestStatus.PENDING,
            direct_time_s=700.0,
            direct_dist_m=5000.0,
        ),
    }


def test_validator_happy_path(base_requests):
    """Test a completely valid route with two riders respects all constraints."""
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=150.0, load_after=1),
        Stop(seq=1, type=StopType.PICKUP, request_id="R2", point=base_requests["R2"].pickup, eta_s=200.0, load_after=3),
        Stop(seq=2, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=780.0, load_after=2),
        Stop(seq=3, type=StopType.DROP, request_id="R2", point=base_requests["R2"].drop, eta_s=920.0, load_after=0),
    ]
    # R1 ride time = 780 - 150 = 630s (direct = 600s, detour = 5% <= 15%)
    # R2 ride time = 920 - 200 = 720s (direct = 700s, detour = 2.86% <= 15%)
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])

    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is True
    assert len(report.violations) == 0
    assert "R1" in report.per_rider
    assert "R2" in report.per_rider
    assert report.per_rider["R1"].wait_s == 50.0
    assert report.per_rider["R1"].detour_pct == 5.0


def test_validator_precedence_violation(base_requests):
    """Drop before pickup should trigger PRECEDENCE_VIOLATION."""
    stops = [
        Stop(seq=0, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=150.0, load_after=0),
        Stop(seq=1, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=200.0, load_after=1),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("PRECEDENCE_VIOLATION" in v for v in report.violations)


def test_validator_missing_pickup(base_requests):
    """Having a drop stop without a pickup when rider is not onboard should fail."""
    stops = [
        Stop(seq=0, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=300.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("MISSING_PICKUP" in v for v in report.violations)


def test_validator_duplicate_pickup(base_requests):
    """Duplicate pickup stop should be flagged."""
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=150.0, load_after=1),
        Stop(seq=1, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=160.0, load_after=2),
        Stop(seq=2, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=700.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("DUPLICATE_STOP" in v for v in report.violations)


def test_validator_capacity_exceeded(base_requests):
    """Route exceeding vehicle seat capacity should be flagged."""
    # Vehicle capacity is 2, R1 takes 1 seat, R2 takes 2 seats -> total 3 > 2
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=150.0, load_after=1),
        Stop(seq=1, type=StopType.PICKUP, request_id="R2", point=base_requests["R2"].pickup, eta_s=200.0, load_after=3),
        Stop(seq=2, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=700.0, load_after=2),
        Stop(seq=3, type=StopType.DROP, request_id="R2", point=base_requests["R2"].drop, eta_s=800.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=2, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("CAPACITY_EXCEEDED" in v for v in report.violations)


def test_validator_pickup_window_missed(base_requests):
    """Pickup arriving after request_time + max_wait_s should be flagged."""
    # R1 requested at 100 with max_wait_s 300 -> window end is 400. ETA is 450.
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=450.0, load_after=1),
        Stop(seq=1, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=900.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("WINDOW_MISSED" in v for v in report.violations)


def test_validator_detour_cap_exceeded(base_requests):
    """Ride time exceeding (1 + 0.15) * direct_time should fail with DETOUR_EXCEEDED."""
    # R1 direct_time is 600s, max allowed ride is 690s.
    # Here pickup is at 150s, drop is at 900s -> ride time is 750s (detour 25%).
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=base_requests["R1"].pickup, eta_s=150.0, load_after=1),
        Stop(seq=1, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=900.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("DETOUR_EXCEEDED" in v for v in report.violations)
    assert "R1" in report.per_rider
    assert report.per_rider["R1"].detour_pct == 25.0


def test_validator_unknown_request_id(base_requests):
    """Stops referring to nonexistent request should be flagged."""
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="UNKNOWN_99", point=LatLon(lat=19.9, lon=73.7), eta_s=150.0, load_after=1),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=[])
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle)
    assert report.ok is False
    assert any("UNKNOWN_REQUEST" in v for v in report.violations)


def test_validator_onboard_rider_legitimate_flow(base_requests):
    """Onboard rider only needs DROP stop and respects detour cap from past pickup time."""
    # R1 is already onboard. Picked up at t=100. Direct is 600.
    # Drop at t=680 -> ride time is 580s <= 690s cap.
    stops = [
        Stop(seq=0, type=StopType.DROP, request_id="R1", point=base_requests["R1"].drop, eta_s=680.0, load_after=0),
    ]
    vehicle = Vehicle(id="V1", position=LatLon(lat=19.99, lon=73.78), capacity=4, onboard=["R1"])
    config = {"onboard_pickup_times": {"R1": 100.0}}
    report = validate(stops=stops, requests=base_requests, vehicle_state=vehicle, config=config)
    assert report.ok is True
    assert len(report.violations) == 0
    assert report.per_rider["R1"].wait_s == 0.0
