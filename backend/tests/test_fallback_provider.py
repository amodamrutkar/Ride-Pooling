"""
Tests for FallbackMatrixProvider.

Verifies: symmetry, zero diagonal, triangle inequality, determinism,
known distance sanity check.
"""

import math

from backend.app.models import LatLon
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.routing.haversine import haversine


class TestHaversine:
    """Unit tests for the haversine function."""

    def test_same_point_is_zero(self):
        assert haversine(19.9977, 73.7803, 19.9977, 73.7803) == 0.0

    def test_symmetry(self):
        d1 = haversine(19.9977, 73.7803, 20.0069, 73.7930)
        d2 = haversine(20.0069, 73.7930, 19.9977, 73.7803)
        assert d1 == d2

    def test_known_distance_sanity(self):
        """CBS to Panchavati is roughly 1.5 km straight line."""
        d = haversine(19.9977, 73.7803, 20.0069, 73.7930)
        assert 1000 < d < 3000  # rough sanity

    def test_positive_for_different_points(self):
        d = haversine(19.9977, 73.7803, 19.9472, 73.8421)
        assert d > 0


class TestFallbackProvider:
    """Unit tests for FallbackMatrixProvider."""

    def test_pair_same_point_is_zero(self, fallback_provider: FallbackMatrixProvider):
        p = LatLon(lat=19.9977, lon=73.7803)
        dur, dist = fallback_provider.pair(p, p)
        assert dur == 0.0
        assert dist == 0.0

    def test_pair_symmetry(self, fallback_provider: FallbackMatrixProvider):
        a = LatLon(lat=19.9977, lon=73.7803)
        b = LatLon(lat=20.0069, lon=73.7930)
        dur1, dist1 = fallback_provider.pair(a, b)
        dur2, dist2 = fallback_provider.pair(b, a)
        assert dur1 == dur2
        assert dist1 == dist2

    def test_table_diagonal_is_zero(
        self,
        fallback_provider: FallbackMatrixProvider,
        sample_points: list[LatLon],
    ):
        result = fallback_provider.table(sample_points)
        n = len(sample_points)
        for i in range(n):
            assert result.durations_s[i][i] == 0.0
            assert result.distances_m[i][i] == 0.0

    def test_table_symmetry(
        self,
        fallback_provider: FallbackMatrixProvider,
        sample_points: list[LatLon],
    ):
        result = fallback_provider.table(sample_points)
        n = len(sample_points)
        for i in range(n):
            for j in range(n):
                assert result.durations_s[i][j] == result.durations_s[j][i]
                assert result.distances_m[i][j] == result.distances_m[j][i]

    def test_table_triangle_inequality(
        self,
        fallback_provider: FallbackMatrixProvider,
        sample_points: list[LatLon],
    ):
        """Triangle inequality: d(A,C) <= d(A,B) + d(B,C) for haversine."""
        result = fallback_provider.table(sample_points)
        n = len(sample_points)
        for i in range(n):
            for j in range(n):
                for k in range(n):
                    direct = result.distances_m[i][k]
                    via = result.distances_m[i][j] + result.distances_m[j][k]
                    assert direct <= via + 0.01  # small float tolerance

    def test_determinism(self, fallback_provider: FallbackMatrixProvider):
        """Same inputs always produce same outputs."""
        points = [
            LatLon(lat=19.9977, lon=73.7803),
            LatLon(lat=20.0069, lon=73.7930),
            LatLon(lat=19.9472, lon=73.8421),
        ]
        r1 = fallback_provider.table(points)
        r2 = fallback_provider.table(points)
        assert r1.durations_s == r2.durations_s
        assert r1.distances_m == r2.distances_m

    def test_circuity_applied(self):
        """Distance should be > raw haversine (circuity > 1)."""
        provider = FallbackMatrixProvider(circuity=1.35)
        a = LatLon(lat=19.9977, lon=73.7803)
        b = LatLon(lat=20.0069, lon=73.7930)
        _, dist = provider.pair(a, b)
        raw = haversine(a.lat, a.lon, b.lat, b.lon)
        assert dist > raw
        assert abs(dist - raw * 1.35) < 0.01

    def test_speed_applied(self):
        """Duration should equal distance / speed_mps."""
        provider = FallbackMatrixProvider(circuity=1.0, speed_kmh=25.0)
        a = LatLon(lat=19.9977, lon=73.7803)
        b = LatLon(lat=20.0069, lon=73.7930)
        dur, dist = provider.pair(a, b)
        expected_dur = dist / (25.0 * 1000.0 / 3600.0)
        assert abs(dur - expected_dur) < 0.01

    def test_provider_name(self, fallback_provider: FallbackMatrixProvider):
        assert fallback_provider.name == "Offline model"
