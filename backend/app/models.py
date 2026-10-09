"""
PoolIQ Data Models — Pydantic v2

Frozen at hour 2 per PRD §6. All team members import from here.
Units: time = seconds, distance = meters, money = ₹.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

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
