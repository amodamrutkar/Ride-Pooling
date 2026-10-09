"""
PoolIQ Data Models — Pydantic v2

Frozen at hour 2 per PRD §6. All team members import from here.
Units: time = seconds, distance = meters, money = ₹.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─── Primitives ──────────────────────────────────────────────────────────────

class LatLon(BaseModel):
    """Geographic coordinate."""
    lat: float
    lon: float


# ─── Enums ───────────────────────────────────────────────────────────────────

class RequestStatus(str, Enum):
    PENDING = "PENDING"
    BATCHED = "BATCHED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    COMPLETED = "COMPLETED"
    DEFERRED = "DEFERRED"
    REJECTED = "REJECTED"


class RejectReason(str, Enum):
    NO_VEHICLE_NEARBY = "NO_VEHICLE_NEARBY"
    CAPACITY_FULL = "CAPACITY_FULL"
    DETOUR_EXCEEDED = "DETOUR_EXCEEDED"
    WINDOW_MISSED = "WINDOW_MISSED"
    WOULD_BREAK_COMMITMENT = "WOULD_BREAK_COMMITMENT"
    SOLVER_TIMEOUT = "SOLVER_TIMEOUT"


class StopType(str, Enum):
    PICKUP = "PICKUP"
    DROP = "DROP"


class FlushReason(str, Enum):
    TIMER = "TIMER"
    SIZE = "SIZE"
    URGENCY = "URGENCY"


# ─── Request ─────────────────────────────────────────────────────────────────

class Request(BaseModel):
    """A ride request from a rider."""
    id: str
    pickup: LatLon
    drop: LatLon
    request_time: float  # sim seconds
    seats: int = 1
    max_wait_s: float = 480.0
    detour_cap: float = 0.15
    status: RequestStatus = RequestStatus.PENDING
    vehicle_id: Optional[str] = None
    reason: Optional[RejectReason] = None
    direct_time_s: Optional[float] = None
    direct_dist_m: Optional[float] = None


# ─── Vehicle ─────────────────────────────────────────────────────────────────

class Vehicle(BaseModel):
    """A vehicle in the fleet."""
    id: str
    position: LatLon
    capacity: int = 4
    onboard: list[str] = Field(default_factory=list)
    route: Optional[RoutePlan] = None


# ─── Route ───────────────────────────────────────────────────────────────────

class Stop(BaseModel):
    """A stop in a route plan."""
    seq: int
    type: StopType
    request_id: str
    point: LatLon
    eta_s: float
    load_after: int


class RiderValidation(BaseModel):
    """Per-rider validation results."""
    detour_pct: float
    wait_s: float


class ValidationReport(BaseModel):
    """Output of the independent validator."""
    ok: bool
    violations: list[str] = Field(default_factory=list)
    per_rider: dict[str, RiderValidation] = Field(default_factory=dict)


class RoutePlan(BaseModel):
    """A complete route plan for a vehicle."""
    vehicle_id: str
    version: int = 1
    stops: list[Stop] = Field(default_factory=list)
    total_dist_m: float = 0.0
    total_time_s: float = 0.0
    polyline: list[list[float]] = Field(default_factory=list)  # [[lat, lon], ...]
    validation: Optional[ValidationReport] = None


# ─── Dispatch ────────────────────────────────────────────────────────────────

class RejectedRequest(BaseModel):
    """A rejected request with reason and explanation."""
    id: str
    reason: RejectReason
    explain: str


class DispatchResult(BaseModel):
    """Result of running a dispatch strategy on a batch."""
    strategy: str
    solve_ms: float
    plans: list[RoutePlan] = Field(default_factory=list)
    assigned: list[str] = Field(default_factory=list)
    deferred: list[str] = Field(default_factory=list)
    rejected: list[RejectedRequest] = Field(default_factory=list)


# ─── Fares ───────────────────────────────────────────────────────────────────

class IndividualRationalityAudit(BaseModel):
    ok: bool
    violations: list[str] = Field(default_factory=list)


class FairnessAudit(BaseModel):
    """Shapley axiom checks."""
    efficiency: bool
    symmetry: bool
    null_player: bool
    individual_rationality: IndividualRationalityAudit


class FareBreakdown(BaseModel):
    """Fare allocation for a pool group."""
    group_id: str
    riders: list[str]
    total_cost: float
    solo: dict[str, float] = Field(default_factory=dict)
    equal: dict[str, float] = Field(default_factory=dict)
    proportional: dict[str, float] = Field(default_factory=dict)
    shapley: dict[str, float] = Field(default_factory=dict)
    shapley_ci: Optional[dict[str, list[float]]] = None
    audit: Optional[FairnessAudit] = None


# ─── Metrics ─────────────────────────────────────────────────────────────────

class Metrics(BaseModel):
    """Aggregate KPIs."""
    pooled_km: float = 0.0
    solo_km: float = 0.0
    saved_pct: float = 0.0
    avg_occupancy: float = 0.0
    avg_detour_pct: float = 0.0
    max_detour_pct: float = 0.0
    served_pct: float = 0.0
    deadhead_pct: float = 0.0


# ─── Window ──────────────────────────────────────────────────────────────────

class WindowState(BaseModel):
    """Current state of the sliding-window batcher."""
    window_s: float = 30.0
    elapsed_s: float = 0.0
    pending: list[str] = Field(default_factory=list)
    next_flush_reason: Optional[FlushReason] = None


# ─── Scenario ────────────────────────────────────────────────────────────────

class Hub(BaseModel):
    """A named location hub."""
    name: str
    lat: float
    lon: float


class Scenario(BaseModel):
    """A complete scenario for simulation."""
    id: str
    seed: Optional[int] = None
    requests: list[Request]
    vehicles: list[Vehicle]
    hubs: list[Hub] = Field(default_factory=list)


# Fix forward reference for Vehicle.route
Vehicle.model_rebuild()


# ─── GPS Integrity & Fraud Detection Models ──────────────────────────────────

class EntityType(str, Enum):
    DRIVER = "DRIVER"
    PASSENGER = "PASSENGER"


class GpsRiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class GpsObservationStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    SUSPICIOUS = "SUSPICIOUS"
    QUARANTINED = "QUARANTINED"


class GpsReasonCode(str, Enum):
    IMPOSSIBLE_SPEED = "IMPOSSIBLE_SPEED"
    TELEPORTATION_JUMP = "TELEPORTATION_JUMP"
    ROAD_GEOMETRY_MISMATCH = "ROAD_GEOMETRY_MISMATCH"
    STALE_TIMESTAMP = "STALE_TIMESTAMP"
    FUTURE_TIMESTAMP = "FUTURE_TIMESTAMP"
    OUT_OF_ORDER_TIMESTAMP = "OUT_OF_ORDER_TIMESTAMP"
    ROUTE_DEVIATION = "ROUTE_DEVIATION"
    REPEATED_ANOMALIES = "REPEATED_ANOMALIES"
    LOW_ACCURACY_UNCERTAIN = "LOW_ACCURACY_UNCERTAIN"


class LocationUpdate(BaseModel):
    """Raw incoming GPS location observation submitted by a driver or passenger device."""
    entity_id: str
    entity_type: EntityType = EntityType.DRIVER
    lat: float = Field(..., ge=19.5, le=20.5, description="Latitude bounded to Nashik region")
    lon: float = Field(..., ge=73.5, le=74.5, description="Longitude bounded to Nashik region")
    device_timestamp: float
    server_timestamp: Optional[float] = None
    accuracy_m: Optional[float] = Field(default=None, ge=0.0)
    heading_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0)
    speed_mps: Optional[float] = Field(default=None, ge=0.0)
    trip_id: Optional[str] = None
    vehicle_id: Optional[str] = None


class GpsIntegrityResult(BaseModel):
    """Structured assessment produced by the backend GPS integrity service."""
    entity_id: str
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_level: GpsRiskLevel
    reason_codes: list[GpsReasonCode] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    gps_confidence: str = "HIGH"  # HIGH | MEDIUM | LOW
    status: GpsObservationStatus
    recommended_action: str  # ALLOW | FLAG_FOR_REVIEW | QUARANTINE_RETAIN_LAST_KNOWN
    trusted_position: LatLon
    audit_timestamp: float


class GpsAlertSummary(BaseModel):
    """Operational alert record for administrative dashboard monitoring."""
    id: str
    entity_id: str
    timestamp: float
    risk_score: float
    risk_level: GpsRiskLevel
    status: GpsObservationStatus
    reason_codes: list[GpsReasonCode]
    details: str
    observed_point: LatLon
    last_trusted_point: LatLon


# ─── Distance & Candidate Search Configuration ───────────────────────────────

class DistanceConfig(BaseModel):
    """Backend-owned settings for distance boundaries, candidate discovery, and pooling."""
    min_trip_distance_m: float = Field(default=500.0, description="Minimum supported passenger trip distance")
    max_trip_distance_m: float = Field(default=35000.0, description="Maximum supported passenger trip distance")
    enforce_min_trip_distance: bool = Field(default=False, description="Whether to reject trips below min_trip_distance_m")
    max_approach_distance_m: float = Field(default=5000.0, description="Maximum driver-to-pickup distance")
    max_approach_time_s: float = Field(default=480.0, description="Maximum driver travel time to pickup")
    initial_search_radius_m: float = Field(default=1200.0, description="Initial spatial search radius")
    max_search_radius_m: float = Field(default=5000.0, description="Maximum candidate search radius expansion")
    search_radius_step_m: float = Field(default=1000.0, description="Radial increment when expanding candidate search")
    max_candidates_k: int = Field(default=8, description="Maximum candidate vehicles per request")
    max_pickup_wait_s: float = Field(default=480.0, description="Hard cap on passenger pickup wait time")
    max_detour_cap: float = Field(default=0.15, description="15% detour ceiling per rider")
    vehicle_capacity: int = Field(default=4, description="Standard fleet passenger capacity")
    base_fare_per_km: float = Field(default=12.0, description="Standard unpooled fare rate in ₹/km")
    short_trip_threshold_m: float = Field(default=1500.0, description="Trips below this are considered short trips")
    short_trip_absolute_slack_s: float = Field(default=60.0, description="Absolute detour slack in seconds for short trips")


# ─── Traffic & ETA Simulation Models ─────────────────────────────────────────

class TrafficMode(str, Enum):
    NORMAL = "NORMAL"
    FAST = "FAST"
    MODERATE_CONGESTION = "MODERATE_CONGESTION"
    SEVERE_CONGESTION = "SEVERE_CONGESTION"
    CORRIDOR_SLOWDOWN = "CORRIDOR_SLOWDOWN"
    STALE_FALLBACK = "STALE_FALLBACK"


class LatenessStatus(str, Enum):
    ON_TIME = "ON_TIME"
    ARRIVING_EARLY = "ARRIVING_EARLY"
    SLIGHT_DELAY = "SLIGHT_DELAY"
    SIGNIFICANT_DELAY = "SIGNIFICANT_DELAY"
    DEADLINE_AT_RISK = "DEADLINE_AT_RISK"
    DEADLINE_MISSED = "DEADLINE_MISSED"
    ETA_UNAVAILABLE = "ETA_UNAVAILABLE"


class TrafficScenarioConfig(BaseModel):
    """Configuration for deterministic traffic condition simulation."""
    mode: TrafficMode = TrafficMode.NORMAL
    multiplier: float = 1.0
    seed: int = 42
    corridor_focus: Optional[str] = None


class EtaDetails(BaseModel):
    """Separated ETAs and lateness tracking for an active rider / vehicle assignment."""
    request_id: str
    vehicle_id: Optional[str] = None
    driver_to_pickup_eta_s: float = 0.0
    passenger_pickup_time_s: float = 0.0
    passenger_direct_eta_s: float = 0.0
    expected_destination_eta_s: float = 0.0
    current_predicted_arrival_s: float = 0.0
    delay_vs_previous_s: float = 0.0
    delay_vs_initial_s: float = 0.0
    delay_pct: float = 0.0
    lateness_status: LatenessStatus = LatenessStatus.ON_TIME
    traffic_mode: TrafficMode = TrafficMode.NORMAL
    traffic_source: str = "Cached Road Data"

