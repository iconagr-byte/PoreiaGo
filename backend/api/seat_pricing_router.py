"""Public + admin seat pricing (per bus layout)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from travel_platform.settings.seat_pricing_store import (
    LAYOUT_IDS,
    get_layout_pricing,
    read_seat_pricing,
    write_seat_pricing,
)

router = APIRouter(tags=["seat-pricing"])


class AsidePanelModel(BaseModel):
    show_trip_card: bool = True
    show_legend: bool = True
    show_pricing: bool = True
    show_amenities: bool = True
    show_availability: bool = True
    show_vehicle_photo: bool = False
    show_route_stops: bool = False
    show_tips: bool = True
    show_deposit_note: bool = True
    show_selected_seats: bool = True
    trip_card_title: str = "Η εκδρομή σας"
    amenities_title: str = "Παροχές onboard"
    standard_amenities_label: str = "Standard"
    vip_amenities_label: str = ""
    vehicle_image_url: str = ""
    route_stops: list[str] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    legend_hint: str = ""
    deposit_note: str = ""
    availability_label: str = ""


class LayoutPricingModel(BaseModel):
    show_popup: bool = True
    standard_mode: str = "trip_price"
    standard_price_eur: float | None = None
    vip_mode: str = "markup"
    vip_price_eur: float | None = None
    vip_markup_pct: float = 25
    standard_amenities: list[str] = Field(default_factory=list)
    vip_amenities: list[str] = Field(default_factory=list)
    seat_overrides: dict[str, Any] = Field(default_factory=dict)
    aside_panel: AsidePanelModel = Field(default_factory=AsidePanelModel)


class SeatPricingResponse(BaseModel):
    layouts: dict[str, LayoutPricingModel]


class SeatPricingPatch(BaseModel):
    layouts: dict[str, LayoutPricingModel] | None = None


class PublicLayoutPricingResponse(LayoutPricingModel):
    layout_id: str


@router.get("/api/site/seat-pricing", response_model=PublicLayoutPricingResponse)
async def get_public_seat_pricing(layout_id: str = Query(default="luxury-coach")):
    lid = layout_id if layout_id in LAYOUT_IDS else "luxury-coach"
    row = get_layout_pricing(lid)
    return PublicLayoutPricingResponse(layout_id=lid, **row)


@router.get("/api/admin/platform/seat-pricing", response_model=SeatPricingResponse)
async def get_admin_seat_pricing():
    data = read_seat_pricing()
    return SeatPricingResponse(
        layouts={k: LayoutPricingModel(**v) for k, v in data["layouts"].items()}
    )


@router.patch("/api/admin/platform/seat-pricing", response_model=SeatPricingResponse)
async def patch_seat_pricing(body: SeatPricingPatch):
    if not body.layouts:
        raise HTTPException(status_code=400, detail="No layouts in patch")
    patch = {
        "layouts": {
            k: v.model_dump(exclude_unset=True)
            for k, v in body.layouts.items()
            if k in LAYOUT_IDS
        }
    }
    saved = write_seat_pricing(patch)
    return SeatPricingResponse(
        layouts={k: LayoutPricingModel(**v) for k, v in saved["layouts"].items()}
    )
