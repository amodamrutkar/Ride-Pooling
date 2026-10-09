"""
Strategy D: batch_matching — Hungarian algorithm matching over insertion costs.

Builds requests x vehicles cost matrix of best insertion costs (from Strategy C logic).
Solves optimal batch assignment using scipy.optimize.linear_sum_assignment.
Applies assignments in rounds until no further assignments improve total cost.
"""

from __future__ import annotations

import copy
import time
import numpy as np
from scipy.optimize import linear_sum_assignment

from backend.app.models import (
    DispatchResult,
    RejectReason,
    RejectedRequest,
    Request,
    RoutePlan,
    Vehicle,
)
from backend.engine.dispatch import DispatchCtx, Dispatcher
from backend.engine.dispatch.loud_insertion import LoudInsertionDispatcher


class BatchMatchingDispatcher(Dispatcher):
    """Strategy D: Hungarian matching over insertion cost matrix."""

    name: str = "batch_matching"

    def __init__(self):
        self._loud = LoudInsertionDispatcher()

    def dispatch(
        self,
        batch: list[Request],
        fleet: list[Vehicle],
        ctx: DispatchCtx,
    ) -> DispatchResult:
        start_time = time.perf_counter()

        assigned_ids: list[str] = []
        deferred_ids: list[str] = []
        rejected: list[RejectedRequest] = []

        working_routes: dict[str, RoutePlan] = {
            v.id: copy.deepcopy(v.route) if v.route else RoutePlan(vehicle_id=v.id)
            for v in fleet
        }

        unassigned_requests = list(batch)
        MAX_ROUNDS = len(batch)

        for _ in range(MAX_ROUNDS):
            if not unassigned_requests:
                break

            # Build Cost Matrix: N_requests x M_vehicles
            n_reqs = len(unassigned_requests)
            n_vehs = len(fleet)
            cost_matrix = np.full((n_reqs, n_vehs), fill_value=1e9)
            candidates_matrix = [[None] * n_vehs for _ in range(n_reqs)]

            for r_idx, req in enumerate(unassigned_requests):
                for v_idx, v in enumerate(fleet):
                    route = working_routes[v.id]
                    m = len(route.stops)

                    # Find best insertion of req in vehicle v
                    best_cand = None
                    best_cost = float("inf")

                    for i in range(m + 1):
                        for j in range(i, m + 1):
                            cand = self._loud._evaluate_insertion(v, route, req, i, j, ctx)
                            if cand is not None:
                                if ctx.validator is not None:
                                    report = ctx.validator(cand.new_plan, [req], ctx.matrix)
                                    if not report.ok:
                                        continue
                                    cand.new_plan.validation = report

                                if cand.added_time_s < best_cost:
                                    best_cost = cand.added_time_s
                                    best_cand = cand

                    if best_cand is not None:
                        cost_matrix[r_idx, v_idx] = best_cost
                        candidates_matrix[r_idx][v_idx] = best_cand

            # Check if any feasible assignment exists in matrix
            if np.all(cost_matrix >= 1e8):
                break

            # Run Hungarian algorithm
            row_ind, col_ind = linear_sum_assignment(cost_matrix)

            matched_any = False
            remaining_reqs = []

            for r_idx, v_idx in zip(row_ind, col_ind):
                cand = candidates_matrix[r_idx][v_idx]
                req = unassigned_requests[r_idx]

                if cand is not None and cost_matrix[r_idx, v_idx] < 1e8:
                    working_routes[cand.vehicle_id] = cand.new_plan
                    assigned_ids.append(req.id)
                    matched_any = True
                else:
                    remaining_reqs.append(req)

            # Keep unassigned for next round
            unassigned_requests = remaining_reqs
            if not matched_any:
                break

        # Any leftover requests get rejected
        for req in unassigned_requests:
            rejected.append(
                RejectedRequest(
                    id=req.id,
                    reason=RejectReason.DETOUR_EXCEEDED,
                    explain=f"No assignment found in Hungarian batch matching for request {req.id}.",
                )
            )

        updated_plans = [plan for plan in working_routes.values() if plan.stops]
        solve_ms = (time.perf_counter() - start_time) * 1000.0

        return DispatchResult(
            strategy=self.name,
            solve_ms=round(solve_ms, 2),
            plans=updated_plans,
            assigned=assigned_ids,
            deferred=deferred_ids,
            rejected=rejected,
        )
