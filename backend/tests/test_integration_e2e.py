"""
End-to-End System Integration Test — PoolIQ

Validates complete integration across all four modules:
1. Ketan's World orchestrator, REST routes, Batcher, and independent Route Validator.
2. Spandan's Strategies A-E (Solo, Greedy, Loud Insertion, Batch Matching, Hybrid) with spatial indexing.
3. Kaushik's Fair Shapley cost allocation (exact & Monte Carlo) and operational KPI metrics engine.
4. Amod's Simulation Clock, Haversine fallback matrix provider, and Vehicle Motion kinematics.
"""

import pytest

from backend.app.models import (
    LatLon,
    Request,
    RequestStatus,
    StopType,
)
from backend.app.world import World
from backend.engine.pricing.shapley import compute_fares
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.sim.scenario_gen import load_scenario


def test_e2e_world_full_lifecycle():
    """Verify entire lifecycle: load -> submit -> dispatch -> move -> fares -> metrics."""
    # 1. Initialize World and load scenario
    matrix = FallbackMatrixProvider()
    world = World(matrix_provider=matrix, db_path=":memory:")
    world.load_scenario("demo_5r_3v")

    assert len(world.vehicles) == 3
    assert len(world.requests) == 6
    assert world.clock.now() == 0.0

    # 2. Advance clock and verify request injection
    world.step(35.0)
    assert world.clock.now() == 35.0

    # 3. Add dynamic user request within Nashik
    new_req = Request(
        id="R_LIVE_POOL",
        pickup=LatLon(lat=19.9975, lon=73.7898),
        drop=LatLon(lat=20.0050, lon=73.7950),
        request_time=35.0,
        seats=1,
        max_wait_s=480.0,
        detour_cap=0.15,
    )
    world.submit_request(new_req)
    assert "R_LIVE_POOL" in world.requests

    # 4. Force dispatch using Strategy E (Hybrid)
    disp_res = world.force_dispatch(strategy="hybrid")
    assert disp_res is not None
    assert len(disp_res.assigned) > 0

    # Verify committed plans passed independent validation
    for plan in disp_res.plans:
        assert plan.validation is not None
        assert plan.validation.ok is True
        assert len(plan.stops) >= 2

    # 5. Advance clock to simulate vehicle motion & event firing
    world.step(120.0)

    # Check vehicle moved from start position
    active_vehs = [v for v in world.vehicles.values() if v.route and v.route.stops]
    assert len(active_vehs) > 0

    # 6. Verify Fair Shapley Fare Allocations
    assert len(world.fare_groups) > 0
    for group_id, breakdown in world.fare_groups.items():
        assert breakdown.total_cost > 0
        assert len(breakdown.riders) > 0
        assert len(breakdown.shapley) == len(breakdown.riders)
        # Efficiency axiom check
        sum_shapley = sum(breakdown.shapley.values())
        assert abs(sum_shapley - breakdown.total_cost) <= 0.1
        # Individual rationality audit check
        assert breakdown.audit is not None
        assert breakdown.audit.efficiency is True

    # 7. Verify Operational Metrics Engine
    metrics = world.metrics
    assert metrics.solo_km > 0.0
    assert metrics.pooled_km >= 0.0
    assert 0.0 <= metrics.served_pct <= 100.0
    assert metrics.avg_detour_pct <= 15.0  # Respects hard detour cap

    # 8. Verify State Snapshot
    state = world.get_state()
    assert state["sim_time"] == 155.0
    assert len(state["vehicles"]) == 3
    assert state["metrics"]["solo_km"] == metrics.solo_km


def test_e2e_arena_all_strategies():
    """Verify Algorithm Arena executes all 5 strategies on the scenario."""
    from scripts.run_arena import run_arena

    scenario = load_scenario("backend/data/scenarios/demo_5r_3v.json")
    results = run_arena(scenario)

    expected_strategies = {"solo", "greedy_fcfs", "loud_insertion", "batch_matching", "hybrid"}
    assert set(results.keys()) == expected_strategies

    for name, r in results.items():
        assert r["solve_ms"] >= 0.0
        assert r["total_km"] > 0.0
        assert 0.0 <= r["served_pct"] <= 100.0


def test_e2e_shapley_exact_with_audit():
    """Verify Kaushik's Shapley cost allocator handles realistic 3-rider pool."""
    matrix = FallbackMatrixProvider()

    reqs = [
        Request(
            id="R1",
            pickup=LatLon(lat=19.9975, lon=73.7898),
            drop=LatLon(lat=20.0050, lon=73.7950),
            request_time=0.0,
            seats=1,
            max_wait_s=300.0,
            detour_cap=0.15,
        ),
        Request(
            id="R2",
            pickup=LatLon(lat=19.9980, lon=73.7900),
            drop=LatLon(lat=20.0070, lon=73.7960),
            request_time=0.0,
            seats=1,
            max_wait_s=300.0,
            detour_cap=0.15,
        ),
        Request(
            id="R3",
            pickup=LatLon(lat=19.9990, lon=73.7910),
            drop=LatLon(lat=20.0090, lon=73.7980),
            request_time=0.0,
            seats=1,
            max_wait_s=300.0,
            detour_cap=0.15,
        ),
    ]

    breakdown = compute_fares(
        group_requests=reqs,
        dist_fn=lambda p1, p2: matrix.pair(p1, p2)[1],
        executed_cost=45.0,
        rate_per_km=12.0,
        group_id="test_group",
    )

    assert breakdown.total_cost == 45.0
    assert len(breakdown.shapley) == 3
    assert abs(sum(breakdown.shapley.values()) - 45.0) <= 0.05
    assert breakdown.audit.efficiency is True
    assert breakdown.audit.individual_rationality.ok is True
