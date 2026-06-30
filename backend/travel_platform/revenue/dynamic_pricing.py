"""
Dynamic pricing engine — adjusts unit price from seat occupancy vs trip capacity.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.config import platform_settings
from core.exceptions import PricingError


class PricingRuleType(str, Enum):
    HIGH_OCCUPANCY_SURGE = "high_occupancy_surge"
    LOW_OCCUPANCY_DISCOUNT = "low_occupancy_discount"
    FLAT = "flat"


@dataclass(frozen=True)
class TripCapacitySnapshot:
    trip_id: int
    total_seats: int
    sold_seats: int
    base_price_eur: Decimal

    @property
    def occupancy_ratio(self) -> float:
        if self.total_seats <= 0:
            return 0.0
        return min(1.0, self.sold_seats / self.total_seats)


@dataclass(frozen=True)
class PricingQuote:
    trip_id: int
    base_price_eur: Decimal
    final_price_eur: Decimal
    occupancy_ratio: float
    applied_rule: PricingRuleType | None
    adjustment_pct: float


def compute_quote_pure(
    base_price_eur: float,
    total_seats: int,
    sold_seats: int,
    *,
    trip_id: int = 0,
    high_threshold: float | None = None,
    high_markup_pct: float | None = None,
    low_threshold: float | None = None,
    low_discount_pct: float | None = None,
) -> PricingQuote:
    """Pure pricing — no DB (B2C / admin quote endpoint)."""
    high_threshold = (
        high_threshold if high_threshold is not None else platform_settings.pricing_high_occupancy_threshold
    )
    high_markup = (
        high_markup_pct if high_markup_pct is not None else platform_settings.pricing_high_occupancy_markup_pct
    )
    low_threshold = (
        low_threshold if low_threshold is not None else platform_settings.pricing_low_occupancy_threshold
    )
    low_discount = (
        low_discount_pct if low_discount_pct is not None else platform_settings.pricing_low_occupancy_discount_pct
    )
    capacity = max(total_seats, 1)
    ratio = min(1.0, sold_seats / capacity)
    base = Decimal(str(base_price_eur))
    rule: PricingRuleType | None = None
    adjustment_pct = 0.0
    if ratio >= high_threshold:
        rule = PricingRuleType.HIGH_OCCUPANCY_SURGE
        adjustment_pct = high_markup
    elif ratio <= low_threshold:
        rule = PricingRuleType.LOW_OCCUPANCY_DISCOUNT
        adjustment_pct = -low_discount
    multiplier = Decimal("1") + Decimal(str(adjustment_pct)) / Decimal("100")
    final = (base * multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return PricingQuote(
        trip_id=trip_id,
        base_price_eur=base,
        final_price_eur=final,
        occupancy_ratio=ratio,
        applied_rule=rule,
        adjustment_pct=adjustment_pct,
    )


class DynamicPricingEngine(TenantScopedService):
    """Stateless strategy evaluation; persists quotes optionally via audit."""

    def __init__(self, session: AsyncSession, tenant_id: UUID, **kwargs):
        super().__init__(session, tenant_id, **kwargs)
        self._high_threshold = platform_settings.pricing_high_occupancy_threshold
        self._high_markup = platform_settings.pricing_high_occupancy_markup_pct
        self._low_threshold = platform_settings.pricing_low_occupancy_threshold
        self._low_discount = platform_settings.pricing_low_occupancy_discount_pct

    async def load_trip_snapshot(self, trip_id: int) -> TripCapacitySnapshot:
        await self._bind_tenant_rls()
        row = await self._session.execute(
            text("""
                SELECT t.id AS trip_id,
                       t.total_seats,
                       COUNT(b.id) FILTER (WHERE b.status IN ('CONFIRMED','PENDING')) AS sold_seats,
                       t.base_price AS base_price_eur
                FROM trips t
                LEFT JOIN bookings b ON b.trip_id = t.id AND b.tenant_id = t.tenant_id
                WHERE t.id = :trip_id AND t.tenant_id = :tenant_id
                GROUP BY t.id, t.total_seats, t.base_price
            """),
            {"trip_id": trip_id, "tenant_id": str(self._tenant_id)},
        )
        mapping = row.mappings().first()
        if not mapping:
            raise PricingError(f"Trip {trip_id} not found for tenant")
        return TripCapacitySnapshot(
            trip_id=mapping["trip_id"],
            total_seats=mapping["total_seats"] or 0,
            sold_seats=mapping["sold_seats"] or 0,
            base_price_eur=Decimal(str(mapping["base_price_eur"])),
        )

    def compute_quote(self, snapshot: TripCapacitySnapshot) -> PricingQuote:
        return compute_quote_pure(
            float(snapshot.base_price_eur),
            snapshot.total_seats,
            snapshot.sold_seats,
            trip_id=snapshot.trip_id,
            high_threshold=self._high_threshold,
            high_markup_pct=self._high_markup,
            low_threshold=self._low_threshold,
            low_discount_pct=self._low_discount,
        )

    async def quote_for_trip(self, trip_id: int) -> PricingQuote:
        snapshot = await self.load_trip_snapshot(trip_id)
        quote = self.compute_quote(snapshot)
        await self._audit(
            "pricing.quote_generated",
            "trip",
            str(trip_id),
            metadata={
                "occupancy_ratio": quote.occupancy_ratio,
                "final_price_eur": str(quote.final_price_eur),
                "rule": quote.applied_rule.value if quote.applied_rule else None,
            },
            financial=True,
        )
        return quote
