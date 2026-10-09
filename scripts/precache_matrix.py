"""
precache_matrix.py — Pre-cache OSRM travel-time matrix for demo scenario.

Calls OSRM Table API for all points in the demo scenario and saves the
result to backend/data/cache/. Falls back gracefully if OSRM is unreachable.

Usage:
    python scripts/precache_matrix.py
"""

import json
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from backend.app.models import LatLon
from backend.engine.sim.scenario_gen import load_scenario

OSRM_TABLE_URL = "http://router.project-osrm.org/table/v1/driving/"
SCENARIO_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "scenarios" / "demo_5r_3v.json"
CACHE_DIR = Path(__file__).resolve().parents[1] / "backend" / "data" / "cache"
CACHE_PATH = CACHE_DIR / "demo_matrix.json"
RATE_LIMIT_S = 1.0  # seconds between OSRM requests


def collect_points(scenario_path: Path) -> list[LatLon]:
    """Collect all unique points from the demo scenario."""
    scenario = load_scenario(scenario_path)
    points_set: set[tuple[float, float]] = set()

    for r in scenario.requests:
        points_set.add((r.pickup.lat, r.pickup.lon))
        points_set.add((r.drop.lat, r.drop.lon))
    for v in scenario.vehicles:
        points_set.add((v.position.lat, v.position.lon))

    return [LatLon(lat=lat, lon=lon) for lat, lon in sorted(points_set)]


def fetch_osrm_matrix(points: list[LatLon]) -> dict:
    """Fetch NxN matrix from OSRM Table API.

    Returns dict with 'durations' and 'distances' (2D lists), or None on error.
    """
    coords = ";".join(f"{p.lon},{p.lat}" for p in points)
    url = f"{OSRM_TABLE_URL}{coords}?annotations=duration,distance"

    print(f"  Requesting OSRM matrix for {len(points)} points...")
    print(f"  URL: {url[:100]}...")

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != "Ok":
            print(f"  OSRM error: {data.get('code')}")
            return None

        return {
            "durations_s": data["durations"],
            "distances_m": data["distances"],
            "points": [{"lat": p.lat, "lon": p.lon} for p in points],
        }
    except Exception as e:
        print(f"  OSRM unreachable: {e}")
        return None


def main():
    print("PoolIQ — Pre-cache OSRM Matrix")
    print("=" * 40)

    if not SCENARIO_PATH.exists():
        print(f"ERROR: Demo scenario not found at {SCENARIO_PATH}")
        sys.exit(1)

    points = collect_points(SCENARIO_PATH)
    print(f"Collected {len(points)} unique points from demo scenario.")

    time.sleep(RATE_LIMIT_S)
    result = fetch_osrm_matrix(points)

    if result is None:
        print("\nOSRM is unavailable. Falling back to FallbackMatrixProvider.")
        print("The app will work fine with the offline model.")
        sys.exit(0)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"\nMatrix cached to {CACHE_PATH}")
    n = len(points)
    print(f"Matrix size: {n}×{n} ({n*n} cells)")


if __name__ == "__main__":
    main()
