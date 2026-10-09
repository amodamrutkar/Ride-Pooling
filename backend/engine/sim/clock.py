"""
SimClock — deterministic simulation clock.

Supports 1×, 10×, 60× speed multipliers and a deterministic stepping
mode for tests (step() ignores wall time, advances by exact sim seconds).
Owner: Amod.
"""

from __future__ import annotations


class SimClock:
    """Simulation clock with speed control and deterministic stepping.

    The clock maintains sim_time in float seconds. sim_time=0 is scenario start.

    Usage (real-time mode):
        clock = SimClock(speed=10)
        clock.advance(dt_real_s=0.1)  # sim_time advances by 1.0

    Usage (deterministic test mode):
        clock = SimClock(speed=1)
        clock.step(sim_seconds=30.0)  # sim_time advances by exactly 30.0
    """

    VALID_SPEEDS = (1, 10, 60)

    def __init__(self, speed: int = 1):
        if speed not in self.VALID_SPEEDS:
            raise ValueError(
                f"Speed must be one of {self.VALID_SPEEDS}, got {speed}"
            )
        self._speed: int = speed
        self._sim_time: float = 0.0
        self._paused: bool = False

    @property
    def speed(self) -> int:
        """Current speed multiplier."""
        return self._speed

    @property
    def paused(self) -> bool:
        """Whether the clock is paused."""
        return self._paused

    def now(self) -> float:
        """Current simulation time in seconds."""
        return self._sim_time

    def set_speed(self, speed: int) -> None:
        """Change the speed multiplier.

        Args:
            speed: Must be one of 1, 10, 60.
        """
        if speed not in self.VALID_SPEEDS:
            raise ValueError(
                f"Speed must be one of {self.VALID_SPEEDS}, got {speed}"
            )
        self._speed = speed

    def advance(self, dt_real_s: float) -> float:
        """Advance the clock based on real elapsed time × speed.

        Args:
            dt_real_s: Real (wall) time elapsed in seconds.

        Returns:
            The new sim_time after advancing.
        """
        if self._paused:
            return self._sim_time
        self._sim_time += dt_real_s * self._speed
        return self._sim_time

    def step(self, sim_seconds: float) -> float:
        """Deterministic step: advance by exact sim seconds (ignores speed).

        Use in tests for reproducible time progression.

        Args:
            sim_seconds: Exact simulation seconds to advance.

        Returns:
            The new sim_time after stepping.
        """
        if self._paused:
            return self._sim_time
        self._sim_time += sim_seconds
        return self._sim_time

    def pause(self) -> None:
        """Pause the clock. advance() and step() become no-ops."""
        self._paused = True

    def resume(self) -> None:
        """Resume the clock from where it was paused."""
        self._paused = False

    def reset(self) -> None:
        """Reset sim_time to 0 and unpause."""
        self._sim_time = 0.0
        self._paused = False

    def __repr__(self) -> str:
        state = "paused" if self._paused else f"{self._speed}×"
        return f"SimClock(t={self._sim_time:.1f}s, {state})"
