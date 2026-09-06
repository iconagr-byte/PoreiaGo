"""Public + admin agency SaaS plan marketing cards."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from travel_platform.settings.agency_plan_catalog_store import (
    read_agency_plan_catalog,
    write_agency_plan_catalog,
)

router = APIRouter(tags=["agency-plan-catalog"])


class AgencyPlanCardModel(BaseModel):
    id: str
    name: str = ""
    tagline: str = ""
    kind: str = "buses"
    monthlyEur: float | None = None
    features: list[str] = Field(default_factory=list)
    highlighted: bool = False
    contactSales: bool = False
    visible: bool = True
    icon: str = "workspace_premium"
    builtin: bool = False


class AgencyPlanCatalogResponse(BaseModel):
    sectionTitle: str
    plans: list[AgencyPlanCardModel]


class AgencyPlanCatalogPatch(BaseModel):
    sectionTitle: str | None = None
    plans: list[AgencyPlanCardModel] | None = None


def _to_response(data: dict) -> AgencyPlanCatalogResponse:
    return AgencyPlanCatalogResponse(
        sectionTitle=data["sectionTitle"],
        plans=[AgencyPlanCardModel(**p) for p in data.get("plans") or []],
    )


@router.get("/api/site/agency-plan-catalog", response_model=AgencyPlanCatalogResponse)
async def get_public_agency_plan_catalog():
    return _to_response(read_agency_plan_catalog())


@router.get("/api/admin/platform/agency-plan-catalog", response_model=AgencyPlanCatalogResponse)
async def get_admin_agency_plan_catalog():
    return _to_response(read_agency_plan_catalog())


@router.patch("/api/admin/platform/agency-plan-catalog", response_model=AgencyPlanCatalogResponse)
async def patch_agency_plan_catalog(body: AgencyPlanCatalogPatch):
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")
    saved = write_agency_plan_catalog(patch)
    return _to_response(saved)
