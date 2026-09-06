"""JWT issued for drivers must carry plate/name for GPS ingest fallbacks."""

from __future__ import annotations

import time
import unittest
from unittest.mock import patch

import jwt

from api.driver_portal import _issue_driver_session


class DriverSessionJwtClaimsTests(unittest.TestCase):
    def test_jwt_includes_vehicle_and_driver_name(self):
        with patch("api.driver_portal._jwt_secret", return_value="test-secret-32chars-minimum!!"):
            with patch(
                "api.driver_portal._profile_fields",
                return_value={
                    "driver_name": "Achilleas",
                    "photo_url": None,
                    "vehicle_plate": "XAH-4021",
                    "vehicle_code": "XAH-4021",
                    "vehicle_image_url": None,
                },
            ):
                with patch("api.driver_portal._trip_context", return_value={}):
                    with patch("api.driver_portal._build_daily_schedule", return_value=[]):
                        session = _issue_driver_session(
                            driver_id="drv-1",
                            tenant_id="81ce186d-40fd-4f51-8e62-1353a9e68f33",
                            trip_id=42,
                            trip_source="live_fleet",
                            expires_at=int(time.time()) + 3600,
                        )
        payload = jwt.decode(session.access_token, "test-secret-32chars-minimum!!", algorithms=["HS256"])
        self.assertEqual(payload["vehicle_code"], "XAH-4021")
        self.assertEqual(payload["driver_name"], "Achilleas")
        self.assertEqual(payload["tenant_id"], "81ce186d-40fd-4f51-8e62-1353a9e68f33")
        self.assertEqual(payload["trip_id"], 42)
        self.assertEqual(payload["trip_source"], "live_fleet")


if __name__ == "__main__":
    unittest.main()
