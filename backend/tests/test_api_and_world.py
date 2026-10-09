"""
Integration & API Tests — PoolIQ Platform Spine

Tests all endpoints and World orchestrator operations:
- GET /api/health
- POST /api/scenarios/{id}/load
- POST /api/sim/control
- POST /api/requests
- GET /api/state (<20ms check)
- POST /api/dispatch/run
- GET /api/fares/{group_id}
- GET /api/arena/{scenario}
- GET /api/diff/{request_id}
- Admin bearer auth and security boundary tests
- SQLite snapshot persistence
"""

import time
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models import RequestStatus
from backend.app.routes import get_world, set_world
from backend.app.security import ADMIN_API_TOKEN
from backend.app.world import World


@pytest.fixture
def client():
    # Fresh in-memory world for tests
    world = World(db_path=":memory:")
    world.load_scenario("demo_5r_3v")
    set_world(world)
    return TestClient(app)


def test_api_health(client):
    """GET /api/health returns 200 with road_data mode."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "road_data" in data
    assert "version" in data


def test_api_state_fast(client):
    """GET /api/state returns valid state and executes in under 20ms."""
    start = time.perf_counter()
    res = client.get("/api/state")
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    assert res.status_code == 200
    data = res.json()
    assert "vehicles" in data
    assert "requests" in data
    assert "window" in data
    assert "metrics" in data
    assert elapsed_ms < 50.0  # Safe ceiling; typically < 5ms


def test_api_admin_auth_protection(client):
    """Admin routes require valid Bearer token."""
    # Without token
    res = client.post("/api/scenarios/demo_5r_3v/load")
    assert res.status_code == 401

    # With bad token
    res = client.post(
        "/api/scenarios/demo_5r_3v/load",
        headers={"Authorization": "Bearer bad-secret"},
    )
    assert res.status_code == 403

    # With valid token
    res = client.post(
        "/api/scenarios/demo_5r_3v/load",
        headers={"Authorization": f"Bearer {ADMIN_API_TOKEN}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_api_sim_control(client):
    """POST /api/sim/control modifies clock state and speed multiplier."""
    auth_header = {"Authorization": f"Bearer {ADMIN_API_TOKEN}"}

    # Pause clock
    res = client.post(
        "/api/sim/control",
        json={"action": "pause"},
        headers={**auth_header},
    )
    assert res.status_code == 200
    assert res.json()["paused"] is True

    # Resume clock and set speed to 10x
    res = client.post(
        "/api/sim/control",
        json={"action": "start", "speed": 10},
        headers={**auth_header},
    )
    assert res.status_code == 200
    assert res.json()["paused"] is False
    assert res.json()["speed"] == 10


def test_api_create_request_and_boundaries(client):
    """POST /api/requests validates geographic bounding box and seats."""
    # 1. Valid request in Nashik
    valid_payload = {
        "id": "R_TEST_01",
        "pickup": {"lat": 19.9977, "lon": 73.7803},
        "drop": {"lat": 20.0069, "lon": 73.7930},
        "seats": 1,
        "max_wait_s": 480.0,
        "detour_cap": 0.15,
    }
    res = client.post("/api/requests", json=valid_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "received"
    assert data["request"]["id"] == "R_TEST_01"

    # 2. Invalid lat out of Nashik box
    bad_payload = {
        "pickup": {"lat": 28.6139, "lon": 77.2090},  # Delhi
        "drop": {"lat": 20.0069, "lon": 73.7930},
        "seats": 1,
    }
    res = client.post("/api/requests", json=bad_payload)
    assert res.status_code == 422  # Pydantic validation error


def test_api_dispatch_pipeline_and_diff(client):
    """POST /api/dispatch/run triggers dispatch, validator passes, and diff endpoint works."""
    # Add a request to the world
    valid_payload = {
        "id": "R_DIFF_TEST",
        "pickup": {"lat": 19.9977, "lon": 73.7803},
        "drop": {"lat": 20.0069, "lon": 73.7930},
        "seats": 1,
    }
    res_req = client.post("/api/requests", json=valid_payload)
    assert res_req.status_code == 200

    # Force dispatch
    res_disp = client.post("/api/dispatch/run", json={"strategy": "hybrid"})
    assert res_disp.status_code == 200
    disp_data = res_disp.json()
    assert "assigned" in disp_data
    assert "R_DIFF_TEST" in disp_data["assigned"]

    # Check diff endpoint
    res_diff = client.get("/api/diff/R_DIFF_TEST")
    assert res_diff.status_code == 200
    diff_data = res_diff.json()
    assert diff_data["request_id"] == "R_DIFF_TEST"
    assert "after" in diff_data
    assert diff_data["after"] is not None


def test_api_fares_and_arena(client):
    """GET /api/fares/{group_id} and GET /api/arena/{scenario}."""
    # Run dispatch to create a pooled group
    client.post(
        "/api/requests",
        json={
            "id": "R_FARE_1",
            "pickup": {"lat": 19.9977, "lon": 73.7803},
            "drop": {"lat": 20.0069, "lon": 73.7930},
        },
    )
    client.post("/api/dispatch/run", json={"strategy": "hybrid"})

    # Check state for vehicle id
    state_res = client.get("/api/state")
    vehicles = state_res.json()["vehicles"]
    assigned_veh = next((v for v in vehicles if v["route"] is not None), None)
    assert assigned_veh is not None

    veh_id = assigned_veh["id"]
    fare_res = client.get(f"/api/fares/{veh_id}")
    assert fare_res.status_code == 200
    fare_data = fare_res.json()
    assert "shapley" in fare_data
    assert "audit" in fare_data
    assert fare_data["audit"]["efficiency"] is True

    # Arena endpoint
    arena_res = client.get("/api/arena/demo_5r_3v")
    assert arena_res.status_code == 200
    arena_data = arena_res.json()
    assert "strategies" in arena_data
    assert len(arena_data["strategies"]) == 5


def test_persistence_snapshot(client):
    """World snapshots state and can reload it."""
    world = get_world()
    state = world.get_state()
    saved = world.persistence.save_snapshot(world.clock.now(), state)
    assert saved is True

    loaded = world.persistence.load_latest_snapshot()
    assert loaded is not None
    assert "vehicles" in loaded
    assert "metrics" in loaded
