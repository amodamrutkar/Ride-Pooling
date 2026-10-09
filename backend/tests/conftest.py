"""
conftest.py — shared pytest fixtures for PoolIQ tests.

Provides: fallback matrix provider, demo scenario, hubs, and paths.
"""

import json
from pathlib import Path

import pytest

from backend.app.models import Hub, LatLon, Scenario
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.sim.scenario_gen import load_hubs, load_scenario


# ─── Paths ───────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"
HUBS_PATH = DATA_DIR / "hubs.json"


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def hubs() -> list[Hub]:
    """Load all Nashik hubs."""
    return load_hubs(HUBS_PATH)


@pytest.fixture
def fallback_provider() -> FallbackMatrixProvider:
    """Create a FallbackMatrixProvider with default settings."""
    return FallbackMatrixProvider()


@pytest.fixture
def demo_scenario() -> Scenario:
    """Load the demo_5r_3v scenario."""
    return load_scenario(SCENARIOS_DIR / "demo_5r_3v.json")


@pytest.fixture
def sample_points(hubs: list[Hub]) -> list[LatLon]:
    """Return first 5 hub locations as LatLon points."""
    return [LatLon(lat=h.lat, lon=h.lon) for h in hubs[:5]]
