"""
Security Controls & Hardening — PoolIQ

Provides:
- Pydantic input boundaries for geographical coords, fleet limits, and string sanitization.
- Rate limiting helpers.
- Admin Bearer token authorization for control routes.
- Security response headers middleware.
- Solver execution timeout enforcement.

Owner: Ketan
"""

from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict
from typing import Any, Callable, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.base import BaseHTTPMiddleware

# Geographic bounding box for Nashik urban region
NASHIK_LAT_MIN = 19.80
NASHIK_LAT_MAX = 20.20
NASHIK_LON_MIN = 73.60
NASHIK_LON_MAX = 74.00

# Security tokens
ADMIN_API_TOKEN = os.getenv("POOLIQ_ADMIN_TOKEN", "pooliq-admin-secret-key")

security_bearer = HTTPBearer(auto_error=False)


def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
) -> bool:
    """Validate Bearer token for admin actions."""
    # If environment disables auth (e.g. during local demo presentation), pass
    if os.getenv("DISABLE_AUTH", "false").lower() == "true":
        return True

    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer authentication token.",
        )
    if credentials.credentials != ADMIN_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid administrator credentials.",
        )
    return True


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add defense-in-depth security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


class RateLimiter:
    """In-memory rate limiter per client IP address."""

    def __init__(self, requests_per_minute: int = 60) -> None:
        self.rate = requests_per_minute
        self.history: dict[str, list[float]] = defaultdict(list)

    def check(self, client_ip: str) -> None:
        now = time.time()
        window_start = now - 60.0
        # Prune old timestamps
        timestamps = [t for t in self.history[client_ip] if t > window_start]
        if len(timestamps) >= self.rate:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: Max {self.rate} requests per minute.",
            )
        timestamps.append(now)
        self.history[client_ip] = timestamps


# ─── Bounded Input Schemas ───────────────────────────────────────────────────

class BoundedLatLon(BaseModel):
    """LatLon with strict geographical boundaries."""
    lat: float = Field(..., ge=NASHIK_LAT_MIN, le=NASHIK_LAT_MAX)
    lon: float = Field(..., ge=NASHIK_LON_MIN, le=NASHIK_LON_MAX)


class BoundedRequestSubmission(BaseModel):
    """Validated ride request submission."""
    id: Optional[str] = Field(None, max_length=32)
    pickup: BoundedLatLon
    drop: BoundedLatLon
    seats: int = Field(default=1, ge=1, le=4)
    max_wait_s: float = Field(default=480.0, ge=30.0, le=3600.0)
    detour_cap: float = Field(default=0.15, ge=0.05, le=0.50)

    @field_validator("id")
    @classmethod
    def sanitize_id(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Request ID must contain only alphanumeric characters, dashes, and underscores.")
        return v


async def run_with_timeout(
    coro_or_func: Callable[..., Any],
    *args: Any,
    timeout_s: float = 1.5,
    **kwargs: Any,
) -> Any:
    """Enforce a strict timeout on solver or optimizer execution to prevent API freeze."""
    try:
        if asyncio.iscoroutinefunction(coro_or_func):
            return await asyncio.wait_for(coro_or_func(*args, **kwargs), timeout=timeout_s)
        else:
            return await asyncio.wait_for(
                asyncio.to_thread(coro_or_func, *args, **kwargs), timeout=timeout_s
            )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Solver computation timed out after {timeout_s}s limit.",
        )


BoundedLatLon.model_rebuild()
BoundedRequestSubmission.model_rebuild()
