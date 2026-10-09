"""
benchmark.py — Benchmark scenario generation + fallback matrix computation.

Runs scenario sizes (20/5, 100/25, 500/100) through the FallbackMatrixProvider,
measures generation time and matrix computation time, and prints a summary table.
Full arena benchmarking (dispatch strategies) will be added once Spandan's code exists.

Usage:
    python scripts/benchmark.py
"""

import csv
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.models import LatLon
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.sim.scenario_gen import generate

SIZES = [
    (20, 5),
    (100, 25),
    (500, 100),
]
SEED = 42
OUTPUT_CSV = Path(__file__).resolve().parents[1] / "benchmark_results.csv"


def run_benchmark():
    print("PoolIQ — Benchmark")
    print("=" * 70)
    print(f"{'Requests':>10} {'Vehicles':>10} {'Gen (ms)':>10} {'Points':>8} {'Matrix (ms)':>12} {'Total (ms)':>12}")
    print("-" * 70)

    provider = FallbackMatrixProvider()
    results = []

    for n_req, n_veh in SIZES:
        # Benchmark scenario generation
        t0 = time.perf_counter()
        scenario = generate(seed=SEED, n_requests=n_req, n_vehicles=n_veh)
        gen_ms = (time.perf_counter() - t0) * 1000

        # Collect unique points
        points_set: set[tuple[float, float]] = set()
        for r in scenario.requests:
            points_set.add((r.pickup.lat, r.pickup.lon))
            points_set.add((r.drop.lat, r.drop.lon))
        for v in scenario.vehicles:
            points_set.add((v.position.lat, v.position.lon))
        points = [LatLon(lat=lat, lon=lon) for lat, lon in sorted(points_set)]
        n_points = len(points)

        # Benchmark matrix computation
        t1 = time.perf_counter()
        provider.table(points)
        matrix_ms = (time.perf_counter() - t1) * 1000

        total_ms = gen_ms + matrix_ms

        print(f"{n_req:>10} {n_veh:>10} {gen_ms:>10.1f} {n_points:>8} {matrix_ms:>12.1f} {total_ms:>12.1f}")

        results.append({
            "requests": n_req,
            "vehicles": n_veh,
            "gen_ms": round(gen_ms, 1),
            "points": n_points,
            "matrix_ms": round(matrix_ms, 1),
            "total_ms": round(total_ms, 1),
        })

    print("-" * 70)

    # Save CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    print(f"\nResults saved to {OUTPUT_CSV}")


if __name__ == "__main__":
    run_benchmark()
