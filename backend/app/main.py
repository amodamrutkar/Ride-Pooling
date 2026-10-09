"""
PoolIQ Backend — FastAPI Application

Placeholder main app. Ketan owns the full API implementation.
"""

from fastapi import FastAPI

app = FastAPI(
    title="PoolIQ",
    description="Explainable Ride-Pooling Dispatch Engine",
    version="0.1.0",
)


@app.get("/api/health")
async def health():
    """Liveness check + road-data mode."""
    return {
        "status": "ok",
        "road_data": "Offline model",
        "version": "0.1.0",
    }
