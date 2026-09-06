"""Unit tests for hybrid trip yield calculator & segment helpers."""

from __future__ import annotations

import unittest

from travel_platform.operations.hybrid_trip import HybridTripService, SEGMENT_TYPES


class HybridYieldTests(unittest.TestCase):
    def test_segment_types_cover_hybrid_blocks(self):
        self.assertIn("flight", SEGMENT_TYPES)
        self.assertIn("hotel_transfer", SEGMENT_TYPES)
        self.assertIn("van", SEGMENT_TYPES)

    def test_yield_recommends_price_with_margin(self):
        result = HybridTripService.calculate_yield(
            flights=[{"total_cost": 1000, "currency": "EUR"}],
            segments=[{"ground_cost": 200, "currency": "EUR"}],
            passenger_count=10,
            target_margin_pct=20,
            display_currency="EUR",
        )
        self.assertEqual(result["total_cost"], 1200.0)
        self.assertEqual(result["target_revenue"], 1440.0)
        self.assertEqual(result["recommended_price_per_person"], 144.0)

    def test_multi_currency_conversion_to_display(self):
        result = HybridTripService.calculate_yield(
            flights=[{"total_cost": 100, "currency": "USD"}],  # ~92 EUR
            segments=[{"ground_cost": 0, "currency": "EUR"}],
            passenger_count=1,
            target_margin_pct=0,
            display_currency="EUR",
            fx_rates_to_eur={"USD": 0.92, "EUR": 1.0},
        )
        self.assertAlmostEqual(result["flight_cost"], 92.0, places=2)
        self.assertAlmostEqual(result["recommended_price_per_person"], 92.0, places=2)

    def test_yield_scenarios_scale_with_margin(self):
        base = HybridTripService.calculate_yield(
            flights=[{"total_cost": 500, "currency": "EUR"}],
            segments=[{"ground_cost": 100, "currency": "EUR"}],
            passenger_count=10,
            target_margin_pct=0,
            display_currency="EUR",
        )
        high = HybridTripService.calculate_yield(
            flights=[{"total_cost": 500, "currency": "EUR"}],
            segments=[{"ground_cost": 100, "currency": "EUR"}],
            passenger_count=10,
            target_margin_pct=35,
            display_currency="EUR",
        )
        self.assertEqual(base["total_cost"], 600.0)
        self.assertEqual(base["recommended_price_per_person"], 60.0)
        self.assertEqual(high["recommended_price_per_person"], 81.0)


class HybridNotifyDispatchImportTests(unittest.TestCase):
    def test_dispatcher_exports_whatsapp_and_delay_alerts(self):
        from travel_platform.notifications import dispatcher

        self.assertTrue(callable(dispatcher.send_sms))
        self.assertTrue(callable(dispatcher.send_whatsapp))
        self.assertTrue(callable(dispatcher.dispatch_delay_alerts))


class HybridSchemaHardeningTests(unittest.TestCase):
    def test_replace_request_schemas_exist(self):
        from schemas.platform.hybrid import (
            HybridMetaUpsertRequest,
            LuggageReplaceRequest,
            PassengerSeatsReplaceRequest,
        )

        seats = PassengerSeatsReplaceRequest(
            seats=[{"passenger_name": "Νίκος", "flight_id": None}]
        )
        self.assertEqual(len(seats.seats), 1)
        self.assertIsNone(seats.seats[0].flight_id)

        luggage = LuggageReplaceRequest(
            items=[{"passenger_name": "Μαρία", "luggage_count": 2}]
        )
        self.assertEqual(luggage.items[0].luggage_count, 2)

        meta = HybridMetaUpsertRequest(
            rooming_list=[{"room": "101"}],
            crew={"tourLeader": "Άννα"},
            target_margin_pct=30,
        )
        self.assertEqual(meta.crew["tourLeader"], "Άννα")
        self.assertEqual(meta.target_margin_pct, 30)

    def test_hybrid_trip_response_includes_meta(self):
        from schemas.platform.hybrid import HybridTripResponse

        resp = HybridTripResponse(trip_id=1, meta={"currency": "EUR"})
        self.assertEqual(resp.meta["currency"], "EUR")


class HybridProviderEnvTests(unittest.TestCase):
    def test_provider_status_stub_without_keys(self):
        import os
        import tempfile
        from pathlib import Path

        from core.config import get_platform_settings, hybrid_provider_status
        from travel_platform.integrations import secrets_store

        get_platform_settings.cache_clear()
        for key in (
            "AVIATIONSTACK_API_KEY",
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM_NUMBER",
            "TWILIO_WHATSAPP_FROM",
        ):
            os.environ.pop(key, None)
        get_platform_settings.cache_clear()

        with tempfile.TemporaryDirectory() as tmp:
            secrets_store.STORE_PATH = Path(tmp) / "integrations_secrets.json"
            secrets_store.clear_cache()
            status = hybrid_provider_status()
            self.assertEqual(status["aviationstack"]["mode"], "stub")
            self.assertEqual(status["twilio_sms"]["mode"], "stub")
            self.assertEqual(status["twilio_whatsapp"]["mode"], "stub")

    def test_provider_status_live_when_env_set(self):
        import os
        import tempfile
        from pathlib import Path

        from core.config import get_platform_settings, hybrid_provider_status
        from travel_platform.integrations import secrets_store

        os.environ["AVIATIONSTACK_API_KEY"] = "test-key"
        os.environ["TWILIO_ACCOUNT_SID"] = "ACtest"
        os.environ["TWILIO_AUTH_TOKEN"] = "token"
        os.environ["TWILIO_FROM_NUMBER"] = "+12025550123"
        os.environ["TWILIO_WHATSAPP_FROM"] = "whatsapp:+14155238886"
        get_platform_settings.cache_clear()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                secrets_store.STORE_PATH = Path(tmp) / "integrations_secrets.json"
                secrets_store.clear_cache()
                status = hybrid_provider_status()
                self.assertEqual(status["aviationstack"]["mode"], "live")
                self.assertEqual(status["twilio_sms"]["mode"], "live")
                self.assertEqual(status["twilio_whatsapp"]["mode"], "live")
        finally:
            for key in (
                "AVIATIONSTACK_API_KEY",
                "TWILIO_ACCOUNT_SID",
                "TWILIO_AUTH_TOKEN",
                "TWILIO_FROM_NUMBER",
                "TWILIO_WHATSAPP_FROM",
            ):
                os.environ.pop(key, None)
            get_platform_settings.cache_clear()

    def test_ui_store_overrides_and_masks(self):
        import os
        import tempfile
        from pathlib import Path

        from travel_platform.integrations import secrets_store

        for key in ("AVIATIONSTACK_API_KEY",):
            os.environ.pop(key, None)

        with tempfile.TemporaryDirectory() as tmp:
            secrets_store.STORE_PATH = Path(tmp) / "integrations_secrets.json"
            secrets_store.clear_cache()
            secrets_store.save_secrets({"aviationstack_api_key": "ui-secret-key"})
            status = secrets_store.public_status()
            self.assertEqual(status["aviationstack"]["mode"], "live")
            self.assertEqual(status["aviationstack"]["source"], "ui")
            self.assertEqual(secrets_store.effective_secrets()["aviationstack_api_key"], "ui-secret-key")
            # Disk must not contain plaintext
            raw = secrets_store.STORE_PATH.read_text(encoding="utf-8")
            self.assertNotIn("ui-secret-key", raw)
            self.assertIn("enc:", raw)


class HybridSlaLogicTests(unittest.TestCase):
    def test_whatsapp_template_render_shape(self):
        # Frontend templates are mirrored in dispatcher — ensure delay template keys exist.
        from travel_platform.notifications.dispatcher import dispatch_delay_alerts
        import inspect

        sig = inspect.signature(dispatch_delay_alerts)
        self.assertIn("template_id", sig.parameters)
        self.assertIn("pickup_time", sig.parameters)


if __name__ == "__main__":
    unittest.main()
