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
