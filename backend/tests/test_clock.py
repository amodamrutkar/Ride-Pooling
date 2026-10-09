"""
Tests for SimClock.

Verifies: speed math (1×/10×/60×), deterministic stepping, pause/resume,
reset, and invalid speed rejection.
"""

import pytest

from backend.engine.sim.clock import SimClock


class TestSimClock:
    """Unit tests for SimClock."""

    def test_initial_state(self):
        clock = SimClock(speed=1)
        assert clock.now() == 0.0
        assert clock.speed == 1
        assert not clock.paused

    def test_advance_1x(self):
        clock = SimClock(speed=1)
        clock.advance(1.0)
        assert clock.now() == 1.0

    def test_advance_10x(self):
        clock = SimClock(speed=10)
        clock.advance(1.0)
        assert clock.now() == 10.0

    def test_advance_60x(self):
        clock = SimClock(speed=60)
        clock.advance(1.0)
        assert clock.now() == 60.0

    def test_advance_accumulates(self):
        clock = SimClock(speed=10)
        clock.advance(0.5)
        clock.advance(0.5)
        assert abs(clock.now() - 10.0) < 1e-9

    def test_step_ignores_speed(self):
        """Deterministic step advances by exact sim seconds."""
        clock = SimClock(speed=60)
        clock.step(30.0)
        assert clock.now() == 30.0

    def test_step_accumulates(self):
        clock = SimClock(speed=1)
        clock.step(10.0)
        clock.step(20.0)
        assert clock.now() == 30.0

    def test_pause_blocks_advance(self):
        clock = SimClock(speed=10)
        clock.advance(1.0)
        clock.pause()
        clock.advance(1.0)
        assert clock.now() == 10.0  # no change after pause

    def test_pause_blocks_step(self):
        clock = SimClock(speed=1)
        clock.step(10.0)
        clock.pause()
        clock.step(10.0)
        assert clock.now() == 10.0

    def test_resume_after_pause(self):
        clock = SimClock(speed=10)
        clock.advance(1.0)
        clock.pause()
        clock.resume()
        clock.advance(1.0)
        assert clock.now() == 20.0

    def test_reset(self):
        clock = SimClock(speed=10)
        clock.advance(5.0)
        clock.pause()
        clock.reset()
        assert clock.now() == 0.0
        assert not clock.paused

    def test_set_speed(self):
        clock = SimClock(speed=1)
        clock.set_speed(60)
        assert clock.speed == 60
        clock.advance(1.0)
        assert clock.now() == 60.0

    def test_invalid_speed_init(self):
        with pytest.raises(ValueError):
            SimClock(speed=5)

    def test_invalid_speed_set(self):
        clock = SimClock(speed=1)
        with pytest.raises(ValueError):
            clock.set_speed(100)

    def test_repr(self):
        clock = SimClock(speed=10)
        clock.step(42.0)
        assert "42.0" in repr(clock)
        assert "10×" in repr(clock)

    def test_repr_paused(self):
        clock = SimClock(speed=1)
        clock.pause()
        assert "paused" in repr(clock)
