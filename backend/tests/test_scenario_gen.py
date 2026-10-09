"""
Tests for scenario generator.

Verifies: determinism, correct counts, coordinates within Nashik bbox,
valid request_time ordering, and scenario load/save roundtrip.
"""

from pathlib import Path

from backend.app.models import Scenario
from backend.engine.sim.scenario_gen import generate, load_scenario, save_scenario

# Nashik bounding box (approximate)
NASHIK_BBOX = {
    "lat_min": 19.85,
    "lat_max": 20.10,
    "lon_min": 73.65,
    "lon_max": 73.90,
}


class TestScenarioGen:
    """Tests for the generate() function."""

    def test_determinism(self):
        """Same seed produces identical scenarios."""
        s1 = generate(seed=42, n_requests=10, n_vehicles=3)
        s2 = generate(seed=42, n_requests=10, n_vehicles=3)
        assert s1.model_dump() == s2.model_dump()

    def test_different_seeds_differ(self):
        """Different seeds produce different scenarios."""
        s1 = generate(seed=42, n_requests=10, n_vehicles=3)
        s2 = generate(seed=99, n_requests=10, n_vehicles=3)
        # At least request positions should differ
        r1_pickups = [(r.pickup.lat, r.pickup.lon) for r in s1.requests]
        r2_pickups = [(r.pickup.lat, r.pickup.lon) for r in s2.requests]
        assert r1_pickups != r2_pickups

    def test_correct_counts(self):
        """Generated scenario has the requested number of requests and vehicles."""
        s = generate(seed=1, n_requests=20, n_vehicles=5)
        assert len(s.requests) == 20
        assert len(s.vehicles) == 5

    def test_coordinates_in_nashik(self):
        """All pickup and drop coordinates fall within the Nashik bounding box."""
        s = generate(seed=7, n_requests=50, n_vehicles=10)
        for r in s.requests:
            for pt in [r.pickup, r.drop]:
                assert NASHIK_BBOX["lat_min"] <= pt.lat <= NASHIK_BBOX["lat_max"], \
                    f"Latitude {pt.lat} outside Nashik bbox"
                assert NASHIK_BBOX["lon_min"] <= pt.lon <= NASHIK_BBOX["lon_max"], \
                    f"Longitude {pt.lon} outside Nashik bbox"

    def test_request_times_sorted(self):
        """Requests are sorted by request_time."""
        s = generate(seed=3, n_requests=15, n_vehicles=3)
        times = [r.request_time for r in s.requests]
        assert times == sorted(times)

    def test_pickup_drop_differ(self):
        """Pickup and drop locations are never the same hub."""
        s = generate(seed=5, n_requests=30, n_vehicles=5)
        for r in s.requests:
            assert (r.pickup.lat, r.pickup.lon) != (r.drop.lat, r.drop.lon)

    def test_scenario_id_format(self):
        """Scenario ID follows expected format."""
        s = generate(seed=42, n_requests=10, n_vehicles=3)
        assert s.id == "gen_42_10r_3v"

    def test_hubs_loaded(self):
        """Generated scenario includes the hub list."""
        s = generate(seed=1, n_requests=5, n_vehicles=2)
        assert len(s.hubs) >= 10  # we have 15 hubs


class TestScenarioIO:
    """Tests for load/save roundtrip."""

    def test_roundtrip(self, tmp_path: Path):
        """Save and reload produces identical scenario."""
        original = generate(seed=42, n_requests=5, n_vehicles=2)
        path = tmp_path / "test_scenario.json"
        save_scenario(original, path)
        loaded = load_scenario(path)
        assert original.model_dump() == loaded.model_dump()

    def test_demo_scenario_loads(self, demo_scenario: Scenario):
        """The fixed demo scenario loads correctly."""
        assert demo_scenario.id == "demo_5r_3v"
        assert len(demo_scenario.requests) == 6  # 5 good + 1 bad
        assert len(demo_scenario.vehicles) == 3
