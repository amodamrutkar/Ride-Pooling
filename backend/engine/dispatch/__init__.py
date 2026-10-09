"""
Dispatch — pluggable dispatch strategies for PoolIQ.

Strategies:
    - solo: One vehicle per rider (no pooling baseline)
    - greedy_fcfs: First-come first-served nearest feasible vehicle append
    - loud_insertion: LOUD-inspired exact best insertion with slack arrays
    - batch_matching: Hungarian algorithm (scipy.optimize.linear_sum_assignment) over insertion costs
    - hybrid: batch_matching + OR-Tools VRPTW polish stage

All strategies implement the Dispatcher protocol.

NOTE FOR OTHER AGENTS / KETAN INTEGRATION:
Strategies receive a `validator` callable inside `DispatchCtx`.
If `ctx.validator` is provided, strategies call `ctx.validator(plan, requests, ctx.matrix)` to verify route validity.
During testing without Ketan's validator module ready, a lightweight test stub is used in `backend/tests/test_dispatch.py`.
When Ketan's `backend/engine/validator/validator.py` is ready, inject `validate_route_plan` into `DispatchCtx.validator`.
Do NOT import validator internal code inside strategy modules!
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol, TYPE_CHECKING

if TYPE_CHECKING:
    from backend.app.models import DispatchResult, Request, Vehicle, ValidationReport, RoutePlan
    from backend.engine.routing.matrix_provider import MatrixProvider


@dataclass
class DispatchCtx:
    """Execution context injected into dispatchers.

    Attributes:
        matrix: Travel-time/distance matrix provider.
        now_s: Current simulation time in seconds.
        rate_per_km: Fare calculation rate in ₹/km. Default 12.0.
        detour_cap: Maximum allowed detour percentage (e.g. 0.15 = 15%).
        max_wait_s: Maximum pickup wait time in seconds (e.g. 480.0 = 8 min).
        validator: Optional callable `(RoutePlan, list[Request], MatrixProvider) -> ValidationReport`.
                   If provided, strategies call this before committing a route plan.
    """
    matrix: MatrixProvider
    now_s: float
    rate_per_km: float = 12.0
    detour_cap: float = 0.15
    max_wait_s: float = 480.0
    validator: Callable[[RoutePlan, list[Request], MatrixProvider], ValidationReport] | None = None


class Dispatcher(Protocol):
    """Protocol for all dispatch strategy implementations."""
    name: str

    def dispatch(
        self,
        batch: list[Request],
        fleet: list[Vehicle],
        ctx: DispatchCtx,
    ) -> DispatchResult:
        """Execute dispatch strategy on a batch of requests against a fleet.

        Args:
            batch: List of pending/batched ride requests.
            fleet: List of all vehicles in the fleet.
            ctx: Execution context containing matrix provider, sim time, and validator.

        Returns:
            DispatchResult containing updated RoutePlans, assigned IDs, deferred IDs,
            and rejected requests with explanations.
        """
        ...
