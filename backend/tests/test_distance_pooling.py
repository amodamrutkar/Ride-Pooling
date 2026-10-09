"""
Tests for Distance-Aware Pooling & Adaptive Candidate Discovery — PoolIQ
"""

import pytest

from backend.app.models import (
    DistanceConfig,
    LatLon,
    RejectReason,
    Request,
    RoutePlan,
    Stop,
    StopType,
    Vehicle,
)
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.routing.spatial_index import SpatialIndex
from backend.engine.validator.validator import validate


@pytest.fixture
def matrix():
    return FallbackMatrixProvider()


def test_short_trip_pooled_with_safe_detour_slack(matrix):
    # Short trip: 600m (~86s direct time)
    cbs_pt = LatLon(lat=19.9975, lon=73.7898)
    short_drop = LatLon(lat=20.0025, lon=73.7898)
    r_short = Request(
        id="R_SHORT",
        pickup=cbs_pt,
        drop=short_drop,
        request_time=0.0,
        max_wait_s=300.0,
        detour_cap=0.15,
        direct_time_s=86.0,
        direct_dist_m=600.0,
    )

    # Co-rider: 2.5 km along the same corridor
    long_drop = LatLon(lat=20.0200, lon=73.7898)
    long_dur, long_dist = matrix.pair(cbs_pt, long_drop)
    short_dur, short_dist = matrix.pair(cbs_pt, short_drop)
    r_short.direct_time_s = short_dur
    r_short.direct_dist_m = short_dist

    r_long = Request(
        id="R_LONG",
        pickup=cbs_pt,
        drop=long_drop,
        request_time=0.0,
        max_wait_s=480.0,
        detour_cap=0.15,
        direct_time_s=long_dur,
        direct_dist_m=long_dist,
    )

    t1_2, _ = matrix.pair(cbs_pt, short_drop)
    t2_3, _ = matrix.pair(short_drop, long_drop)

    eta0 = 0.0
    eta1 = 0.0
    eta2 = round(t1_2, 1)
    eta3 = round(t1_2 + t2_3, 1)

    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R_SHORT", point=cbs_pt, eta_s=eta0, load_after=1),
        Stop(seq=1, type=StopType.PICKUP, request_id="R_LONG", point=cbs_pt, eta_s=eta1, load_after=2),
        Stop(seq=2, type=StopType.DROP, request_id="R_SHORT", point=short_drop, eta_s=eta2, load_after=1),
        Stop(seq=3, type=StopType.DROP, request_id="R_LONG", point=long_drop, eta_s=eta3, load_after=0),
    ]

    veh = Vehicle(id="V1", position=cbs_pt, capacity=4, onboard=[])
    cfg = DistanceConfig(short_trip_absolute_slack_s=60.0)

    report = validate(
        stops=stops,
        requests={"R_SHORT": r_short, "R_LONG": r_long},
        matrix=matrix,
        vehicle_state=veh,
        config=cfg,
    )

    # Short trip is accepted because of the safe slack!
    assert report.ok is True
    assert "R_SHORT" in report.per_rider
    assert report.per_rider["R_SHORT"].wait_s == 0.0


def test_short_trip_rejected_only_when_explicitly_restricted(matrix):
    cbs_pt = LatLon(lat=19.9975, lon=73.7898)
    short_drop = LatLon(lat=19.9990, lon=73.7898)  # ~170m
    dur, dist = matrix.pair(cbs_pt, short_drop)

    r_micro = Request(
        id="R_MICRO",
        pickup=cbs_pt,
        drop=short_drop,
        request_time=0.0,
        max_wait_s=300.0,
        direct_time_s=dur,
        direct_dist_m=dist,
    )

    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R_MICRO", point=cbs_pt, eta_s=0.0, load_after=1),
        Stop(seq=1, type=StopType.DROP, request_id="R_MICRO", point=short_drop, eta_s=round(dur + 1.0, 1), load_after=0),
    ]
    veh = Vehicle(id="V1", position=cbs_pt, capacity=4, onboard=[])

    # Case A: By default enforce_min_trip_distance is False -> accepted
    cfg_default = DistanceConfig(enforce_min_trip_distance=False, min_trip_distance_m=500.0)
    report_default = validate(
        stops=stops,
        requests={"R_MICRO": r_micro},
        matrix=matrix,
        vehicle_state=veh,
        config=cfg_default,
    )
    assert report_default.ok is True

    # Case B: When explicitly enabled -> rejected
    cfg_enforced = DistanceConfig(enforce_min_trip_distance=True, min_trip_distance_m=500.0)
    report_enforced = validate(
        stops=stops,
        requests={"R_MICRO": r_micro},
        matrix=matrix,
        vehicle_state=veh,
        config=cfg_enforced,
    )
    assert report_enforced.ok is False
    assert any("TRIP_DISTANCE_TOO_SHORT" in v for v in report_enforced.violations)


def test_max_trip_distance_enforced(matrix):
    cbs_pt = LatLon(lat=19.9975, lon=73.7898)
    extreme_drop = LatLon(lat=20.4000, lon=74.3000)  # ~60 km away

    r_long = Request(
        id="R_EXCESS",
        pickup=cbs_pt,
        drop=extreme_drop,
        request_time=0.0,
        direct_dist_m=60000.0,
        direct_time_s=5000.0,
    )
    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R_EXCESS", point=cbs_pt, eta_s=0.0, load_after=1),
        Stop(seq=1, type=StopType.DROP, request_id="R_EXCESS", point=extreme_drop, eta_s=5000.0, load_after=0),
    ]
    veh = Vehicle(id="V1", position=cbs_pt, capacity=4, onboard=[])
    cfg = DistanceConfig(max_trip_distance_m=35000.0)

    report = validate(
        stops=stops,
        requests={"R_EXCESS": r_long},
        matrix=matrix,
        vehicle_state=veh,
        config=cfg,
    )
    assert report.ok is False
    assert any("TRIP_DISTANCE_TOO_LONG" in v for v in report.violations)


def test_bounded_adaptive_candidate_search(matrix):
    idx = SpatialIndex()
    pickup = LatLon(lat=19.9975, lon=73.7898)

    # Create 3 vehicles at different radial distances
    # V1: 800m away (inside initial search radius 1200m)
    v1 = Vehicle(id="V1", position=LatLon(lat=20.0030, lon=73.7898), capacity=4, onboard=[])
    # V2: 2500m away (inside max search radius 5000m)
    v2 = Vehicle(id="V2", position=LatLon(lat=20.0180, lon=73.7898), capacity=4, onboard=[])
    # V3: 15000m away (outside max search radius)
    v3 = Vehicle(id="V3", position=LatLon(lat=20.1200, lon=73.7898), capacity=4, onboard=[])

    fleet = [v1, v2, v3]
    cfg = DistanceConfig(
        initial_search_radius_m=1200.0,
        max_search_radius_m=5000.0,
        search_radius_step_m=1000.0,
        max_candidates_k=8,
    )

    candidates = idx.candidates(pickup, fleet, matrix, now_s=0.0, config=cfg)
    candidate_ids = [v.id for v in candidates]

    assert "V1" in candidate_ids
    assert "V2" in candidate_ids
    # V3 should NOT be included because it exceeds max_search_radius_m
    assert "V3" not in candidate_ids


def test_capacity_and_detour_invariants_preserved(matrix):
    cbs_pt = LatLon(lat=19.9975, lon=73.7898)
    college_rd = LatLon(lat=20.0069, lon=73.7628)

    r1 = Request(id="R1", pickup=cbs_pt, drop=college_rd, request_time=0.0, seats=1, direct_time_s=300.0)
    # Vehicle already has 4 onboard (full)
    veh_full = Vehicle(id="V1", position=cbs_pt, capacity=4, onboard=["R_A", "R_B", "R_C", "R_D"])

    stops = [
        Stop(seq=0, type=StopType.PICKUP, request_id="R1", point=cbs_pt, eta_s=0.0, load_after=5),
        Stop(seq=1, type=StopType.DROP, request_id="R1", point=college_rd, eta_s=300.0, load_after=4),
    ]

    report = validate(
        stops=stops,
        requests={"R1": r1},
        matrix=matrix,
        vehicle_state=veh_full,
    )

    assert report.ok is False
    assert any("CAPACITY_EXCEEDED" in v for v in report.violations)
