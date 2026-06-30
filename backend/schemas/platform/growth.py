from pydantic import BaseModel, Field, HttpUrl


class BrandingUpdateRequest(BaseModel):
    display_name: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    logo_url: HttpUrl | None = None
    primary_color: str = "#0040df"
    custom_domain: str | None = None
    css_injection_url: HttpUrl | None = None
    css_injection_inline: str | None = Field(None, max_length=50_000)


class BrandingResponse(BaseModel):
    slug: str
    display_name: str
    logo_url: str | None
    primary_color: str
    custom_domain: str | None
    css_injection_url: str | None
    verified_domain: bool


class WebhookRegisterRequest(BaseModel):
    partner_name: str
    target_url: HttpUrl
    event_types: list[str]
