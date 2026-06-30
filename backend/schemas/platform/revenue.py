from decimal import Decimal
from pydantic import BaseModel, Field


class PricingQuoteResponse(BaseModel):
    trip_id: int
    base_price_eur: Decimal
    final_price_eur: Decimal
    occupancy_ratio: float = Field(ge=0, le=1)
    applied_rule: str | None
    adjustment_pct: float
