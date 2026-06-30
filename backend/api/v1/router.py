from fastapi import APIRouter

from api.v1 import drivers, growth, operations, partner, revenue
from api.telemetry_router import admin_router as telemetry_admin_router

platform_router = APIRouter(prefix="/api/v1", tags=["platform"])

platform_router.include_router(telemetry_admin_router)
platform_router.include_router(revenue.router, prefix="/revenue", tags=["revenue"])
platform_router.include_router(operations.router, prefix="/operations", tags=["operations"])
platform_router.include_router(growth.router, prefix="/growth", tags=["growth"])
platform_router.include_router(partner.router, prefix="/partners", tags=["partners"])
platform_router.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
