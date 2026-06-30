"""
SaaS application factory — mount from legacy `backend/main.py` or run standalone:

    uvicorn app.main:saas_app --reload --app-dir backend
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import saas_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Schema: use `alembic upgrade head` + `python -m scripts.seed_saas_dev`
    yield


def create_saas_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Multi-tenant Travel SaaS — bookings, AADE, telemetry, audit.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(saas_router)
    return app


saas_app = create_saas_app()
