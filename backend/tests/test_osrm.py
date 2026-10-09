"""
Tests for OsrmProvider fallback and caching behavior.
"""

import pytest
from backend.app.models import LatLon
from backend.engine.routing.osrm import OsrmProvider


def test_osrm_provider_fallback(tmp_path):
    """Test that OsrmProvider automatically falls back to FallbackMatrixProvider when offline."""
    provider = OsrmProvider(
        server_url="http://invalid.osrm.server.local",
        cache_dir=tmp_path,
        timeout_s=0.1,
    )

    pts = [
        LatLon(lat=19.9977, lon=73.7803),
        LatLon(lat=20.0069, lon=73.7930),
    ]

    result = provider.table(pts)
    assert len(result.durations_s) == 2
    assert len(result.distances_m) == 2
    assert "fallback" in provider.name.lower() or "offline" in provider.name.lower()


def test_osrm_provider_cache(tmp_path):
    """Test that OsrmProvider correctly saves and loads cache."""
    provider = OsrmProvider(
        server_url="http://invalid.osrm.server.local",
        cache_dir=tmp_path,
        timeout_s=0.1,
    )
    pts = [LatLon(lat=20.0, lon=73.0), LatLon(lat=20.1, lon=73.1)]

    # First query populates cache via fallback
    res1 = provider.table(pts)
    # Second query loads from cache
    res2 = provider.table(pts)

    assert res1.durations_s == res2.durations_s
    assert res1.distances_m == res2.distances_m
