"""
AADE Gateway — isolated fiscal boundary.

Booking API never holds AADE certificates. This module:
  - Loads per-tenant credentials from Vault
  - Signs XML per myDATA spec
  - Returns MARK; retries via Celery on transient failures
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol

from app.core.config import get_settings
from core.exceptions import AadeTransmissionError

logger = logging.getLogger(__name__)


class DocumentType(str, Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt"
    CREDIT_NOTE = "credit_note"


@dataclass(frozen=True)
class FiscalDocumentRequest:
    tenant_id: str
    booking_id: str
    document_type: DocumentType
    amount_eur: float
    vat_rate: float
    customer_country: str
    line_items: list[dict[str, Any]]
    idempotency_key: str


@dataclass(frozen=True)
class FiscalDocumentResult:
    mark: str
    uid: str
    transmitted_at: str
    idempotency_key: str


class SecretsProvider(Protocol):
    async def get_tenant_aade_credentials(self, tenant_id: str) -> dict[str, str]: ...


class VaultSecretsProvider:
    """Production: HashiCorp Vault / AWS Secrets Manager."""

    async def get_tenant_aade_credentials(self, tenant_id: str) -> dict[str, str]:
        raise NotImplementedError(f"Wire Vault for tenant {tenant_id}")


class DevSecretsProvider:
    async def get_tenant_aade_credentials(self, tenant_id: str) -> dict[str, str]:
        return {
            "vat_number": "000000000",
            "aade_user_id": "dev",
            "aade_subscription_key": "dev-key",
            "certificate_ref": f"dev/tenants/{tenant_id}/aade.p12",
        }


class EnvSecretsProvider:
    """Staging / single-tenant: credentials from environment variables."""

    async def get_tenant_aade_credentials(self, tenant_id: str) -> dict[str, str]:
        import os

        prefix = f"AADE_{tenant_id.replace('-', '_').upper()}_"
        vat = os.getenv(f"{prefix}VAT") or os.getenv("AADE_VAT_NUMBER", "000000000")
        user_id = os.getenv(f"{prefix}USER_ID") or os.getenv("AADE_USER_ID", "dev")
        sub_key = os.getenv(f"{prefix}SUBSCRIPTION_KEY") or os.getenv("AADE_SUBSCRIPTION_KEY", "dev-key")
        cert = os.getenv(f"{prefix}CERT_PATH") or os.getenv("AADE_CERT_PATH", f"dev/tenants/{tenant_id}/aade.p12")
        return {
            "vat_number": vat,
            "aade_user_id": user_id,
            "aade_subscription_key": sub_key,
            "certificate_ref": cert,
        }


class AadeXmlSigner(Protocol):
    def sign_payload(self, xml_bytes: bytes, certificate_ref: str) -> bytes: ...


class StubAadeXmlSigner:
    def sign_payload(self, xml_bytes: bytes, certificate_ref: str) -> bytes:
        return xml_bytes


class Pkcs12AadeXmlSigner:
    """Load .p12 and attach RSA-SHA256 signature envelope (staging/production)."""

    def sign_payload(self, xml_bytes: bytes, certificate_ref: str) -> bytes:
        import base64
        import hashlib
        import os
        from pathlib import Path

        cert_path = Path(certificate_ref)
        if not cert_path.is_file():
            logger.warning("AADE certificate missing at %s — transmitting unsigned", certificate_ref)
            return xml_bytes

        try:
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import padding
            from cryptography.hazmat.primitives.serialization import pkcs12
        except ImportError as exc:
            raise AadeTransmissionError("cryptography package required for AADE signing") from exc

        password = os.getenv("AADE_CERT_PASSWORD", get_settings().aade_cert_password or "")
        key, cert, _additional = pkcs12.load_key_and_certificates(
            cert_path.read_bytes(),
            password.encode() if password else None,
        )
        if key is None:
            raise AadeTransmissionError(f"No private key in certificate {certificate_ref}")

        digest = hashlib.sha256(xml_bytes).digest()
        signature = key.sign(digest, padding.PKCS1v15(), hashes.SHA256())
        cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode("ascii") if cert else ""
        signed = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f"<SignedPayload><Document>{xml_bytes.decode('utf-8')}</Document>"
            f"<SignatureAlgorithm>RSA-SHA256</SignatureAlgorithm>"
            f"<SignatureValue>{base64.b64encode(signature).decode('ascii')}</SignatureValue>"
            f"<X509Certificate>{cert_pem}</X509Certificate></SignedPayload>"
        )
        return signed.encode("utf-8")


class AadeHttpClient(Protocol):
    async def transmit(self, signed_xml: bytes, credentials: dict[str, str]) -> dict[str, Any]: ...


class StubAadeHttpClient:
    async def transmit(self, signed_xml: bytes, credentials: dict[str, str]) -> dict[str, Any]:
        logger.info("AADE transmit stub vat=%s bytes=%d", credentials.get("vat_number"), len(signed_xml))
        return {"mark": f"MARK-STUB-{credentials['vat_number'][:4]}", "uid": "uid-stub"}


class MyDataHttpClient:
    """Production HTTP client — subscription key + optional mTLS from PKCS#12."""

    async def transmit(self, signed_xml: bytes, credentials: dict[str, str]) -> dict[str, Any]:
        import os
        import ssl
        import tempfile
        from datetime import datetime, timezone
        from pathlib import Path

        import httpx
        from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, pkcs12

        settings = get_settings()
        url = os.getenv("AADE_API_URL", settings.aade_api_url)
        headers = {
            "Content-Type": "application/xml",
            "Ocp-Apim-Subscription-Key": credentials.get("aade_subscription_key", ""),
        }

        ssl_context = None
        cert_ref = credentials.get("certificate_ref", "")
        cert_path = Path(cert_ref)
        if cert_path.is_file():
            password = os.getenv("AADE_CERT_PASSWORD", settings.aade_cert_password or "")
            key, cert, _chain = pkcs12.load_key_and_certificates(
                cert_path.read_bytes(),
                password.encode() if password else None,
            )
            if key and cert:
                with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".pem") as cert_file:
                    cert_file.write(cert.public_bytes(Encoding.PEM))
                    cert_tmp = cert_file.name
                with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".pem") as key_file:
                    key_file.write(
                        key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()),
                    )
                    key_tmp = key_file.name
                ssl_context = ssl.create_default_context()
                ssl_context.load_cert_chain(certfile=cert_tmp, keyfile=key_tmp)

        async with httpx.AsyncClient(timeout=45.0, verify=ssl_context or True) as client:
            response = await client.post(url, content=signed_xml, headers=headers)
            response.raise_for_status()
            body = response.text
            mark = _extract_xml_tag(body, "mark") or _extract_xml_tag(body, "invoiceMark")
            uid = _extract_xml_tag(body, "uid") or _extract_xml_tag(body, "invoiceUid") or ""
            if not mark:
                raise AadeTransmissionError(f"AADE response missing MARK: {body[:500]}")
            return {
                "mark": mark,
                "uid": uid,
                "transmitted_at": datetime.now(timezone.utc).isoformat(),
            }


def _extract_xml_tag(xml_text: str, tag: str) -> str | None:
    import re

    match = re.search(rf"<{tag}>([^<]+)</{tag}>", xml_text, re.IGNORECASE)
    return match.group(1).strip() if match else None


class AadeGateway:
    """
    Single entry point for fiscal transmission. Workers call this; HTTP handlers enqueue only.
    """

    def __init__(
        self,
        secrets: SecretsProvider | None = None,
        signer: AadeXmlSigner | None = None,
        client: AadeHttpClient | None = None,
    ):
        self._secrets = secrets or DevSecretsProvider()
        self._signer = signer or StubAadeXmlSigner()
        self._client = client or StubAadeHttpClient()
        self._idempotency_cache: dict[str, FiscalDocumentResult] = {}

    async def transmit(self, req: FiscalDocumentRequest) -> FiscalDocumentResult:
        if req.idempotency_key in self._idempotency_cache:
            return self._idempotency_cache[req.idempotency_key]

        creds = await self._secrets.get_tenant_aade_credentials(req.tenant_id)
        xml = self._build_mydata_xml(req, creds)
        signed = self._signer.sign_payload(xml.encode("utf-8"), creds["certificate_ref"])

        try:
            response = await self._client.transmit(signed, creds)
        except Exception as e:
            raise AadeTransmissionError(f"AADE API failure: {e}") from e

        if "mark" not in response:
            raise AadeTransmissionError("AADE response missing MARK")

        result = FiscalDocumentResult(
            mark=response["mark"],
            uid=response.get("uid", ""),
            transmitted_at=response.get("transmitted_at", ""),
            idempotency_key=req.idempotency_key,
        )
        self._idempotency_cache[req.idempotency_key] = result
        return result

    def _build_mydata_xml(self, req: FiscalDocumentRequest, creds: dict[str, str]) -> str:
        """Minimal placeholder — replace with official myDATA XML builder."""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <issuerVat>{creds['vat_number']}</issuerVat>
  <bookingId>{req.booking_id}</bookingId>
  <amount>{req.amount_eur:.2f}</amount>
  <type>{req.document_type.value}</type>
</Invoice>"""


def build_aade_gateway() -> AadeGateway:
    """Factory — picks secrets/signer/client from environment."""
    import os

    settings = get_settings()
    backend = os.getenv("AADE_SECRETS_BACKEND", "dev").strip().lower()
    mode = os.getenv("AADE_MODE", settings.aade_mode or "stub").strip().lower()

    if backend in ("vault", "aws"):
        secrets: SecretsProvider = VaultSecretsProvider()
    elif backend in ("env", "environment"):
        secrets = EnvSecretsProvider()
    else:
        secrets = DevSecretsProvider()

    if mode in ("production", "prod", "live"):
        return AadeGateway(
            secrets=secrets,
            signer=Pkcs12AadeXmlSigner(),
            client=MyDataHttpClient(),
        )
    if mode in ("signed", "staging"):
        return AadeGateway(secrets=secrets, signer=Pkcs12AadeXmlSigner())
    return AadeGateway(secrets=secrets)
