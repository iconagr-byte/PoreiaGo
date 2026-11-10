"""Public + admin Rent plan marketing cards (standalone + add-on)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from travel_platform.settings.rent_plan_catalog_store import (
    read_rent_plan_catalog,
    write_rent_plan_catalog,
)

router = APIRouter(tags=["rent-plan-catalog"])


class RentPlanCardModel(BaseModel):
    badge: str = ""
    name: str = ""
    tagline: str = ""
    monthlyEur: float = 0
    features: list[str] = Field(default_factory=list)
    ctaLoggedIn: str = ""
    ctaGuest: str = ""
    servicesLinkLabel: str | None = None
    visible: bool = True


class RentPlanCatalogResponse(BaseModel):
    sectionTitle: str
    standalone: RentPlanCardModel
    addon: RentPlanCardModel


class RentPlanCatalogPatch(BaseModel):
    sectionTitle: str | None = None
    standalone: RentPlanCardModel | None = None
    addon: RentPlanCardModel | None = None


def _to_response(data: dict) -> RentPlanCatalogResponse:
    return RentPlanCatalogResponse(
        sectionTitle=data["sectionTitle"],
        standalone=RentPlanCardModel(**data["standalone"]),
        addon=RentPlanCardModel(**data["addon"]),
    )


@router.get("/api/site/rent-plan-catalog", response_model=RentPlanCatalogResponse)
async def get_public_rent_plan_catalog():
    return _to_response(read_rent_plan_catalog())


@router.get("/api/admin/platform/rent-plan-catalog", response_model=RentPlanCatalogResponse)
async def get_admin_rent_plan_catalog():
    return _to_response(read_rent_plan_catalog())


@router.patch("/api/admin/platform/rent-plan-catalog", response_model=RentPlanCatalogResponse)
async def patch_rent_plan_catalog(body: RentPlanCatalogPatch):
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")
    saved = write_rent_plan_catalog(patch)
    return _to_response(saved)
