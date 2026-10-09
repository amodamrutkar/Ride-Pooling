"""
OR-Tools VRPTW Pickup and Delivery Model.

Wraps Google OR-Tools RoutingModel for dynamic multi-vehicle VRPTW polish stage.
Used by Strategy E (hybrid) to optimize vehicle route plans with warm-starting.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from backend.app.models import LatLon, Request, RoutePlan, Stop, StopType, Vehicle

if TYPE_CHECKING:
    from backend.engine.routing.matrix_provider import MatrixProvider

logger = logging.getLogger(__name__)

try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False
    logger.warning("ortools package not available. Hybrid strategy will fall back to batch_matching.")


def optimize_vrptw(
    vehicles: list[Vehicle],
    requests: list[Request],
    matrix: MatrixProvider,
    now_s: float = 0.0,
    time_limit_ms: int = 1500,
    warm_start_plans: list[RoutePlan] | None = None,
) -> list[RoutePlan] | None:
    """Run OR-Tools Pickup and Delivery VRPTW solver.

    Args:
        vehicles: List of vehicles.
        requests: List of pending/assigned requests to route.
        matrix: Travel-time matrix provider.
        now_s: Current simulation timestamp.
        time_limit_ms: Solver search time limit in milliseconds (default 1500 ms).
        warm_start_plans: Optional initial RoutePlans to warm start the solver.

    Returns:
        List of optimized RoutePlans, or None if solver failed or ortools is missing.
    """
    if not ORTOOLS_AVAILABLE:
        return None

    if not requests and not any(v.route and v.route.stops for v in vehicles):
        return []

    # Map node indices for OR-Tools routing model
    # Nodes:
    # 0 .. V-1 : Vehicle starts
    # V .. V+2R-1 : Requests (Pairs of Pickup, Drop)
    n_vehicles = len(vehicles)
    node_points: list[LatLon] = [v.position for v in vehicles]

    # Map requests to pickup and drop node indices
    req_nodes: dict[str, tuple[int, int]] = {}
    node_to_req: dict[int, tuple[str, StopType]] = {}
    req_by_id = {r.id: r for r in requests}

    node_idx = n_vehicles
    for r in requests:
        p_node = node_idx
        d_node = node_idx + 1
        node_idx += 2

        req_nodes[r.id] = (p_node, d_node)
        node_to_req[p_node] = (r.id, StopType.PICKUP)
        node_to_req[d_node] = (r.id, StopType.DROP)

        node_points.append(r.pickup)
        node_points.append(r.drop)

    # Compute NxN travel time matrix in integer seconds for OR-Tools
    mat_res = matrix.table(node_points)
    durations_int = [
        [int(round(cell)) for cell in row] for row in mat_res.durations_s
    ]

    # Initialize OR-Tools Routing Index Manager
    # Vehicles start at their node 0..V-1, and end at arbitrary depot or start
    starts = list(range(n_vehicles))
    ends = list(range(n_vehicles))  # allow vehicles to end anywhere (zero-cost dummy end)

    manager = pywrapcp.RoutingIndexManager(len(node_points), n_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    # Transit distance/time callback
    def transit_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return durations_int[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Add Time Dimension (VRPTW)
    time_dim_name = "Time"
    HORIZON = 86400  # 24 hours max horizon
    routing.AddDimension(
        transit_callback_index,
        HORIZON,  # allow waiting
        HORIZON,  # max time per vehicle
        False,    # Don't force start to zero
        time_dim_name,
    )
    time_dimension = routing.GetDimensionOrDie(time_dim_name)

    # Add Capacity Dimension
    def capacity_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        if from_node in node_to_req:
            rid, stype = node_to_req[from_node]
            seats = req_by_id[rid].seats if rid in req_by_id else 1
            return seats if stype == StopType.PICKUP else -seats
        return 0

    capacity_callback_index = routing.RegisterUnaryTransitCallback(capacity_callback)
    routing.AddDimensionWithVehicleCapacity(
        capacity_callback_index,
        0,  # null capacity slack
        [v.capacity for v in vehicles],  # vehicle capacities
        True,  # start at 0
        "Capacity",
    )

    # Pickup and Delivery constraints + 1.15 x direct ride time caps
    DISJUNCTION_PENALTY = 1_000_000

    for r in requests:
        p_node, d_node = req_nodes[r.id]
        p_index = manager.NodeToIndex(p_node)
        d_index = manager.NodeToIndex(d_node)

        # Allow disjunction (optional request drop if infeasible)
        routing.AddDisjunction([p_index], DISJUNCTION_PENALTY)
        routing.AddDisjunction([d_index], DISJUNCTION_PENALTY)

        routing.AddPickupAndDelivery(p_index, d_index)
        routing.Solver().Add(
            routing.VehicleVar(p_index) == routing.VehicleVar(d_index)
        )
        routing.Solver().Add(
            time_dimension.CumulVar(p_index) <= time_dimension.CumulVar(d_index)
        )

        # Pickup Window Constraint
        max_wait = r.max_wait_s
        req_time = int(round(r.request_time))
        time_dimension.CumulVar(p_index).SetRange(
            req_time, req_time + int(round(max_wait))
        )

        # Ride Time Cap: 1.15 x T_direct
        direct_dur, _ = matrix.pair(r.pickup, r.drop)
        max_ride = int(round((1.0 + r.detour_cap) * direct_dur))
        routing.Solver().Add(
            time_dimension.CumulVar(d_index) - time_dimension.CumulVar(p_index) <= max_ride
        )

    # Search Parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromMilliseconds(time_limit_ms)

    # Solve
    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return None

    # Reconstruct RoutePlans from OR-Tools solution
    new_plans: list[RoutePlan] = []

    for v_idx, vehicle in enumerate(vehicles):
        index = routing.Start(v_idx)
        stops: list[Stop] = []
        seq = 0
        current_time = now_s
        prev_point = vehicle.position
        tot_dist = 0.0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node in node_to_req:
                rid, stype = node_to_req[node]
                pt = node_points[node]
                cumul_time = solution.Min(time_dimension.CumulVar(index))

                dur_step, dist_step = matrix.pair(prev_point, pt)
                tot_dist += dist_step
                prev_point = pt

                load = solution.Min(routing.GetDimensionOrDie("Capacity").CumulVar(index))

                stops.append(
                    Stop(
                        seq=seq,
                        type=stype,
                        request_id=rid,
                        point=pt,
                        eta_s=float(cumul_time),
                        load_after=int(load),
                    )
                )
                seq += 1

            index = solution.Value(routing.NextVar(index))

        if stops:
            version = (vehicle.route.version + 1) if vehicle.route else 1
            plan = RoutePlan(
                vehicle_id=vehicle.id,
                version=version,
                stops=stops,
                total_dist_m=tot_dist,
                total_time_s=stops[-1].eta_s - now_s,
                polyline=[[s.point.lat, s.point.lon] for s in stops],
            )
            new_plans.append(plan)

    return new_plans
