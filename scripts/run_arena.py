"""
Algorithm Arena Runner — Benchmarks dispatch strategies A–E on the same scenario.

Usage:
    python -m scripts.run_arena [--scenario demo_5r_3v]
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

from backend.app.models import Scenario
from backend.engine.dispatch import DispatchCtx
from backend.engine.dispatch.solo import SoloDispatcher
from backend.engine.dispatch.greedy_fcfs import GreedyFcfsDispatcher
from backend.engine.dispatch.loud_insertion import LoudInsertionDispatcher
from backend.engine.dispatch.batch_matching import BatchMatchingDispatcher
from backend.engine.dispatch.hybrid import HybridDispatcher
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.sim.scenario_gen import load_scenario

SCENARIOS_DIR = Path(__file__).resolve().parents[1] / "backend" / "data" / "scenarios"


def run_arena(scenario: Scenario, matrix=None) -> dict:
    matrix = matrix or FallbackMatrixProvider()
    ctx = DispatchCtx(matrix=matrix, now_s=0.0)

    dispatchers = [
        SoloDispatcher(),
        GreedyFcfsDispatcher(),
        LoudInsertionDispatcher(),
        BatchMatchingDispatcher(),
        HybridDispatcher(),
    ]

    results = {}

    for d in dispatchers:
        # Deep copy scenario state for clean seeded isolation
        scen_copy = copy.deepcopy(scenario)
        fleet = scen_copy.vehicles
        batch = scen_copy.requests

        res = d.dispatch(batch=batch, fleet=fleet, ctx=ctx)

        tot_dist_km = sum(p.total_dist_m for p in res.plans) / 1000.0
        tot_time_min = sum(p.total_time_s for p in res.plans) / 60.0
        served_count = len(res.assigned)
        served_pct = (served_count / len(batch) * 100.0) if batch else 0.0

        results[d.name] = {
            "strategy": d.name,
            "solve_ms": res.solve_ms,
            "assigned_count": served_count,
            "total_requests": len(batch),
            "served_pct": round(served_pct, 1),
            "total_km": round(tot_dist_km, 2),
            "total_time_min": round(tot_time_min, 1),
            "rejected_count": len(res.rejected),
        }

    return results


def main():
    parser = argparse.ArgumentParser(description="PoolIQ Algorithm Arena Benchmark")
    parser.add_argument(
        "--scenario",
        default="demo_5r_3v",
        help="Scenario ID (e.g. demo_5r_3v, stress_25r_100v)",
    )
    args = parser.parse_args()

    scen_path = SCENARIOS_DIR / f"{args.scenario}.json"
    if not scen_path.exists():
        print(f"Error: Scenario file not found: {scen_path}")
        return

    scenario = load_scenario(scen_path)
    print(f"=== Running Algorithm Arena on Scenario: {scenario.id} ===")
    print(f"Requests: {len(scenario.requests)} | Vehicles: {len(scenario.vehicles)}\n")

    results = run_arena(scenario)

    print(f"{'Strategy':<18} | {'Solve (ms)':<10} | {'Served %':<10} | {'Total km':<10} | {'Rejected':<8}")
    print("-" * 65)
    for name, m in results.items():
        print(
            f"{name:<18} | {m['solve_ms']:<10.2f} | {m['served_pct']:<9.1f}% | {m['total_km']:<10.2f} | {m['rejected_count']:<8}"
        )


if __name__ == "__main__":
    main()
