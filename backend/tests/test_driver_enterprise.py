"""Tests for Driver PWA enterprise toolkit."""

from __future__ import annotations

import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from travel_platform.driver.inspection_store import (
    PRE_TRIP_TEMPLATE,
    save_pre_trip_inspection,
)
from travel_platform.driver.expense_store import save_driver_expense_upload


class InspectionStoreTests(unittest.TestCase):
    def test_save_inspection(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            import travel_platform.driver.inspection_store as mod

            mod.DATA_DIR = __import__("pathlib").Path(tmp)
            mod.STORE_PATH = mod.DATA_DIR / "driver_inspections.json"
            items = {i["key"]: "pass" for i in PRE_TRIP_TEMPLATE}
            row = save_pre_trip_inspection(
                trip_id=42,
                driver_id="drv-1",
                tenant_id="00000000-0000-0000-0000-000000000001",
                items=items,
            )
            self.assertEqual(row["status"], "completed")
            self.assertTrue(row["cleared_for_shift"])


class ExpenseStoreTests(unittest.TestCase):
    def test_save_expense(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            import travel_platform.driver.expense_store as mod

            mod.DATA_DIR = __import__("pathlib").Path(tmp)
            mod.UPLOAD_DIR = mod.DATA_DIR / "uploads" / "driver_expenses"
            mod.INDEX_PATH = mod.DATA_DIR / "driver_expenses.json"
            row = save_driver_expense_upload(
                amount=55.5,
                category="fuel",
                trip_id=1,
                driver_id="drv-1",
                tenant_id="t1",
                description="test",
                receipt_bytes=b"fake-image",
                receipt_filename="r.jpg",
                content_type="image/jpeg",
            )
            self.assertEqual(row["category"], "fuel")
            self.assertTrue(row["receipt_path"])


class SosServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_publish_sos(self) -> None:
        os.environ.setdefault("AUTH_JWT_SECRET", "dev-jwt-secret-change-in-prod-32bytes!!")
        from travel_platform.driver.sos_service import publish_driver_sos

        with patch(
            "travel_platform.driver.sos_service.publish_fleet_alert",
            new_callable=AsyncMock,
            return_value=True,
        ):
            result = await publish_driver_sos(
                tenant_id="00000000-0000-0000-0000-000000000001",
                trip_id=7,
                driver_id="drv-1",
                lat=37.98,
                lng=23.73,
            )
        self.assertTrue(result["ok"])
        self.assertTrue(result["alert_id"])

    async def test_publish_sos_does_not_force_offline_or_remove_vehicles(self) -> None:
        """Regression: SOS must never cut the driver live connection / map pin."""
        from travel_platform.driver.sos_service import publish_driver_sos

        with (
            patch(
                "travel_platform.driver.sos_service.publish_fleet_alert",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "travel_platform.telemetry.driver_shift_tracker.force_driver_offline",
            ) as offline,
            patch(
                "travel_platform.telemetry.processor.get_live_fleet",
            ) as live,
        ):
            result = await publish_driver_sos(
                tenant_id="00000000-0000-0000-0000-000000000001",
                trip_id=7,
                driver_id="drv-1",
                lat=37.98,
                lng=23.73,
            )
        self.assertTrue(result["ok"])
        offline.assert_not_called()
        live.assert_not_called()


if __name__ == "__main__":
    unittest.main()
