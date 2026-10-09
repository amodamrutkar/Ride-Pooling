"""
Vehicle Motion — position interpolation along route polylines.

Given a polyline (list of [lat, lon] points) and elapsed time at a constant
speed, returns the interpolated position. Also detects pickup/drop stop events.

All functions are pure — no mutation, return new state.
Owner: Amod.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from backend.app.models import LatLon, RoutePlan, StopType
from backend.engine.routing.haversine import haversine


class EventType(str, Enum):
    PICKUP = "PICKUP"
    DROP = "DROP"


@dataclass
class StopEvent:
    """An event triggered when a vehicle reaches a route stop."""
    event_type: EventType
    request_id: str
    stop_seq: int
    point: LatLon
    time_s: float  # sim time when event occurs


def polyline_total_distance(polyline: list[list[float]]) -> float:
    """Compute total distance of a polyline in meters.

    Args:
        polyline: List of [lat, lon] coordinate pairs.

    Returns:
        Total distance in meters.
    """
    total = 0.0
    for i in range(len(polyline) - 1):
        total += haversine(
            polyline[i][0], polyline[i][1],
            polyline[i + 1][0], polyline[i + 1][1],
        )
    return total


def interpolate_position(
    polyline: list[list[float]],
    elapsed_s: float,
    speed_mps: float,
) -> LatLon:
    """Interpolate vehicle position along a polyline.

    Given the elapsed sim time and a constant speed, returns the lat/lon
    position along the polyline.

    Args:
        polyline: List of [lat, lon] coordinate pairs (at least 2 points).
        elapsed_s: Sim time elapsed since the vehicle started this polyline.
        speed_mps: Vehicle speed in meters per second.

    Returns:
        Interpolated LatLon position. If elapsed_s exceeds the polyline
        travel time, returns the last point.
    """
    if not polyline:
        raise ValueError("Polyline must have at least one point")

    if len(polyline) == 1:
        return LatLon(lat=polyline[0][0], lon=polyline[0][1])

    distance_to_travel = elapsed_s * speed_mps
    cumulative = 0.0

    for i in range(len(polyline) - 1):
        seg_dist = haversine(
            polyline[i][0], polyline[i][1],
            polyline[i + 1][0], polyline[i + 1][1],
        )
        if seg_dist == 0:
            continue

        if cumulative + seg_dist >= distance_to_travel:
            # Interpolate within this segment
            remaining = distance_to_travel - cumulative
            fraction = remaining / seg_dist
            lat = polyline[i][0] + fraction * (polyline[i + 1][0] - polyline[i][0])
            lon = polyline[i][1] + fraction * (polyline[i + 1][1] - polyline[i][1])
            return LatLon(lat=lat, lon=lon)

        cumulative += seg_dist

    # Past the end — return final point
    return LatLon(lat=polyline[-1][0], lon=polyline[-1][1])


def check_stop_events(
    route: RoutePlan,
    current_time_s: float,
    last_checked_seq: int = -1,
) -> list[StopEvent]:
    """Check which route stops have been reached by the current sim time.

    Args:
        route: The vehicle's current route plan (with stop ETAs).
        current_time_s: Current simulation time in seconds.
        last_checked_seq: The last stop sequence already processed.
                          Only stops with seq > last_checked_seq are returned.

    Returns:
        List of StopEvents for newly reached stops (in order).
    """
    events: list[StopEvent] = []

    for stop in route.stops:
        if stop.seq <= last_checked_seq:
            continue
        if stop.eta_s <= current_time_s:
            event_type = (
                EventType.PICKUP if stop.type == StopType.PICKUP
                else EventType.DROP
            )
            events.append(StopEvent(
                event_type=event_type,
                request_id=stop.request_id,
                stop_seq=stop.seq,
                point=stop.point,
                time_s=stop.eta_s,
            ))

    return events
