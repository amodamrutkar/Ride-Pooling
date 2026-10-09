"""
Tests for SpatialIndex candidate vehicle filtering.
"""

import pytest
from backend.app.models import LatLon, Vehicle
from backend.engine.routing.spatial_index import SpatialIndex


def test_spatial_index_coordinate_to_cell():
    idx = SpatialIndex(cell_deg=0.0045)
    cell1 = idx._coord_to_cell(LatLon(lat=20.0, lon=73.0))
    cell2 = idx._coord_to_cell(LatLon(lat=20.0001, lon=73.0001))
    assert cell1 == cell2


def test_spatial_index_candidates_filtering(fallback_provider, demo_scenario):
    idx = SpatialIndex()
    pickup = demo_scenario.requests[0].pickup

    candidates = idx.candidates(
        pickup=pickup,
        fleet=demo_scenario.vehicles,
        matrix=fallback_provider,
        now_s=0.0,
        max_wait_s=480.0,
        k=2,
    )

    assert len(candidates) <= 2
    assert len(candidates) > 0
    assert isinstance(candidates[0], Vehicle)
