"""
Tests for Adaptive Sliding-Window Batcher.

Covers:
- Timer flush
- Size flush
- Urgency flush
- Deferred request re-entry vs deadline expiration
- Window state reporting for UI timeline
"""

from backend.app.models import (
    FlushReason,
    LatLon,
    RejectReason,
    Request,
    RequestStatus,
)
from backend.engine.batching.sliding_window import WindowBatcher


def make_req(req_id: str, request_time: float, max_wait_s: float = 300.0) -> Request:
    return Request(
        id=req_id,
        pickup=LatLon(lat=19.9975, lon=73.7898),
        drop=LatLon(lat=20.0050, lon=73.7950),
        request_time=request_time,
        seats=1,
        max_wait_s=max_wait_s,
        status=RequestStatus.PENDING,
    )


def test_batcher_timer_flush():
    """Window should flush when window_s elapsed time is reached."""
    batcher = WindowBatcher(window_s=30.0, n_max=10, urgency_margin_s=15.0)

    # At t=10s, add request
    req1 = make_req("R1", request_time=10.0)
    batcher.add(req1, now_s=10.0)

    # At t=25s (15s elapsed), no flush
    assert batcher.tick(now_s=25.0) is None
    state = batcher.state(now_s=25.0)
    assert state.elapsed_s == 15.0
    assert state.pending == ["R1"]
    assert state.next_flush_reason == FlushReason.TIMER

    # At t=40s (30s elapsed), flush with TIMER
    decision = batcher.tick(now_s=40.0)
    assert decision is not None
    assert decision.flush_reason == FlushReason.TIMER
    assert len(decision.requests) == 1
    assert decision.requests[0].id == "R1"

    # Queue should be empty now
    assert batcher.pending_count == 0


def test_batcher_size_flush():
    """Window should flush immediately when N_max requests accumulate."""
    batcher = WindowBatcher(window_s=60.0, n_max=3, urgency_margin_s=15.0)

    # Add 2 requests at t=0
    batcher.add(make_req("R1", 0.0), now_s=0.0)
    batcher.add(make_req("R2", 0.0), now_s=0.0)
    assert batcher.tick(now_s=5.0) is None

    # Add 3rd request (hits N_max=3)
    batcher.add(make_req("R3", 0.0), now_s=5.0)
    decision = batcher.tick(now_s=5.0)
    assert decision is not None
    assert decision.flush_reason == FlushReason.SIZE
    assert len(decision.requests) == 3
    assert [r.id for r in decision.requests] == ["R1", "R2", "R3"]


def test_batcher_urgency_flush():
    """Window should flush early if any request's pickup deadline is imminent."""
    # window_s=60, urgency_margin=20
    batcher = WindowBatcher(window_s=60.0, n_max=10, urgency_margin_s=20.0)

    # R1 requested at 0s with max_wait_s=50s -> deadline is 50s.
    req1 = make_req("R1", request_time=0.0, max_wait_s=50.0)
    batcher.add(req1, now_s=0.0)

    # At t=20s, time to deadline is 30s > 20s margin -> no flush
    assert batcher.tick(now_s=20.0) is None

    # At t=32s, time to deadline is 50 - 32 = 18s <= 20s margin -> urgency flush!
    decision = batcher.tick(now_s=32.0)
    assert decision is not None
    assert decision.flush_reason == FlushReason.URGENCY
    assert len(decision.requests) == 1


def test_batcher_deferred_handling():
    """Deferred requests re-enter until deadline, then are rejected with WINDOW_MISSED."""
    batcher = WindowBatcher(window_s=30.0, n_max=10, urgency_margin_s=15.0)

    req = make_req("R1", request_time=0.0, max_wait_s=60.0)

    # At t=20s (deadline is 60s), re-adding succeeds
    ok, reason, _ = batcher.re_add_deferred(req, now_s=20.0)
    assert ok is True
    assert reason is None
    assert batcher.pending_count == 1

    # At t=65s (past 60s deadline), re-adding fails and marks REJECTED
    ok, reason, explain = batcher.re_add_deferred(req, now_s=65.0)
    assert ok is False
    assert reason == RejectReason.WINDOW_MISSED
    assert req.status == RequestStatus.REJECTED
    assert req.reason == RejectReason.WINDOW_MISSED
    assert "expired" in explain.lower()


def test_batcher_force_flush():
    """force_flush should flush pending requests immediately."""
    batcher = WindowBatcher(window_s=60.0, n_max=10)
    batcher.add(make_req("R1", 0.0), now_s=0.0)
    decision = batcher.force_flush(now_s=5.0)
    assert decision is not None
    assert len(decision.requests) == 1
    assert batcher.pending_count == 0
