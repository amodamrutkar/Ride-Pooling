"""
MatrixProvider — abstract interface for travel-time / distance matrices.

All routing providers (OSRM, fallback, cached) implement this interface.
Owner: Spandan (interface), Amod (fallback implementation).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from backend.app.models import LatLon


@dataclass
class MatrixResult:
    """Result of a matrix query.

    durations_s: 2D list, durations_s[i][j] = travel time in seconds from
                 points[i] to points[j].
    distances_m: 2D list, distances_m[i][j] = travel distance in meters from
                 points[i] to points[j].
    """
    durations_s: list[list[float]]
    distances_m: list[list[float]]


class MatrixProvider(ABC):
    """Abstract base class for travel-time matrix providers.

    Implementations:
        - FallbackMatrixProvider: haversine × 1.35 / 25 km/h (deterministic)
        - OsrmMatrixProvider: OSRM Table API (network, cached)
    """

    @abstractmethod
    def table(self, points: list[LatLon]) -> MatrixResult:
        """Compute an NxN travel-time and distance matrix for the given points.

        Args:
            points: List of LatLon coordinates.

        Returns:
            MatrixResult with durations_s and distances_m as NxN 2D lists.
        """
        ...

    @abstractmethod
    def pair(self, origin: LatLon, destination: LatLon) -> tuple[float, float]:
        """Compute travel time and distance for a single origin-destination pair.

        Args:
            origin: Start point.
            destination: End point.

        Returns:
            Tuple of (duration_s, distance_m).
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name for the provider (shown in UI)."""
        ...
