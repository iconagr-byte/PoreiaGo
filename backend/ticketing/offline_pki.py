"""
Offline verification (PKI): manifest signed with Ed25519 private key.
Driver app embeds public key only — verifies JWT + manifest signature without DB.
"""

import base64
import json
import time
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

from .config import settings
from .boarding_service import get_boarding_manifest
from .qr_rotating import issue_rotating_jwt


def _ensure_keypair() -> tuple[Ed25519PrivateKey, bytes]:
    priv_path = Path(settings.pki_private_key_path)
    pub_path = Path(settings.pki_public_key_path)
    priv_path.parent.mkdir(parents=True, exist_ok=True)

    if priv_path.exists() and pub_path.exists():
        priv = serialization.load_pem_private_key(priv_path.read_bytes(), password=None)
        pub = pub_path.read_bytes()
        return priv, pub

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    priv_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    pub_path.write_bytes(
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return private_key, pub_path.read_bytes()


def sign_manifest_payload(payload: dict) -> str:
    private_key, _ = _ensure_keypair()
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    sig = private_key.sign(canonical)
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


async def build_offline_manifest(trip_id: int) -> dict:
    manifest = await get_boarding_manifest(trip_id)
    entries = []
    for p in manifest["missing_passengers"] + manifest["boarded_passengers"]:
        booking_id = p["booking_id"]
        from .scan_service import get_booking_by_id

        b = await get_booking_by_id(booking_id)
        if not b:
            continue
        rot = issue_rotating_jwt(b["ticket_ref"], b["trip_id"])
        entries.append(
            {
                "booking_id": booking_id,
                "ticket_ref": b["ticket_ref"],
                "trip_id": trip_id,
                "sample_token": rot["token"],
                "passenger_name": p.get("passenger_name") or b["customer_name"],
                "seat_number": p.get("seat_number") or b["seat_number"],
            }
        )

    payload = {
        "trip_id": trip_id,
        "issued_at": int(time.time()),
        "expires_at": int(time.time()) + 3600 * 8,
        "entries": entries,
    }
    _, pub_pem = _ensure_keypair()
    return {
        "manifest": payload,
        "signature": sign_manifest_payload(payload),
        "public_key_pem": pub_pem.decode(),
        "verification_note": "Verify Ed25519 signature locally; validate rotating JWT ref+step without DB.",
    }
