"""
PoolIQ Backend — FastAPI Application

Main application entry point.
- Configures CORS for frontend
- Adds security headers middleware
- Registers API routers
- Suppresses raw stack traces in error responses

Owner: Ketan
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.routes import router as api_router
from backend.app.security import SecurityHeadersMiddleware

app = FastAPI(
    title="PoolIQ",
    description="Explainable Ride-Pooling Dispatch Engine — Algorithmic Transit & Fair Fare Allocation",
    version="1.0.0",
)

import os

# CORS allowlist for Vite/React frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.getenv("FRONTEND_URL"):
    origins.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security defense-in-depth headers
app.add_middleware(SecurityHeadersMiddleware)

# Register routes
app.include_router(api_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure internal errors do not leak stack traces to client."""
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An internal server error occurred.",
            "path": request.url.path,
        },
    )


def export_openapi() -> None:
    """Export the OpenAPI schema to docs/openapi.json."""
    docs_dir = Path("docs")
    docs_dir.mkdir(parents=True, exist_ok=True)
    openapi_schema = app.openapi()
    with open(docs_dir / "openapi.json", "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)


if __name__ == "__main__":
    export_openapi()
