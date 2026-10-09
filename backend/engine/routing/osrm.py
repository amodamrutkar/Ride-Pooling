"""
OsrmProvider — OSRM Table API matrix provider with disk caching and auto-fallback.

Features:
- Queries OSRM public demo server (or custom endpoint) for NxN travel time & distance matrix.
- Caches matrix queries on disk as JSON (keyed by rounded/sorted coordinates) in backend/data/cache/.
- Configurable timeout (default 2.0 s).
- Automatic fallback to FallbackMatrixProvider if network/OSRM fails or times out.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

import httpx

from backend.app.models import LatLon
from backend.engine.routing.fallback_provider import FallbackMatrixProvider
from backend.engine.routing.matrix_provider import MatrixProvider, MatrixResult

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "cache"


class OsrmProvider(MatrixProvider):
    """OSRM Table API client with local JSON caching and FallbackMatrixProvider fallback.

    Args:
        server_url: Base URL for OSRM server. Default http://router.project-osrm.org
        cache_dir: Path to store JSON cache files.
        timeout_s: HTTP request timeout in seconds.
        fallback: Fallback MatrixProvider if OSRM query fails.
    """

    def __init__(
        self,
        server_url: str = "http://router.project-osrm.org",
        cache_dir: Path | None = None,
        timeout_s: float = 2.0,
        fallback: MatrixProvider | None = None,
    ):
        self._server_url = server_url.rstrip("/")
        self._cache_dir = cache_dir or DEFAULT_CACHE_DIR
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._timeout_s = timeout_s
        self._fallback = fallback or FallbackMatrixProvider()
        self._using_fallback = False

    @property
    def name(self) -> str:
        if self._using_fallback:
            return f"Offline model (OSRM fallback)"
        return "OSRM Table API"

    def _get_cache_key(self, points: list[LatLon]) -> str:
        """Generate a deterministic MD5 hash for a list of rounded coordinates."""
        coords_str = ";".join(f"{round(p.lon, 4)},{round(p.lat, 4)}" for p in points)
        return hashlib.md5(coords_str.encode("utf-8")).hexdigest()

    def _load_cache(self, cache_key: str) -> MatrixResult | None:
        cache_file = self._cache_dir / f"osrm_{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return MatrixResult(
                    durations_s=data["durations_s"],
                    distances_m=data["distances_m"],
                )
            except Exception as e:
                logger.warning(f"Failed to read cache file {cache_file}: {e}")
        return None

    def _save_cache(self, cache_key: str, result: MatrixResult) -> None:
        cache_file = self._cache_dir / f"osrm_{cache_key}.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump({
                    "durations_s": result.durations_s,
                    "distances_m": result.distances_m,
                }, f)
        except Exception as e:
            logger.warning(f"Failed to write cache file {cache_file}: {e}")

    def table(self, points: list[LatLon]) -> MatrixResult:
        if not points:
            return MatrixResult(durations_s=[], distances_m=[])
        if len(points) == 1:
            return MatrixResult(durations_s=[[0.0]], distances_m=[[0.0]])

        cache_key = self._get_cache_key(points)
        cached = self._load_cache(cache_key)
        if cached is not None:
            return cached

        # Construct OSRM table request
        # Format: /table/v1/driving/lon1,lat1;lon2,lat2?...?annotations=duration,distance
        coords = ";".join(f"{p.lon:.6f},{p.lat:.6f}" for p in points)
        url = f"{self._server_url}/table/v1/driving/{coords}?annotations=duration,distance"

        try:
            with httpx.Client(timeout=self._timeout_s) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()

            if data.get("code") == "Ok":
                durations = data["durations"]
                # OSRM returns distances in meters if requested, otherwise None
                distances = data.get("distances")
                if distances is None:
                    # Fallback distance calculation if OSRM server didn't return distances
                    fallback_res = self._fallback.table(points)
                    distances = fallback_res.distances_m

                result = MatrixResult(durations_s=durations, distances_m=distances)
                self._save_cache(cache_key, result)
                self._using_fallback = False
                return result

        except Exception as e:
            logger.warning(f"OSRM Table query failed ({e}). Falling back to {self._fallback.name}.")

        # Fallback
        self._using_fallback = True
        return self._fallback.table(points)

    def pair(self, origin: LatLon, destination: LatLon) -> tuple[float, float]:
        res = self.table([origin, destination])
        return res.durations_s[0][1], res.distances_m[0][1]
