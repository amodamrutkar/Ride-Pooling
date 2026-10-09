"""
Tests for GPS Integrity and Location Fraud Detection — PoolIQ
"""

import time
import pytest
from pydantic import ValidationError

from backend.app.models import (
    GpsObservationStatus,
    GpsReasonCode,
    GpsRiskLevel,
    LatLon,
    LocationUpdate,
    RoutePlan,
    Stop,
    StopType,
)
from backend.engine.integrity.gps_verifier import GpsIntegrityVerifier


def test_gps_initial_observation_accepted():
    verifier = GpsIntegrityVerifier()
    update = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=10.0,
    )
    res = verifier.verify_location(update, current_server_time=100.0)

    assert res.status == GpsObservationStatus.ACCEPTED
    assert res.risk_score == 0.0
    assert res.risk_level == GpsRiskLevel.LOW
    assert res.trusted_position.lat == 19.9975
    assert res.trusted_position.lon == 73.7898


def test_gps_normal_movement_accepted():
    verifier = GpsIntegrityVerifier()
    # Initial point at CBS Chowk
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=8.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # 10s later, vehicle moved ~120m (~43 km/h urban speed)
    u2 = LocationUpdate(
        entity_id="V1",
        lat=19.9985,
        lon=73.7898,
        device_timestamp=110.0,
        accuracy_m=8.0,
    )
    res = verifier.verify_location(u2, current_server_time=110.0)

    assert res.status == GpsObservationStatus.ACCEPTED
    assert res.risk_level == GpsRiskLevel.LOW
    assert res.risk_score < 25.0
    assert GpsReasonCode.IMPOSSIBLE_SPEED not in res.reason_codes
    assert res.trusted_position.lat == 19.9985


def test_gps_impossible_speed_quarantined_retains_last_trusted():
    verifier = GpsIntegrityVerifier(max_speed_mps=28.0)  # ~100 km/h
    # Initial point
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=5.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # 2s later, reported 1.5 km away (~750 m/s = 2700 km/h)
    u2 = LocationUpdate(
        entity_id="V1",
        lat=20.0100,
        lon=73.7898,
        device_timestamp=102.0,
        accuracy_m=5.0,
    )
    res = verifier.verify_location(u2, current_server_time=102.0)

    assert res.status == GpsObservationStatus.QUARANTINED
    assert res.risk_score >= 55.0
    assert GpsReasonCode.IMPOSSIBLE_SPEED in res.reason_codes
    assert res.recommended_action == "QUARANTINE_RETAIN_LAST_KNOWN"
    # CRITICAL: Trusted position MUST NOT be overwritten by the spoofed coordinate!
    assert res.trusted_position.lat == 19.9975
    assert res.trusted_position.lon == 73.7898


def test_gps_teleportation_jump_detected():
    verifier = GpsIntegrityVerifier()
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=10.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # 800m jump in 3 seconds
    u2 = LocationUpdate(
        entity_id="V1",
        lat=20.0050,
        lon=73.7898,
        device_timestamp=103.0,
        accuracy_m=10.0,
    )
    res = verifier.verify_location(u2, current_server_time=103.0)

    assert GpsReasonCode.TELEPORTATION_JUMP in res.reason_codes
    assert res.status == GpsObservationStatus.QUARANTINED
    assert res.trusted_position.lat == 19.9975


def test_gps_stale_and_future_timestamps():
    verifier = GpsIntegrityVerifier()
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # Future-dated update (60s ahead of server clock)
    u_future = LocationUpdate(
        entity_id="V1",
        lat=19.9976,
        lon=73.7898,
        device_timestamp=170.0,
    )
    res_future = verifier.verify_location(u_future, current_server_time=105.0)
    assert GpsReasonCode.FUTURE_TIMESTAMP in res_future.reason_codes

    # Stale update (60s behind server clock)
    u_stale = LocationUpdate(
        entity_id="V1",
        lat=19.9976,
        lon=73.7898,
        device_timestamp=40.0,
    )
    res_stale = verifier.verify_location(u_stale, current_server_time=110.0)
    assert GpsReasonCode.STALE_TIMESTAMP in res_stale.reason_codes


def test_poor_gps_accuracy_treated_as_uncertainty_not_fraud():
    verifier = GpsIntegrityVerifier()
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=10.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # Poor accuracy ping (75m radius noise) with moderate displacement
    u2 = LocationUpdate(
        entity_id="V1",
        lat=19.9990,
        lon=73.7898,
        device_timestamp=105.0,
        accuracy_m=80.0,  # poor accuracy
    )
    res = verifier.verify_location(u2, current_server_time=105.0)

    assert GpsReasonCode.LOW_ACCURACY_UNCERTAIN in res.reason_codes
    assert res.gps_confidence == "LOW"
    # Should NOT be classified as severe intentional fraud
    assert res.status != GpsObservationStatus.QUARANTINED
    assert res.risk_level in (GpsRiskLevel.LOW, GpsRiskLevel.MEDIUM)


def test_legitimate_traffic_delay_not_flagged_as_fraud():
    verifier = GpsIntegrityVerifier()
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=10.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # Vehicle stuck in congestion: moved only 15 meters in 120 seconds
    u2 = LocationUpdate(
        entity_id="V1",
        lat=19.9976,
        lon=73.7898,
        device_timestamp=220.0,
        accuracy_m=10.0,
    )
    res = verifier.verify_location(u2, current_server_time=220.0)

    assert res.status == GpsObservationStatus.ACCEPTED
    assert res.risk_score == 0.0
    assert len(res.reason_codes) == 0


def test_invalid_coordinates_rejected_by_model():
    # Outside Nashik region (< 19.5 lat)
    with pytest.raises(ValidationError):
        LocationUpdate(
            entity_id="V1",
            lat=12.9716,  # Bangalore lat, out of Nashik bounds
            lon=73.7898,
            device_timestamp=100.0,
        )


def test_repeated_suspicious_patterns_escalates_alerts():
    verifier = GpsIntegrityVerifier(max_speed_mps=28.0)
    u1 = LocationUpdate(
        entity_id="V1",
        lat=19.9975,
        lon=73.7898,
        device_timestamp=100.0,
        accuracy_m=5.0,
    )
    verifier.verify_location(u1, current_server_time=100.0)

    # Trigger 3 consecutive impossible jumps
    for i in range(1, 4):
        t = 100.0 + i * 2.0
        u = LocationUpdate(
            entity_id="V1",
            lat=19.9975 + (i * 0.01),
            lon=73.7898,
            device_timestamp=t,
            accuracy_m=5.0,
        )
        res = verifier.verify_location(u, current_server_time=t)

    alerts = verifier.get_alerts()
    assert len(alerts) >= 2
    assert GpsReasonCode.REPEATED_ANOMALIES in res.reason_codes
    assert res.risk_level in (GpsRiskLevel.HIGH, GpsRiskLevel.CRITICAL)
