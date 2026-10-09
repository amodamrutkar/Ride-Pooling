"""
GPS Integrity & Location Fraud Detection Engine — PoolIQ

Evaluates incoming device location observations for drivers and passengers:
1. Impossible Speed Check (displacement / elapsed time > realistic threshold)
2. Teleportation / GPS Jump Check (unexplained coordinate displacements)
3. Road-Geometry & Route Deviation Check (distance to assigned route polyline)
4. Timestamp Manipulation Check (stale, future, or out-of-order updates)
5. Repeated Anomalies Tracking (rolling window anomaly escalation)
6. Low Accuracy Uncertainty Handling (noise does not equal fraud)
7. Explanatory Risk Scoring (0-100, Low/Med/High/Critical) and Quarantining

Server timestamps and persisted backend state are the authoritative references.
"""

from __future__ import annotations

import math
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence

from backend.app.models import (
    GpsAlertSummary,
    GpsIntegrityResult,
    GpsObservationStatus,
    GpsReasonCode,
    GpsRiskLevel,
    LatLon,
    LocationUpdate,
    RoutePlan,
)
from backend.engine.routing.haversine import haversine


@dataclass
class EntityTrackingState:
    """Server-authoritative state for an active vehicle or rider."""
    entity_id: str
    last_trusted_position: LatLon
    last_trusted_server_time: float
    last_trusted_device_time: float
    recent_updates: deque[LocationUpdate] = field(default_factory=lambda: deque(maxlen=10))
    recent_anomalies_count: int = 0
    total_quarantined_count: int = 0
    active_route: Optional[RoutePlan] = None


class GpsIntegrityVerifier:
    """Backend-first GPS verification and location fraud detection service."""

    def __init__(
        self,
        max_speed_mps: float = 28.0,  # ~100.8 km/h max urban speed
        max_jump_m: float = 600.0,    # 600m jump in < 5s
        max_jump_time_s: float = 5.0,
        max_route_deviation_m: float = 450.0,
        max_stale_time_s: float = 45.0,
        max_clock_drift_future_s: float = 5.0,
        low_accuracy_threshold_m: float = 50.0,
    ) -> None:
        self.max_speed_mps = max_speed_mps
        self.max_jump_m = max_jump_m
        self.max_jump_time_s = max_jump_time_s
        self.max_route_deviation_m = max_route_deviation_m
        self.max_stale_time_s = max_stale_time_s
        self.max_clock_drift_future_s = max_clock_drift_future_s
        self.low_accuracy_threshold_m = low_accuracy_threshold_m

        # entity_id -> EntityTrackingState
        self._tracking: dict[str, EntityTrackingState] = {}
        # Recent operational alerts for dashboard audit
        self._alert_logs: list[GpsAlertSummary] = []

    def set_trusted_initial_position(
        self,
        entity_id: str,
        position: LatLon,
        server_time: float,
        route: Optional[RoutePlan] = None,
    ) -> None:
        """Seed or sync the initial trusted location (e.g. from vehicle spawn or assigned trip)."""
        self._tracking[entity_id] = EntityTrackingState(
            entity_id=entity_id,
            last_trusted_position=position,
            last_trusted_server_time=server_time,
            last_trusted_device_time=server_time,
            active_route=route,
        )

    def set_active_route(self, entity_id: str, route: Optional[RoutePlan]) -> None:
        """Update assigned route plan for route-deviation checks."""
        if entity_id in self._tracking:
            self._tracking[entity_id].active_route = route

    def get_trusted_position(self, entity_id: str) -> Optional[LatLon]:
        """Return authoritative last accepted position for an entity."""
        state = self._tracking.get(entity_id)
        return state.last_trusted_position if state else None

    def get_alerts(self, limit: int = 50) -> list[GpsAlertSummary]:
        """Return recent operational alerts for operator dashboard."""
        return self._alert_logs[-limit:]

    def get_entity_state(self, entity_id: str) -> Optional[dict[str, Any]]:
        """Return diagnostic state for an entity."""
        state = self._tracking.get(entity_id)
        if not state:
            return None
        return {
            "entity_id": entity_id,
            "last_trusted_position": state.last_trusted_position.model_dump(),
            "last_trusted_server_time": state.last_trusted_server_time,
            "recent_anomalies_count": state.recent_anomalies_count,
            "total_quarantined_count": state.total_quarantined_count,
        }

    def verify_location(
        self,
        update: LocationUpdate,
        current_server_time: Optional[float] = None,
        assigned_route: Optional[RoutePlan] = None,
    ) -> GpsIntegrityResult:
        """Evaluate a raw incoming location observation against server-authoritative state.

        Never trusts client-supplied previous position, fraud flags, or ETAs.
        """
        now_server = current_server_time if current_server_time is not None else time.time()
        update.server_timestamp = now_server

        entity_id = update.entity_id
        current_point = LatLon(lat=update.lat, lon=update.lon)
        accuracy = update.accuracy_m if update.accuracy_m is not None else 10.0

        # Retrieve or initialize entity tracking state
        tracking = self._tracking.get(entity_id)
        if tracking is None:
            # First observation: seed as trusted initial state
            self.set_trusted_initial_position(entity_id, current_point, now_server, assigned_route)
            return GpsIntegrityResult(
                entity_id=entity_id,
                risk_score=0.0,
                risk_level=GpsRiskLevel.LOW,
                reason_codes=[],
                evidence={"message": "Initial observation registered"},
                gps_confidence="HIGH" if accuracy <= self.low_accuracy_threshold_m else "MEDIUM",
                status=GpsObservationStatus.ACCEPTED,
                recommended_action="ALLOW",
                trusted_position=current_point,
                audit_timestamp=now_server,
            )

        if assigned_route:
            tracking.active_route = assigned_route

        # Evaluate rules against authoritative tracking state
        reason_codes: list[GpsReasonCode] = []
        evidence: dict[str, Any] = {}
        risk_score = 0.0

        last_pos = tracking.last_trusted_position
        last_server_time = tracking.last_trusted_server_time
        last_device_time = tracking.last_trusted_device_time

        # 1. Timestamp Integrity Checks
        device_time = update.device_timestamp
        time_diff_to_server = device_time - now_server

        if time_diff_to_server > self.max_clock_drift_future_s:
            reason_codes.append(GpsReasonCode.FUTURE_TIMESTAMP)
            risk_score += 35.0
            evidence["future_drift_s"] = round(time_diff_to_server, 2)

        stale_duration = now_server - device_time
        if stale_duration > self.max_stale_time_s:
            reason_codes.append(GpsReasonCode.STALE_TIMESTAMP)
            risk_score += 25.0
            evidence["stale_duration_s"] = round(stale_duration, 2)

        if device_time < last_device_time - 1.0:
            reason_codes.append(GpsReasonCode.OUT_OF_ORDER_TIMESTAMP)
            risk_score += 20.0
            evidence["time_inversion_s"] = round(last_device_time - device_time, 2)

        # 2. Displacement & Speed Check
        # Displacement from last authoritative position
        displacement_m = haversine(last_pos.lat, last_pos.lon, current_point.lat, current_point.lon)
        elapsed_server_s = max(now_server - last_server_time, 0.5)

        # Account for accuracy uncertainty: subtract GPS error margin before computing speed
        effective_distance_m = max(0.0, displacement_m - (accuracy + 10.0))
        calculated_speed_mps = effective_distance_m / elapsed_server_s
        calculated_speed_kmh = calculated_speed_mps * 3.6

        evidence["displacement_m"] = round(displacement_m, 1)
        evidence["elapsed_server_s"] = round(elapsed_server_s, 2)
        evidence["calculated_speed_kmh"] = round(calculated_speed_kmh, 1)

        # Check: Impossible Speed
        if calculated_speed_mps > self.max_speed_mps:
            reason_codes.append(GpsReasonCode.IMPOSSIBLE_SPEED)
            # Severe penalty proportional to impossible speed
            excess_ratio = calculated_speed_mps / self.max_speed_mps
            speed_penalty = min(60.0, 30.0 * excess_ratio)
            risk_score += speed_penalty
            evidence["speed_excess_factor"] = round(excess_ratio, 2)

        # Check: Teleportation / GPS Jump
        if displacement_m > self.max_jump_m and elapsed_server_s < self.max_jump_time_s:
            reason_codes.append(GpsReasonCode.TELEPORTATION_JUMP)
            risk_score += 45.0
            evidence["jump_rate_mps"] = round(displacement_m / elapsed_server_s, 1)

        # 3. Route Deviation Check
        active_route = tracking.active_route
        if active_route and active_route.polyline and len(active_route.polyline) >= 2:
            min_dist_to_route = self._min_distance_to_polyline(current_point, active_route.polyline)
            evidence["min_dist_to_route_m"] = round(min_dist_to_route, 1)

            if min_dist_to_route > self.max_route_deviation_m:
                reason_codes.append(GpsReasonCode.ROUTE_DEVIATION)
                risk_score += 25.0
                evidence["route_deviation_excess_m"] = round(min_dist_to_route - self.max_route_deviation_m, 1)

        # 4. Low Accuracy Uncertainty Handling
        # If accuracy is poor, do NOT classify as intentional fraud:
        if accuracy > self.low_accuracy_threshold_m:
            reason_codes.append(GpsReasonCode.LOW_ACCURACY_UNCERTAIN)
            evidence["accuracy_uncertainty_m"] = round(accuracy, 1)
            # Dampen risk score when evidence is weak due to poor satellite reception
            risk_score *= 0.65
            gps_confidence = "LOW"
        elif accuracy > 25.0:
            gps_confidence = "MEDIUM"
        else:
            gps_confidence = "HIGH"

        # 5. Repeated Suspicious Patterns Escalation
        if reason_codes and GpsReasonCode.LOW_ACCURACY_UNCERTAIN not in reason_codes:
            tracking.recent_anomalies_count += 1
        else:
            tracking.recent_anomalies_count = max(0, tracking.recent_anomalies_count - 1)

        if tracking.recent_anomalies_count >= 3:
            reason_codes.append(GpsReasonCode.REPEATED_ANOMALIES)
            risk_score = min(100.0, risk_score + 25.0)
            evidence["consecutive_anomalies"] = tracking.recent_anomalies_count

        # Bound risk score [0, 100]
        risk_score = min(100.0, max(0.0, round(risk_score, 1)))

        # Determine Risk Level and Action
        if risk_score < 25.0:
            risk_level = GpsRiskLevel.LOW
            status = GpsObservationStatus.ACCEPTED
            recommended_action = "ALLOW"
        elif risk_score < 55.0:
            risk_level = GpsRiskLevel.MEDIUM
            status = GpsObservationStatus.SUSPICIOUS
            recommended_action = "FLAG_FOR_REVIEW"
        elif risk_score < 80.0:
            risk_level = GpsRiskLevel.HIGH
            status = GpsObservationStatus.QUARANTINED
            recommended_action = "QUARANTINE_RETAIN_LAST_KNOWN"
        else:
            risk_level = GpsRiskLevel.CRITICAL
            status = GpsObservationStatus.QUARANTINED
            recommended_action = "QUARANTINE_RETAIN_LAST_KNOWN"

        # State Mutation: Quarantine retains last trusted location
        if status == GpsObservationStatus.QUARANTINED:
            tracking.total_quarantined_count += 1
            trusted_pos = tracking.last_trusted_position
            # Log operational alert
            alert = GpsAlertSummary(
                id=f"ALT_{uuid.uuid4().hex[:6]}",
                entity_id=entity_id,
                timestamp=now_server,
                risk_score=risk_score,
                risk_level=risk_level,
                status=status,
                reason_codes=reason_codes,
                details=f"Observation quarantined: {', '.join(r.value for r in reason_codes)}",
                observed_point=current_point,
                last_trusted_point=trusted_pos,
            )
            self._alert_logs.append(alert)
        else:
            # Accepted or soft suspicious: update server-authoritative trusted state
            tracking.last_trusted_position = current_point
            tracking.last_trusted_server_time = now_server
            tracking.last_trusted_device_time = device_time
            trusted_pos = current_point

        tracking.recent_updates.append(update)

        return GpsIntegrityResult(
            entity_id=entity_id,
            risk_score=risk_score,
            risk_level=risk_level,
            reason_codes=reason_codes,
            evidence=evidence,
            gps_confidence=gps_confidence,
            status=status,
            recommended_action=recommended_action,
            trusted_position=trusted_pos,
            audit_timestamp=now_server,
        )

    def _min_distance_to_polyline(self, point: LatLon, polyline: Sequence[list[float]]) -> float:
        """Calculate minimum perpendicular distance from point to polyline segments in meters."""
        if not polyline or len(polyline) < 2:
            return 0.0

        min_dist = float("inf")
        p_lat, p_lon = point.lat, point.lon

        for i in range(len(polyline) - 1):
            a_lat, a_lon = polyline[i][0], polyline[i][1]
            b_lat, b_lon = polyline[i + 1][0], polyline[i + 1][1]

            # Approximate projection onto segment [A, B]
            d = self._point_to_segment_distance_m(p_lat, p_lon, a_lat, a_lon, b_lat, b_lon)
            if d < min_dist:
                min_dist = d

        return min_dist

    def _point_to_segment_distance_m(
        self,
        plat: float, plon: float,
        alat: float, alon: float,
        blat: float, blon: float,
    ) -> float:
        """Distance from point P to line segment AB using Equirectangular projection approximation."""
        # Scale longitudes by cosine of latitude
        cos_lat = math.cos(math.radians((alat + blat) / 2.0))
        px, py = plon * cos_lat, plat
        ax, ay = alon * cos_lat, alat
        bx, by = blon * cos_lat, blat

        dx = bx - ax
        dy = by - ay

        if dx == 0 and dy == 0:
            return haversine(plat, plon, alat, alon)

        # Projection factor t
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))

        closest_lat = alat + t * (blat - alat)
        closest_lon = alon + t * (blon - alon)

        return haversine(plat, plon, closest_lat, closest_lon)
