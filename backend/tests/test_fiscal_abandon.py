"""Contract: abandon stuck fiscal invoices + celery compose wiring."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class FiscalAbandonContractTests(unittest.TestCase):
    def test_abandon_service_and_route(self):
        svc = (ROOT / "backend" / "app" / "services" / "fiscal_retry_service.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("async def abandon_invoice", svc)
        self.assertIn('"abandoned"', svc)

        router = (ROOT / "backend" / "api" / "admin_bookings_router.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("/api/admin/platform/fiscal-invoices/{invoice_id}/abandon", router)

    def test_health_excludes_abandoned(self):
        health = (
            ROOT / "backend" / "app" / "services" / "platform_health_service.py"
        ).read_text(encoding="utf-8")
        self.assertIn('contains({"abandoned": True})', health)

    def test_prod_celery_uses_workers_module_and_beat(self):
        compose = (ROOT / "deploy" / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertIn("celery -A workers.celery_app worker", compose)
        self.assertIn("celery -A workers.celery_app beat", compose)
        self.assertNotIn("celery -A worker.app", compose)


if __name__ == "__main__":
    unittest.main()
