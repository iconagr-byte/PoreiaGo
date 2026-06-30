"""Επαλήθευση ροών πληρωμών & QR για πελάτες."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import unittest
import uuid

from fastapi.testclient import TestClient

from ticketing.bt1_token import verify_bt1_token
from ticketing.qr_rotating import issue_rotating_jwt, verify_rotating_jwt
from travel_platform.payments.bank_deposit_confirm import (
    build_confirm_patch,
    validate_confirm_request,
)
from travel_platform.payments.payment_security import (
    amounts_match,
    is_pending_bank_transfer_booking,
    references_match,
    validate_iban_checksum,
)


def _issue_bt1(bid: str = "B-1029", trip_id: int = 1, seat: str = "12A") -> str:
    secret = os.getenv(
        "TICKET_SIGNING_SECRET",
        "dev-only-aerostride-ticket-secret-change-in-production",
    ).encode()
    payload = {
        "v": 1,
        "bid": bid,
        "tripId": trip_id,
        "seat": seat,
        "exp": int(time.time()) + 3600,
        "nonce": uuid.uuid4().hex[:12],
    }
    message = "|".join(
        str(payload[k]) for k in ("v", "bid", "tripId", "seat", "exp", "nonce")
    )
    sig = hmac.new(secret, message.encode(), hashlib.sha256).digest()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"bt1.{payload_b64}.{sig_b64}"


class PaymentSecurityTests(unittest.TestCase):
    def test_valid_greek_iban(self):
        self.assertTrue(validate_iban_checksum("GR1601101250000000012300695"))

    def test_invalid_iban(self):
        self.assertFalse(validate_iban_checksum("GR00INVALID"))

    def test_pending_bank_booking(self):
        booking = {"status": "Εκκρεμής", "paymentMethod": "Τραπεζική μεταφορά"}
        self.assertTrue(is_pending_bank_transfer_booking(booking))

    def test_confirmed_not_pending(self):
        booking = {"status": "Επιβεβαιωμένη", "paymentStatus": "PAID"}
        self.assertFalse(is_pending_bank_transfer_booking(booking))

    def test_reference_matches_pnr(self):
        booking = {"pnr": "VOY-ABC123", "id": "B-1029"}
        self.assertTrue(references_match(booking, "VOY-ABC123"))
        self.assertTrue(references_match(booking, "B-1029"))

    def test_amount_tolerance(self):
        self.assertTrue(amounts_match(100.0, 100.01))
        self.assertFalse(amounts_match(100.0, 101.0))


class BankDepositConfirmTests(unittest.TestCase):
    def test_validate_and_patch_full(self):
        booking = {
            "status": "Εκκρεμής",
            "paymentMethod": "Τραπεζική μεταφορά",
            "price": 120.0,
            "balanceDue": 120.0,
            "pnr": "VOY-TEST1",
            "paymentPlan": "full",
        }
        validate_confirm_request(
            booking,
            {"confirmed_amount": 120.0, "reference_code": "VOY-TEST1"},
        )
        patch = build_confirm_patch(booking)
        self.assertEqual(patch["status"], "Επιβεβαιωμένη")
        self.assertTrue(patch["boardingPassIssued"])
        self.assertEqual(patch["balanceDue"], 0.0)

    def test_validate_deposit_plan(self):
        booking = {
            "status": "Εκκρεμής",
            "paymentMethod": "Τραπεζική μεταφορά",
            "price": 200.0,
            "balanceDue": 60.0,
            "depositPercent": 30,
            "paymentPlan": "deposit",
            "pnr": "VOY-DEP",
        }
        validate_confirm_request(
            booking,
            {"confirmed_amount": 60.0, "reference_code": "VOY-DEP"},
        )
        patch = build_confirm_patch(booking)
        self.assertEqual(patch["amountPaid"], 60.0)
        self.assertEqual(patch["balanceDue"], 140.0)

    def test_rejects_wrong_amount(self):
        booking = {
            "status": "Εκκρεμής",
            "paymentMethod": "Τραπεζική μεταφορά",
            "price": 50.0,
            "balanceDue": 50.0,
            "pnr": "X",
        }
        with self.assertRaises(ValueError):
            validate_confirm_request(
                booking,
                {"confirmed_amount": 10.0, "reference_code": "X"},
            )


class QrTokenTests(unittest.TestCase):
    def test_bt1_roundtrip(self):
        token = _issue_bt1()
        payload, err = verify_bt1_token(token)
        self.assertIsNone(err)
        self.assertEqual(payload["bid"], "B-1029")

    def test_bt1_rejects_tamper(self):
        token = _issue_bt1()
        bad = token[:-4] + "XXXX"
        payload, err = verify_bt1_token(bad)
        self.assertIsNone(payload)
        self.assertIsNotNone(err)

    def test_rotating_jwt_roundtrip(self):
        issued = issue_rotating_jwt("ref-abc", 42)
        payload, err = verify_rotating_jwt(issued["token"])
        self.assertIsNone(err)
        self.assertEqual(payload["ref"], "ref-abc")
        self.assertEqual(payload["tid"], 42)


class CustomerApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from wallet_main import app

        cls.client = TestClient(app)

    def test_payment_settings_public(self):
        r = self.client.get("/api/site/payment-settings")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("methods", data)
        self.assertIn("bank_accounts", data)

    def test_email_spam_check(self):
        r = self.client.get("/api/site/email-spam-check", params={"email": "test@gmail.com"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json().get("allowed"))

    def test_payment_notification_endpoint(self):
        booking = {
            "id": "B-TEST",
            "pnr": "VOY-TEST",
            "email": "test@gmail.com",
            "customerName": "Test User",
            "price": 99.0,
            "paymentStatus": "PAID (Card)",
            "status": "Επιβεβαιωμένη",
        }
        r = self.client.post(
            "/api/notifications/payment-confirmation",
            json={"booking": booking, "event": "online_paid_full"},
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("customer", body)


if __name__ == "__main__":
    unittest.main()
