"""
Traffic-Aware Matrix Provider — PoolIQ

Wraps a base MatrixProvider (OSRM or Fallback) and applies deterministic,
reproducible traffic condition multipliers:
- NORMAL: 1.0x baseline travel times
- FAST: 0.8x faster travel times (light off-peak traffic)
- MODERATE_CONGESTION: 1.25x travel times (+25%)
- SEVERE_CONGESTION: 1.50x travel times (+50% delay alert scenario)
- CORRIDOR_SLOWDOWN: 1.80x travel times on high-density Nashik urban corridors
- STALE_FALLBACK: Offline estimate with stale indicator

Clearly separates real OSRM road data, cached data, and simulated traffic.
"""

from __future__ import annotations

import random
from typing import Optional

from backend.app.models import LatLon, TrafficMode, TrafficScenarioConfig
from backend.engine.routing.matrix_provider import MatrixProvider, MatrixResult


class TrafficMatrixProvider(MatrixProvider):
    """Decorator around MatrixProvider that applies traffic adjustments."""

    def __init__(
        self,
        base_provider: MatrixProvider,
        config: Optional[TrafficScenarioConfig] = None,
    ) -> None:
        self.base_provider = base_provider
        self.config = config or TrafficScenarioConfig()
        self._rng = random.Random(self.config.seed)

    @property
    def mode(self) -> TrafficMode:
        return self.config.mode

    @property
    def multiplier(self) -> float:
        return self.config.multiplier

    def set_scenario(self, mode: TrafficMode, seed: int = 42, corridor_focus: Optional[str] = None) -> None:
        """Update active traffic simulation scenario deterministically."""
        multiplier_map = {
            TrafficMode.NORMAL: 1.0,
            TrafficMode.FAST: 0.8,
            TrafficMode.MODERATE_CONGESTION: 1.25,
            TrafficMode.SEVERE_CONGESTION: 1.50,
            TrafficMode.CORRIDOR_SLOWDOWN: 1.80,
            TrafficMode.STALE_FALLBACK: 1.0,
        }
        mult = multiplier_map.get(mode, 1.0)
        self.config = TrafficScenarioConfig(
            mode=mode,
            multiplier=mult,
            seed=seed,
            corridor_focus=corridor_focus,
        )
        self._rng = random.Random(seed)

    @property
    def name(self) -> str:
        base_name = self.base_provider.name
        if self.config.mode == TrafficMode.NORMAL:
            return f"{base_name} (Normal Flow)"
        elif self.config.mode == TrafficMode.FAST:
            return f"{base_name} (Fast Flow 0.8x)"
        elif self.config.mode == TrafficMode.MODERATE_CONGESTION:
            return f"{base_name} (Moderate Traffic +25%)"
        elif self.config.mode == TrafficMode.SEVERE_CONGESTION:
            return f"{base_name} (Severe Traffic +50% Alert)"
        elif self.config.mode == TrafficMode.CORRIDOR_SLOWDOWN:
            return f"{base_name} (Corridor Slowdown 1.8x)"
        elif self.config.mode == TrafficMode.STALE_FALLBACK:
            return f"{base_name} (Offline Stale Fallback)"
        return base_name

    def pair(self, origin: LatLon, destination: LatLon) -> tuple[float, float]:
        """Compute traffic-adjusted travel time and distance."""
        base_dur, dist = self.base_provider.pair(origin, destination)
        adjusted_dur = round(base_dur * self.config.multiplier, 1)
        return adjusted_dur, dist

    def table(self, points: list[LatLon]) -> MatrixResult:
        """Compute NxN matrix adjusted for traffic conditions."""
        base_result = self.base_provider.table(points)
        n = len(points)
        adjusted_durations: list[list[float]] = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    adjusted_durations[i][j] = 0.0
                else:
                    adjusted_durations[i][j] = round(
                        base_result.durations_s[i][j] * self.config.multiplier, 1
                    )

        return MatrixResult(
            durations_s=adjusted_durations,
            distances_m=base_result.distances_m,
        )
