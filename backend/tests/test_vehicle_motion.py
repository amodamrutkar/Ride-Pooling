"""
Tests for vehicle_motion module.

Verifies: polyline interpolation, reaching final stop, intermediate
positions, and pickup/drop event detection.
"""

import pytest

from backend.app.models import LatLon, RoutePlan, Stop, StopType
from backend.engine.sim.vehicle_motion import (
    EventType,
    check_stop_events,
    interpolate_position,
    polyline_total_distance,
)


class TestPolylineTotalDistance:
    """Tests for polyline_total_distance."""

    def test_single_segment(self):
        poly = [[19.9977, 73.7803], [20.0069, 73.7930]]
        d = polyline_total_distance(poly)
        assert d > 0

    def test_single_point(self):
        poly = [[19.9977, 73.7803]]
        assert polyline_total_distance(poly) == 0.0

    def test_empty(self):
        assert polyline_total_distance([]) == 0.0

    def test_multi_segment_is_sum(self):
        poly = [
            [19.9977, 73.7803],
            [20.0069, 73.7930],
            [19.9742, 73.7819],
        ]
        total = polyline_total_distance(poly)
        seg1 = polyline_total_distance(poly[:2])
        seg2 = polyline_total_distance(poly[1:])
        assert abs(total - (seg1 + seg2)) < 0.01


class TestInterpolatePosition:
    """Tests for interpolate_position."""

    def test_at_start(self):
        poly = [[19.9977, 73.7803], [20.0069, 73.7930]]
        pos = interpolate_position(poly, elapsed_s=0.0, speed_mps=10.0)
        assert abs(pos.lat - 19.9977) < 1e-6
        assert abs(pos.lon - 73.7803) < 1e-6

    def test_past_end_returns_last_point(self):
        poly = [[19.9977, 73.7803], [20.0069, 73.7930]]
        pos = interpolate_position(poly, elapsed_s=999999, speed_mps=10.0)
        assert abs(pos.lat - 20.0069) < 1e-6
        assert abs(pos.lon - 73.7930) < 1e-6

    def test_midpoint(self):
        poly = [[0.0, 0.0], [0.0, 1.0]]
        total_dist = polyline_total_distance(poly)
        halfway_time = (total_dist / 2.0) / 10.0
        pos = interpolate_position(poly, elapsed_s=halfway_time, speed_mps=10.0)
        assert abs(pos.lon - 0.5) < 0.01

    def test_single_point(self):
        poly = [[19.9977, 73.7803]]
        pos = interpolate_position(poly, elapsed_s=10.0, speed_mps=10.0)
        assert abs(pos.lat - 19.9977) < 1e-6

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            interpolate_position([], elapsed_s=0.0, speed_mps=10.0)


class TestCheckStopEvents:
    """Tests for check_stop_events."""

    @pytest.fixture
    def sample_route(self) -> RoutePlan:
        """A simple route with 2 stops: pickup at t=60, drop at t=300."""
        return RoutePlan(
            vehicle_id="V1",
            version=1,
            stops=[
                Stop(
                    seq=0,
                    type=StopType.PICKUP,
                    request_id="R1",
                    point=LatLon(lat=19.9977, lon=73.7803),
                    eta_s=60.0,
                    load_after=1,
                ),
                Stop(
                    seq=1,
                    type=StopType.DROP,
                    request_id="R1",
                    point=LatLon(lat=20.0069, lon=73.7930),
                    eta_s=300.0,
                    load_after=0,
                ),
            ],
        )

    def test_no_events_before_first_stop(self, sample_route: RoutePlan):
        events = check_stop_events(sample_route, current_time_s=30.0)
        assert len(events) == 0

    def test_pickup_event(self, sample_route: RoutePlan):
        events = check_stop_events(sample_route, current_time_s=60.0)
        assert len(events) == 1
        assert events[0].event_type == EventType.PICKUP
        assert events[0].request_id == "R1"

    def test_both_events(self, sample_route: RoutePlan):
        events = check_stop_events(sample_route, current_time_s=300.0)
        assert len(events) == 2
        assert events[0].event_type == EventType.PICKUP
        assert events[1].event_type == EventType.DROP

    def test_last_checked_seq_filters(self, sample_route: RoutePlan):
        """Only events after last_checked_seq are returned."""
        events = check_stop_events(
            sample_route, current_time_s=300.0, last_checked_seq=0
        )
        assert len(events) == 1
        assert events[0].event_type == EventType.DROP
