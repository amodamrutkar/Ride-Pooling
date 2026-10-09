"""
SpatialIndex — Grid-based spatial index for candidate vehicle filtering.

Implements LOUD-inspired "local buckets" idea:
- Divides geographic space into grid cells (~500 m).
- Indexes stops of active route plans for all vehicles.
- Returns candidate vehicles that have stops in neighboring cells reachable
  within pickup wait window, plus idle vehicles within range.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import TYPE_CHECKING

from backend.app.models import LatLon, Vehicle
from backend.engine.routing.haversine import haversine

if TYPE_CHECKING:
    from backend.engine.routing.matrix_provider import MatrixProvider


class SpatialIndex:
    """Grid spatial index for filtering vehicles near a pickup location.

    Args:
        cell_deg: Grid size in decimal degrees (~0.0045° ≈ 500 m at latitude 20°N).
    """

    def __init__(self, cell_deg: float = 0.0045):
        self._cell_deg = cell_deg
        # Grid cell -> set of vehicle IDs
        self._grid: dict[tuple[int, int], set[str]] = defaultdict(set)

    def _coord_to_cell(self, point: LatLon) -> tuple[int, int]:
        lat_idx = math.floor(point.lat / self._cell_deg)
        lon_idx = math.floor(point.lon / self._cell_deg)
        return (lat_idx, lon_idx)

    def rebuild(self, fleet: list[Vehicle]) -> None:
        """Re-index all active route stops and positions of vehicles."""
        self._grid.clear()
        for v in fleet:
            # Index current vehicle position
            cell = self._coord_to_cell(v.position)
            self._grid[cell].add(v.id)

            # Index all stops in current active route
            if v.route and v.route.stops:
                for stop in v.route.stops:
                    c = self._coord_to_cell(stop.point)
                    self._grid[c].add(v.id)

    def candidates(
        self,
        pickup: LatLon,
        fleet: list[Vehicle],
        matrix: MatrixProvider,
        now_s: float,
        max_wait_s: float = 480.0,
        k: int = 8,
        config: Optional[Any] = None,
    ) -> list[Vehicle]:
        """Find up to K candidate vehicles for a pickup location using bounded adaptive expansion.

        Strategy:
        1. Query grid cells starting from initial search radius (e.g. 1200m ~ 2-3 cells).
        2. If fewer than K candidates found, adaptively expand search radius in bounded steps.
        3. Stop at configured maximum radius (e.g. 5000m) or when candidate limit K is met.
        4. Include idle vehicles within approach radius.
        5. Filter vehicles with capacity available and travel time <= max_wait_s / max_approach_time_s.
        6. Return top K ranked candidate vehicles deterministically.
        """
        self.rebuild(fleet)
        pickup_cell = self._coord_to_cell(pickup)

        # Config extraction
        init_radius_m = getattr(config, "initial_search_radius_m", 1200.0) if config else 1200.0
        max_radius_m = getattr(config, "max_search_radius_m", 5000.0) if config else 5000.0
        step_m = getattr(config, "search_radius_step_m", 1000.0) if config else 1000.0
        max_k = getattr(config, "max_candidates_k", k) if config else k
        approach_time_limit_s = getattr(config, "max_approach_time_s", max_wait_s) if config else max_wait_s
        max_wait_s = min(max_wait_s, approach_time_limit_s)

        fleet_by_id = {v.id: v for v in fleet}
        candidate_ids: set[str] = set()

        # Adaptive bounded radial expansion
        current_radius_m = init_radius_m
        while current_radius_m <= max_radius_m:
            # Approximate cell ring size (~500m per cell)
            ring_cells = max(1, math.ceil(current_radius_m / 500.0))

            for dlat in range(-ring_cells, ring_cells + 1):
                for dlon in range(-ring_cells, ring_cells + 1):
                    # Check Chebyshev / Euclidean distance in cell units
                    if dlat * dlat + dlon * dlon <= ring_cells * ring_cells:
                        cell = (pickup_cell[0] + dlat, pickup_cell[1] + dlon)
                        if cell in self._grid:
                            candidate_ids.update(self._grid[cell])

            if len(candidate_ids) >= max_k:
                break

            current_radius_m += step_m

        # Also include idle vehicles (no active route or empty onboard) within search area
        for v in fleet:
            if not v.route or not v.route.stops or len(v.onboard) == 0:
                dist_m = haversine(v.position.lat, v.position.lon, pickup.lat, pickup.lon)
                if dist_m <= max_radius_m:
                    candidate_ids.add(v.id)

        # Fallback to fleet if candidate set is empty and within max_radius
        candidate_vehicles = [fleet_by_id[vid] for vid in candidate_ids if vid in fleet_by_id]
        if not candidate_vehicles:
            candidate_vehicles = [
                v for v in fleet
                if haversine(v.position.lat, v.position.lon, pickup.lat, pickup.lon) <= max_radius_m
            ]

        # Score candidate vehicles by ETA to pickup and capacity availability
        scored: list[tuple[float, Vehicle]] = []
        for v in candidate_vehicles:
            # Check capacity: if already full and no drops scheduled, cannot pick up
            veh_capacity = getattr(config, "vehicle_capacity", v.capacity) if config else v.capacity
            if len(v.onboard) >= veh_capacity and not (v.route and any(s.type.value == "DROP" for s in v.route.stops)):
                continue

            # Vehicle starting point for ETA is current position or last stop
            start_pt = v.position
            if v.route and v.route.stops:
                start_pt = v.route.stops[-1].point
            dur_s, _ = matrix.pair(start_pt, pickup)

            # Check reachability within pickup window constraint
            if dur_s <= max_wait_s:
                scored.append((dur_s, v))

        # Sort by travel time (and vehicle id for determinism)
        scored.sort(key=lambda x: (x[0], x[1].id))

        return [v for _, v in scored[:max_k]]

