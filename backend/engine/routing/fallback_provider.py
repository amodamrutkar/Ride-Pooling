"""
FallbackMatrixProvider — deterministic offline travel-time model.

Distance = haversine × CIRCUITY_FACTOR (default 1.35).
Duration = distance ÷ SPEED_MPS (default 25 km/h ≈ 6.944 m/s).

No network calls. Deterministic. Used when OSRM is unavailable or for tests.
Owner: Amod.
"""

from __future__ import annotations

from backend.app.models import LatLon
from backend.engine.routing.haversine import haversine
from backend.engine.routing.matrix_provider import MatrixProvider, MatrixResult


class FallbackMatrixProvider(MatrixProvider):
    """Offline matrix provider using haversine with circuity correction.

    Args:
        circuity: Multiplier for haversine distance to approximate road
                  distance. Default 1.35 (per PRD §4.5).
        speed_kmh: Assumed average speed in km/h. Default 25.
    """

    def __init__(self, circuity: float = 1.35, speed_kmh: float = 25.0):
        self._circuity = circuity
        self._speed_mps = speed_kmh * 1000.0 / 3600.0  # convert to m/s

    @property
    def name(self) -> str:
        return "Offline model"

    def _road_distance(self, a: LatLon, b: LatLon) -> float:
        """Approximate road distance in meters."""
        return haversine(a.lat, a.lon, b.lat, b.lon) * self._circuity

    def _duration(self, distance_m: float) -> float:
        """Travel time in seconds for a given road distance."""
        if distance_m == 0.0:
            return 0.0
        return distance_m / self._speed_mps

    def pair(self, origin: LatLon, destination: LatLon) -> tuple[float, float]:
        """Single OD pair: returns (duration_s, distance_m)."""
        dist = self._road_distance(origin, destination)
        dur = self._duration(dist)
        return dur, dist

    def table(self, points: list[LatLon]) -> MatrixResult:
        """Compute NxN matrix for all point pairs.

        Returns:
            MatrixResult with symmetric durations_s and distances_m.
            Diagonal is always 0.
        """
        n = len(points)
        durations: list[list[float]] = [[0.0] * n for _ in range(n)]
        distances: list[list[float]] = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(i + 1, n):
                dist = self._road_distance(points[i], points[j])
                dur = self._duration(dist)
                distances[i][j] = dist
                distances[j][i] = dist
                durations[i][j] = dur
                durations[j][i] = dur

        return MatrixResult(durations_s=durations, distances_m=distances)
