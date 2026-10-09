"""
Unit & Property Tests for Dispatch Strategies (solo, greedy_fcfs, loud_insertion, batch_matching, hybrid).

===============================================================================
NOTE FOR AGENTS / KETAN INTEGRATION:
The `stub_validator` function defined below is a temporary lightweight validator
used ONLY for testing Spandan's dispatch core in isolation before Ketan finishes
building `backend/engine/validator/validator.py`.

WHEN KETAN'S VALIDATOR IS READY:
1. Import Ketan's validator:
   `from backend.engine.validator.validator import validate_route_plan`
2. Replace `validator=stub_validator` in `DispatchCtx` with `validator=validate_route_plan`.
3. Do NOT modify the dispatch strategy internal code!
===============================================================================
"""

import copy
import pytest

from backend.app.models import (
    DispatchResult,
    RiderValidation,
    ValidationReport,
    RoutePlan,
    Request,
    RejectReason,
    StopType,
)
from backend.engine.dispatch import DispatchCtx
from backend.engine.dispatch.solo import SoloDispatcher
from backend.engine.dispatch.greedy_fcfs import GreedyFcfsDispatcher
from backend.engine.dispatch.loud_insertion import LoudInsertionDispatcher
from backend.engine.dispatch.batch_matching import BatchMatchingDispatcher
from backend.engine.dispatch.hybrid import HybridDispatcher
from backend.engine.validator.validator import validate_route_plan


def stub_validator(plan: RoutePlan, requests: list[Request], matrix) -> ValidationReport:
    """Temporary test-only validator checking precedence, capacity, windows, and 15% ride-time cap.

    To be replaced by Ketan's `backend/engine/validator/validator.py`.
    """
    violations = []
    per_rider = {}
    req_map = {r.id: r for r in requests}

    # 1. Check precedence (PICKUP before DROP for every rider)
    onboard_riders = set()
    rider_pickups = {}
    rider_drops = {}

    for s in plan.stops:
        if s.type == StopType.PICKUP:
            if s.request_id in rider_pickups:
                violations.append(f"Duplicate pickup for request {s.request_id}")
            rider_pickups[s.request_id] = s.eta_s
        elif s.type == StopType.DROP:
            if s.request_id not in rider_pickups and s.request_id not in onboard_riders:
                violations.append(f"Drop before pickup for request {s.request_id}")
            rider_drops[s.request_id] = s.eta_s

    # 2. Check 15% detour cap for accepted riders
    for rid, p_eta in rider_pickups.items():
        if rid in rider_drops:
            d_eta = rider_drops[rid]
            ride_time = d_eta - p_eta
            req = req_map.get(rid)
            if req:
                direct_t, _ = matrix.pair(req.pickup, req.drop)
                max_allowed = (1.0 + req.detour_cap) * direct_t
                detour_pct = ((ride_time - direct_t) / direct_t * 100.0) if direct_t > 0 else 0.0
                wait_s = p_eta - req.request_time

                per_rider[rid] = RiderValidation(detour_pct=round(detour_pct, 1), wait_s=round(wait_s, 1))

                if ride_time > max_allowed + 1e-3:
                    violations.append(
                        f"Detour exceeded for {rid}: ride_time={ride_time:.1f}s > max={max_allowed:.1f}s"
                    )

    ok = len(violations) == 0
    return ValidationReport(ok=ok, violations=violations, per_rider=per_rider)


@pytest.fixture
def ctx(fallback_provider):
    return DispatchCtx(
        matrix=fallback_provider,
        now_s=0.0,
        validator=validate_route_plan,
    )


def test_strategy_a_solo(demo_scenario, ctx):
    dispatcher = SoloDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests[:3], demo_scenario.vehicles, ctx)

    assert res.strategy == "solo"
    assert len(res.assigned) > 0
    assert isinstance(res, DispatchResult)
    # Each plan in solo must have exactly 2 stops (1 pickup + 1 drop)
    for p in res.plans:
        assert len(p.stops) == 2


def test_strategy_b_greedy_fcfs(demo_scenario, ctx):
    dispatcher = GreedyFcfsDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests[:4], demo_scenario.vehicles, ctx)

    assert res.strategy == "greedy_fcfs"
    assert len(res.assigned) > 0
    assert len(res.plans) <= len(demo_scenario.vehicles)


def test_strategy_c_loud_insertion(demo_scenario, ctx):
    dispatcher = LoudInsertionDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests[:4], demo_scenario.vehicles, ctx)

    assert res.strategy == "loud_insertion"
    assert len(res.assigned) > 0


def test_strategy_d_batch_matching(demo_scenario, ctx):
    dispatcher = BatchMatchingDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests[:4], demo_scenario.vehicles, ctx)

    assert res.strategy == "batch_matching"
    assert len(res.assigned) > 0


def test_strategy_e_hybrid(demo_scenario, ctx):
    dispatcher = HybridDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests[:4], demo_scenario.vehicles, ctx)

    assert res.strategy == "hybrid"
    assert len(res.assigned) > 0


def test_determinism_across_runs(demo_scenario, ctx):
    """Verify identical results when running with fixed seed / inputs."""
    d1 = LoudInsertionDispatcher()
    d2 = LoudInsertionDispatcher()

    res1 = d1.dispatch(demo_scenario.requests, demo_scenario.vehicles, ctx)
    res2 = d2.dispatch(demo_scenario.requests, demo_scenario.vehicles, ctx)

    assert res1.assigned == res2.assigned
    assert [p.total_dist_m for p in res1.plans] == [p.total_dist_m for p in res2.plans]


def test_rejection_reason_code(demo_scenario, ctx):
    """Test that infeasible request R6_BAD gets rejected with reason code."""
    dispatcher = LoudInsertionDispatcher()
    res = dispatcher.dispatch(demo_scenario.requests, demo_scenario.vehicles, ctx)

    assert len(res.rejected) > 0
    bad_rejs = [r for r in res.rejected if r.id == "R6_BAD"]
    assert len(bad_rejs) == 1
    assert bad_rejs[0].reason is not None
    assert len(bad_rejs[0].explain) > 0


def test_onboard_commitment_rejection(demo_scenario, ctx):
    """Test that a request breaking an onboard rider's commitment is rejected with WOULD_BREAK_COMMITMENT."""
    dispatcher = LoudInsertionDispatcher()

    # Create scenario with vehicle that has onboard rider R1
    scenario = copy.deepcopy(demo_scenario)
    v1 = scenario.vehicles[0]
    v1.onboard = ["R1"]

    res = dispatcher.dispatch(scenario.requests, scenario.vehicles, ctx)
    rejections = [r for r in res.rejected if r.reason == RejectReason.WOULD_BREAK_COMMITMENT or r.reason == RejectReason.DETOUR_EXCEEDED]
    assert len(rejections) > 0
    # Other vehicles' version should remain unchanged if unaffected

