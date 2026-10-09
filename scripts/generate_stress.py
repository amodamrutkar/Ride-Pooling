"""
generate_stress.py — Generate stress test scenarios and save to disk.

Usage:
    python scripts/generate_stress.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.engine.sim.scenario_gen import generate, save_scenario

SCENARIOS_DIR = Path(__file__).resolve().parents[1] / "backend" / "data" / "scenarios"


def main():
    configs = [
        (100, 25, 100),   # seed=100, 100 requests, 25 vehicles
        (200, 500, 100),  # seed=200, 500 requests, 100 vehicles
    ]

    for seed, n_req, n_veh in configs:
        scenario = generate(seed=seed, n_requests=n_req, n_vehicles=n_veh)
        filename = f"stress_{n_req}r_{n_veh}v.json"
        path = SCENARIOS_DIR / filename
        save_scenario(scenario, path)
        print(f"Generated {filename}: {len(scenario.requests)} requests, {len(scenario.vehicles)} vehicles")


if __name__ == "__main__":
    main()
