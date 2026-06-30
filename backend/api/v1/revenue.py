from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.dependencies import get_actor_id, get_tenant_db, get_tenant_id
from travel_platform.revenue.dynamic_pricing import DynamicPricingEngine
from schemas.platform.revenue import PricingQuoteResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/pricing/quote", response_model=PricingQuoteResponse)
async def get_pricing_quote(
    trip_id: Annotated[int, Query(gt=0)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
):
    engine = DynamicPricingEngine(session, tenant_id, actor_id=actor_id)
    quote = await engine.quote_for_trip(trip_id)
    return PricingQuoteResponse(
        trip_id=quote.trip_id,
        base_price_eur=quote.base_price_eur,
        final_price_eur=quote.final_price_eur,
        occupancy_ratio=quote.occupancy_ratio,
        applied_rule=quote.applied_rule.value if quote.applied_rule else None,
        adjustment_pct=quote.adjustment_pct,
    )
