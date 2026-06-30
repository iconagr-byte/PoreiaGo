"""Pydantic schemas — Email Marketing API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class EmailTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = ""
    body_html: str = ""
    variables: list[str] = Field(
        default_factory=lambda: ["client_name", "product_list"],
        description="Δυναμικές μεταβλητές π.χ. client_name, product_list",
    )


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    variables: list[str] | None = None


class EmailTemplateOut(EmailTemplateBase):
    id: str
    created_at: str | None = None
    updated_at: str | None = None


class EmailCampaignBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1)
    body_html: str = ""
    status: str = "Draft"
    audience_filter: str = "all"


class EmailCampaignCreate(EmailCampaignBase):
    email_settings_id: str | None = None
    preheader: str = ""
    blocks: list[dict] | None = None
    send_now: bool = False
    subscriber_list: str | None = "subscribed_only"


class SegmentOut(BaseModel):
    id: str
    label: str
    description: str
    count: int
    label_count: str


class GenerateSubjectRequest(BaseModel):
    body_html: str = ""
    campaign_name: str = ""
    preheader: str = ""


class GenerateSubjectResponse(BaseModel):
    subjects: list[str]
    source: str


class InventoryProductOut(BaseModel):
    id: str
    title: str
    price: float
    image_url: str | None = None
    description: str | None = None
    stock: int = 100
    active: bool = True


class EmailCampaignUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    preheader: str | None = None
    status: str | None = None
    audience_filter: str | None = None
    email_settings_id: str | None = None
    blocks: list[dict] | None = None


class EmailCampaignOut(EmailCampaignBase):
    id: str
    email_settings_id: str | None = None
    preheader: str = ""
    blocks_json: str | None = None
    sent_at: str | None = None
    open_count: int = 0
    click_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None
    stats: dict | None = None


class CampaignTestSendRequest(BaseModel):
    to_email: str = Field(min_length=3, description="Email για δοκιμαστική αποστολή")
    subject: str = Field(min_length=1)
    body_html: str = ""
    preheader: str = ""
    blocks: list[dict] | None = None
    email_settings_id: str | None = None


class CampaignTestSendResult(BaseModel):
    ok: bool = True
    to: str
    from_address: str
    subject: str


class CampaignSendRequest(BaseModel):
    campaign_id: str
    batch_size: int = 50
    audience: str | None = None
    email_settings_id: str | None = Field(
        default=None,
        description="SMTP λογαριασμός από EmailSettings — αλλιώς default ενεργός",
    )
    subscriber_list: str | None = Field(
        default=None,
        description='Π.χ. "subscribed_only" για μόνο εγγεγραμμένους GDPR',
    )


class AutoResponderRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    trigger_keywords: str = Field(
        description='Λέξεις-κλειδιά χωρισμένες με κόμμα, π.χ. "προσφορά, βλάβη, τιμή"',
    )
    response_template: str = Field(description="HTML/text απάντησης")
    is_active: bool = True
    priority: int = 100


class AutoResponderRuleCreate(AutoResponderRuleBase):
    template_id: str | None = None
    email_settings_id: str | None = None


class AutoResponderRuleUpdate(BaseModel):
    name: str | None = None
    trigger_keywords: str | None = None
    response_template: str | None = None
    is_active: bool | None = None
    priority: int | None = None
    template_id: str | None = None


class AutoResponderRuleOut(AutoResponderRuleBase):
    id: str
    template_id: str | None = None
    email_settings_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CampaignSendResult(BaseModel):
    ok: bool
    campaign_id: str
    total_recipients: int
    sent: int
    failed: int
    batches: int


class ProductForTemplate(BaseModel):
    id: str
    title: str
    price: float
    image_url: str | None = None
    description: str | None = None
    stock: int = 100
    active: bool = True


class ImapPollResult(BaseModel):
    fetched: int
    auto_replied: int
    skipped: int
    errors: list[str] = Field(default_factory=list)
