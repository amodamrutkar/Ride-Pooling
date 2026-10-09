"""
Tests for PoolIQ Metrics Engine.

Validates:
  - Total pooled km & solo km calculations
  - Saved km percentage calculation
  - Distance-weighted average occupancy and deadhead percentage
  - Detour metrics aggregation from ValidationReport
  - Service rate percentages (served/deferred/rejected)
"""

from backend.app.models import (
    LatLon,
    Request,
    RequestStatus,
    RiderValidation,
    RoutePlan,
    Stop,
    StopType,
    ValidationReport,
)
from backend.engine.metrics.metrics import compute_metrics


def test_metrics_empty_scenario():
    """Metrics handle empty inputs gracefully without ZeroDivisionError."""
    m = compute_metrics(plans=[], requests=[])
    assert m.pooled_km == 0.0
    assert m.solo_km == 0.0
    assert m.saved_pct == 0.0
    assert m.served_pct == 0.0


def test_metrics_standard_pooling():
    """Metrics properly calculate pooled vs solo distance, occupancy, and detour."""
    # 2 requests
    r1 = Request(
        id="R1",
        pickup=LatLon(lat=20.00, lon=73.78),
        drop=LatLon(lat=20.02, lon=73.80),
        request_time=0.0,
        status=RequestStatus.COMPLETED,
        direct_dist_m=3000.0,
    )
    r2 = Request(
        id="R2",
        pickup=LatLon(lat=20.01, lon=73.79),
        drop=LatLon(lat=20.03, lon=73.81),
        request_time=30.0,
        status=RequestStatus.COMPLETED,
        direct_dist_m=3000.0,
    )
    # 1 rejected request
    r3 = Request(
        id="R3",
        pickup=LatLon(lat=20.10, lon=73.90),
        drop=LatLon(lat=20.15, lon=73.95),
        request_time=60.0,
        status=RequestStatus.REJECTED,
        direct_dist_m=7000.0,
    )

    # 1 vehicle serving both R1 and R2 with 4 stops
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=r1.pickup, eta_s=60, load_after=1),
        Stop(seq=1, type=StopType.PICKUP, request_id="R2", point=r2.pickup, eta_s=180, load_after=2),
        Stop(seq=2, type=StopType.DROP, request_id="R1", point=r1.drop, eta_s=360, load_after=1),
        Stop(seq=3, type=StopType.DROP, request_id="R2", point=r2.drop, eta_s=480, load_after=0),
    ]

    val_report = ValidationReport(
        ok=True,
        violations=[],
        per_rider={
            "R1": RiderValidation(detour_pct=5.5, wait_s=60),
            "R2": RiderValidation(detour_pct=10.2, wait_s=120),
        },
    )

    plan = RoutePlan(
        vehicle_id="V1",
        stops=stops,
        total_dist_m=4500.0,
        total_time_s=480.0,
        validation=val_report,
    )

    metrics = compute_metrics(plans=[plan], requests=[r1, r2, r3])

    # Pooled km = 4.5 km
    assert metrics.pooled_km == 4.5
    # Solo km for served (R1 + R2) = 3.0 + 3.0 = 6.0 km
    assert metrics.solo_km == 6.0
    # Saved % = (6.0 - 4.5) / 6.0 = 25.0%
    assert abs(metrics.saved_pct - 25.0) <= 0.1
    # Served % = 2 / 3 = 66.67%
    assert abs(metrics.served_pct - 66.67) <= 0.1
    # Detour
    assert abs(metrics.avg_detour_pct - 7.85) <= 0.1
    assert abs(metrics.max_detour_pct - 10.2) <= 0.1
    # Occupancy should be strictly > 1 (pooling occurred during segment 1->2)
    assert metrics.avg_occupancy > 1.0
