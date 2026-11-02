"""Create-office must not roll back the outer txn when detail counts fail."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ProvisionTenantCreateSafeTests(unittest.TestCase):
    def test_tenant_detail_uses_savepoint_not_full_rollback(self):
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("begin_nested()", src)
        # Counts failure must not call session.rollback() inside _tenant_detail_async.
        tree = ast.parse(src)
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "PlatformAdminService":
                for item in node.body:
                    if isinstance(item, ast.AsyncFunctionDef) and item.name == "_tenant_detail_async":
                        text = ast.get_source_segment(src, item) or ""
                        self.assertIn("begin_nested", text)
                        self.assertNotIn("await self._session.rollback()", text)
                        return
        self.fail("_tenant_detail_async not found")

    def test_create_tenant_endpoint_builds_local_summary(self):
        src = (ROOT / "app/api/platform.py").read_text(encoding="utf-8")
        self.assertIn("Prefer in-memory summary", src)
        self.assertIn("svc._tenant_detail(tenant", src)

    def test_provision_prepares_contabo_schema_and_inserts_name(self):
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("prepare_contabo_tenant_write", src)
        self.assertIn("INSERT INTO tenants", src)
        self.assertIn("tenant_plan_db_token", src)
        self.assertIn("merge(tenant, load=False)", src)
        mods = (ROOT / "app/services/tenant_modules.py").read_text(encoding="utf-8")
        self.assertIn("async def prepare_contabo_tenant_write", mods)
        self.assertIn("detect_tenant_plan_persist_style", mods)

    def test_tenant_plan_db_token_name_vs_value(self):
        from app.models.tenant import TenantPlan
        from app.services.tenant_modules import tenant_plan_db_token

        self.assertEqual(tenant_plan_db_token(TenantPlan.STARTER, "name"), "STARTER")
        self.assertEqual(tenant_plan_db_token(TenantPlan.RENT, "name"), "RENT")
        self.assertEqual(tenant_plan_db_token(TenantPlan.STARTER, "value"), "starter")
        self.assertEqual(tenant_plan_db_token(TenantPlan.RENT, "value"), "rent")


if __name__ == "__main__":
    unittest.main()
