import os
from pydantic_settings import BaseSettings

class TicketingSettings(BaseSettings):
    jwt_secret: str = os.getenv(
        "TICKET_JWT_SECRET",
        "change-me-in-production-min-32-characters-long",
    )
    jwt_algorithm: str = "HS256"
    qr_window_seconds: int = 30
    jwt_issuer: str = "aerostride-ticketing"
    sqlite_path: str = os.getenv("TICKETING_DB_PATH", "data/ticketing.db")
    driver_api_keys: str = os.getenv("DRIVER_API_KEYS", "dev-driver-key")
    pki_private_key_path: str = os.getenv("PKI_PRIVATE_KEY_PATH", "data/ticket_signing_ed25519.pem")
    pki_public_key_path: str = os.getenv("PKI_PUBLIC_KEY_PATH", "data/ticket_verify_ed25519.pem")
    sms_enabled: bool = os.getenv("SMS_ENABLED", "false").lower() == "true"
    pre_departure_minutes: int = int(os.getenv("PRE_DEPARTURE_SMS_MINUTES", "5"))

    def driver_keys_set(self) -> set[str]:
        return {k.strip() for k in self.driver_api_keys.split(",") if k.strip()}

settings = TicketingSettings()
