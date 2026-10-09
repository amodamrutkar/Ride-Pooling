"""
Adaptive Sliding-Window Batcher — PoolIQ

Batches incoming ride requests over a sliding sim-time window and flushes on:
- TIMER: Window duration W (default 30s) elapsed
- SIZE: Accumulated requests >= N_max (default 12)
- URGENCY: Any request's (pickup_deadline - best_case_ETA) <= urgency_margin (default 20s)

Pure logic: clock is injected, no internal threads.
Owner: Ketan
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from backend.app.models import (
    FlushReason,
    RejectReason,
    Request,
    RequestStatus,
    WindowState,
)


@dataclass
class BatchDecision:
    """Result of a window flush."""
    requests: list[Request]
    flush_reason: FlushReason
    timestamp: float


class WindowBatcher:
    """Sliding-window request batcher with multi-trigger flush policies."""

    def __init__(
        self,
        window_s: float = 30.0,
        n_max: int = 12,
        urgency_margin_s: float = 20.0,
    ) -> None:
        self.window_s = window_s
        self.n_max = n_max
        self.urgency_margin_s = urgency_margin_s

        self._pending: dict[str, Request] = {}
        self._window_start_s: Optional[float] = None

    @property
    def pending_count(self) -> int:
        return len(self._pending)

    def add(self, req: Request, now_s: float) -> None:
        """Add a new ride request to the current window.
        
        Args:
            req: Ride request.
            now_s: Current simulation time in seconds.
        """
        if self._window_start_s is None:
            self._window_start_s = now_s

        req.status = RequestStatus.BATCHED
        self._pending[req.id] = req

    def re_add_deferred(
        self, req: Request, now_s: float
    ) -> tuple[bool, Optional[RejectReason], Optional[str]]:
        """Attempt to re-add a previously deferred request for the next batch window.

        Args:
            req: Previously deferred ride request.
            now_s: Current simulation time in seconds.

        Returns:
            (success: bool, reject_reason: Optional[RejectReason], explain: Optional[str])
        """
        pickup_deadline = req.request_time + req.max_wait_s

        # If already past deadline or won't have time to be picked up
        if now_s >= pickup_deadline:
            req.status = RequestStatus.REJECTED
            req.reason = RejectReason.WINDOW_MISSED
            return (
                False,
                RejectReason.WINDOW_MISSED,
                f"Rider {req.id} pickup deadline ({pickup_deadline:.1f}s) expired before dispatch.",
            )

        req.status = RequestStatus.BATCHED
        self._pending[req.id] = req
        if self._window_start_s is None:
            self._window_start_s = now_s

        return True, None, None

    def tick(
        self,
        now_s: float,
        eta_estimator: Optional[Callable[[Request, float], float]] = None,
    ) -> Optional[BatchDecision]:
        """Check flush triggers against current simulation time.

        Args:
            now_s: Current simulation time in seconds.
            eta_estimator: Optional callback (req, now_s) -> best_case_pickup_eta_s.
                           Defaults to now_s (instant hypothetical pickup).

        Returns:
            BatchDecision if window flushed, or None if still accumulating.
        """
        if not self._pending:
            # No requests waiting, slide window forward
            self._window_start_s = now_s
            return None

        if self._window_start_s is None:
            self._window_start_s = now_s

        # 1. Trigger: SIZE flush
        if len(self._pending) >= self.n_max:
            return self._flush(FlushReason.SIZE, now_s)

        # 2. Trigger: URGENCY flush
        for req in self._pending.values():
            pickup_deadline = req.request_time + req.max_wait_s
            best_case_eta = (
                eta_estimator(req, now_s)
                if eta_estimator is not None
                else now_s
            )
            time_to_deadline = pickup_deadline - best_case_eta
            if time_to_deadline <= self.urgency_margin_s:
                return self._flush(FlushReason.URGENCY, now_s)

        # 3. Trigger: TIMER flush
        elapsed = now_s - self._window_start_s
        if elapsed >= self.window_s:
            return self._flush(FlushReason.TIMER, now_s)

        return None

    def force_flush(self, now_s: float) -> Optional[BatchDecision]:
        """Manually flush the current batch (e.g. from POST /api/dispatch/run)."""
        if not self._pending:
            return None
        return self._flush(FlushReason.TIMER, now_s)

    def state(self, now_s: float) -> WindowState:
        """Inspect current batch window status for the UI timeline."""
        elapsed = 0.0
        if self._window_start_s is not None and self._pending:
            elapsed = max(0.0, now_s - self._window_start_s)

        # Predict next flush reason
        predicted_reason = None
        if self._pending:
            if len(self._pending) >= self.n_max:
                predicted_reason = FlushReason.SIZE
            else:
                # Check urgency
                has_urgent = False
                for req in self._pending.values():
                    if (req.request_time + req.max_wait_s - now_s) <= self.urgency_margin_s:
                        has_urgent = True
                        break
                if has_urgent:
                    predicted_reason = FlushReason.URGENCY
                else:
                    predicted_reason = FlushReason.TIMER

        return WindowState(
            window_s=self.window_s,
            elapsed_s=round(elapsed, 1),
            pending=list(self._pending.keys()),
            next_flush_reason=predicted_reason,
        )

    def _flush(self, reason: FlushReason, now_s: float) -> BatchDecision:
        batch = list(self._pending.values())
        self._pending.clear()
        self._window_start_s = now_s
        return BatchDecision(
            requests=batch,
            flush_reason=reason,
            timestamp=now_s,
        )
