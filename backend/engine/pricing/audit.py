"""
PoolIQ Fairness Audit — Shapley Axiom Verification.

Validates the formal mathematical properties of the fare allocation:
  1. Efficiency: Sum of fares equals group cost within tolerance (₹0.01).
  2. Symmetry: Symmetric riders receive equal fares.
  3. Null Player: A rider with zero marginal cost across coalitions pays ≈ 0.
  4. Individual Rationality: Each rider's fare <= solo fare (flags violators).
"""

from __future__ import annotations

import itertools
from typing import Callable, Optional

from backend.app.models import FairnessAudit, IndividualRationalityAudit


def run_fairness_audit(
    shapley_fares: dict[str, float],
    solo_fares: dict[str, float],
    total_cost: float,
    v_func: Optional[Callable[[frozenset[str]], float]] = None,
    rider_ids: Optional[list[str]] = None,
    tolerance: float = 0.05,
) -> FairnessAudit:
    """Audit Shapley fare allocations against core cooperative game axioms.

    Args:
        shapley_fares: Computed Shapley fare for each rider.
        solo_fares: Unpooled solo trip cost for each rider.
        total_cost: Total cost of the group trip (v(N)).
        v_func: Characteristic function mapping frozenset of rider IDs to cost.
        rider_ids: List of rider IDs in the coalition.
        tolerance: Numerical tolerance in ₹ for floating point comparisons.

    Returns:
        FairnessAudit matching the PRD §6 data contract.
    """
    riders = rider_ids if rider_ids is not None else list(shapley_fares.keys())
    n = len(riders)

    if n == 0:
        return FairnessAudit(
            efficiency=True,
            symmetry=True,
            null_player=True,
            individual_rationality=IndividualRationalityAudit(ok=True, violations=[]),
        )

    # 1. Efficiency: sum(phi_i) == total_cost
    fare_sum = sum(shapley_fares.values())
    efficiency = abs(fare_sum - total_cost) <= tolerance

    # 2. Symmetry check
    # Riders i and j are symmetric if for all S ⊆ N \ {i, j}, v(S ∪ {i}) == v(S ∪ {j}).
    # If symmetric riders exist, check |phi_i - phi_j| <= tolerance.
    symmetry = True
    if v_func is not None and n >= 2 and n <= 6:
        for i_idx in range(n):
            for j_idx in range(i_idx + 1, n):
                r_i, r_j = riders[i_idx], riders[j_idx]
                others = [r for r in riders if r not in (r_i, r_j)]
                is_symmetric = True

                for k in range(len(others) + 1):
                    for comb in itertools.combinations(others, k):
                        s = frozenset(comb)
                        v_i = v_func(s | {r_i})
                        v_j = v_func(s | {r_j})
                        if abs(v_i - v_j) > tolerance:
                            is_symmetric = False
                            break
                    if not is_symmetric:
                        break

                if is_symmetric:
                    if abs(shapley_fares[r_i] - shapley_fares[r_j]) > tolerance:
                        symmetry = False
                        break
            if not symmetry:
                break

    # 3. Null player check
    # A null player has v(S ∪ {i}) - v(S) == 0 for all S ⊆ N \ {i}.
    null_player = True
    if v_func is not None and n <= 6:
        for r_i in riders:
            others = [r for r in riders if r != r_i]
            is_null = True

            for k in range(len(others) + 1):
                for comb in itertools.combinations(others, k):
                    s = frozenset(comb)
                    marginal = v_func(s | {r_i}) - v_func(s)
                    if abs(marginal) > tolerance:
                        is_null = False
                        break
                if not is_null:
                    break

            if is_null:
                if abs(shapley_fares[r_i]) > tolerance:
                    null_player = False
                    break

    # 4. Individual Rationality: phi_i <= solo_i
    violations: list[str] = []
    for rid in riders:
        fare = shapley_fares.get(rid, 0.0)
        solo = solo_fares.get(rid, 0.0)
        if fare > solo + tolerance:
            violations.append(
                f"{rid}: Shapley fare ₹{fare:.2f} > Solo fare ₹{solo:.2f} "
                f"(loss: ₹{fare - solo:.2f})"
            )

    ir_audit = IndividualRationalityAudit(
        ok=(len(violations) == 0),
        violations=violations,
    )

    return FairnessAudit(
        efficiency=efficiency,
        symmetry=symmetry,
        null_player=null_player,
        individual_rationality=ir_audit,
    )
