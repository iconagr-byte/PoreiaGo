"""NEW_BOOKING alerts must serialize without a vehicle_id."""

from __future__ import annotations

import unittest

from schemas.telemetry import TelemetryAlertResponse
from travel_platform.telemetry.alerts import TelemetryAlertBus


class TelemetryAlertBookingSchemaTests(unittest.TestCase):
    def setUp(self):
        TelemetryAlertBus._recent.clear()
        TelemetryAlertBus._cleared_ids.clear()

    def tearDown(self):
        TelemetryAlertBus._recent.clear()
        TelemetryAlertBus._cleared_ids.clear()

    def test_new_booking_alert_serializes_without_vehicle(self):
        row = TelemetryAlertBus.push_generic(
            alert_type="NEW_BOOKING",
            tenant_id="97798681-2f60-4398-b1f6-9eb38dc341b0",
            message="Μαρία · Μετέωρα · θέσεις 1B · €53.00",
            metadata={"tab": "bookings", "booking_id": "bk-1"},
        )
        self.assertEqual(row["alert_type"], "NEW_BOOKING")
        self.assertIsNone(row.get("vehicle_id"))
        parsed = TelemetryAlertResponse(**row)
        self.assertEqual(parsed.alert_type, "NEW_BOOKING")
        self.assertIsNone(parsed.vehicle_id)
        listed = TelemetryAlertBus.list_recent(row["tenant_id"], limit=5)
        self.assertEqual(len(listed), 1)
        # Endpoint builds a list of responses — must not raise.
        responses = [TelemetryAlertResponse(**r) for r in listed]
        self.assertEqual(responses[0].message, row["message"])


if __name__ == "__main__":
    unittest.main()
