"""
Pricing — Shapley values, baseline splits, fairness audit.
"""

from backend.engine.pricing.audit import run_fairness_audit
from backend.engine.pricing.baselines import (
    distance_proportional_split,
    equal_split,
    solo_fares,
)
from backend.engine.pricing.shapley import (
    CharacteristicFunction,
    compute_exact_shapley,
    compute_fares,
    compute_monte_carlo_shapley,
)

__all__ = [
    "compute_fares",
    "compute_exact_shapley",
    "compute_monte_carlo_shapley",
    "CharacteristicFunction",
    "solo_fares",
    "equal_split",
    "distance_proportional_split",
    "run_fairness_audit",
]
