"""Office boarding notify — SaaS sync + fleet boarding push after bus check-in."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from travel_platform.driver.office_boarding_notify import (
    _compact_boarding,
    notify_office_after_boarding,
    schedule_office_boarding_notify,
)


class CompactBoardingTests(unittest.TestCase):
    def test_compact_boarding_counts(self):
        out = _compact_boarding(
            {
                "boarded_count": 2,
                "capacity": 50,
                "progress_label": "2/50",
                "progress_percent": 4,
                "boarded_passengers": [
                    {
                        "booking_id": "b1",
                        "passenger_name": "Nikos",
                        "seat_number": "12",
                        "boarded_at": "2026-07-22T10:00:00Z",
                    },
                    {
                        "booking_id": "b2",
                        "customer_name": "Maria",
                        "seat": "13",
                    },
                ],
            },
        )
        self.assertEqual(out["boarded_count"], 2)
        self.assertEqual(out["capacity"], 50)
        self.assertEqual(len(out["boarded_passengers"]), 2)
        self.assertEqual(out["boarded_passengers"][1]["passenger_name"], "Maria")
        self.assertEqual(out["boarded_passengers"][1]["seat_number"], "13")


class NotifyOfficeTests(unittest.IsolatedAsyncioTestCase):
    async def test_notify_publishes_boarding_update(self):
        booking = {
            "id": "local-1",
            "saas_booking_id": None,
            "customer_name": "Nikos",
            "seat_number": "7",
            "boarded_at": "2026-07-22T10:00:00Z",
        }
        manifest = {
            "trip_id": 42,
            "boarded_count": 1,
            "capacity": 50,
            "progress_label": "1/50",
            "progress_percent": 2,
            "boarded_passengers": [
                {
                    "booking_id": "local-1",
                    "passenger_name": "Nikos",
                    "seat_number": "7",
                    "boarded_at": "2026-07-22T10:00:00Z",
                },
            ],
        }
        hub = MagicMock()
        hub.broadcast = AsyncMock()

        with (
            patch(
                "travel_platform.driver.office_boarding_notify.mark_saas_booking_boarded",
                new=AsyncMock(return_value="tenant-abc"),
            ),
            patch(
                "ticketing.boarding_service.get_boarding_manifest",
                new=AsyncMock(return_value=manifest),
            ),
            patch(
                "travel_platform.driver.office_boarding_notify._attach_boarding_to_live_vehicles",
                new=AsyncMock(return_value=["veh-1"]),
            ),
            patch(
                "travel_platform.telemetry.fleet_pubsub.publish_fleet_location",
                new=AsyncMock(return_value=True),
            ) as publish,
            patch(
                "travel_platform.telemetry.fleet_ws_hub.get_fleet_egress_hub",
                return_value=hub,
            ),
            patch(
                "travel_platform.driver.boarding_ws_hub.broadcast_boarding_update",
                new=AsyncMock(return_value=1),
            ),
        ):
            result = await notify_office_after_boarding(booking, 42)

        self.assertTrue(result["ok"])
        self.assertEqual(result["tenant_id"], "tenant-abc")
        publish.assert_awaited()
        payload = publish.await_args.args[1]
        self.assertEqual(payload["type"], "boarding_update")
        self.assertEqual(payload["trip_id"], 42)
        self.assertEqual(payload["boarding"]["boarded_count"], 1)
        hub.broadcast.assert_awaited()

    def test_schedule_noop_without_loop(self):
        # Should not raise when called outside a running event loop.
        schedule_office_boarding_notify({"id": "x"}, 1)


if __name__ == "__main__":
    unittest.main()
