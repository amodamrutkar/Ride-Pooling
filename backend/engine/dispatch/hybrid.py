"""
Strategy E: hybrid — Strategy D (batch matching) + OR-Tools VRPTW polish stage.

1. Runs Strategy D (batch_matching) to get initial high-quality assignment.
2. Collects assigned/affected requests and vehicles.
3. Invokes OR-Tools VRPTW solver with a 1.5s time limit to polish route plans.
4. Checks cost: retains OR-Tools result only if valid AND total route cost is lower than Strategy D.
5. On solver timeout or missing ortools dependency: gracefully returns Strategy D result.
"""

from __future__ import annotations

import time
from backend.app.models import DispatchResult, Request, Vehicle
from backend.engine.dispatch import DispatchCtx, Dispatcher
from backend.engine.dispatch.batch_matching import BatchMatchingDispatcher
from backend.engine.optimizer.ortools_vrptw import optimize_vrptw


class HybridDispatcher(Dispatcher):
    """Strategy E: Hybrid Batch Matching + OR-Tools VRPTW Polish."""

    name: str = "hybrid"

    def __init__(self, time_limit_ms: int = 1500):
        self._batch_matching = BatchMatchingDispatcher()
        self._time_limit_ms = time_limit_ms

    def dispatch(
        self,
        batch: list[Request],
        fleet: list[Vehicle],
        ctx: DispatchCtx,
    ) -> DispatchResult:
        start_time = time.perf_counter()

        # Step 1: Run Strategy D (batch_matching)
        base_result = self._batch_matching.dispatch(batch, fleet, ctx)

        # If batch matching assigned nothing, return base result
        if not base_result.assigned or not base_result.plans:
            return base_result

        # Step 2: Try OR-Tools VRPTW polish on assigned requests & vehicles
        assigned_requests = [r for r in batch if r.id in base_result.assigned]

        try:
            polished_plans = optimize_vrptw(
                vehicles=fleet,
                requests=assigned_requests,
                matrix=ctx.matrix,
                now_s=ctx.now_s,
                time_limit_ms=self._time_limit_ms,
                warm_start_plans=base_result.plans,
            )
        except Exception:
            polished_plans = None

        solve_ms = (time.perf_counter() - start_time) * 1000.0

        if polished_plans is None or not polished_plans:
            # Fall back to Strategy D
            return DispatchResult(
                strategy=self.name,
                solve_ms=round(solve_ms, 2),
                plans=base_result.plans,
                assigned=base_result.assigned,
                deferred=base_result.deferred,
                rejected=base_result.rejected,
            )

        # Step 3: Compare costs — keep OR-Tools result if valid and total time/dist is lower
        base_dist = sum(p.total_dist_m for p in base_result.plans)
        polished_dist = sum(p.total_dist_m for p in polished_plans)

        # Validate polished plans if validator provided
        if ctx.validator is not None:
            valid_all = True
            for plan in polished_plans:
                rep = ctx.validator(plan, assigned_requests, ctx.matrix)
                plan.validation = rep
                if not rep.ok:
                    valid_all = False
                    break
            if not valid_all:
                return DispatchResult(
                    strategy=self.name,
                    solve_ms=round(solve_ms, 2),
                    plans=base_result.plans,
                    assigned=base_result.assigned,
                    deferred=base_result.deferred,
                    rejected=base_result.rejected,
                )

        if polished_dist <= base_dist:
            final_plans = polished_plans
        else:
            final_plans = base_result.plans

        return DispatchResult(
            strategy=self.name,
            solve_ms=round(solve_ms, 2),
            plans=final_plans,
            assigned=base_result.assigned,
            deferred=base_result.deferred,
            rejected=base_result.rejected,
        )
