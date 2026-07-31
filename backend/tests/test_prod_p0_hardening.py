"""P0 production hardening — boot guard, rent payment, demo fleet gate."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from travel_platform.rental import rental_store as store


class ProductionGuardTests(unittest.TestCase):
    def test_non_production_allows_weak_secrets(self):
        from app.core.production_guard import collect_production_boot_errors

        errs = collect_production_boot_errors(
            environ={"ENVIRONMENT": "development", "AUTH_JWT_SECRET": "dev-jwt"}
        )
        self.assertEqual(errs, [])

    def test_production_refuses_weak_jwt_and_dev_gps(self):
        from app.core.production_guard import (
            assert_production_safe_or_raise,
            collect_production_boot_errors,
        )

        env = {
            "ENVIRONMENT": "production",
            "AUTH_JWT_SECRET": "dev-jwt-secret-change-in-prod",
            "TICKET_JWT_SECRET": "change-me-min-32-chars-ticket",
            "TELEMETRY_DEVICE_KEYS": "dev-gps-key",
            "DATABASE_URL": "postgresql+asyncpg://u:securepassword@db/x",
            "ADMIN_AUTH_DISABLED": "1",
            "RENT_DEMO_FLEET": "true",
            "EMAIL_ENCRYPTION_KEY": "aerostride-dev-email-key-change-in-production",
        }
        errs = collect_production_boot_errors(environ=env)
        self.assertTrue(any("AUTH_JWT_SECRET" in e for e in errs))
        self.assertTrue(any("TICKET_JWT_SECRET" in e for e in errs))
        self.assertTrue(any("TELEMETRY_DEVICE_KEYS" in e for e in errs))
        self.assertTrue(any("ADMIN_AUTH_DISABLED" in e for e in errs))
        self.assertTrue(any("RENT_DEMO_FLEET" in e for e in errs))
        self.assertTrue(any("DATABASE_URL" in e for e in errs))
        self.assertTrue(any("EMAIL_ENCRYPTION_KEY" in e for e in errs))
        with self.assertRaises(RuntimeError):
            assert_production_safe_or_raise(environ=env)

    def test_production_accepts_strong_secrets(self):
        from app.core.production_guard import collect_production_boot_errors

        env = {
            "ENVIRONMENT": "production",
            "AUTH_JWT_SECRET": "x" * 40,
            "TICKET_JWT_SECRET": "y" * 40,
            "TELEMETRY_DEVICE_KEYS": "prod-device-key-abc123",
            "DATABASE_URL": "postgresql+asyncpg://u:real-strong-pass@db/x",
            "ADMIN_AUTH_DISABLED": "0",
            "RENT_DEMO_FLEET": "false",
            "EMAIL_ENCRYPTION_KEY": "email-enc-key-" + ("z" * 24),
        }
        self.assertEqual(collect_production_boot_errors(environ=env), [])


class DemoFleetGateTests(unittest.TestCase):
    def test_production_skips_demo_seed(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "rental_store.json"
            with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(
                store, "DATA_DIR", Path(tmp)
            ), mock.patch.dict(
                os.environ,
                {"ENVIRONMENT": "production", "RENT_DEMO_FLEET": ""},
                clear=False,
            ):
                tid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
                self.assertEqual(store.ensure_demo_rental_fleet(tid), 0)
                self.assertEqual(store.public_catalog(tid), [])

    def test_explicit_flag_allows_seed_even_in_prod_env_for_tests(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "rental_store.json"
            with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(
                store, "DATA_DIR", Path(tmp)
            ), mock.patch.dict(
                os.environ,
                {"ENVIRONMENT": "development", "RENT_DEMO_FLEET": "true"},
                clear=False,
            ):
                tid = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
                self.assertEqual(store.ensure_demo_rental_fleet(tid), 6)


class RentPaymentTrustTests(unittest.TestCase):
    def _seed_vehicle(self, tid: str, plate: str = "P0-TEST-01") -> str:
        row = store.upsert_vehicle(
            tid,
            {
                "plate_number": plate,
                "category": "ECONOMY",
                "model": "Test Car",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
                "current_status": "AVAILABLE",
            },
        )
        return row["id"]

    def test_client_paid_without_provider_stays_pending(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "rental_store.json"
            with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(
                store, "DATA_DIR", Path(tmp)
            ), mock.patch.dict(os.environ, {"RENT_DEMO_FLEET": "false"}, clear=False):
                tid = "cccccccc-dddd-eeee-ffff-000000000001"
                vid = self._seed_vehicle(tid)
                start = datetime.now(timezone.utc) + timedelta(days=1)
                end = start + timedelta(days=2)
                booking = store.create_booking(
                    tid,
                    {
                        "vehicle_id": vid,
                        "client_name": "Test",
                        "client_email": "t@example.com",
                        "start_time": start.isoformat(),
                        "end_time": end.isoformat(),
                        "pickup_location": "Office",
                        "dropoff_location": "Office",
                        "payment_method": "card",
                        "payment_status": "PAID",
                        "amount_paid": 80,
                        "balance_due": 0,
                        "card_last4": "4242",
                    },
                )
                self.assertEqual(booking["payment_status"], "PENDING")
                self.assertEqual(booking["rental_status"], "RESERVED")
                self.assertEqual(booking["amount_paid"], 0.0)
                self.assertGreater(booking["balance_due"], 0)
                self.assertIsNone(booking.get("provider_payment_id"))

    def test_provider_ref_marks_paid(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "rental_store.json"
            with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(
                store, "DATA_DIR", Path(tmp)
            ), mock.patch.dict(os.environ, {"RENT_DEMO_FLEET": "false"}, clear=False):
                tid = "dddddddd-eeee-ffff-0000-111111111111"
                vid = self._seed_vehicle(tid)
                start = datetime.now(timezone.utc) + timedelta(days=1)
                end = start + timedelta(days=2)
                # Client-forged Stripe id alone must NOT mark PAID
                forged = store.create_booking(
                    tid,
                    {
                        "vehicle_id": vid,
                        "client_name": "Test",
                        "client_email": "t@example.com",
                        "start_time": start.isoformat(),
                        "end_time": end.isoformat(),
                        "pickup_location": "Office",
                        "dropoff_location": "Office",
                        "payment_method": "card",
                        "stripe_payment_intent": "pi_forged_abc",
                    },
                )
                self.assertEqual(forged["payment_status"], "PENDING")
                self.assertEqual(forged["rental_status"], "RESERVED")

                vid2 = self._seed_vehicle(tid, plate="P0-TEST-02")
                # Only server-verified flag + provider ref confirms settlement
                booking = store.create_booking(
                    tid,
                    {
                        "vehicle_id": vid2,
                        "client_name": "Test2",
                        "client_email": "t2@example.com",
                        "start_time": (start + timedelta(days=10)).isoformat(),
                        "end_time": (end + timedelta(days=10)).isoformat(),
                        "pickup_location": "Office",
                        "dropoff_location": "Office",
                        "payment_method": "card",
                        "payment_status": "PENDING",
                        "stripe_payment_intent": "pi_live_abc",
                        "_server_verified_payment": True,
                    },
                )
                self.assertEqual(booking["payment_status"], "PAID")
                self.assertEqual(booking["rental_status"], "CONFIRMED")
                self.assertEqual(booking.get("provider_payment_id"), "pi_live_abc")


class TelemetryDeviceKeyTests(unittest.TestCase):
    def test_prod_rejects_missing_and_dev_keys(self):
        from fastapi import HTTPException

        from api.telemetry_router import verify_device_key

        with mock.patch.dict(
            os.environ,
            {"ENVIRONMENT": "production", "TELEMETRY_DEVICE_KEYS": ""},
            clear=False,
        ):
            with self.assertRaises(HTTPException) as ctx:
                verify_device_key(x_device_key="dev-gps-key")
            self.assertEqual(ctx.exception.status_code, 401)

        with mock.patch.dict(
            os.environ,
            {"ENVIRONMENT": "production", "TELEMETRY_DEVICE_KEYS": "dev-gps-key"},
            clear=False,
        ):
            with self.assertRaises(HTTPException):
                verify_device_key(x_device_key="dev-gps-key")

        with mock.patch.dict(
            os.environ,
            {"ENVIRONMENT": "production", "TELEMETRY_DEVICE_KEYS": "strong-key-9"},
            clear=False,
        ):
            self.assertEqual(verify_device_key(x_device_key="strong-key-9"), "strong-key-9")


class AdminWsAuthDisabledTests(unittest.TestCase):
    def test_admin_auth_disabled_ignored_in_production(self):
        import jwt as pyjwt

        from api.ws_telemetry import _decode_admin_ws_token

        with mock.patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "ADMIN_AUTH_DISABLED": "1",
                "AUTH_JWT_SECRET": "test-security-jwt-secret-32chars!!",
            },
            clear=False,
        ):
            with self.assertRaises(pyjwt.InvalidTokenError):
                _decode_admin_ws_token(None)


class AdminTenantFailCloseTests(unittest.TestCase):
    def test_request_tenant_id_fail_close_in_production(self):
        from fastapi import HTTPException
        from starlette.requests import Request

        from api.admin_platform import _request_tenant_id

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/x",
            "headers": [],
        }
        request = Request(scope)
        with mock.patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            with self.assertRaises(HTTPException) as ctx:
                _request_tenant_id(request)
            self.assertEqual(ctx.exception.status_code, 401)


class RentalStorePathTests(unittest.TestCase):
    def test_resolve_prefers_data_dir(self):
        with TemporaryDirectory() as tmp:
            data = Path(tmp) / "data"
            data.mkdir()
            target = data / "rental_store.json"
            target.write_text('{"vehicles":[],"bookings":[],"inspections":[]}', encoding="utf-8")
            with mock.patch.dict(os.environ, {"POREIAGO_DATA_DIR": str(data)}, clear=False):
                data_dir, store_file = store.resolve_rental_store_paths()
            self.assertEqual(data_dir, data)
            self.assertEqual(store_file, target)


if __name__ == "__main__":
    unittest.main()
