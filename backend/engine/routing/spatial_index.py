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
    ) -> list[Vehicle]:
        """Find up to K candidate vehicles for a pickup location.

        Strategy:
        1. Find grid cells within a 1-ring neighborhood (3x3 grid cells) of pickup.
        2. Gather vehicle IDs indexed in those cells, plus any idle vehicles (no route/empty onboard).
        3. Rank candidates by estimated travel time to pickup using matrix provider.
        4. Return top K vehicles reachable within max_wait_s.

        If fewer than K candidates are found via grid, falls back to evaluating all fleet vehicles.
        """
        self.rebuild(fleet)
        pickup_cell = self._coord_to_cell(pickup)

        candidate_ids: set[str] = set()
        # 3x3 neighborhood search (current cell + 8 surrounding cells)
        for dlat in (-1, 0, 1):
            for dlon in (-1, 0, 1):
                cell = (pickup_cell[0] + dlat, pickup_cell[1] + dlon)
                if cell in self._grid:
                    candidate_ids.update(self._grid[cell])

        # Also include all idle vehicles (no route or empty onboard)
        for v in fleet:
            if not v.route or not v.route.stops or len(v.onboard) == 0:
                candidate_ids.add(v.id)

        # Map IDs to vehicle objects
        fleet_by_id = {v.id: v for v in fleet}
        candidate_vehicles = [fleet_by_id[vid] for vid in candidate_ids if vid in fleet_by_id]

        # If candidates set is empty or small, fall back to entire fleet
        if len(candidate_vehicles) < k:
            candidate_vehicles = fleet

        # Score candidate vehicles by ETA to pickup
        scored: list[tuple[float, Vehicle]] = []
        for v in candidate_vehicles:
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

        return [v for _, v in scored[:k]]
