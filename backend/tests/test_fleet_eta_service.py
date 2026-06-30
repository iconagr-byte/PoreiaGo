"""Fleet ETA service tests."""

from __future__ import annotations

import asyncio
import unittest
from uuid import UUID

TENANT = UUID("00000000-0000-0000-0000-000000000001")


class FleetEtaServiceTests(unittest.TestCase):
    def test_fetch_fleet_etas_empty_fleet(self):
        async def run() -> None:
            from travel_platform.telemetry.fleet_eta_service import fetch_fleet_etas

            result = await fetch_fleet_etas(TENANT)
            self.assertEqual(result["tenant_id"], str(TENANT))
            self.assertIn("items", result)
            self.assertIsInstance(result["items"], list)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
