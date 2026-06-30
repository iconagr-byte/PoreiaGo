"""12-factor configuration for the SaaS core."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Project Travel SaaS"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = False

    database_url: str = Field(
        default="postgresql+asyncpg://aerostride_user:securepassword@localhost:5432/aerostride_db",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    auth_jwt_secret: str = Field(default="", alias="AUTH_JWT_SECRET")
    auth_jwt_algorithm: str = Field(default="HS256", alias="AUTH_JWT_ALGORITHM")
    auth_jwt_private_key: str = Field(default="", alias="AUTH_JWT_PRIVATE_KEY")
    auth_jwt_public_key: str = Field(default="", alias="AUTH_JWT_PUBLIC_KEY")
    auth_jwt_issuer: str = Field(default="aerostride-auth", alias="AUTH_JWT_ISSUER")
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    mfa_issuer_name: str = "Project Travel"
    mfa_required_roles: str = "tenant_admin,superadmin"

    geofence_radius_m: int = 50
    aade_queue_key: str = "saas:aade:queue"
    aade_status_key_prefix: str = "saas:aade:status:"
    email_queue_key: str = "saas:email:queue"

    backup_s3_bucket: str = Field(default="", alias="BACKUP_S3_BUCKET")
    backup_s3_prefix: str = Field(default="postgres-dumps", alias="BACKUP_S3_PREFIX")
    aws_region: str = Field(default="eu-central-1", alias="AWS_REGION")
    aws_access_key_id: str = Field(default="", alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="", alias="AWS_SECRET_ACCESS_KEY")

    celery_broker_url: str = Field(default="redis://localhost:6379/0", alias="CELERY_BROKER_URL")

    aade_webhook_secret: str = Field(default="", alias="AADE_WEBHOOK_SECRET")

    stripe_secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")
    stripe_checkout_webhook_secret: str = Field(
        default="",
        alias="STRIPE_CHECKOUT_WEBHOOK_SECRET",
        description="Webhook secret for B2C ticket PaymentIntent events (falls back to STRIPE_WEBHOOK_SECRET)",
    )
    stripe_price_starter: str = Field(default="", alias="STRIPE_PRICE_STARTER")
    stripe_price_professional: str = Field(default="", alias="STRIPE_PRICE_PROFESSIONAL")
    stripe_price_enterprise: str = Field(default="", alias="STRIPE_PRICE_ENTERPRISE")
    stripe_price_metered_bus: str = Field(default="", alias="STRIPE_PRICE_METERED_BUS")
    stripe_price_metered_trip: str = Field(default="", alias="STRIPE_PRICE_METERED_TRIP")
    stripe_price_starter_yearly: str = Field(default="", alias="STRIPE_PRICE_STARTER_YEARLY")
    stripe_price_professional_yearly: str = Field(default="", alias="STRIPE_PRICE_PROFESSIONAL_YEARLY")
    stripe_price_enterprise_yearly: str = Field(default="", alias="STRIPE_PRICE_ENTERPRISE_YEARLY")
    billing_success_url: str = Field(
        default="http://localhost:5173/admin?billing=success",
        alias="BILLING_SUCCESS_URL",
    )
    billing_cancel_url: str = Field(
        default="http://localhost:5173/admin?billing=cancel",
        alias="BILLING_CANCEL_URL",
    )
    billing_signup_success_url: str = Field(
        default="http://localhost:5173/grafeia/signup/success?billing=success",
        alias="BILLING_SIGNUP_SUCCESS_URL",
    )
    billing_signup_cancel_url: str = Field(
        default="http://localhost:5173/grafeia/signup?billing=cancel",
        alias="BILLING_SIGNUP_CANCEL_URL",
    )

    usage_metering_enabled: bool = Field(default=True, alias="USAGE_METERING_ENABLED")
    usage_metering_cron_hour: int = Field(default=2, alias="USAGE_METERING_CRON_HOUR")
    usage_metering_cron_minute: int = Field(default=0, alias="USAGE_METERING_CRON_MINUTE")

    gdpr_erasure_email_enabled: bool = Field(default=True, alias="GDPR_ERASURE_EMAIL_ENABLED")

    tenant_dedicated_db_auto_provision: bool = Field(
        default=False,
        alias="TENANT_DEDICATED_DB_AUTO_PROVISION",
        description="Dev/staging: auto CREATE DATABASE for Enterprise tenants",
    )
    aade_api_url: str = Field(
        default="https://mydataapi.aade.gr/myDATA/SendInvoices",
        alias="AADE_API_URL",
    )
    aade_cert_password: str = Field(default="", alias="AADE_CERT_PASSWORD")
    aade_mode: str = Field(default="stub", alias="AADE_MODE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
