from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health(include_fiscal: bool = Query(True, description="Include fiscal pipeline snapshot")):
    """Liveness + dependency checks (DB, Redis, fiscal counts)."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.platform_health_service import build_platform_health

        async with AsyncSessionLocal() as session:
            payload = await build_platform_health(session, include_fiscal=include_fiscal)
    except Exception:
        from app.services.platform_health_service import build_platform_health

        payload = await build_platform_health(None, include_fiscal=False)
        payload["database"] = {"status": "fail", "detail": "session unavailable"}
        payload["status"] = "unhealthy"

    status_code = 200 if payload.get("status") != "unhealthy" else 503
    return JSONResponse(content=payload, status_code=status_code)
