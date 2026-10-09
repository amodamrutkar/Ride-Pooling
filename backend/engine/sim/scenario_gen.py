"""
Scenario Generator — seeded, deterministic scenario creation for PoolIQ.

Reads hub coordinates from backend/data/hubs.json. Never invents coordinates.
Uses instance-based random.Random(seed) for determinism and thread safety.
Owner: Amod.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from backend.app.models import (
    Hub,
    LatLon,
    Request,
    RequestStatus,
    Scenario,
    Vehicle,
)

# Default path to hubs file (relative to project root)
_DEFAULT_HUBS_PATH = Path(__file__).resolve().parents[2] / "data" / "hubs.json"


def load_hubs(hubs_path: Path | str | None = None) -> list[Hub]:
    """Load hub locations from JSON file.

    Args:
        hubs_path: Path to hubs.json. Defaults to backend/data/hubs.json.

    Returns:
        List of Hub objects.
    """
    path = Path(hubs_path) if hubs_path else _DEFAULT_HUBS_PATH
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Hub(**h) for h in data]


def generate(
    seed: int,
    n_requests: int,
    n_vehicles: int,
    hubs_path: Path | str | None = None,
    *,
    max_wait_s: float = 480.0,
    detour_cap: float = 0.15,
    vehicle_capacity: int = 4,
    time_span_s: float = 600.0,
) -> Scenario:
    """Generate a deterministic scenario from hubs.

    Picks random pickup/drop hubs (ensuring they differ), staggers request
    times across the time span, and places vehicles at random hubs.

    Args:
        seed: RNG seed for determinism.
        n_requests: Number of ride requests to generate.
        n_vehicles: Number of vehicles in the fleet.
        hubs_path: Path to hubs.json. Defaults to backend/data/hubs.json.
        max_wait_s: Maximum wait time per request (default 480s = 8 min).
        detour_cap: Maximum detour fraction (default 0.15 = 15%).
        vehicle_capacity: Seats per vehicle (default 4).
        time_span_s: Time window over which requests are spread (default 600s).

    Returns:
        A Scenario object with the generated requests and vehicles.
    """
    hubs = load_hubs(hubs_path)
    if len(hubs) < 2:
        raise ValueError("Need at least 2 hubs to generate scenarios")

    rng = random.Random(seed)

    # Generate requests
    requests: list[Request] = []
    for i in range(n_requests):
        pickup_hub, drop_hub = rng.sample(hubs, 2)
        request_time = round(rng.uniform(0, time_span_s), 1)
        requests.append(Request(
            id=f"R{i + 1}",
            pickup=LatLon(lat=pickup_hub.lat, lon=pickup_hub.lon),
            drop=LatLon(lat=drop_hub.lat, lon=drop_hub.lon),
            request_time=request_time,
            seats=1,
            max_wait_s=max_wait_s,
            detour_cap=detour_cap,
            status=RequestStatus.PENDING,
        ))

    # Sort by request time for natural ordering
    requests.sort(key=lambda r: r.request_time)

    # Generate vehicles at random hubs
    vehicles: list[Vehicle] = []
    for i in range(n_vehicles):
        hub = rng.choice(hubs)
        vehicles.append(Vehicle(
            id=f"V{i + 1}",
            position=LatLon(lat=hub.lat, lon=hub.lon),
            capacity=vehicle_capacity,
        ))

    return Scenario(
        id=f"gen_{seed}_{n_requests}r_{n_vehicles}v",
        seed=seed,
        requests=requests,
        vehicles=vehicles,
        hubs=hubs,
    )


def load_scenario(path: Path | str) -> Scenario:
    """Load a scenario from a JSON file.

    Args:
        path: Path to the scenario JSON file.

    Returns:
        Scenario object.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Scenario(**data)


def save_scenario(scenario: Scenario, path: Path | str) -> None:
    """Save a scenario to a JSON file.

    Args:
        scenario: The scenario to save.
        path: Output file path.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(scenario.model_dump(), f, indent=2)
